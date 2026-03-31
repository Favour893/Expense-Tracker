import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebaseClient";

export type UserProfile = {
  firstName: string;
  otherName?: string;
  lastName: string;
  country: string;
  city: string;
  currency: string;
  email: string;
};

export type UserDocument = {
  email: string;
  displayName?: string;
  photoURL?: string | null;
  preferredCurrency: string;
};

export async function saveProfile(uid: string, profile: UserProfile) {
  await setDoc(
    doc(db, "users", uid, "profile", "main"),
    {
      ...profile,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid, "profile", "main"));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function saveUserDocument(uid: string, user: UserDocument) {
  await setDoc(
    doc(db, "users", uid),
    {
      ...user,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserDocument;
}

