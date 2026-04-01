"use client";

import React, { useState } from "react";

export function ExportPdfButton({
  monthKey,
  currency,
  disabled,
  buttonClassName = ""
}: {
  monthKey: string;
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

      const filename = `monthly-report-${monthKey}.pdf`;

      await html2pdf()
        .set({
          margin: 0.35,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
        })
        .from(reportRoot)
        .save();
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

