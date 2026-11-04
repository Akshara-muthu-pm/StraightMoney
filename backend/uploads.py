"""Bounded, content-validated uploads and safe responses for stored evidence."""
from io import BytesIO
import warnings

from fastapi import HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image
import pdfplumber
from starlette.concurrency import run_in_threadpool

from config import settings


def validate_content(data: bytes, *, proof: bool = False) -> tuple[str, str]:
    if not data or len(data) > settings.max_upload_bytes:
        raise HTTPException(413, "File is empty or exceeds the upload size limit.")
    try:
        if data.startswith(b"%PDF-") and not proof:
            with pdfplumber.open(BytesIO(data)) as pdf:
                if not 0 < len(pdf.pages) <= settings.max_pdf_pages:
                    raise ValueError("PDF exceeds the page limit.")
            return "application/pdf", ".pdf"
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.width * image.height > 20_000_000:
                    raise ValueError("Image exceeds the pixel limit.")
                image.verify()
                kind = {"JPEG": ("image/jpeg", ".jpg"), "PNG": ("image/png", ".png"),
                        "WEBP": ("image/webp", ".webp")}.get(image.format)
                if kind:
                    return kind
    except Exception as exc:
        raise HTTPException(415, "Invalid file; upload a valid PDF, JPEG, PNG or WEBP (proof must be an image).") from exc
    raise HTTPException(415, "Unsupported file content.")


async def read_upload(file: UploadFile, *, proof: bool = False) -> tuple[bytes, str, str]:
    data = await file.read(settings.max_upload_bytes + 1)
    mime, extension = await run_in_threadpool(validate_content, data, proof=proof)
    return data, mime, extension


def file_response(data: bytes, mime: str) -> Response:
    return Response(data, media_type=mime, headers={
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Content-Disposition": 'inline; filename="evidence' + {
            "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"
        }[mime] + '"',
        "Cache-Control": "no-store",
    })
