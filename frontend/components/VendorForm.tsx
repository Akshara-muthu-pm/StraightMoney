"use client";

import { useState, useRef, useEffect, type FormEvent, type DragEvent } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign, Invoice } from "@/lib/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DropzoneProps {
  label: string;
  hint: string;
  accept: string;
  required?: boolean;
  file: File | null;
  onSelect: (file: File | null) => void;
}

function FileDropzone({ label, hint, accept, required = true, file, onSelect }: DropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const selectFile = (next: File | null) => {
    setPreviewUrl(next?.type.startsWith("image/") ? URL.createObjectURL(next) : null);
    onSelect(next);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        <span>{label} {required && <span className="text-rose-500">*</span>}</span>
        {file && (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ Ready
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        required={required && !file}
        onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
            dragOver
              ? "border-[#0070BA] bg-[#E1F0FC]/60 dark:border-[#38bdf8] dark:bg-sky-950/40"
              : "border-slate-300/80 bg-white/60 hover:border-[#0070BA] hover:bg-white/90 dark:border-white/15 dark:bg-slate-900/60 dark:hover:border-sky-500"
          }`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#003087]/10 text-[#003087] transition group-hover:scale-105 group-hover:bg-[#0070BA]/20 dark:bg-sky-500/10 dark:text-[#38bdf8]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="mt-3 text-xs font-bold text-[#001435] dark:text-white">
            <span className="text-[#0070BA] dark:text-[#38bdf8] underline underline-offset-2">Click to upload</span> or drag and drop
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-3.5 shadow-2xs dark:border-emerald-900/60 dark:bg-emerald-950/40">
          {previewUrl ? (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-emerald-300/60 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-emerald-950 dark:text-emerald-100">
              {file.name}
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-700/90 dark:text-emerald-400 font-semibold tabular-nums">
              {formatFileSize(file.size)} &middot; {file.type || "Document"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              selectFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-xl border border-rose-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-50 hover:border-rose-300 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function VendorForm({ campaign, onSubmitted, correction }: { campaign: Campaign; onSubmitted: () => void; correction?: Invoice | null }) {
  const [lineId, setLineId] = useState(String(correction?.budget_line_id ?? campaign.budget_lines[0]?.id ?? ""));
  const [number, setNumber] = useState(correction?.invoice_number ?? "");
  const [correctionNote, setCorrectionNote] = useState("");
  const [invoice, setInvoice] = useState<File | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const ocrStep = elapsedSec >= 6 ? 3 : elapsedSec >= 2 ? 2 : 1;

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [pending]);

  const line = campaign.budget_lines.find((item) => String(item.id) === lineId);

  const blockedReason = campaign.status.toLowerCase() !== "active"
    ? "This campaign is closed or inactive. New invoices are not accepted."
    : !line ? "No budget line is assigned. Ask your organizer to assign one."
    : Math.round((line.budgeted_amount - line.paid_amount) * 100) <= 0
      ? "This budget line is fully paid. No further invoices can be submitted. Delivery closeout remains available above."
      : "";
  const missing = [!number.trim() && "Enter the invoice number.", !invoice && "Attach an invoice (PDF, PNG, JPG or WEBP).", !proof && "Attach a delivery proof photo."].filter(Boolean);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (blockedReason) { setError(blockedReason); return; }
    if (correction && correctionNote.trim().length < 5) { setError("Explain what you corrected (at least 5 characters)."); return; }
    if (!line || !invoice || !proof || !number.trim()) { setError(missing.join(" ")); return; }
    const invalid = [invoice, proof].find((file) => file.size === 0 || file.size > 10 * 1024 * 1024);
    if (invalid) { setError(`${invalid.name}: choose a non-empty file of 10 MB or less.`); return; }
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(invoice.type) || !["image/png", "image/jpeg", "image/webp"].includes(proof.type)) {
      setError("Invoice must be PDF, PNG, JPG or WEBP. Delivery proof must be a PNG, JPG or WEBP photo."); return;
    }
    setElapsedSec(0);
    setPending(true);
    setError("");
    setMessage("");

    const form = new FormData();
    if (correction) { form.append("original_invoice_id", String(correction.id)); form.append("correction_note", correctionNote.trim()); }
    form.append("campaign_id", String(campaign.id));
    form.append("budget_line_id", String(line.id));
    form.append("invoice_number", number.trim());
    if (line.vendor_id !== null) form.append("vendor_id", String(line.vendor_id));
    form.append("invoice_file", invoice);
    form.append("proof_photo", proof);

    try {
      const result = await api.uploadInvoice(form);
      if (["REJECTED", "NEEDS_REVIEW"].includes(result.status)) {
        const reasons = result.checks.filter((check) => !check.passed && check.severity === "hard").map((check) => check.detail);
        setError(`Invoice ${result.invoice_number} was not accepted. ${reasons.join(" ") || result.ai_summary || "Review the invoice details and delivery evidence, then try again."}`);
        return;
      }
      setMessage(
        USE_MOCKS
          ? "Demo submission preview; no files were uploaded."
          : `Invoice ${result.invoice_number} submitted with status ${result.status}.`
      );
      if (!USE_MOCKS) onSubmitted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload invoice.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
      <form noValidate onSubmit={submit} className="liquid-glass p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-sky-400">
              Vendor Invoice Intake
            </p>
          </div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#001435] dark:text-white">
            {correction ? `Correct invoice ${correction.invoice_number}` : "Submit delivery paperwork"}
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Upload your invoice and photo proof. Gemini AI checks OCR fields, policy rules evaluate limits, and human verifiers approve payouts.
          </p>
        </div>

        {blockedReason && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">{blockedReason}</p>}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Budget line assignment
            <select
              disabled={!!correction}
              value={lineId}
              onChange={(event) => { setLineId(event.target.value); setError(""); setMessage(""); }}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm font-semibold text-[#001435] shadow-xs backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 dark:border-white/10 dark:bg-slate-900/90 dark:text-white"
            >
              {campaign.budget_lines.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} &middot; {item.vendor_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {line && (
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs dark:border-blue-900/60 dark:bg-blue-950/40">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[#003087] dark:text-sky-300">Approved Vendor Assignment</span>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black text-[#003087] dark:bg-blue-900/80 dark:text-sky-200">
                {line.vendor_name ?? "Assigned"}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-blue-200/50 pt-2 text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Remaining line budget:</span>
              <strong className="text-sm font-black text-[#001435] dark:text-white tabular-nums">
                ${Math.max(0, line.budgeted_amount - line.paid_amount).toFixed(2)}
              </strong>
            </div>
          </div>
        )}

        {correction && <label className="block text-sm font-bold">What did you correct?<textarea value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} maxLength={5000} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" /><p className="mt-1 text-xs font-normal">Upload the complete corrected invoice and proof. Earlier files remain in this claim’s history.</p></label>}
        <fieldset disabled={pending || !!blockedReason} className="space-y-6 disabled:opacity-60">
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Invoice Number
            <input
              required
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="e.g. SHELVES-001 or INV-2026-04"
              className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-[#001435] shadow-xs backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 dark:border-white/10 dark:bg-slate-900/90 dark:text-white placeholder:text-slate-400"
            />
          </label>
        </div>

        <FileDropzone
          label="Invoice Document"
          hint="PDF, PNG, JPG, or WEBP up to 10 MB"
          accept="application/pdf,image/*"
          file={invoice}
          onSelect={setInvoice}
        />

        <FileDropzone
          label="Delivery Proof Photo"
          hint="Real-world photo of goods/delivery (JPG, PNG, WEBP)"
          accept="image/*"
          file={proof}
          onSelect={setProof}
        />

        </fieldset>
        {!blockedReason && missing.length > 0 && <ul aria-live="polite" className="list-disc pl-5 text-xs text-slate-700 dark:text-slate-200">{missing.map((item) => <li key={String(item)}>{item}</li>)}</ul>}
        <div className="pt-2">
          <button
            type="submit"
            disabled={pending || !!blockedReason}
            className="button-primary w-full shadow-lg shadow-blue-950/15 disabled:cursor-not-allowed disabled:opacity-50 text-sm font-extrabold"
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Reading &amp; checking invoice…
              </span>
            ) : USE_MOCKS ? (
              "Preview submission"
            ) : (
              "Submit invoice for verification"
            )}
          </button>
        </div>

        {pending && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/90 via-sky-50/70 to-indigo-50/80 p-5 shadow-lg shadow-blue-900/5 backdrop-blur-md dark:border-blue-800/60 dark:bg-slate-900/80 dark:from-slate-900/90 dark:via-blue-950/40 dark:to-slate-900/90 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow-sm dark:bg-slate-800">
                  <svg className="h-6 w-6 animate-spin text-[#0070BA]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0070BA]" />
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-wide text-[#001435] dark:text-white">
                    {ocrStep === 1 && "Uploading Invoice PDF & Delivery Proof..."}
                    {ocrStep === 2 && "Gemini 1.5 Multimodal OCR Analysis..."}
                    {ocrStep === 3 && "Evaluating 8 Deterministic Policy Rules..."}
                  </h4>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    {ocrStep === 1 && "Securely encrypting and transmitting documents to cloud storage."}
                    {ocrStep === 2 && "Extracting line items, vendor name, invoice date, currency & totals."}
                    {ocrStep === 3 && "Verifying budget line balance, PayPal payout email & duplicate hashes."}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-blue-100/80 px-2.5 py-1 text-[10px] font-black tracking-wider text-[#003087] dark:bg-blue-950 dark:text-sky-300 tabular-nums">
                {elapsedSec}s elapsed
              </span>
            </div>

            {/* Phased Step Indicators */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { step: 1, title: "1. Upload", icon: "📄" },
                { step: 2, title: "2. Gemini OCR", icon: "🤖" },
                { step: 3, title: "3. Policy Rules", icon: "⚖️" },
              ].map(({ step, title, icon }) => {
                const isDone = ocrStep > step;
                const isCurrent = ocrStep === step;
                return (
                  <div
                    key={step}
                    className={`rounded-xl p-2.5 text-center transition ${
                      isCurrent
                        ? "bg-white border-2 border-[#0070BA] shadow-sm dark:bg-slate-800 dark:border-sky-400"
                        : isDone
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                        : "bg-white/50 border border-slate-200/60 text-slate-400 dark:bg-slate-800/40 dark:border-white/5 dark:text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold">
                      <span>{icon}</span>
                      <span className={isCurrent ? "text-[#001435] dark:text-white" : ""}>
                        {isDone ? `${title} ✓` : title}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#0070BA] dark:text-sky-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] animate-pulse" />
                        In Progress
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Animated Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100/80 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#003087] via-[#0070BA] to-[#009CDE] transition-all duration-700 ease-out"
                  style={{
                    width: `${
                      ocrStep === 1
                        ? Math.min(45, 20 + elapsedSec * 10)
                        : ocrStep === 2
                        ? Math.min(80, 50 + (elapsedSec - 2) * 8)
                        : 94
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <span>StraightMoney Verification Protocol</span>
                <span>{ocrStep === 3 ? "Finalizing verdict..." : "Processing artifacts..."}</span>
              </div>
            </div>
          </div>
        )}

        {message && (
          <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </form>

      <aside className="liquid-glass p-6 sm:p-7 space-y-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-sky-400">
            Transparency Protocol
          </p>
          <h3 className="mt-2 text-xl font-extrabold text-[#001435] dark:text-white">
            What happens next
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Every submission is checked deterministically before reaching the verifier.
          </p>
        </div>

        <ol className="space-y-4 text-xs">
          <li className="rounded-xl border border-slate-200/70 bg-white/60 p-3.5 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 font-black text-[#001435] dark:text-white">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#003087] text-[10px] text-white">1</span>
              Gemini OCR Extraction
            </div>
            <p className="mt-1 pl-7 leading-relaxed text-slate-600 dark:text-slate-300">
              Amounts, currencies, invoice numbers, and payout emails are extracted into structured JSON.
            </p>
          </li>

          <li className="rounded-xl border border-slate-200/70 bg-white/60 p-3.5 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 font-black text-[#001435] dark:text-white">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0070BA] text-[10px] text-white">2</span>
              8 Deterministic Policy Checks
            </div>
            <p className="mt-1 pl-7 leading-relaxed text-slate-600 dark:text-slate-300">
              Hard Python rules enforce budget caps, duplicate invoice hashes, and registered PayPal recipient addresses.
            </p>
          </li>

          <li className="rounded-xl border border-slate-200/70 bg-white/60 p-3.5 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 font-black text-[#001435] dark:text-white">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white">3</span>
              Human Verifier &amp; PayPal Payout
            </div>
            <p className="mt-1 pl-7 leading-relaxed text-slate-600 dark:text-slate-300">
              A community verifier inspects the delivery photo. Upon approval, funds disburse directly to your PayPal account.
            </p>
          </li>
        </ol>
      </aside>
    </div>
  );
}
