"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  userDoc: UserDocument | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  theme: "light" | "dark";
  toggleTheme: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const THEME_KEY = "expense-tracker-theme";

function firstProviderPhoto(user: User | null) {
  if (!user?.providerData?.length) return null;
  for (const provider of user.providerData) {
    if (provider?.photoURL) return provider.photoURL;
  }
  return null;
}

function firstProviderDisplayName(user: User | null) {
  if (!user?.providerData?.length) return null;
  for (const provider of user.providerData) {
    if (provider?.displayName) return provider.displayName;
  }
  return null;
}

function hashCode(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function gravatarFallbackUrl(email?: string | null) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  // Email-based avatar fallback so every signed-in account has an image.
  return `https://www.gravatar.com/avatar/${hashCode(normalized)}?d=identicon&s=128`;
}

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
      try {
        if (u) {
          const existingUser = await getUserDocument(u.uid);
          const preferredCurrency = existingUser?.preferredCurrency || "USD";
          const providerPhoto = firstProviderPhoto(u);
          const photoURL = u.photoURL || providerPhoto || existingUser?.photoURL || null;
          const displayName = u.displayName || firstProviderDisplayName(u) || existingUser?.displayName || "";

          await saveUserDocument(u.uid, {
            email: u.email || "",
            displayName,
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
      } catch (error) {
        // Keep the app accessible even if profile/userDoc sync fails in production.
        console.error("AuthProvider bootstrap failed:", error);
        setProfile(null);
        setUserDoc(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const refreshProfile = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    const [p, doc] = await Promise.all([getProfile(u.uid), getUserDocument(u.uid)]);
    setProfile(p);
    setUserDoc(doc);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      userDoc,
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
      },
      refreshProfile
    }),
    [user, profile, userDoc, loading, router, theme, refreshProfile]
  );

  const showNav = pathname !== "/login";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

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

  const avatarLabel = user?.displayName || firstProviderDisplayName(user) || userDoc?.displayName || user?.email || userDoc?.email || "User";
  const avatarCandidates = [
    user?.photoURL,
    firstProviderPhoto(user),
    userDoc?.photoURL,
    gravatarFallbackUrl(user?.email || userDoc?.email)
  ].filter(Boolean) as string[];
  const avatarSrc = avatarLoadFailed ? avatarCandidates[avatarCandidates.length - 1] || null : avatarCandidates[0] || null;

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.uid, user?.photoURL, userDoc?.photoURL, user?.email, userDoc?.email]);
  const initials = avatarLabel
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <AuthContext.Provider value={value}>
      <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden overflow-x-hidden text-slate-800 dark:text-slate-100">
        {showNav ? (
          <header className="relative z-40 shrink-0 border-b border-indigo-100 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] grid-rows-[auto_auto] gap-x-2 gap-y-1 px-2 py-1.5 md:grid-cols-[auto_1fr_auto] md:grid-rows-1 md:items-center md:gap-3 md:px-3 md:py-2">
              <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
                <CashLogo size={32} className="shrink-0 translate-y-px" />
                <div className="truncate bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-base font-bold text-transparent md:text-lg">
                  Expense Tracker
                </div>
              </div>

              <div className="relative col-start-2 row-start-1 inline-flex justify-self-end md:col-start-3 md:justify-self-auto" ref={avatarRef}>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm shadow-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-slate-700"
                  onClick={() => setDropdownOpen((open) => !open)}
                  aria-label="Open user menu"
                  aria-expanded={dropdownOpen}
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={avatarLabel}
                      className="h-9 w-9 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarLoadFailed(true)}
                    />
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

              <nav className="col-span-2 row-start-2 flex justify-center overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:col-span-1 md:col-start-2 md:row-start-1 md:pb-0 [&::-webkit-scrollbar]:hidden">
                <div className="flex shrink-0 items-center gap-4 px-1 md:gap-5">
                  <NavLink href="/categories" label="Categories" active={pathname === "/categories"} />
                  <NavLink href="/entries" label="Entries" active={pathname === "/entries"} />
                  <NavLink href="/reports" label="Reports" active={pathname === "/reports"} />
                </div>
              </nav>
            </div>
          </header>
        ) : null}
        <main className="mx-auto flex h-0 min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden overflow-x-hidden px-2 py-1 md:px-3 md:py-2">
          {children}
        </main>
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

