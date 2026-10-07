"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import OrgWorkspaceGuard from "@/components/org/OrgWorkspaceGuard";
import { orgService } from "@/lib/api/org-service";
import { groupService } from "@/lib/api/group-service";
import { useAuth } from "@/lib/auth/auth-context";
import { Group, Organization } from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

export default function OrgSlugGroupsPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || "";

  return (
    <OrgWorkspaceGuard orgSlug={orgSlug}>
      {({ organization }) => (
        <OrgGroupsContent organization={organization} orgSlug={orgSlug} />
      )}
    </OrgWorkspaceGuard>
  );
}

function OrgGroupsContent({
  organization,
  orgSlug,
}: {
  organization: Organization;
  orgSlug: string;
}) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Form states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupApproval, setNewGroupApproval] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joiningGroup, setJoiningGroup] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [orgSlug]);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await orgService.getOrgGroupsBySlug(orgSlug);
      if (res?.data?.groups) {
        setGroups(res.data.groups);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    setError(null);
    try {
      const res = await groupService.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
        requireApproval: newGroupApproval,
      });

      const newGroup = res?.data?.group;
      if (newGroup) {
        setGroups((prev) => [newGroup, ...prev]);
        setShowCreateModal(false);
        setNewGroupName("");
        setNewGroupDesc("");
        setNewGroupApproval(false);
        setSuccess(`Group "${newGroup.name}" created with invite code ${newGroup.code}!`);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoiningGroup(true);
    setError(null);
    try {
      const res = await groupService.joinGroup(joinCode.trim());
      if (res?.data?.group) {
        setShowJoinModal(false);
        setJoinCode("");
        setSuccess(res.message || "Joined group successfully!");
        loadGroups();
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setJoiningGroup(false);
    }
  };

  const isPartnerOrAdmin =
    user?.role === "ORG_ADMIN" ||
    user?.role === "ORG_PARTNER" ||
    user?.role === "SUPER_ADMIN" ||
    Boolean(user?.isSuperAdmin);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-sm">hub</span>
              {organization.name} Cohorts
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Group Workspaces Hub
            </h1>
            <p className="text-on-surface-variant text-xs mt-1">
              Collaborate in study cohorts, attempt group-assigned exams, and exchange discussions with peers and instructors.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-sm text-tertiary">key</span>
              <span>Join via 6-Char Code</span>
            </button>

            {isPartnerOrAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Create New Cohort</span>
              </button>
            )}
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

        {/* Groups Grid */}
        {isLoading ? (
          <div className="py-20 flex justify-center items-center">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">
              progress_activity
            </span>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 rounded-3xl bg-[#0b0e1b]/60 border border-white/10 text-center flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-3xl bg-tertiary/10 border border-tertiary/20 flex items-center justify-center mb-4 text-tertiary">
              <span className="material-symbols-outlined text-3xl">groups_3</span>
            </div>
            <h2 className="text-lg font-bold text-white">No Cohorts in this Organization Yet</h2>
            <p className="text-xs text-on-surface-variant mt-2 max-w-md">
              {isPartnerOrAdmin
                ? "As an instructor or administrator, you can create the first cohort class or study team for your learners."
                : "Ask your instructor or team partner for an invite code or link to join your cohort."}
            </p>
            <div className="mt-6 flex items-center gap-3">
              {isPartnerOrAdmin ? (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 transition-all cursor-pointer active:scale-95"
                >
                  Create First Cohort Group
                </button>
              ) : (
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-tertiary/20 text-tertiary border border-tertiary/30 text-xs font-semibold hover:bg-tertiary/30 transition-all cursor-pointer"
                >
                  Enter Join Code
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group.groupId}
                className="group p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 hover:border-white/20 transition-all backdrop-blur-xl flex flex-col justify-between shadow-xl"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-tertiary/10 border border-tertiary/20 text-[11px] font-mono text-tertiary font-bold tracking-wider">
                      CODE: {group.code}
                    </span>
                    {group.isLocked && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                        LOCKED
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-tertiary transition-colors line-clamp-1">
                    {group.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-2 min-h-[32px]">
                    {group.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-outline">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">group</span>
                      {group.memberCount || group.memberIds?.length || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">assignment</span>
                      {group.quizCount || 0}
                    </span>
                  </div>

                  <Link
                    href={`/${orgSlug}/groups/${group.groupId}`}
                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-white flex items-center gap-1 transition-all"
                  >
                    <span>Enter Workspace</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL: CREATE GROUP */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#0b0e1b] border border-white/15 p-6 shadow-2xl relative animate-fadeIn">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <div className="flex items-center gap-2 mb-4 text-primary">
                <span className="material-symbols-outlined text-xl">group_add</span>
                <h2 className="text-lg font-bold text-white">Create Cohort Workspace</h2>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">
                    Cohort Name <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. CS201 - Data Structures Cohort A"
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-on-surface-variant">Description</label>
                  <textarea
                    rows={3}
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Brief description of the study cohort or course objectives..."
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <input
                    type="checkbox"
                    id="requireApproval"
                    checked={newGroupApproval}
                    onChange={(e) => setNewGroupApproval(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                  <label htmlFor="requireApproval" className="text-xs text-on-surface-variant cursor-pointer">
                    <strong className="text-white">Require Instructor Approval</strong>
                    <p className="text-[11px] text-outline mt-0.5">
                      Learners must be approved before viewing questions &amp; exams.
                    </p>
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/[0.04] text-xs font-medium text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingGroup || !newGroupName.trim()}
                    className="px-5 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 disabled:opacity-40 transition-all cursor-pointer active:scale-95"
                  >
                    {creatingGroup ? "Creating..." : "Create Cohort"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: JOIN GROUP VIA CODE */}
        {showJoinModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#0b0e1b] border border-white/15 p-6 shadow-2xl relative animate-fadeIn">
              <button
                onClick={() => setShowJoinModal(false)}
                className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <div className="flex items-center gap-2 mb-4 text-tertiary">
                <span className="material-symbols-outlined text-xl">key</span>
                <h2 className="text-lg font-bold text-white">Join Cohort Group</h2>
              </div>

              <form onSubmit={handleJoinGroup} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant">
                    6-Character Admission Code <span className="text-tertiary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 7X9K2A"
                    className="mt-1 w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-center font-mono tracking-widest text-lg text-white font-bold outline-none focus:border-tertiary transition-colors uppercase"
                  />
                  <p className="text-[11px] text-outline mt-1 text-center">
                    Provided by your instructor or cohort administrator.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/[0.04] text-xs font-medium text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joiningGroup || joinCode.length !== 6}
                    className="px-5 py-2 rounded-xl bg-tertiary text-black text-xs font-bold hover:bg-tertiary/90 disabled:opacity-40 transition-colors cursor-pointer shadow-lg"
                  >
                    {joiningGroup ? "Joining..." : "Enter Group"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
