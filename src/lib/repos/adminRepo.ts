import {
  addDoc,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where
} from "firebase/firestore";
import { db } from "../firebaseClient";

export type DirectoryUser = {
  id: string;
  email: string;
  displayName?: string;
  role?: "admin" | "user";
  updatedAt?: unknown;
};

export type DirectoryUserUsage = DirectoryUser & {
  totalEntries: number;
  entriesLast30Days: number;
  lastEntryAt: Date | null;
};

export async function listDirectoryUsers(): Promise<DirectoryUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => {
      const data = d.data() as {
        email?: string;
        displayName?: string;
        role?: "admin" | "user";
        updatedAt?: unknown;
      };
      return {
        id: d.id,
        email: data.email || "",
        displayName: data.displayName,
        role: data.role,
        updatedAt: data.updatedAt
      };
    })
    .filter((u) => u.email)
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function createReviewRequest(adminUid: string, user: DirectoryUser) {
  await addDoc(collection(db, "reviewRequests"), {
    userId: user.id,
    userEmail: user.email,
    userDisplayName: user.displayName || "",
    requestedBy: adminUid,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return null;
}

async function readUserUsage(uid: string): Promise<Pick<DirectoryUserUsage, "totalEntries" | "entriesLast30Days" | "lastEntryAt">> {
  const txCol = collection(db, "users", uid, "transactions");
  const since = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [totalSnap, recentSnap, latestSnap] = await Promise.all([
    getCountFromServer(txCol),
    getCountFromServer(query(txCol, where("date", ">=", since))),
    getDocs(query(txCol, orderBy("date", "desc"), limit(1)))
  ]);
  const lastEntryAt = latestSnap.empty ? null : toDateSafe(latestSnap.docs[0].data().date);
  return {
    totalEntries: totalSnap.data().count,
    entriesLast30Days: recentSnap.data().count,
    lastEntryAt
  };
}

export async function listDirectoryUsersWithUsage(): Promise<DirectoryUserUsage[]> {
  const users = await listDirectoryUsers();
  const rows = await Promise.all(
    users.map(async (u) => {
      const usage = await readUserUsage(u.id);
      return { ...u, ...usage };
    })
  );
  return rows.sort((a, b) => {
    if (b.totalEntries !== a.totalEntries) return b.totalEntries - a.totalEntries;
    return a.email.localeCompare(b.email);
  });
}
