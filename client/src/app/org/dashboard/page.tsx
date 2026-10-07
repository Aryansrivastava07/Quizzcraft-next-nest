"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth/auth-context";

export default function OrgDashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user?.orgSlug) {
      router.replace(`/${user.orgSlug}/dashboard`);
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  if (user?.orgSlug) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary">
          <span className="material-symbols-outlined text-3xl">apartment</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Institutional Workspace Required</h1>
        <p className="text-on-surface-variant text-xs sm:text-sm mt-2 leading-relaxed">
          The Organization Admin Console is exclusive to registered institutions. Your current account is not linked to any organization.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/org/register"
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-lg"
          >
            Register an Organization
          </Link>
          <Link
            href="/quizzes"
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-white text-xs font-semibold hover:bg-white/[0.08] border border-white/10 transition-colors"
          >
            Browse Public Quizzes
          </Link>
        </div>
      </main>
    </div>
  );
}
