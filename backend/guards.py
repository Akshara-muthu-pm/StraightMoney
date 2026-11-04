"""Small per-process abuse guard for the public Sandbox demo."""
from collections import OrderedDict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request
from config import settings
from starlette.responses import JSONResponse

_requests: OrderedDict[str, deque] = OrderedDict()
_lock = Lock()


def limit_writes(request: Request) -> None:
    # Do not trust caller-supplied forwarding headers.
    key = request.client.host if request.client else "unknown"
    now = monotonic()
    with _lock:
        bucket = _requests.setdefault(key, deque())
        _requests.move_to_end(key)
        while bucket and bucket[0] <= now - 60:
            bucket.popleft()
        if len(bucket) >= settings.write_rate_limit:
            raise HTTPException(429, "Too many requests. Please wait a minute.", headers={"Retry-After": "60"})
        bucket.append(now)
        while len(_requests) > 10000:
            _requests.popitem(last=False)


class UploadSizeLimit:
    """Enforce the total request limit even without Content-Length."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        try:
            limit_writes(Request(scope))
        except HTTPException as exc:
            return await JSONResponse({"detail": exc.detail}, exc.status_code, headers=exc.headers)(scope, receive, send)
        limit = settings.max_upload_bytes * 2 + 65536
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                return await JSONResponse({"detail": "Request exceeds upload limit."}, 413)(scope, receive, send)
            if not message.get("more_body", False):
                break
        consumed = False

        async def buffered_receive():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, buffered_receive, send)
