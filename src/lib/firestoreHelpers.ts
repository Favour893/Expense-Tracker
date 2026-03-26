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