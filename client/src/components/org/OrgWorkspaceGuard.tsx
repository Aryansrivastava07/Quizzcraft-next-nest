"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/lib/auth/auth-context";
import { orgService } from "@/lib/api/org-service";
import { Organization } from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

interface OrgWorkspaceGuardProps {
  orgSlug: string;
  requiredRole?: "ORG_ADMIN" | "ORG_PARTNER";
  children: (data: {
    organization: Organization;
    stats: { memberCount: number; groupCount: number; quizCount: number; maxSeats: number };
    userRole: string;
    isOrgAdmin: boolean;
  }) => React.ReactNode;
}

export default function OrgWorkspaceGuard({
  orgSlug,
  requiredRole,
  children,
}: OrgWorkspaceGuardProps) {
  const { user, isLoading: authLoading, logout, refreshUser } = useAuth();
  const [orgData, setOrgData] = useState<{
    organization: Organization;
    stats: { memberCount: number; groupCount: number; quizCount: number; maxSeats: number };
    userRole: string;
    isMember: boolean;
    isOrgAdmin: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadOrg = async () => {
      setIsLoading(true);
      setError(null);
      setJoinError(null);
      try {
        const res = await orgService.getOrgBySlug(orgSlug);
        if (res?.data) {
          setOrgData(res.data);
        }
      } catch (err: any) {
        setError(formatApiError(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadOrg();
  }, [authLoading, user, orgSlug]);

  const handleJoinOrg = async () => {
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await orgService.joinOrg(orgSlug);
      // Refresh user context so user.orgSlug, user.role, etc. update in real time
      await refreshUser();
      // Re-fetch organization details
      const updated = await orgService.getOrgBySlug(orgSlug);
      if (updated?.data) {
        setOrgData(updated.data);
      }
    } catch (err: any) {
      setJoinError(formatApiError(err));
    } finally {
      setIsJoining(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  // Case 1: User is not logged in at all
  if (!user) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary shadow-lg shadow-primary/5">
            <span className="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Institutional Workspace</h1>
          <p className="text-on-surface-variant text-sm mt-2 max-w-md">
            The workspace for <code className="text-primary font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">/{orgSlug}</code> is private and requires institutional authentication.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              href={`/auth?org=${encodeURIComponent(orgSlug)}`}
              className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all"
            >
              Sign In to Organization
            </Link>
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-white text-xs font-semibold hover:bg-white/[0.08] border border-white/10 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Case 2: Org details failed to load / Not Found
  if (error || !orgData) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Organization Not Found</h1>
          <p className="text-on-surface-variant text-sm mt-2 max-w-md">
            {error || `The organization "${orgSlug}" does not exist or has been suspended.`}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all"
            >
              Return Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN" || Boolean(user.isSuperAdmin);
  const isMemberOfOrg = orgData.isMember || user.orgSlug === orgSlug || isSuperAdmin;

  // Case 3: Logged in user is NOT yet enrolled in this organization
  if (!isMemberOfOrg) {
    const org = orgData.organization;
    const stats = orgData.stats;
    const maxSeats = org.maxSeats || stats?.maxSeats || 100;
    const currentMembers = stats?.memberCount ?? 0;
    const seatsAvailable = currentMembers < maxSeats;
    const isOrgActive = org.status === "ACTIVE";

    const allowedDomain = org.allowedEmailDomain
      ? org.allowedEmailDomain.toLowerCase().replace(/^@/, "").trim()
      : null;
    const userEmails = [user.email, ...(user.emails || [])].filter(Boolean).map((e) => e.toLowerCase().trim());
    const matchedEmail = allowedDomain ? userEmails.find((e) => e.endsWith(`@${allowedDomain}`)) : user.email;
    const domainMatches = !allowedDomain || Boolean(matchedEmail);

    // Sub-case 3a: Organization is inactive/suspended
    if (!isOrgActive) {
      return (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
          <Navbar />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
              <span className="material-symbols-outlined text-3xl">pause_circle</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Organization Inactive</h1>
            <p className="text-on-surface-variant text-sm mt-2 max-w-md">
              The organization <strong className="text-white">{org.name}</strong> is currently inactive or suspended. New enrollments are paused.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all"
              >
                Return to Public QuizzCraft
              </Link>
            </div>
          </main>
        </div>
      );
    }

    // Sub-case 3b: Seats are completely full
    if (!seatsAvailable) {
      return (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
          <Navbar />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
              <span className="material-symbols-outlined text-3xl">group_off</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Seat Capacity Reached</h1>
            <p className="text-on-surface-variant text-sm mt-2 max-w-lg">
              <strong className="text-white">{org.name}</strong> has reached its maximum seat capacity of{" "}
              <strong className="text-white">{maxSeats} members</strong> ({currentMembers} currently enrolled). Please contact your institutional administrator.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all"
              >
                Back to Public QuizzCraft
              </Link>
              <button
                onClick={() => logout()}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-white text-xs font-semibold hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
              >
                Switch Account
              </button>
            </div>
          </main>
        </div>
      );
    }

    // Sub-case 3c: Domain mismatch limitation
    if (!domainMatches) {
      return (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
          <Navbar />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
              <span className="material-symbols-outlined text-3xl">verified_user</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Institutional Email Required</h1>
            <p className="text-on-surface-variant text-sm mt-2 max-w-lg">
              <strong className="text-white">{org.name}</strong> requires members to be verified with an institutional email address ending with{" "}
              <strong className="text-primary font-mono">@{allowedDomain}</strong>.
            </p>
            <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 max-w-md w-full text-left text-xs space-y-2">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Signed in as:</span>
                <span className="font-mono text-white">@{user.username}</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Active email:</span>
                <span className="font-mono text-red-300">{user.email}</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Required domain:</span>
                <span className="font-mono text-primary font-semibold">@{allowedDomain}</span>
              </div>
            </div>
            <p className="text-outline text-xs mt-3 max-w-md">
              Tip: You can keep your QuizzCraft account and link your institutional email in Profile Settings.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/profile?tab=settings"
                className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">link</span>
                <span>Link Institutional Email</span>
              </Link>
              <button
                onClick={() => logout()}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-white text-xs font-semibold hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
              >
                Switch Account
              </button>
              <Link
                href="/"
                className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:text-white text-xs font-medium transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </main>
        </div>
      );
    }

    // Sub-case 3d: All limitations matched! Show Enrollment Card to 1-click Join!
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-[#090d16]/90 backdrop-blur-2xl border border-white/[0.09] p-7 sm:p-8 shadow-2xl shadow-black/80 relative text-center">
            {/* Top ambient highlight */}
            <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto mb-4 text-primary shadow-lg shadow-primary/10">
              <span className="material-symbols-outlined text-3xl">corporate_fare</span>
            </div>

            <span className="px-3 py-1 rounded-full text-[10px] font-label-code font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 inline-block mb-2">
              Workspace Invitation
            </span>

            <h1 className="text-2xl font-bold text-white tracking-tight">
              Join {org.name}
            </h1>
            <p className="text-on-surface-variant text-xs mt-1.5 leading-relaxed">
              You are signed in as <strong className="text-white">@{user.username}</strong> ({user.email}). Enroll your account into this organization to access private cohorts, exams, and institutional leaderboards.
            </p>

            {/* Verification & Capacity Pill indicators */}
            <div className="my-5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-left text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-400 text-sm">verified</span>
                  Domain Match
                </span>
                <span className="font-mono text-emerald-400 font-medium">
                  {allowedDomain ? `@${allowedDomain}` : "Open Access"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">group</span>
                  Seat Availability
                </span>
                <span className="font-mono text-white">
                  {currentMembers} / {maxSeats} ({maxSeats - currentMembers} seats free)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-tertiary text-sm">school</span>
                  Role Assignment
                </span>
                <span className="font-mono text-tertiary font-medium">Student / Learner (ORG_STD)</span>
              </div>
            </div>

            {joinError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-left flex items-start gap-2">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                <span>{joinError}</span>
              </div>
            )}

            <button
              onClick={handleJoinOrg}
              disabled={isJoining}
              className="w-full py-3 px-6 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-50 text-white font-headline-sm text-xs font-semibold shadow-lg shadow-primary-container/25 border border-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isJoining ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  <span>Enrolling into Organization...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">login</span>
                  <span>Join {org.name} Workspace</span>
                </>
              )}
            </button>

            <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant pt-3 border-t border-white/[0.08]">
              <Link href="/" className="hover:text-white transition-colors">
                Back to Home
              </Link>
              <button
                onClick={() => logout()}
                className="hover:text-red-400 transition-colors cursor-pointer"
              >
                Switch Account
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Case 4: Role requirement check (e.g. Org Admin dashboard)
  if (
    requiredRole === "ORG_ADMIN" &&
    !orgData.isOrgAdmin &&
    !isSuperAdmin
  ) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
            <span className="material-symbols-outlined text-3xl">shield_lock</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Administrator Access Required</h1>
          <p className="text-on-surface-variant text-sm mt-2 max-w-md">
            This console is reserved for Organization Administrators. You are enrolled as an{" "}
            <strong className="text-primary font-mono">{user.role || "ORG_STD"}</strong>.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link
              href={`/${orgSlug}/groups`}
              className="px-5 py-2 rounded-xl bg-primary-container text-white text-xs font-semibold hover:bg-primary-container/90 transition-colors"
            >
              Go to Cohort Groups Hub
            </Link>
            <Link
              href={`/${orgSlug}`}
              className="px-4 py-2 rounded-xl bg-white/[0.04] text-white text-xs font-semibold hover:bg-white/[0.08] border border-white/10 transition-colors"
            >
              Org Portal
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <>{children(orgData)}</>;
}
