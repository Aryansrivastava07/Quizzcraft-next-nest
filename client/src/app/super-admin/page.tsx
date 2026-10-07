"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { orgService } from "@/lib/api/org-service";
import { useAuth } from "@/lib/auth/auth-context";
import { Organization, Quiz, OrgMember, SuperAdminStats } from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

export default function SuperAdminPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"orgs" | "quizzes">("orgs");
  const [searchQuery, setSearchQuery] = useState("");

  // Drilldown modal state
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgDetails, setOrgDetails] = useState<{
    organization: Organization;
    members: OrgMember[];
    groups?: any[];
    quizzes: Quiz[];
    stats?: { totalMembers?: number; totalQuizzes?: number; totalAttempts?: number; totalGroups?: number };
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN" || Boolean(user?.isSuperAdmin);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) {
      loadData();
    }
  }, [authLoading, isSuperAdmin]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, orgsRes, quizzesRes] = await Promise.all([
        orgService.getSuperAdminStats(),
        orgService.getSuperAdminOrgs(),
        orgService.getSuperAdminQuizzes(),
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (orgsRes?.data?.organizations) setOrgs(orgsRes.data.organizations);
      if (quizzesRes?.data?.quizzes) setQuizzes(quizzesRes.data.quizzes);
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectOrg = async (orgId: string) => {
    setSelectedOrgId(orgId);
    setLoadingDetails(true);
    setDrilldownError(null);
    setOrgDetails(null);
    try {
      const res = await orgService.getSuperAdminOrgDetails(orgId);
      if (res?.data) {
        setOrgDetails(res.data);
      } else {
        setDrilldownError(res?.message || "Failed to load organization details.");
      }
    } catch (err: any) {
      console.error(err);
      setDrilldownError(formatApiError(err));
    } finally {
      setLoadingDetails(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
            <span className="material-symbols-outlined text-3xl">gavel</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Super Admin Access Required</h1>
          <p className="text-on-surface-variant text-sm mt-2 max-w-md">
            This terminal is strictly restricted to platform super administrators. Your account does
            not possess global operator credentials.
          </p>
          <Link
            href="/"
            className="mt-6 px-5 py-2 rounded-xl bg-primary-container text-white text-xs font-semibold hover:bg-primary-container/90 transition-colors"
          >
            Return to Command Center
          </Link>
        </main>
      </div>
    );
  }

  const filteredOrgs = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.orgId && q.orgId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-sm">shield_person</span>
              Global Oversight Command
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Super Admin Console
            </h1>
            <p className="text-on-surface-variant text-xs mt-1">
              Cross-tenant monitoring, institutional lifecycle, and global quiz activity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Sync Telemetry</span>
            </button>
            <Link
              href="/org/register"
              className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add_business</span>
              <span>Provision Org</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center gap-3">
            <span className="material-symbols-outlined text-red-400 text-base">error</span>
            <span className="flex-1">{error}</span>
            <button onClick={loadData} className="underline text-red-300 hover:text-white cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* Global KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">corporate_fare</span>
              Organizations
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              {stats?.totalOrgs ?? orgs.length}
            </p>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
              Active Institutional Tenants
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-tertiary text-base">group</span>
              Total Users
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              {stats?.totalUsers ?? 0}
            </p>
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-1">
              {stats?.totalOrgUsers ?? 0} in Orgs &bull; {stats?.totalPublicUsers ?? 0} Public
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-400 text-base">quiz</span>
              Global Quizzes
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              {stats?.totalQuizzes ?? quizzes.length}
            </p>
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-1">
              Across all tenants &amp; public
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-cyan-400 text-base">analytics</span>
              Total Attempts
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              {stats?.totalAttempts ?? 0}
            </p>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
              Graded Submissions
            </span>
          </div>
        </div>

        {/* View Switcher Tabs & Search Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="inline-flex p-1 rounded-2xl bg-white/[0.04] border border-white/10">
            <button
              onClick={() => setActiveTab("orgs")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "orgs"
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">apartment</span>
              <span>All Organizations ({orgs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "quizzes"
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">folder_open</span>
              <span>All Quizzes ({quizzes.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === "orgs" ? "Search orgs or slugs..." : "Search quiz titles..."}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>

        {/* Content Stages */}
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">
              progress_activity
            </span>
          </div>
        ) : activeTab === "orgs" ? (
          /* TAB 1: ALL ORGANIZATIONS TABLE */
          <div className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-on-surface-variant border-b border-white/10 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4">Slug</th>
                    <th className="py-3 px-4">Domain Filter</th>
                    <th className="py-3 px-4">Seats Utilized</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-on-surface">
                  {filteredOrgs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                        No organizations found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrgs.map((org) => (
                      <tr key={org.orgId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                              {org.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span>{org.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-tertiary">org/{org.slug}</td>
                        <td className="py-3.5 px-4 font-mono text-on-surface-variant">
                          {org.allowedEmailDomain ? `@${org.allowedEmailDomain}` : "Open Access"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white">{org.currentSeats}</span> /{" "}
                          <span className="text-on-surface-variant">{org.maxSeats}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                              org.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {org.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleInspectOrg(org.orgId)}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium border border-white/10 hover:border-primary/40 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm text-primary">
                              visibility
                            </span>
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TAB 2: ALL QUIZZES TABLE */
          <div className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-on-surface-variant border-b border-white/10 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Quiz Title</th>
                    <th className="py-3 px-4">Scope / Tenant</th>
                    <th className="py-3 px-4">Questions</th>
                    <th className="py-3 px-4">Mode / Protocol</th>
                    <th className="py-3 px-4">Attempts</th>
                    <th className="py-3 px-4">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-on-surface">
                  {filteredQuizzes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                        No quizzes found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredQuizzes.map((quiz) => (
                      <tr key={quiz.quizId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <Link
                            href={`/quiz/review/${quiz.quizId}`}
                            className="hover:text-primary transition-colors flex items-center gap-2"
                          >
                            <span>{quiz.title}</span>
                            {quiz.isPractice && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-on-surface-variant">
                                Practice
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          {quiz.orgId ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 font-mono">
                              Org: {quiz.orgId.slice(0, 8)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-on-surface-variant">
                              Public
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">{quiz.questions?.length ?? 0} items</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.04]">
                            {quiz.deploymentType || "ANYTIME"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {quiz.stats?.peopleAttempted ?? 0}
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant">
                          {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Drilldown Modal: Inspect Org Details */}
        {selectedOrgId && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-[#0b0e1b] border border-white/15 p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto relative animate-fadeIn">
              <button
                onClick={() => {
                  setSelectedOrgId(null);
                  setOrgDetails(null);
                }}
                className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              {loadingDetails ? (
                <div className="py-20 flex justify-center items-center">
                  <span className="material-symbols-outlined text-4xl text-primary animate-spin">
                    progress_activity
                  </span>
                </div>
              ) : orgDetails ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                        {orgDetails.organization.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          {orgDetails.organization.name}
                        </h2>
                        <p className="text-xs text-on-surface-variant font-mono">
                          org/{orgDetails.organization.slug} &bull; ID: {orgDetails.organization.orgId}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/${orgDetails.organization.slug}`}
                      target="_blank"
                      className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 mr-8"
                    >
                      <span>Visit Portal</span>
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                      <span className="text-[11px] text-on-surface-variant">Members</span>
                      <p className="text-lg font-bold text-white mt-1">
                        {orgDetails.stats?.totalMembers ?? orgDetails.members?.length ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                      <span className="text-[11px] text-on-surface-variant">Cohorts</span>
                      <p className="text-lg font-bold text-white mt-1">
                        {orgDetails.stats?.totalGroups ?? orgDetails.groups?.length ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                      <span className="text-[11px] text-on-surface-variant">Org Quizzes</span>
                      <p className="text-lg font-bold text-white mt-1">
                        {orgDetails.stats?.totalQuizzes ?? orgDetails.quizzes?.length ?? 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                      <span className="text-[11px] text-on-surface-variant">Total Submissions</span>
                      <p className="text-lg font-bold text-white mt-1">
                        {orgDetails.stats?.totalAttempts ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Members list */}
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mt-6 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">groups</span>
                    Enrolled Organization Members ({orgDetails.members?.length ?? 0})
                  </h3>
                  <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5 text-xs max-h-48 overflow-y-auto">
                    {orgDetails.members && orgDetails.members.length > 0 ? (
                      orgDetails.members.map((member) => (
                        <div
                          key={member.userId}
                          className="p-3 flex items-center justify-between hover:bg-white/[0.02]"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {member.fullName || member.username}
                            </p>
                            <p className="text-[11px] text-on-surface-variant font-mono">
                              {member.email}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-primary/10 text-primary border border-primary/20">
                            {member.role}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-on-surface-variant">
                        No members enrolled in this organization yet.
                      </div>
                    )}
                  </div>

                  {/* Cohort Groups list */}
                  {orgDetails.groups && orgDetails.groups.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-cyan-400">hub</span>
                        Cohort Groups ({orgDetails.groups.length})
                      </h3>
                      <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5 text-xs max-h-48 overflow-y-auto">
                        {orgDetails.groups.map((group) => (
                          <div
                            key={group.groupId}
                            className="p-3 flex items-center justify-between hover:bg-white/[0.02]"
                          >
                            <div>
                              <p className="font-semibold text-white">{group.name}</p>
                              <p className="text-[11px] text-on-surface-variant font-mono">
                                Code: {group.code} &bull; {group.memberIds?.length || 0} members
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              Cohort
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quizzes list */}
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mt-6 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-tertiary">assignment</span>
                    Quizzes Created in Workspace ({orgDetails.quizzes?.length ?? 0})
                  </h3>
                  <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5 text-xs max-h-48 overflow-y-auto">
                    {orgDetails.quizzes && orgDetails.quizzes.length > 0 ? (
                      orgDetails.quizzes.map((quiz) => (
                        <div
                          key={quiz.quizId}
                          className="p-3 flex items-center justify-between hover:bg-white/[0.02]"
                        >
                          <div>
                            <p className="font-semibold text-white">{quiz.title}</p>
                            <p className="text-[11px] text-on-surface-variant">
                              {quiz.questions?.length ?? 0} questions &bull; Created by {quiz.ownerEmail}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.05]">
                            {quiz.status || "LIVE"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-on-surface-variant">
                        No quizzes deployed in this organization yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : drilldownError ? (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-3xl text-red-400 mb-2">error</span>
                  <p className="text-sm text-red-200">{drilldownError}</p>
                  <button
                    onClick={() => selectedOrgId && handleInspectOrg(selectedOrgId)}
                    className="mt-4 px-4 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-white border border-white/10 cursor-pointer"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : (
                <div className="py-12 text-center text-red-400">Failed to load org details.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
