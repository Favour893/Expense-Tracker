"use client";

import React, { useState } from "react";

function cashLogoSvgMarkup() {
  return `
<svg width="256" height="256" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cashGradA_pdf" x1="6" y1="10" x2="56" y2="56" gradientUnits="userSpaceOnUse">
      <stop stop-color="#4F46E5" />
      <stop offset="1" stop-color="#0EA5E9" />
    </linearGradient>
    <linearGradient id="cashGradB_pdf" x1="14" y1="18" x2="52" y2="46" gradientUnits="userSpaceOnUse">
      <stop stop-color="#34D399" />
      <stop offset="1" stop-color="#10B981" />
    </linearGradient>
  </defs>
  <rect x="8" y="16" width="42" height="30" rx="8" fill="url(#cashGradA_pdf)" opacity="0.22" />
  <rect x="14" y="12" width="42" height="30" rx="8" fill="url(#cashGradA_pdf)" />
  <rect x="16.5" y="14.5" width="37" height="25" rx="6" stroke="white" stroke-opacity="0.55" />
  <circle cx="35" cy="27" r="7.5" fill="url(#cashGradB_pdf)" />
  <path
    d="M35 21.8V32.2M31.8 24.7C31.8 23.7 32.7 22.9 33.9 22.9H36.1C37.3 22.9 38.2 23.7 38.2 24.7C38.2 25.7 37.3 26.5 36.1 26.5H33.9C32.7 26.5 31.8 27.3 31.8 28.3C31.8 29.3 32.7 30.1 33.9 30.1H36.1C37.3 30.1 38.2 29.3 38.2 28.3"
    stroke="white"
    stroke-width="1.8"
    stroke-linecap="round"
  />
  <path d="M50 9.5L51.4 12.2L54.1 13.6L51.4 15L50 17.7L48.6 15L45.9 13.6L48.6 12.2L50 9.5Z" fill="#FDE68A" />
  <circle cx="11" cy="50" r="2.2" fill="#A7F3D0" />
</svg>
`.trim();
}

async function svgToPngDataUrl(svgMarkup: string, opts?: { sizePx?: number; alpha?: number }) {
  const sizePx = opts?.sizePx ?? 512;
  const alpha = opts?.alpha ?? 0.12;

  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const img = new Image();
  img.decoding = "async";
  img.src = svgUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not render logo for watermark."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 0, sizePx, sizePx);
  return canvas.toDataURL("image/png");
}

export function ExportPdfButton({
  exportFilenameBase,
  currency,
  disabled,
  buttonClassName = ""
}: {
  /** Used in the download filename after sanitizing (e.g. `2026-01-01_2026-01-31`). */
  exportFilenameBase: string;
  currency: string;
  disabled?: boolean;
  /** Extra classes for the export button (e.g. compact mobile sizing). */
  buttonClassName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      const reportRoot = document.getElementById("report-root");
      if (!reportRoot) throw new Error("Report root not found.");

      document.body.classList.add("pdf-export");
      // Give styles a tick to apply before capture.
      await new Promise((r) => setTimeout(r, 50));

      const mod: any = await import("html2pdf.js");
      const html2pdf: any = mod?.default || mod;

      const safeBase = String(exportFilenameBase || "report").replace(/[^a-zA-Z0-9-_]+/g, "-");
      const filename = `monthly-report-${safeBase}.pdf`;

      const worker = html2pdf()
        .set({
          // Reserve top/bottom space so content never overlaps header/footer stamp.
          margin: [0.65, 0.35, 0.65, 0.35],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
        })
        .from(reportRoot);

      const pdf: any = await worker.toPdf().get("pdf");
      const pageCount: number = pdf?.internal?.getNumberOfPages?.() ?? 0;

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      let watermarkPng: string | null = null;
      try {
        watermarkPng = await svgToPngDataUrl(cashLogoSvgMarkup(), { sizePx: 700, alpha: 0.045 });
      } catch {
        watermarkPng = null;
      }

      for (let i = 1; i <= pageCount; i += 1) {
        pdf.setPage(i);

        if (watermarkPng) {
          const wmW = Math.min(4.4, pageWidth * 0.62);
          const wmH = wmW;
          const x = (pageWidth - wmW) / 2;
          const y = (pageHeight - wmH) / 2;
          try {
            pdf.addImage(watermarkPng, "PNG", x, y, wmW, wmH, undefined, "FAST");
          } catch {
            // ignore watermark failures
          }
        }

        // Footer page number on every page.
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(120);
        // Footer line + page number kept within reserved bottom margin.
        try {
          pdf.setDrawColor(200);
          pdf.setLineWidth(0.01);
          pdf.line(0.35, pageHeight - 0.55, pageWidth - 0.35, pageHeight - 0.55);
        } catch {
          // ignore line failures
        }
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 0.35, { align: "center" });
      }

      await pdf.save(filename);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      document.body.classList.remove("pdf-export");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={`rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 ${buttonClassName}`.trim()}
        onClick={onExport}
        disabled={busy || disabled}
      >
        {busy ? "Exporting..." : `Export to PDF`}
      </button>
      {error ? <div className="text-sm text-red-200">{error}</div> : null}
    </div>
  );
}

