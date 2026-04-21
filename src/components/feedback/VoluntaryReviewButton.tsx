"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "../auth/AuthProvider";
import { useNotifications } from "../notifications/NotificationProvider";
import { saveVoluntaryReview } from "../../lib/repos/reviewsRepo";

export function VoluntaryReviewButton() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { notifySuccess, notifyError } = useNotifications();

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragged: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = () => {
      const next = mq.matches;
      setIsLargeScreen(next);
      if (next) {
        // Keep desktop fixed at bottom-right.
        setFloatingPos(null);
      }
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setBusy(true);
    try {
      await saveVoluntaryReview(uid, { rating, comment });
      notifySuccess("Thanks — your feedback was saved.");
      setOpen(false);
      setComment("");
      setRating(5);
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function clampToViewport(x: number, y: number, width: number, height: number) {
    const maxX = Math.max(0, window.innerWidth - width);
    const maxY = Math.max(0, window.innerHeight - height);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY)
    };
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`fixed z-[80] touch-none select-none whitespace-nowrap rounded-full bg-gradient-to-r from-indigo-600 to-sky-500 px-2.5 py-1.5 text-xs font-semibold leading-none text-white shadow-xl transition hover:brightness-110 ${
          isLargeScreen ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        } sm:px-3 sm:py-2 sm:text-sm ${
          floatingPos && !isLargeScreen ? "" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-3"
        }`}
        style={floatingPos && !isLargeScreen ? { left: `${floatingPos.x}px`, top: `${floatingPos.y}px` } : undefined}
        onPointerDown={(e) => {
          if (isLargeScreen) return;
          const btn = buttonRef.current;
          if (!btn) return;
          btn.setPointerCapture(e.pointerId);
          const rect = btn.getBoundingClientRect();
          const origin = floatingPos ?? { x: rect.left, y: rect.top };
          dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            originX: origin.x,
            originY: origin.y,
            dragged: false
          };
        }}
        onPointerMove={(e) => {
          if (isLargeScreen) return;
          const btn = buttonRef.current;
          const drag = dragRef.current;
          if (!btn || !drag || drag.pointerId !== e.pointerId) return;
          e.preventDefault();
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          const next = clampToViewport(drag.originX + dx, drag.originY + dy, btn.offsetWidth, btn.offsetHeight);
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            drag.dragged = true;
            suppressClickRef.current = true;
          }
          setFloatingPos(next);
        }}
        onPointerUp={(e) => {
          if (isLargeScreen) return;
          const btn = buttonRef.current;
          const drag = dragRef.current;
          if (btn && drag && drag.pointerId === e.pointerId) {
            btn.releasePointerCapture(e.pointerId);
          }
          dragRef.current = null;
        }}
        onPointerCancel={(e) => {
          if (isLargeScreen) return;
          const btn = buttonRef.current;
          const drag = dragRef.current;
          if (btn && drag && drag.pointerId === e.pointerId) {
            btn.releasePointerCapture(e.pointerId);
          }
          dragRef.current = null;
        }}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setOpen(true);
        }}
      >
        Feedback
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto bg-slate-950/75 p-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-[1px] sm:p-3 sm:pt-[max(1.25rem,env(safe-area-inset-top))]"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-dialog-title"
                className="mt-1 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:mt-2 sm:max-h-[min(560px,calc(100dvh-3rem))]"
              >
                <h2 id="feedback-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Share your feedback
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Rate the app and optionally leave a comment. You can send feedback anytime — no invitation required.
                </p>

                <form className="mt-3 grid gap-3" onSubmit={onSubmit}>
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Rating</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`min-h-9 min-w-9 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition ${
                            rating === n
                              ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-indigo-500/20 dark:text-indigo-100"
                              : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                          }`}
                          onClick={() => setRating(n)}
                          aria-pressed={rating === n}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comment (optional)</span>
                    <textarea
                      className="et-input min-h-[88px] resize-y"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="What works well? What could be better?"
                      maxLength={4000}
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="et-btn-primary" disabled={busy}>
                      {busy ? "Sending..." : "Submit feedback"}
                    </button>
                    <button
                      type="button"
                      className="et-btn-secondary"
                      disabled={busy}
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
