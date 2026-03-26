import {
  collection,
  type DocumentData,
  getDocs,
  query,
  type QueryConstraint,
  where
} from "firebase/firestore";

export async function listDocs<T extends DocumentData>(
  colPath: string[],
  constraints: QueryConstraint[] = []
) {
  // colPath: e.g. ["users", uid, "categories"]
  // This helper keeps repository code clean.
  const { db } = await import("./firebaseClient");
  const colRef = collection(db, ...colPath);
  const q = constraints.length ? query(colRef, ...constraints) : colRef;
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T & { id: string }));
}

export function byField(field: string, op: "==", value: unknown) {
  return where(field, op, value);
}

