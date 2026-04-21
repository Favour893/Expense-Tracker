"use client";

import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
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

  return (
    <>
      <button
        type="button"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-[80] whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium leading-none text-indigo-700 shadow-lg hover:bg-indigo-100 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:bg-indigo-500/25 sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-4 sm:px-3.5 sm:py-2.5 sm:text-sm"
        onClick={() => setOpen(true)}
      >
        Feedback
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto bg-slate-950/75 p-2 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[1px] sm:p-4 sm:pt-[max(1.5rem,env(safe-area-inset-top))]"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-dialog-title"
                className="mt-1 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:mt-2 sm:max-h-[min(560px,calc(100dvh-3rem))]"
              >
                <h2 id="feedback-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Share your feedback
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Rate the app and optionally leave a comment. You can send feedback anytime — no invitation required.
                </p>

                <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Rating</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`min-h-10 min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
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
                      className="et-input min-h-[100px] resize-y"
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
