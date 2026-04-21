"use client";

import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { useEffect } from "react";

import { db } from "../../lib/firebaseClient";
import { useAuth } from "../auth/AuthProvider";
import { useNotifications } from "./NotificationProvider";

const FEEDBACK_INVITE = "feedback_invite";

/** Shows in-app toasts for admin-sent feedback invitations stored under `users/{uid}/notifications`. */
export function ReviewInviteNotificationListener() {
  const { user } = useAuth();
  const { notifyInfo } = useNotifications();

  useEffect(() => {
    if (!user?.uid) return;

    const notificationsCol = collection(db, "users", user.uid, "notifications");
    const q = query(notificationsCol, where("delivered", "==", false));
    const handledThisSession = new Set<string>();

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added" && change.type !== "modified") return;
          const id = change.doc.id;
          if (handledThisSession.has(id)) return;

          const data = change.doc.data() as {
            type?: string;
            message?: string;
            delivered?: boolean;
          };
          if (data.delivered === true) return;
          if (data.type !== FEEDBACK_INVITE) return;

          handledThisSession.add(id);
          const msg =
            typeof data.message === "string" && data.message.trim()
              ? data.message.trim()
              : "We’d love your feedback on Expense Tracker. Tap Feedback when you have a moment.";

          notifyInfo(msg);

          updateDoc(doc(db, "users", user.uid, "notifications", id), { delivered: true }).catch(() => {
            handledThisSession.delete(id);
          });
        });
      },
      () => {
        /* ignore permission errors when signed out mid-flight */
      }
    );

    return () => {
      unsub();
    };
  }, [notifyInfo, user?.uid]);

  return null;
}
