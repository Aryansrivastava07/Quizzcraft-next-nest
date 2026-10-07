"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import OrgWorkspaceGuard from "@/components/org/OrgWorkspaceGuard";

export default function OrgPortalPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || "";
  const [copiedLink, setCopiedLink] = useState(false);

  return (
    <OrgWorkspaceGuard orgSlug={orgSlug}>
      {({ organization, stats, userRole, isOrgAdmin }) => {
        const inviteLink =
          typeof window !== "undefined"
            ? `${window.location.origin}/auth?org=${organization.slug}`
            : "";

        const handleCopyInvite = () => {
          navigator.clipboard.writeText(inviteLink);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
        };

        return (
          <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
            <Navbar />

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16">
              {/* Org Hero Header */}
              <div className="rounded-3xl bg-[#0b0e1b]/90 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                      <span className="material-symbols-outlined text-sm">apartment</span>
                      Institutional Workspace Portal
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                      {organization.name}
                    </h1>
                    <p className="text-on-surface-variant text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
                      Welcome to your private institutional domain. All cohorts, examination streams, and learner performance matrices are sandboxed exclusively within this organization.
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-mono text-outline">
                      <span className="text-tertiary">/{organization.slug}</span>
                      <span>&bull;</span>
                      <span>
                        Domain: {organization.allowedEmailDomain ? `@${organization.allowedEmailDomain}` : "Unrestricted"}
                      </span>
                      <span>&bull;</span>
                      <span>
                        Enrolled: <strong className="text-white">{stats.memberCount}</strong> / {stats.maxSeats} Seats
                      </span>
                      <span>&bull;</span>
                      <span className="text-amber-400 font-semibold">Your Role: {userRole}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <button
                      onClick={handleCopyInvite}
                      className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm text-tertiary">
                        {copiedLink ? "check" : "link"}
                      </span>
                      <span>{copiedLink ? "Invite Link Copied!" : "Copy Join Link"}</span>
                    </button>

                    {isOrgAdmin && (
                      <Link
                        href={`/${orgSlug}/dashboard`}
                        className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-lg shadow-primary-container/25 border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                        <span>Admin Console</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Workspace Navigation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* 1. Cohort Groups */}
                <Link
                  href={`/${orgSlug}/groups`}
                  className="group p-6 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 hover:border-tertiary/40 transition-all backdrop-blur-xl flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-tertiary/10 border border-tertiary/20 flex items-center justify-center text-tertiary mb-4 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-2xl">hub</span>
                    </div>
                    <h2 className="text-lg font-bold text-white group-hover:text-tertiary transition-colors">
                      Cohort Groups &amp; Classes
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                      Access enrolled cohorts, study threads, discussions, and complete assigned assessments.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-white font-bold">{stats.groupCount} Active Groups</span>
                    <span className="text-tertiary font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Enter Hub &rarr;
                    </span>
                  </div>
                </Link>

                {/* 2. Org Quizzes */}
                <Link
                  href={`/${orgSlug}/quizzes`}
                  className="group p-6 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 hover:border-primary/40 transition-all backdrop-blur-xl flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-2xl">quiz</span>
                    </div>
                    <h2 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                      Organization Assessments
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                      Browse and take examinations, midterms, and self-paced homework modules designed for this organization.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-white font-bold">{stats.quizCount} Quizzes</span>
                    <span className="text-primary font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Explore &rarr;
                    </span>
                  </div>
                </Link>

                {/* 3. Create Quiz */}
                <Link
                  href={`/${orgSlug}/create`}
                  className="group p-6 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 hover:border-cyan-400/40 transition-all backdrop-blur-xl flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-2xl">add_circle</span>
                    </div>
                    <h2 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                      Create Assessment
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                      Synthesize anti-spoiler questions from PDFs, lecture videos, and diagrams scoped for this workspace.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-white font-bold">AI Multi-Modal</span>
                    <span className="text-cyan-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Create Quiz &rarr;
                    </span>
                  </div>
                </Link>

                {/* 4. Live Arena */}
                <Link
                  href={`/${orgSlug}/arena`}
                  className="group p-6 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 hover:border-amber-400/40 transition-all backdrop-blur-xl flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-2xl">swords</span>
                    </div>
                    <h2 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                      Synchronized Arena Room
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                      Join real-time, live multiplayer exam rounds with proctoring and synchronized cohort leaderboards.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-white font-bold">Live Exams</span>
                    <span className="text-amber-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Join Arena &rarr;
                    </span>
                  </div>
                </Link>
              </div>

              {/* Quick Onboarding Footer Card */}
              <div className="rounded-2xl bg-[#0b0e1b]/60 border border-white/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-white">Need to invite learners or instructors?</span>
                  <p className="text-on-surface-variant mt-0.5">
                    Share your dedicated URL <code className="text-tertiary">/auth?org={organization.slug}</code> to register members directly into your workspace.
                  </p>
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="px-3.5 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-semibold transition-colors cursor-pointer self-start sm:self-auto"
                >
                  {copiedLink ? "Link Copied!" : "Copy Onboarding Link"}
                </button>
              </div>
            </main>
          </div>
        );
      }}
    </OrgWorkspaceGuard>
  );
}
