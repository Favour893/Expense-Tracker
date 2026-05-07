"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import { useAuth } from "../auth/AuthProvider";
import { ONBOARDING_STEPS, ONBOARDING_STORAGE_KEY } from "./onboardingConfig";

const ONBOARDING_ALL_DONE_KEY = "__all__";

function BodyWithBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-slate-900 dark:text-slate-50">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function useTargetRect(selector: string | undefined) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const measure = useCallback(() => {
    if (!selector || typeof document === "undefined") return;
    const el = document.querySelector(`[data-tour="${CSS.escape(selector)}"]`);
    if (!(el instanceof HTMLElement)) {
      setRect(null);
      return;
    }
    try {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" as ScrollBehavior });
    } catch {
      el.scrollIntoView();
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2
    });
  }, [selector]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!selector) return;
    const t = window.setInterval(measure, 180);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [measure, selector]);

  return rect;
}

/** First-time tour: each step highlights one `data-tour` anchor on the active route. */
export function OnboardingTour() {
  const pathname = usePathname();
  const { user } = useAuth();

  const [completedByRoute, setCompletedByRoute] = useState<Record<string, boolean> | null>(null);
  /** False until we read localStorage for this user — avoids showing the tour before we know they already finished. */
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user?.uid) {
      setStorageHydrated(false);
      setCompletedByRoute(null);
      return;
    }

    function parseStored(raw: string | null): Record<string, boolean> {
      if (!raw || raw === "done") {
        return raw === "done" ? { [ONBOARDING_ALL_DONE_KEY]: true } : {};
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, Boolean(v)])
          );
        }
      } catch {
        /* ignore */
      }
      return {};
    }

    try {
      const scopedKey = `${ONBOARDING_STORAGE_KEY}:${user.uid}`;
      let raw = localStorage.getItem(scopedKey);

      if (raw == null) {
        const legacy = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (legacy != null) {
          raw = legacy;
          try {
            localStorage.setItem(scopedKey, legacy);
          } catch {
            /* ignore */
          }
        }
      }

      setCompletedByRoute(parseStored(raw));
    } catch {
      setCompletedByRoute({});
    } finally {
      setStorageHydrated(true);
    }
  }, [user?.uid]);

  const currentRouteSteps = useMemo(
    () => ONBOARDING_STEPS.filter((s) => s.route === pathname),
    [pathname]
  );

  const currentRouteKey = useMemo(() => {
    if (!pathname || pathname === "/") return "home";
    return pathname.replace(/^\/+/, "") || "home";
  }, [pathname]);

  const allDone = Boolean(completedByRoute?.[ONBOARDING_ALL_DONE_KEY]);
  const routeDone = Boolean(completedByRoute?.[currentRouteKey]);
  const showTour = Boolean(
    user &&
      storageHydrated &&
      completedByRoute &&
      pathname !== "/login" &&
      currentRouteSteps.length > 0 &&
      !allDone &&
      !routeDone
  );

  useEffect(() => {
    setStep(0);
  }, [pathname]);

  useEffect(() => {
    if (!showTour) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showTour]);

  const current = currentRouteSteps[step];
  const targetId = current?.target;

  const rect = useTargetRect(showTour ? targetId : undefined);

  const cardStyle = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = Math.min(420, vw - 24);
    const estimatedH = 260;
    const gap = 14;
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return {
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 24,
        width: cardW,
        top: "auto"
      } as React.CSSProperties;
    }

    let top = rect.top + rect.height + gap;
    if (top + estimatedH > vh - 16) {
      top = rect.top - estimatedH - gap;
    }
    top = Math.max(12, Math.min(top, vh - estimatedH - 12));
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(12, Math.min(left, vw - cardW - 12));
    return { top, left, width: cardW } as React.CSSProperties;
  }, [rect]);

  function dismissTour(markCurrentRouteDone: boolean) {
    if (!markCurrentRouteDone || !user?.uid) return;
    const uid = user.uid;
    setCompletedByRoute((prev) => {
      const base = prev ?? {};
      const next = { ...base, [currentRouteKey]: true };
      const requiredRoutes = Array.from(new Set(ONBOARDING_STEPS.map((s) => s.route.replace(/^\/+/, "") || "home")));
      const completedAllRoutes = requiredRoutes.every((routeKey) => Boolean(next[routeKey]));
      if (completedAllRoutes) {
        next[ONBOARDING_ALL_DONE_KEY] = true;
      }
      const scopedKey = `${ONBOARDING_STORAGE_KEY}:${uid}`;
      const payload = completedAllRoutes ? "done" : JSON.stringify(next);
      try {
        localStorage.setItem(scopedKey, payload);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function onNext() {
    if (step >= currentRouteSteps.length - 1) {
      dismissTour(true);
      return;
    }
    setStep((s) => s + 1);
  }

  function onBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (!mounted || !storageHydrated || !showTour || !current) return null;

  const isLast = step >= currentRouteSteps.length - 1;

  const spotlight =
    rect && rect.width > 0 && rect.height > 0 ? (
      <>
        <div
          className="pointer-events-none fixed z-[99952] rounded-xl ring-4 ring-indigo-500 ring-offset-2 ring-offset-transparent dark:ring-indigo-400"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.62)"
          }}
          aria-hidden
        />
      </>
    ) : null;

  const dialog = (
    <>
      <div className="fixed inset-0 z-[99948] cursor-default bg-transparent" aria-hidden onClick={(e) => e.preventDefault()} />
      {spotlight}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-body"
        className="fixed z-[99953] max-h-[min(52dvh,420px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="onboarding-title" className="text-base font-semibold text-slate-900 dark:text-white">
            {current.title}
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            onClick={() => dismissTour(true)}
          >
            Skip tour
          </button>
        </div>
        <p id="onboarding-body" className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <BodyWithBold text={current.body} />
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10 sm:text-sm"
            onClick={onBack}
            disabled={step <= 0}
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {step + 1}/{currentRouteSteps.length}
            </span>
            <button type="button" className="et-btn-primary px-4 py-1.5 text-xs sm:text-sm" onClick={onNext}>
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(dialog, document.body);
}
