import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, type DocumentData } from "firebase/firestore";
import { db } from "../firebaseClient";
import type { Category } from "../../types/app";

export type CategoryCreateInput = {
  name: string;
  type: "income" | "expense";
};

export async function listCategories(uid: string): Promise<Category[]> {
  const q = query(collection(db, "users", uid, "categories"), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) } as Category));
}

export async function createCategory(uid: string, data: CategoryCreateInput) {
  const payload = {
    ...data,
    isActive: true,
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "users", uid, "categories"), payload);
  return ref.id;
}

export async function deleteCategory(uid: string, categoryId: string) {
  await deleteDoc(doc(db, "users", uid, "categories", categoryId));
}

