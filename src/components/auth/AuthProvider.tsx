"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { deleteUser, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";

import { auth, db } from "../../lib/firebaseClient";
import { getProfile, type UserProfile } from "../../lib/repos/profileRepo";
import { CashLogo } from "../branding/CashLogo";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  theme: "light" | "dark";
  toggleTheme: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const THEME_KEY = "expense-tracker-theme";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as "light" | "dark" | null) || "light";
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  useEffect(() => {
    // Arrow-key navigation across visible inputs/selects/textarea.
    // Uses the current form scope first, then falls back to page-wide controls.
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key;
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(key)) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;
      if ((target as HTMLElement).dataset.arrowEdit === "true") return;
      const tag = (target.tagName || "").toLowerCase();
      const isFormControl = tag === "input" || tag === "select" || tag === "textarea";
      if (!isFormControl) return;

      const scope = (target.closest("form") as HTMLElement | null) ?? document.body;
      const controls = Array.from(
        scope.querySelectorAll("input, select, textarea")
      ).filter((node) => {
        const e = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if ((e as any).disabled) return false;
        const hidden = e.offsetParent === null;
        return !hidden;
      }) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

      const idx = controls.indexOf(target as any);
      if (idx < 0) return;

      const moveNext = key === "ArrowDown" || key === "ArrowRight";
      const nextIndex = moveNext
        ? Math.min(controls.length - 1, idx + 1)
        : Math.max(0, idx - 1);

      if (nextIndex !== idx) {
        event.preventDefault();
        controls[nextIndex].focus();
        const nextTag = controls[nextIndex].tagName.toLowerCase();
        if (nextTag === "input" && typeof (controls[nextIndex] as HTMLInputElement).select === "function") {
          try {
            (controls[nextIndex] as HTMLInputElement).select();
          } catch {
            // no-op for non-text-like controls
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await getProfile(u.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signOutUser: async () => {
        const ok = window.confirm("Are you sure you want to sign out?");
        if (!ok) return;
        await signOut(auth);
        router.push("/login");
      },
      deleteAccount: async () => {
        const u = auth.currentUser;
        if (!u) return;

        const ok = window.confirm(
          "This will permanently delete your account and data (profile, categories, transactions). Continue?"
        );
        if (!ok) return;
        try {
          // Delete user-owned subcollections used by this app.
          const profileRef = doc(db, "users", u.uid, "profile", "main");
          const categoriesRef = collection(db, "users", u.uid, "categories");
          const transactionsRef = collection(db, "users", u.uid, "transactions");

          const [categoriesSnap, transactionsSnap] = await Promise.all([
            getDocs(categoriesRef),
            getDocs(transactionsRef)
          ]);

          await Promise.all([
            ...categoriesSnap.docs.map((d) => deleteDoc(d.ref)),
            ...transactionsSnap.docs.map((d) => deleteDoc(d.ref))
          ]);

          // Profile doc may or may not exist.
          await deleteDoc(profileRef).catch(() => undefined);

          // Delete auth user last.
          await deleteUser(u);
          router.push("/login");
        } catch (err: any) {
          if (String(err?.code || "").includes("requires-recent-login")) {
            window.alert("For security, please sign out, sign in again, then try Delete account.");
            return;
          }
          window.alert(`Could not delete account: ${err?.message || err}`);
        }
      },
      theme,
      toggleTheme: () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        localStorage.setItem(THEME_KEY, next);
        document.documentElement.classList.toggle("dark", next === "dark");
      }
    }),
    [user, profile, loading, router, theme]
  );

  const showNav = pathname !== "/login";

  return (
    <AuthContext.Provider value={value}>
      <div className="min-h-screen w-full overflow-x-hidden text-slate-800 dark:text-slate-100">
        {showNav ? (
          <header className="border-b border-indigo-100 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <CashLogo size={30} />
                <div className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-lg font-bold text-transparent">
                  Expense Tracker
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-700 hover:bg-indigo-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                  onClick={() => value.toggleTheme()}
                >
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <div className="hidden md:block text-slate-600 dark:text-slate-300">
                  {user?.email ? `Signed in as ${profile?.firstName ? `${profile.firstName} ${profile.lastName} (${user.email})` : user.email}` : ""}
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                  onClick={() => value.signOutUser()}
                  disabled={!user}
                >
                  Sign out
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                  onClick={() => value.deleteAccount()}
                  disabled={!user}
                >
                  Delete account
                </button>
              </div>
            </div>
            <nav className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 pb-3">
              <NavLink href="/categories" label="Categories" />
              <NavLink href="/entries" label="Entries" />
              <NavLink href="/reports" label="Reports" />
            </nav>
          </header>
        ) : null}
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </div>
    </AuthContext.Provider>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      onClick={() => router.push(href)}
    >
      {label}
    </button>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

