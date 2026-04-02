import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData
} from "firebase/firestore";
import { db } from "../firebaseClient";
import type { Transaction, TransactionType } from "../../types/app";

export type TransactionCreateInput = {
  date: Timestamp;
  amount: number;
  type: TransactionType;
  categoryId: string;
  description?: string;
  notes?: string;
  monthKey: string;
};

function monthKeyFromDate(date: Timestamp) {
  const d = date.toDate();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function listTransactionsByMonth(uid: string, monthKey: string): Promise<Transaction[]> {
  const q = query(
    collection(db, "users", uid, "transactions"),
    where("monthKey", "==", monthKey),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) } as Transaction));
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDayLocalMs(iso: string): number {
  const d = parseIsoDateLocal(iso);
  if (Number.isNaN(d.getTime())) return NaN;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

function endOfDayLocalMs(iso: string): number {
  const d = parseIsoDateLocal(iso);
  if (Number.isNaN(d.getTime())) return NaN;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

function transactionMillis(ts: unknown): number {
  if (ts == null) return 0;
  if (typeof ts === "object" && ts !== null && "toMillis" in ts && typeof (ts as { toMillis: () => number }).toMillis === "function") {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** Every `YYYY-MM` monthKey that overlaps the inclusive local-date range. */
export function monthKeysCoveringRange(startIso: string, endIso: string): string[] {
  const s = parseIsoDateLocal(startIso);
  const e = parseIsoDateLocal(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return [];
  const keys: string[] = [];
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  const endMonth = new Date(e.getFullYear(), e.getMonth(), 1);
  while (cur.getTime() <= endMonth.getTime()) {
    keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

/** Loads transactions whose `date` falls in the inclusive local calendar range (uses existing monthKey queries + client filter). */
export async function listTransactionsByDateRange(uid: string, startIso: string, endIso: string): Promise<Transaction[]> {
  const startMs = startOfDayLocalMs(startIso);
  const endMs = endOfDayLocalMs(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return [];

  const keys = monthKeysCoveringRange(startIso, endIso);
  if (!keys.length) return [];

  const batches = await Promise.all(keys.map((mk) => listTransactionsByMonth(uid, mk)));
  const byId = new Map<string, Transaction>();

  for (const batch of batches) {
    for (const t of batch) {
      const ms = transactionMillis(t.date);
      if (ms >= startMs && ms <= endMs && !byId.has(t.id)) {
        byId.set(t.id, t);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => transactionMillis(a.date) - transactionMillis(b.date));
}

export async function createTransaction(uid: string, input: Omit<TransactionCreateInput, "monthKey"> & { monthKey?: string }) {
  const monthKey = input.monthKey || monthKeyFromDate(input.date);
  const rawPayload = {
    ...input,
    monthKey,
    createdAt: serverTimestamp()
  };
  const payload = Object.fromEntries(
    Object.entries(rawPayload).filter(([, value]) => value !== undefined)
  );
  const ref = await addDoc(collection(db, "users", uid, "transactions"), payload);
  return ref.id;
}

export async function deleteTransaction(uid: string, transactionId: string) {
  await deleteDoc(doc(db, "users", uid, "transactions", transactionId));
}

