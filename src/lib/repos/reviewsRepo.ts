import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../firebaseClient";

export type VoluntaryReviewPayload = {
  rating: number;
  comment: string;
};

/** Saves or updates this user's voluntary review at `reviews/{uid}`. */
export async function saveVoluntaryReview(uid: string, payload: VoluntaryReviewPayload) {
  const rating = Math.round(Number(payload.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const ref = doc(db, "reviews", uid);
  const existing = await getDoc(ref);

  await setDoc(
    ref,
    {
      userId: uid,
      rating,
      comment: payload.comment.trim(),
      source: "voluntary",
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
    },
    { merge: true }
  );
}
