import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient";

export type DirectoryUser = {
  id: string;
  email: string;
  displayName?: string;
  role?: "admin" | "user";
};

export async function listDirectoryUsers(): Promise<DirectoryUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => {
      const data = d.data() as {
        email?: string;
        displayName?: string;
        role?: "admin" | "user";
      };
      return {
        id: d.id,
        email: data.email || "",
        displayName: data.displayName,
        role: data.role
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
