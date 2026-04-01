"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "./AuthProvider";
import { PageLoadingShimmer } from "../ui/PageLoadingShimmer";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-0 min-h-0 w-full flex-1 flex-col overflow-hidden">
        <PageLoadingShimmer label="Loading session" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        Redirecting...
      </div>
    );
  }

  return <>{children}</>;
}

