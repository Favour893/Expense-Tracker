import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { firebaseConfig } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional: enable Analytics when configured.
// This mirrors the common "getAnalytics(app)" pattern from the Firebase setup docs.
try {
  if (firebaseConfig?.measurementId) getAnalytics(app);
} catch {
  // Ignore analytics initialization errors for local/dev environments.
}

