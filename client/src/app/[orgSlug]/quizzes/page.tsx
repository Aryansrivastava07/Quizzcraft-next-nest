"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import OrgWorkspaceGuard from "@/components/org/OrgWorkspaceGuard";
import { orgService } from "@/lib/api/org-service";
import { useAuth } from "@/lib/auth/auth-context";
import { Quiz, Organization } from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

export default function OrgSlugQuizzesPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || "";

  return (
    <OrgWorkspaceGuard orgSlug={orgSlug}>
      {({ organization }) => (
        <OrgQuizzesContent organization={organization} orgSlug={orgSlug} />
      )}
    </OrgWorkspaceGuard>
  );
}

function OrgQuizzesContent({
  organization,
  orgSlug,
}: {
  organization: Organization;
  orgSlug: string;
}) {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadQuizzes();
  }, [orgSlug]);

  const loadQuizzes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await orgService.getOrgQuizzesBySlug(orgSlug);
      if (res?.data?.quizzes) {
        setQuizzes(res.data.quizzes);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const isPartnerOrAdmin =
    user?.role === "ORG_ADMIN" ||
    user?.role === "ORG_PARTNER" ||
    user?.role === "SUPER_ADMIN" ||
    Boolean(user?.isSuperAdmin);

  const filteredQuizzes = quizzes.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.pin && q.pin.includes(search));
    const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/${orgSlug}`}
                className="text-xs text-on-surface-variant hover:text-white transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>{organization.name} Portal</span>
              </Link>
              <span className="text-on-surface-variant text-xs">&bull;</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                /{organization.slug}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Institutional Assessments &amp; Quizzes
            </h1>
            <p className="text-on-surface-variant text-xs mt-1">
              All examinations, tests, and homework modules deployed strictly within this organization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/${orgSlug}/arena`}
              className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">swords</span>
              <span>Join Live Arena</span>
            </Link>

            {isPartnerOrAdmin && (
              <Link
                href={`/${orgSlug}/create`}
                className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Create New Assessment</span>
              </Link>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-6 p-4 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#0b0e1b]">All Statuses</option>
              <option value="LIVE" className="bg-[#0b0e1b]">Live Synchronized</option>
              <option value="SCHEDULED" className="bg-[#0b0e1b]">Scheduled</option>
              <option value="ANYTIME" className="bg-[#0b0e1b]">Anytime Self-Paced</option>
            </select>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-sm">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quiz title or PIN..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Quizzes List */}
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">
              progress_activity
            </span>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="py-20 rounded-3xl bg-[#0b0e1b]/60 border border-white/10 text-center flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-3xl">quiz</span>
            </div>
            <h2 className="text-lg font-bold text-white">No Quizzes Found</h2>
            <p className="text-xs text-on-surface-variant mt-2 max-w-md">
              {isPartnerOrAdmin
                ? "You haven't deployed any quizzes to this organization yet. Click 'Create New Assessment' to author one."
                : "No assessments have been assigned to your cohorts yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.quizId}
                className="group p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 hover:border-white/20 transition-all backdrop-blur-xl flex flex-col justify-between shadow-xl"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                        quiz.status === "LIVE"
                          ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                          : quiz.status === "SCHEDULED"
                          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      ● {quiz.status}
                    </span>

                    {quiz.pin && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.05] text-on-surface-variant">
                        PIN: {quiz.pin}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors line-clamp-2">
                    {quiz.title}
                  </h3>
                  <div className="mt-2 text-xs text-on-surface-variant space-y-1">
                    <p className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">help</span>
                      <span>{quiz.questions?.length || 0} Questions</span>
                    </p>
                    {quiz.isPractice && (
                      <p className="text-[11px] text-amber-400 font-medium">
                        &bull; Self-Practice Sandbox
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <Link
                    href={`/quiz?quizId=${encodeURIComponent(quiz.quizId)}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold text-center transition-all shadow-md shadow-primary-container/20 border border-white/10 active:scale-95 cursor-pointer"
                  >
                    Enter Assessment
                  </Link>

                  {isPartnerOrAdmin && (
                    <Link
                      href={`/quiz/admin?quizId=${encodeURIComponent(quiz.quizId)}`}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 transition-colors"
                      title="Proctor / Admin Console"
                    >
                      <span className="material-symbols-outlined text-base">monitoring</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
