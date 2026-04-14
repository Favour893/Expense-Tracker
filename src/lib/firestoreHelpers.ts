import {
  collection,
  type DocumentData,
  getDocs,
  query,
  type QueryConstraint,
  where
} from "firebase/firestore";

export async function listDocs<T extends DocumentData>(
  colPath: [string, ...string[]],
  constraints: QueryConstraint[] = []
) {
  const { db } = await import("./firebaseClient");

  const colRef = collection(db, ...colPath);

  // Always use query()
  const q = query(colRef, ...constraints);

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data()
  } as T & { id: string }));
}

export function byField(field: string, op: "==", value: unknown) {
  return where(field, op, value);
}

/** Milliseconds since epoch for Firestore Timestamp-like values (or 0 if unknown). */
export function firestoreTimestampMs(ts: unknown): number {
  if (ts == null) return 0;
  if (typeof ts === "object" && "toMillis" in ts && typeof (ts as { toMillis: () => number }).toMillis === "function") {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === "object" && ts !== null && "seconds" in ts) {
    const sec = Number((ts as { seconds: number }).seconds);
    if (!Number.isFinite(sec)) return 0;
    const nano = Number((ts as { nanoseconds?: number }).nanoseconds ?? 0);
    return sec * 1000 + Math.floor(nano / 1e6);
  }
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  if (ts instanceof Date && !Number.isNaN(ts.getTime())) return ts.getTime();
  return 0;
}