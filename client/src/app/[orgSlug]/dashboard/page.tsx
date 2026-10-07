"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import OrgWorkspaceGuard from "@/components/org/OrgWorkspaceGuard";
import { orgService } from "@/lib/api/org-service";
import { Organization, OrgMember } from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

export default function OrgSlugDashboardPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || "";

  return (
    <OrgWorkspaceGuard orgSlug={orgSlug} requiredRole="ORG_ADMIN">
      {({ organization }) => (
        <OrgDashboardContent organization={organization} orgSlug={orgSlug} />
      )}
    </OrgWorkspaceGuard>
  );
}

function OrgDashboardContent({
  organization,
  orgSlug,
}: {
  organization: Organization;
  orgSlug: string;
}) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Search/Filter members
  const [memberSearch, setMemberSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  useEffect(() => {
    loadMembers();
  }, [orgSlug]);

  const loadMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await orgService.getOrgMembersBySlug(orgSlug);
      if (res?.data?.members) {
        setMembers(res.data.members);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (
    targetUserId: string,
    newRole: "SUPER_ADMIN" | "ORG_ADMIN" | "ORG_PARTNER" | "ORG_STD"
  ) => {
    try {
      await orgService.updateMemberRole(targetUserId, newRole);
      setSuccess("Member role updated successfully.");
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm("Are you sure you want to remove this member from the organization?")) return;
    try {
      await orgService.removeMember(targetUserId);
      setSuccess("Member removed from organization.");
      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const getInviteLink = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth?org=${organization.slug}`;
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(getInviteLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.fullName && m.fullName.toLowerCase().includes(memberSearch.toLowerCase()));
    const matchesRole =
      roleFilter === "ALL" ||
      m.role === roleFilter ||
      (roleFilter === "ORG_STD" && (m.role === "ORG_STD" || (m.role as string) === "ORG_USER"));
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              Institutional Workspace Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {organization.name}
            </h1>
            <p className="text-on-surface-variant text-xs mt-1">
              Slug: <code className="text-tertiary">/{organization.slug}</code> &bull; Domain Whitelist:{" "}
              {organization.allowedEmailDomain ? `@${organization.allowedEmailDomain}` : "Unrestricted"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyInviteLink}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm text-tertiary">
                {copiedLink ? "check" : "link"}
              </span>
              <span>{copiedLink ? "Link Copied!" : "Copy Onboarding Link"}</span>
            </button>

            <Link
              href={`/${orgSlug}/groups`}
              className="px-4 py-2 rounded-xl bg-tertiary/20 text-tertiary hover:bg-tertiary/30 border border-tertiary/30 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">hub</span>
              <span>Cohort Groups</span>
            </Link>
          </div>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-xs font-medium text-on-surface-variant">Seat Allocation</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-white">{members.length}</span>
              <span className="text-xs text-on-surface-variant font-mono">
                / {organization.maxSeats || 100} Enrolled
              </span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{
                  width: `${Math.min(100, (members.length / (organization.maxSeats || 100)) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-xs font-medium text-on-surface-variant">Roster Role Breakdown</span>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <span className="text-xl font-bold text-white">
                  {members.filter((m) => m.role === "ORG_ADMIN").length}
                </span>
                <p className="text-[10px] text-on-surface-variant uppercase">Admins</p>
              </div>
              <div className="border-l border-white/10 pl-3">
                <span className="text-xl font-bold text-white">
                  {members.filter((m) => m.role === "ORG_PARTNER").length}
                </span>
                <p className="text-[10px] text-on-surface-variant uppercase">Partners</p>
              </div>
              <div className="border-l border-white/10 pl-3">
                <span className="text-xl font-bold text-white">
                  {members.filter((m) => m.role === "ORG_STD" || (m.role as string) === "ORG_USER").length}
                </span>
                <p className="text-[10px] text-on-surface-variant uppercase">Learners</p>
              </div>
            </div>
          </div>

          {/* Quick Onboarding Link Card */}
          <div className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-on-surface-variant">Member Join Link</span>
              <p className="text-[11px] text-on-surface-variant mt-1 truncate font-mono">
                {getInviteLink()}
              </p>
            </div>
            <button
              onClick={handleCopyInviteLink}
              className="mt-3 w-full py-1.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              <span>Copy Direct Invite Link</span>
            </button>
          </div>
        </div>

        {/* Members Management Table */}
        <div className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white">Organization Members Roster</h2>
              <p className="text-[11px] text-on-surface-variant">
                Manage roles, seat permissions, and access privileges.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#0b0e1b]">All Roles</option>
                <option value="ORG_ADMIN" className="bg-[#0b0e1b]">Org Admin</option>
                <option value="ORG_PARTNER" className="bg-[#0b0e1b]">Org Partner / Instructor</option>
                <option value="ORG_STD" className="bg-[#0b0e1b]">Learner (ORG_STD)</option>
              </select>

              {/* Search input */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-20 flex justify-center items-center">
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">
                progress_activity
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-on-surface-variant border-b border-white/10 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role Permission</th>
                    <th className="py-3 px-4">Joined Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-on-surface">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                        No members found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr key={member.userId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                              {(member.fullName || member.username).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p>{member.fullName || member.username}</p>
                              <span className="text-[10px] text-on-surface-variant font-mono">
                                @{member.username}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-on-surface-variant">
                          {member.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={member.role === ("ORG_USER" as any) ? "ORG_STD" : member.role}
                            onChange={(e) =>
                              handleRoleChange(
                                member.userId,
                                e.target.value as "SUPER_ADMIN" | "ORG_ADMIN" | "ORG_PARTNER" | "ORG_STD"
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold outline-none cursor-pointer border ${
                              member.role === "ORG_ADMIN"
                                ? "bg-primary/20 text-primary border-primary/40"
                                : member.role === "ORG_PARTNER"
                                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                                : "bg-white/[0.05] text-on-surface-variant border-white/10"
                            }`}
                          >
                            <option value="ORG_ADMIN" className="bg-[#0b0e1b] text-white">
                              ORG_ADMIN (Full Control)
                            </option>
                            <option value="ORG_PARTNER" className="bg-[#0b0e1b] text-white">
                              ORG_PARTNER (Create &amp; Assign Quizzes)
                            </option>
                            <option value="ORG_STD" className="bg-[#0b0e1b] text-white">
                              ORG_STD (Learner / Practice Only)
                            </option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant">
                          {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleRemoveMember(member.userId)}
                            className="px-2.5 py-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer text-xs"
                            title="Remove Member from Org"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
