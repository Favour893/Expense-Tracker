"use client";

import React from "react";

/** Shimmer skeleton for full-page or section loading states. */
export function PageLoadingShimmer({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div
      className={["et-card min-h-0 flex-1 overflow-hidden", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="space-y-3 p-1">
        <div className="et-skeleton-shimmer h-8 w-2/3 max-w-md" />
        <div className="et-skeleton-shimmer h-4 w-full max-w-lg" />
        <div className="et-skeleton-shimmer h-4 w-5/6 max-w-md" />
        <div className="grid gap-2 pt-3 sm:grid-cols-3">
          <div className="et-skeleton-shimmer h-24 rounded-xl" />
          <div className="et-skeleton-shimmer h-24 rounded-xl" />
          <div className="et-skeleton-shimmer h-24 rounded-xl" />
        </div>
        <div className="et-skeleton-shimmer h-40 rounded-xl" />
        <div className="et-skeleton-shimmer h-32 rounded-xl" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
