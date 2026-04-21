"use client";

import React, { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, getRedirectResult, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { mdiApple, mdiGoogle } from "@mdi/js";
import { auth } from "../../src/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { COUNTRIES, currencyFromCountry } from "../../src/lib/constants/countries";
import { saveProfile, saveUserDocument } from "../../src/lib/repos/profileRepo";
import { CashLogo } from "../../src/components/branding/CashLogo";

function isStrongPassword(password: string) {
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasPunctuation = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasPunctuation;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleRedirectResult() {
      setBusy(true);
      try {
        const result = await getRedirectResult(auth);
        if (result?.user || auth.currentUser) {
          router.push("/entries");
        }
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setBusy(false);
      }
    }
    handleRedirectResult();
  }, [router]);

  async function handleEmailPassword(mode: "signin" | "signup") {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        if (!firstName.trim() || !lastName.trim() || !country || !city.trim()) {
          throw new Error("Create account requires first name, last name, country, and city.");
        }
        if (password !== confirmPassword) {
          throw new Error("Password confirmation does not match.");
        }
        if (!isStrongPassword(password)) {
          throw new Error("Use a stronger password: at least 8 chars with uppercase, lowercase, number, and punctuation.");
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const initialCurrency = currencyFromCountry(country);
        await saveUserDocument(cred.user.uid, {
          email: email.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`,
          photoURL: null,
          preferredCurrency: initialCurrency
        });
        await saveProfile(cred.user.uid, {
          firstName: firstName.trim(),
          otherName: otherName.trim() || undefined,
          lastName: lastName.trim(),
          country,
          city: city.trim(),
          currency: initialCurrency,
          email: email.trim()
        });
      }
      router.push("/entries");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithProvider(provider: GoogleAuthProvider | OAuthProvider) {
    setBusy(true);
    setError(null);

    try {
      await signInWithPopup(auth, provider);
      router.push("/entries");
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          setError(redirectError?.message || String(redirectError));
          return;
        }
      }

      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithProvider(provider);
  }

  async function handleApple() {
    const provider = new OAuthProvider("apple.com");
    provider.setCustomParameters({
      locale: "en",
      prompt: "select_account"
    });
    await signInWithProvider(provider);
  }

  return (
    <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden px-1.5 py-1.5">
      <div className="et-card mx-auto flex h-0 min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2">
          <CashLogo size={42} className="shrink-0 translate-y-px" />
          <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-3xl font-extrabold text-transparent">Expense Tracker</h1>
        </div>
        <p className="mt-1.5 shrink-0 text-sm text-slate-600 dark:text-slate-300">Track income, every expense, and generate monthly reports.</p>
        <div className="mt-3 inline-flex shrink-0 rounded-xl border border-indigo-100 bg-indigo-50/70 p-1 dark:border-white/10 dark:bg-white/5">
          <button
            className={`rounded-lg px-2.5 py-1.5 text-sm ${mode === "signin" ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
            type="button"
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            className={`rounded-lg px-2.5 py-1.5 text-sm ${mode === "signup" ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
            type="button"
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

        <div className="mt-3 h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
          <div className="grid gap-2">
        {mode === "signup" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">First name <span className="text-red-500">*</span></span>
              <input className="et-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Other name (optional)</span>
              <input className="et-input" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Last name <span className="text-red-500">*</span></span>
              <input className="et-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Country <span className="text-red-500">*</span></span>
              <select
                className="et-input"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                }}
                required>
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">City <span className="text-red-500">*</span></span>
              <input className="et-input" value={city} onChange={(e) => setCity(e.target.value)} required />
            </label>
          </div>
        ) : null}
        <label className="grid gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Email <span className="text-red-500">*</span></span>
          <input
            className="et-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Password <span className="text-red-500">*</span></span>
          <input
            className="et-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {mode === "signup" ? (
          <>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Confirm password <span className="text-red-500">*</span></span>
              <input
                className="et-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Password must be at least 8 characters with uppercase, lowercase, number, and punctuation.
            </p>
          </>
        ) : null}

        {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="et-btn-primary w-full"
            disabled={busy || !email || !password}
            onClick={() => handleEmailPassword(mode)}
          >
            {busy ? (mode === "signin" ? "Signing in..." : "Creating account...") : (mode === "signin" ? "Sign in" : "Create account")}
          </button>
        </div>

        <div className="mt-2 grid gap-2">
          <button
            className="et-btn-secondary flex items-center justify-center gap-2 w-full"
            disabled={busy}
            onClick={handleGoogle}
          >
            <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={mdiGoogle} />
            </svg>
            Continue with Google
          </button>
          <button
            className="et-btn-secondary flex items-center justify-center gap-2 w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
            disabled={busy}
            onClick={handleApple}
          >
            <svg className="h-5 w-5 text-white dark:text-slate-900" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={mdiApple} />
            </svg>
            Continue with Apple
          </button>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            By continuing, you agree to use your own data only. (MVP: no sharing/collaboration.)
          </p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

