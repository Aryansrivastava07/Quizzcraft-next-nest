"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { groupService } from "@/lib/api/group-service";
import { useAuth } from "@/lib/auth/auth-context";
import { Group } from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

export default function GroupsHubPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<"explore" | "my">("explore");
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Join by code state
  const [joinCode, setJoinCode] = useState("");
  const [joiningGroup, setJoiningGroup] = useState(false);

  // Create public group modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Joining direct state
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      loadGroups();
    }
  }, [authLoading]);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [pubRes, myRes] = await Promise.all([
        groupService.getPublicGroups(),
        user ? groupService.getUserGroups() : Promise.resolve({ data: { groups: [] } }),
      ]);

      if (pubRes?.data?.groups) {
        setPublicGroups(pubRes.data.groups);
      }
      if (myRes?.data?.groups) {
        setMyGroups(myRes.data.groups);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinViaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    if (!user) {
      router.push("/auth");
      return;
    }
    setJoiningGroup(true);
    setError(null);
    try {
      const res = await groupService.joinGroup(joinCode.trim());
      setSuccess("Successfully joined cohort!");
      setJoinCode("");
      await loadGroups();
      const targetId = res?.data?.groupId || res?.data?.group?.groupId;
      if (targetId) {
        router.push(`/groups/${targetId}`);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setJoiningGroup(false);
    }
  };

  const handleDirectJoin = async (groupId: string) => {
    if (!user) {
      router.push("/auth");
      return;
    }
    setJoiningGroupId(groupId);
    setError(null);
    try {
      const res = await groupService.joinGroupById(groupId);
      setSuccess("Successfully joined cohort!");
      await loadGroups();
      router.push(`/groups/${groupId}`);
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setJoiningGroupId(null);
    }
  };

  const handleCreatePublicGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    if (!user) {
      router.push("/auth");
      return;
    }
    setCreatingGroup(true);
    setError(null);
    try {
      const res = await groupService.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || undefined,
        accessMode: "PUBLIC",
      });

      const newGroup = res?.data?.group;
      if (newGroup) {
        setSuccess(`Public cohort "${newGroup.name}" created! Admission code: ${newGroup.code}`);
        setShowCreateModal(false);
        setNewGroupName("");
        setNewGroupDesc("");
        await loadGroups();
        router.push(`/groups/${newGroup.groupId}`);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setCreatingGroup(false);
    }
  };

  const displayedGroups = activeTab === "explore" ? publicGroups : myGroups;
  const filteredGroups = displayedGroups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (g.code && g.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Hero Section */}
        <div className="rounded-3xl bg-[#0b0e1b]/90 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs font-semibold uppercase tracking-wider mb-3">
                <span className="material-symbols-outlined text-sm">hub</span>
                Public Study Cohorts
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Knowledge Communities &amp; Cohorts
              </h1>
              <p className="text-on-surface-variant text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
                Collaborate in public study groups, participate in discussion threads on tricky questions,
                and complete assigned quiz challenges together. All public cohorts are open for anyone to join!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  if (!user) router.push("/auth");
                  else setShowCreateModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-tertiary text-black text-xs font-bold hover:bg-tertiary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-tertiary/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Create Public Cohort</span>
              </button>
            </div>
          </div>

          {/* Quick Join By Code Bar */}
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-tertiary">key</span>
              <span>Have a 6-character cohort admission code?</span>
            </div>
            <form onSubmit={handleJoinViaCode} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                required
                maxLength={8}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="QC-XXXX"
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-center font-mono tracking-wider text-xs text-white font-bold outline-none focus:border-tertiary transition-colors uppercase w-32"
              />
              <button
                type="submit"
                disabled={joiningGroup || !joinCode.trim()}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
              >
                {joiningGroup ? "Joining..." : "Join"}
              </button>
            </form>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs hover:text-white cursor-pointer">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-xs hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        {/* Tabs & Search Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 w-fit">
            <button
              onClick={() => setActiveTab("explore")}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "explore"
                  ? "bg-tertiary text-black shadow-md shadow-tertiary/20"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">public</span>
              <span>Explore Public Cohorts ({publicGroups.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "my"
                  ? "bg-tertiary text-black shadow-md shadow-tertiary/20"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">groups</span>
              <span>My Cohorts ({myGroups.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined text-base text-outline absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cohorts..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline focus:border-tertiary outline-none transition-colors"
            />
          </div>
        </div>

        {/* Groups Grid */}
        {isLoading ? (
          <div className="py-24 text-center">
            <span className="material-symbols-outlined text-4xl text-tertiary animate-spin">
              progress_activity
            </span>
            <p className="text-xs text-on-surface-variant mt-3">Loading cohorts...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#0b0e1b]/60 border border-white/10 text-center backdrop-blur-xl">
            <div className="w-14 h-14 rounded-2xl bg-tertiary/10 border border-tertiary/20 flex items-center justify-center text-tertiary mx-auto mb-4">
              <span className="material-symbols-outlined text-2xl">hub</span>
            </div>
            <h3 className="text-base font-bold text-white">No cohorts found</h3>
            <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
              {activeTab === "my"
                ? "You haven't joined or created any cohorts yet. Explore public cohorts to get started!"
                : searchQuery
                ? "No public cohorts match your search query."
                : "No public cohorts have been created yet. Be the first to start a community study cohort!"}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-5 px-4 py-2 rounded-xl bg-tertiary text-black text-xs font-bold hover:bg-tertiary/90 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Create First Cohort</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((g) => {
              const isEnrolled =
                g.isMember ||
                (user && g.memberIds?.includes(user.userId)) ||
                (user && g.creatorId === user.userId);

              return (
                <div
                  key={g.groupId}
                  className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 hover:border-tertiary/40 transition-all p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-tertiary/10 border border-tertiary/20 flex items-center justify-center text-tertiary font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-xl">groups</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/[0.06] text-outline border border-white/10">
                          {g.code}
                        </span>
                        {isEnrolled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Enrolled
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="text-base font-bold text-white group-hover:text-tertiary transition-colors line-clamp-1">
                      {g.name}
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1.5 line-clamp-2 leading-relaxed">
                      {g.description || "Open community cohort for collaborative test prep and knowledge sharing."}
                    </p>

                    <div className="flex items-center gap-4 mt-4 text-[11px] text-outline">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-tertiary">group</span>
                        <strong className="text-white">{g.memberCount || g.memberIds?.length || 1}</strong> members
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-primary">quiz</span>
                        <strong className="text-white">{g.quizCount || 0}</strong> quizzes
                      </span>
                    </div>

                    {g.creator && (
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[11px] text-on-surface-variant">
                        <span className="material-symbols-outlined text-xs text-outline">person</span>
                        <span>Host: <strong className="text-white">@{g.creator.username}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                    {isEnrolled ? (
                      <Link
                        href={`/groups/${g.groupId}`}
                        className="w-full py-2 px-3 rounded-xl bg-tertiary/15 hover:bg-tertiary/25 text-tertiary border border-tertiary/30 text-xs font-bold transition-all text-center flex items-center justify-center gap-1"
                      >
                        <span>Enter Cohort</span>
                        <span className="material-symbols-outlined text-xs">&rarr;</span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleDirectJoin(g.groupId)}
                        disabled={joiningGroupId === g.groupId}
                        className="w-full py-2 px-3 rounded-xl bg-tertiary text-black text-xs font-bold hover:bg-tertiary/90 transition-all text-center flex items-center justify-center gap-1 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        <span>{joiningGroupId === g.groupId ? "Joining..." : "Join Cohort"}</span>
                        <span className="material-symbols-outlined text-xs">add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Public Cohort Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-[#0b0e1b] border border-white/10 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-tertiary">hub</span>
                <h3 className="font-bold text-white text-base">Create Public Cohort</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-outline hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePublicGroup} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white block mb-1.5">
                  Cohort Name <span className="text-tertiary">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Quantum Computing Enthusiasts"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline focus:border-tertiary outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white block mb-1.5">
                  Description / Study Focus
                </label>
                <textarea
                  rows={3}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What is this cohort focusing on? What material will you be studying?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline focus:border-tertiary outline-none transition-colors resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-tertiary/10 border border-tertiary/20 text-[11px] text-tertiary flex items-start gap-2">
                <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">public</span>
                <span>
                  This cohort will be public. Anyone on QuizzCraft can discover it, join instantly, and collaborate on shared quizzes.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="px-5 py-2 rounded-xl bg-tertiary text-black text-xs font-bold hover:bg-tertiary/90 disabled:opacity-40 transition-all cursor-pointer shadow-md"
                >
                  {creatingGroup ? "Creating..." : "Create Cohort"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
