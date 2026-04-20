import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebaseClient";

export type AdminStatsSummary = {
  totalUsers: number;
  totalTransactions: number;
  totalExpenseAmount: number;
  totalIncomeAmount: number;
  updatedAt?: unknown;
};

export type AdminStatsMonthly = {
  id: string;
  monthKey: string;
  newUsers: number;
  transactions: number;
  expenseAmount: number;
  incomeAmount: number;
};

export async function getAdminStatsSummary(): Promise<AdminStatsSummary | null> {
  const snap = await getDoc(doc(db, "adminStats", "summary"));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<AdminStatsSummary>;
  return {
    totalUsers: Number(data.totalUsers || 0),
    totalTransactions: Number(data.totalTransactions || 0),
    totalExpenseAmount: Number(data.totalExpenseAmount || 0),
    totalIncomeAmount: Number(data.totalIncomeAmount || 0),
    updatedAt: data.updatedAt
  };
}

export async function listAdminStatsMonthly(maxRows = 6): Promise<AdminStatsMonthly[]> {
  const q = query(collection(db, "adminStats", "monthly", "rows"), orderBy("monthKey", "desc"), limit(maxRows));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Partial<AdminStatsMonthly>;
    return {
      id: d.id,
      monthKey: String(data.monthKey || d.id),
      newUsers: Number(data.newUsers || 0),
      transactions: Number(data.transactions || 0),
      expenseAmount: Number(data.expenseAmount || 0),
      incomeAmount: Number(data.incomeAmount || 0)
    };
  });
}
