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
  merchantOrPayee?: string;
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

