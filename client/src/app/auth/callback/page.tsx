"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [statusMessage, setStatusMessage] = useState("Completing Google Authentication...");

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const redirectParam = searchParams.get("redirect") || "/profile";
    const successParam = searchParams.get("success");

    if (errorParam) {
      router.replace(`/auth?error=${encodeURIComponent(errorParam)}`);
      return;
    }

    async function finishGoogleAuth() {
      try {
        setStatusMessage("Verifying secure session credentials...");
        await refreshUser();
        setStatusMessage("Access granted! Entering QuizzCraft...");
        const target = redirectParam.startsWith("/") ? redirectParam : `/${redirectParam}`;
        router.replace(target);
      } catch (err: any) {
        console.error("Failed to complete Google OAuth session:", err);
        router.replace(`/auth?error=${encodeURIComponent(err?.message || "Failed to establish authenticated session.")}`);
      }
    }

    finishGoogleAuth();
  }, [searchParams, router, refreshUser]);

  return (
    <div className="min-h-screen bg-[#070913] text-on-surface flex flex-col items-center justify-center p-4 selection:bg-primary selection:text-white">
      <div className="w-full max-w-sm p-8 rounded-3xl bg-[#0b0e1b]/90 border border-white/10 shadow-2xl backdrop-blur-2xl text-center flex flex-col items-center gap-4 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-3xl animate-spin">
            progress_activity
          </span>
        </div>

        <div>
          <h2 className="text-base font-bold text-white font-headline-sm tracking-tight">
            Google Authentication
          </h2>
          <p className="text-xs text-on-surface-variant mt-1 font-body-sm leading-relaxed">
            {statusMessage}
          </p>
        </div>

        <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden mt-2">
          <div className="bg-primary h-full w-2/3 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070913] flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-primary animate-spin">
            progress_activity
          </span>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
