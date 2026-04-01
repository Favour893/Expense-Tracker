"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type NotificationType = "success" | "error" | "info";

type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
};

type NotificationsContextValue = {
  notify: (type: NotificationType, message: string) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  notifyInfo: (message: string) => void;
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

  const notify = useCallback((type: NotificationType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notify,
      notifySuccess: (message) => notify("success", message),
      notifyError: (message) => notify("error", message),
      notifyInfo: (message) => notify("info", message)
    }),
    [notify]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-lg ${styleByType(item.type)}`}
          >
            <div className="flex items-start justify-between gap-3">
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

