"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { deleteUser, onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { mdiDelete, mdiLogout } from "@mdi/js";
import { usePathname, useRouter } from "next/navigation";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";

import { auth, db } from "../../lib/firebaseClient";
import { getProfile, getUserDocument, saveUserDocument, type UserProfile, type UserDocument } from "../../lib/repos/profileRepo";
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
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
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
        const existingUser = await getUserDocument(u.uid);
        const preferredCurrency = existingUser?.preferredCurrency || "USD";
        const photoURL = u.photoURL || existingUser?.photoURL || null;

        await saveUserDocument(u.uid, {
          email: u.email || "",
          displayName: u.displayName || "",
          photoURL,
          preferredCurrency
        });

        const p = await getProfile(u.uid);
        setProfile(p);
        setUserDoc(await getUserDocument(u.uid));
      } else {
        setProfile(null);
        setUserDoc(null);
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;

    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!avatarRef.current?.contains(target)) {
        setDropdownOpen(false);
      }
    }

    function closeOnEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setDropdownOpen(false);
    }

    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEsc);

    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEsc);
    };
  }, [dropdownOpen]);

  const avatarLabel = user?.displayName || user?.email || "User";
  const avatarSrc = user?.photoURL || userDoc?.photoURL || null;
  const initials = avatarLabel
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <AuthContext.Provider value={value}>
      <div className="min-h-screen w-full overflow-x-hidden text-slate-800 dark:text-slate-100">
        {showNav ? (
          <header className="relative z-40 border-b border-indigo-100 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            <div className="mx-auto grid w-full max-w-6xl items-center gap-4 px-4 py-3 md:grid-cols-[auto_1fr_auto]">
              <div className="flex items-center gap-2">
                <CashLogo size={30} />
                <div className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-lg font-bold text-transparent">
                  Expense Tracker
                </div>
              </div>

              <nav className="flex justify-center">
                <div className="flex flex-wrap items-center justify-center gap-8">
                  <NavLink href="/categories" label="Categories" active={pathname === "/categories"} />
                  <NavLink href="/entries" label="Entries" active={pathname === "/entries"} />
                  <NavLink href="/reports" label="Reports" active={pathname === "/reports"} />
                </div>
              </nav>

              <div className="relative inline-flex" ref={avatarRef}>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm shadow-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-slate-700"
                  onClick={() => setDropdownOpen((open) => !open)}
                  aria-label="Open user menu"
                  aria-expanded={dropdownOpen}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={avatarLabel} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{initials}</span>
                  )}
                </button>

                {dropdownOpen ? (
                  <div className="absolute right-0 top-full z-[9999] mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-slate-800">
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Account</div>
                    <div className="mb-3 text-sm text-slate-700 dark:text-slate-200 truncate">{user?.email}</div>

                    <button
                      type="button"
                      className="mb-2 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                      onClick={() => {
                        value.toggleTheme();
                      }}
                      aria-pressed={theme === "dark"}
                    >
                      <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
                      <span className="flex h-5 w-10 items-center rounded-full bg-slate-300 p-1 transition dark:bg-slate-600">
                        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${theme === "dark" ? "translate-x-5" : "translate-x-0"}`} />
                      </span>
                    </button>
                    <button
                      type="button"
                      className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-2 text-sm text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-slate-700 dark:text-sky-200 dark:hover:bg-slate-600"
                      onClick={async () => {
                        await value.signOutUser();
                        setDropdownOpen(false);
                      }}
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d={mdiLogout} />
                      </svg>
                      Sign out
                    </button>
                    <hr className="my-4 border-slate-200 dark:border-white/10" />
                    <button
                      type="button"
                      className="w-full rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-sm text-rose-700 hover:bg-rose-100 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                      onClick={async () => {
                        await value.deleteAccount();
                        setDropdownOpen(false);
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d={mdiDelete} />
                        </svg>
                        Delete account
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        ) : null}
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </div>
    </AuthContext.Provider>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition ${
        active
          ? "text-indigo-600 underline decoration-indigo-400 underline-offset-4 dark:text-indigo-300"
          : "text-slate-700 hover:text-indigo-600 hover:underline dark:text-slate-200 dark:hover:text-indigo-300"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

