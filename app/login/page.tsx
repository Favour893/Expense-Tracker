"use client";

import React, { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth } from "../../src/lib/firebaseClient";
import { useRouter } from "next/navigation";
import { COUNTRIES, CURRENCIES, currencyFromCountry } from "../../src/lib/constants/countries";
import { saveProfile } from "../../src/lib/repos/profileRepo";
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
  const [currency, setCurrency] = useState("USD");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = new GoogleAuthProvider();

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
        await saveProfile(cred.user.uid, {
          firstName: firstName.trim(),
          otherName: otherName.trim() || undefined,
          lastName: lastName.trim(),
          country,
          city: city.trim(),
          currency,
          email: email.trim()
        });
      }
      router.push("/reports");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      router.push("/reports");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="et-card mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <CashLogo size={38} />
        <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-3xl font-extrabold text-transparent">Expense Tracker</h1>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Track income, every expense, and generate monthly reports.</p>
      <div className="mt-4 inline-flex rounded-xl border border-indigo-100 bg-indigo-50/70 p-1 dark:border-white/10 dark:bg-white/5">
        <button
          className={`rounded-lg px-3 py-2 text-sm ${mode === "signin" ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
          type="button"
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm ${mode === "signup" ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
          type="button"
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
      </div>

      <div className="mt-6 grid gap-4">
        {mode === "signup" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">First name</span>
              <input className="et-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Other name (optional)</span>
              <input className="et-input" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Last name</span>
              <input className="et-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Country</span>
              <select
                className="et-input"
                value={country}
                onChange={(e) => {
                  const code = e.target.value;
                  setCountry(code);
                  setCurrency(currencyFromCountry(code));
                }}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">City</span>
              <input className="et-input" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Currency (auto from country, editable)</span>
              <select className="et-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <label className="grid gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Email</span>
          <input
            className="et-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Password</span>
          <input
            className="et-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {mode === "signup" ? (
          <>
            <label className="grid gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Confirm password</span>
              <input
                className="et-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Password must be at least 8 characters with uppercase, lowercase, number, and punctuation.
            </p>
          </>
        ) : null}

        {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="et-btn-primary w-full"
            disabled={busy || !email || !password}
            onClick={() => handleEmailPassword(mode)}
          >
            {busy ? (mode === "signin" ? "Signing in..." : "Creating account...") : (mode === "signin" ? "Sign in" : "Create account")}
          </button>
        </div>

        <div className="mt-2">
          <button
            className="et-btn-secondary w-full"
            disabled={busy}
            onClick={handleGoogle}
          >
            Continue with Google
          </button>
          <p className="mt-3 text-xs text-slate-400">
            By continuing, you agree to use your own data only. (MVP: no sharing/collaboration.)
          </p>
        </div>
      </div>
    </div>
  );
}

