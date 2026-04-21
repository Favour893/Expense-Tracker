"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type NotificationType = "success" | "error" | "info";

type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
  /** When true, toast stays until dismissed (no auto-hide). Used for feedback invite messages. */
  persistent?: boolean;
};

type NotificationsContextValue = {
  notify: (type: NotificationType, message: string, opts?: { persistent?: boolean }) => void;
  notifySuccess: (message: string, opts?: { persistent?: boolean }) => void;
  notifyError: (message: string, opts?: { persistent?: boolean }) => void;
  notifyInfo: (message: string, opts?: { persistent?: boolean }) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function styleByType(type: NotificationType) {
  if (type === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100";
  }
  if (type === "error") {
    return "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-100";
  }
  return "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100";
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (type: NotificationType, message: string, opts?: { persistent?: boolean }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { id, type, message, persistent: opts?.persistent }]);
      if (!opts?.persistent) {
        window.setTimeout(() => remove(id), 4000);
      }
    },
    [remove]
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notify,
      notifySuccess: (message, opts) => notify("success", message, opts),
      notifyError: (message, opts) => notify("error", message, opts),
      notifyInfo: (message, opts) => notify("info", message, opts)
    }),
    [notify]
  );

  const persistentItems = items.filter((i) => i.persistent);
  const ephemeralItems = items.filter((i) => !i.persistent);
  const ephemeralTopClass = persistentItems.length > 0 ? "top-[max(5.75rem,env(safe-area-inset-top))]" : "top-3";

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[10001] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-2">
          {persistentItems.map((item) => (
            <div
              key={item.id}
              role={item.type === "error" ? "alert" : "status"}
              className={`rounded-xl border px-3 py-2.5 text-sm shadow-lg ${styleByType(item.type)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="leading-snug">{item.message}</div>
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => remove(item.id)}
                  aria-label="Dismiss notification"
                >
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        className={`pointer-events-none fixed right-3 z-[10000] flex w-full max-w-sm flex-col gap-1.5 ${ephemeralTopClass}`}
      >
        {ephemeralItems.map((item) => (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-xl border px-2.5 py-1.5 text-sm shadow-lg ${styleByType(item.type)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="leading-5">{item.message}</div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => remove(item.id)}
                aria-label="Close notification"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
