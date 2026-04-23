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

/** One document per user at `reviews/{uid}` (voluntary in-app feedback). Admin read only. */
export type VoluntaryReviewDoc = {
  userId: string;
  rating: number;
  comment: string;
  source?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
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

/** Records an admin review outreach row and delivers an in-app notification to the target user on next session. */
export async function requestUserFeedback(adminUid: string, user: DirectoryUser) {
  await createReviewRequest(adminUid, user);
  await addDoc(collection(db, "users", user.id, "notifications"), {
    type: "feedback_invite",
    message:
      "We’d love your feedback on Expense Tracker. Tap the Feedback button (bottom-right) when you have a moment.",
    delivered: false,
    createdAt: serverTimestamp()
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
  const lastEntryData = latestSnap.empty ? null : latestSnap.docs[0].data();
  const lastEntryAt =
    toDateSafe(lastEntryData?.updatedAt) ||
    toDateSafe(lastEntryData?.createdAt) ||
    toDateSafe(lastEntryData?.date) ||
    null;
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

function reviewSortTime(r: VoluntaryReviewDoc): number {
  const d = r.updatedAt || r.createdAt;
  return d ? d.getTime() : 0;
}

/** Lists all voluntary feedback docs (newest activity first). Requires admin Firestore rules. */
export async function listVoluntaryReviews(): Promise<VoluntaryReviewDoc[]> {
  const snap = await getDocs(collection(db, "reviews"));
  const rows: VoluntaryReviewDoc[] = snap.docs.map((d) => {
    const data = d.data() as {
      userId?: string;
      rating?: unknown;
      comment?: unknown;
      source?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    return {
      userId: typeof data.userId === "string" ? data.userId : d.id,
      rating: Math.round(Number(data.rating)) || 0,
      comment: typeof data.comment === "string" ? data.comment : "",
      source: typeof data.source === "string" ? data.source : undefined,
      createdAt: toDateSafe(data.createdAt),
      updatedAt: toDateSafe(data.updatedAt)
    };
  });
  rows.sort((a, b) => reviewSortTime(b) - reviewSortTime(a));
  return rows;
}
