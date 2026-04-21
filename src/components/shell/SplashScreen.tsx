"use client";

import React, { useEffect, useState } from "react";

import { CashLogo } from "../branding/CashLogo";

/** Full-screen branded splash on cold load; fades out after window load + minimum display time. */
export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setShowProgress(!reduced);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const waitLoad =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener("load", () => resolve(), { once: true });
          });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minMs = reduced ? 80 : 520;
    const minDelay = new Promise<void>((r) => setTimeout(r, minMs));

    Promise.all([waitLoad, minDelay]).then(() => {
      if (!cancelled) setPhase("fade");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "fade") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 40 : 320;
    const t = window.setTimeout(() => setPhase("gone"), ms);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[99990] flex flex-col items-center justify-center gap-4 transition-opacity duration-300 ease-out ${
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={phase === "fade"}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_700px_at_-10%_-10%,rgba(79,70,229,0.22),transparent),radial-gradient(1000px_600px_at_110%_-20%,rgba(14,165,233,0.2),transparent),linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] dark:hidden"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(1000px_600px_at_-10%_-10%,rgba(99,102,241,0.25),transparent),radial-gradient(900px_500px_at_120%_-20%,rgba(56,189,248,0.16),transparent),#020617] dark:block"
        aria-hidden
      />
      <CashLogo size={88} className="relative z-10 drop-shadow-sm" />
      <p className="relative z-10 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-xl font-bold tracking-tight text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-sky-400">
        Expense Tracker
      </p>
      {showProgress && phase === "show" ? (
        <div className="relative z-10 mt-1 h-1 w-28 overflow-hidden rounded-full bg-indigo-100 dark:bg-white/10" aria-hidden>
          <div className="h-full w-1/3 animate-et-splash-bar rounded-full bg-gradient-to-r from-indigo-500 to-sky-500" />
        </div>
      ) : null}
    </div>
  );
}
