"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { groupService } from "@/lib/api/group-service";
import { quizService } from "@/lib/api/quiz-service";
import { useAuth } from "@/lib/auth/auth-context";
import { useCohortSocket } from "@/lib/hooks/useCohortSocket";
import {
  Group,
  GroupMessage,
  GroupGradebookResponse,
  Quiz,
  OrgMember,
  GroupQuestionContext,
} from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

type GroupTab = "discussion" | "quizzes" | "gradebook" | "members" | "settings";

export default function GroupWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const { user, isLoading: authLoading } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<OrgMember[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [gradebook, setGradebook] = useState<GroupGradebookResponse | null>(null);

  const [activeTab, setActiveTab] = useState<GroupTab>("discussion");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Discussion state
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [questionContext, setQuestionContext] = useState<GroupQuestionContext | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [showPinnedDropdown, setShowPinnedDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Assign Quiz Modal state
  const [showAssignQuizModal, setShowAssignQuizModal] = useState(false);
  const [myAvailableQuizzes, setMyAvailableQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [quizDueDate, setQuizDueDate] = useState("");
  const [assigningQuiz, setAssigningQuiz] = useState(false);

  // Group settings state
  const [isLocked, setIsLocked] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Mobile sidebar toggle
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isCreatorOrAdmin =
    user?.userId === group?.creatorId ||
    user?.role === "ORG_ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    Boolean(user?.isSuperAdmin);

  const isMember =
    Boolean(user && group?.memberIds?.includes(user.userId)) ||
    Boolean(user && user.userId === group?.creatorId);

  // ==================== REAL-TIME WEBSOCKET INTEGRATION ====================
  const { isConnected, activeCadetsCount, typingUsers, sendTyping } = useCohortSocket({
    groupId,
    userId: user?.userId,
    username: user?.username || user?.fullName,
    onNewMessage: (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === newMsg.messageId)) return prev;
        return [...prev, newMsg];
      });
    },
    onMessagePinned: (messageId, isPinned) => {
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, isPinned } : m))
      );
    },
    onMessageDeleted: (messageId) => {
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    },
  });

  useEffect(() => {
    if (!authLoading && user && groupId) {
      loadGroupWorkspace();
    }
  }, [authLoading, user, groupId]);

  // Fallback Polling every 12s only if WebSocket is disconnected
  useEffect(() => {
    if (activeTab !== "discussion" || !groupId || isConnected) return;
    const interval = setInterval(async () => {
      try {
        const res = await groupService.getGroupMessages(groupId);
        if (res?.data?.messages) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        // Silent poll error
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [activeTab, groupId, isConnected]);

  const loadGroupWorkspace = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupRes, quizzesRes, messagesRes] = await Promise.all([
        groupService.getGroupById(groupId),
        groupService.getGroupQuizzes(groupId),
        groupService.getGroupMessages(groupId),
      ]);

      if (groupRes?.data?.group) {
        const fetchedGroup = groupRes.data.group;
        if (
          fetchedGroup.orgId &&
          user?.orgSlug &&
          fetchedGroup.orgId === user.orgId &&
          fetchedGroup.accessMode !== "PUBLIC"
        ) {
          router.replace(`/${user.orgSlug}/groups/${groupId}`);
          return;
        }

        setGroup(fetchedGroup);
        setMembers(groupRes.data.members || []);
        setPendingMembers(groupRes.data.pendingMembers || []);
        setIsLocked(fetchedGroup.isLocked);
        setRequireApproval(fetchedGroup.requireApproval);
      }
      if (quizzesRes?.data?.quizzes) {
        setQuizzes(quizzesRes.data.quizzes);
      }
      if (messagesRes?.data?.messages) {
        setMessages(messagesRes.data.messages);
      }

      // Load gradebook
      try {
        const gbRes = await groupService.getGroupGradebook(groupId);
        if (gbRes?.data) setGradebook(gbRes.data);
      } catch (e) {
        // Non-creators might not have gradebook access
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom of messages
  useEffect(() => {
    if (activeTab === "discussion") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() && !questionContext) return;
    setSendingMessage(true);
    try {
      const res = await groupService.postGroupMessage(groupId, {
        content: messageText.trim(),
        questionContext: questionContext || undefined,
      });

      if (res?.data) {
        const msg = (res.data as any).message || res.data;
        setMessages((prev) => {
          if (prev.some((m) => m.messageId === msg.messageId)) return prev;
          return [...prev, msg];
        });
        setMessageText("");
        setQuestionContext(null);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else {
      sendTyping();
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const res = await groupService.pinGroupMessage(groupId, messageId);
      if (res?.data) {
        const isPinned = Boolean((res.data as any).isPinned ?? (res.data as any).message?.isPinned);
        setMessages((prev) =>
          prev.map((m) => (m.messageId === messageId ? { ...m, isPinned } : m))
        );
      }
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await groupService.deleteGroupMessage(groupId, messageId);
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleApproveMember = async (targetUserId: string) => {
    try {
      await groupService.approvePendingMember(groupId, targetUserId);
      setSuccess("Member admitted into the cohort!");
      const approved = pendingMembers.find((p) => p.userId === targetUserId);
      setPendingMembers((prev) => prev.filter((p) => p.userId !== targetUserId));
      if (approved) {
        setMembers((prev) => [...prev, approved]);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleRegenerateCode = async () => {
    if (!confirm("Regenerate cohort code? The old code will expire immediately.")) return;
    try {
      const res = await groupService.regenerateGroupCode(groupId);
      if (res?.data?.code && group) {
        setGroup({ ...group, code: res.data.code });
        setSuccess(`New cohort code generated: ${res.data.code}`);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleSaveSecuritySettings = async () => {
    try {
      const res = await groupService.updateSettings(groupId, {
        isLocked,
        requireApproval,
      });
      if (res?.data) {
        setGroup(res.data);
        setSuccess("Cohort security preferences updated.");
      }
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleJoinCohortDirectly = async () => {
    try {
      await groupService.joinGroupById(groupId);
      setSuccess("You have joined this cohort!");
      await loadGroupWorkspace();
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleOpenAssignModal = async () => {
    setShowAssignQuizModal(true);
    try {
      const res = await quizService.getUserQuizzes();
      if (res?.data?.quizzes) {
        setMyAvailableQuizzes(res.data.quizzes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;
    setAssigningQuiz(true);
    try {
      await quizService.deployQuiz(selectedQuizId, {
        accessMode: "ORGANIZATION",
        groupId,
        dueDate: quizDueDate || undefined,
      });
      setSuccess("Quiz successfully assigned to cohort!");
      setShowAssignQuizModal(false);
      setSelectedQuizId("");
      setQuizDueDate("");
      const qRes = await groupService.getGroupQuizzes(groupId);
      if (qRes?.data?.quizzes) setQuizzes(qRes.data.quizzes);
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setAssigningQuiz(false);
    }
  };

  const handleExportGradebookCSV = () => {
    if (!gradebook || !gradebook.students.length) return;
    const header = [
      "User ID",
      "Full Name",
      "Username",
      "Email",
      ...gradebook.quizzes.map((q) => `"${q.title} Score (%)"`),
      "Average Score (%)",
      "Total Completed",
    ];

    const rows = gradebook.students.map((st) => [
      st.userId,
      `"${st.fullName || st.username}"`,
      st.username,
      st.email,
      ...gradebook.quizzes.map((q) => {
        const sc = st.scores[q.quizId];
        return sc ? sc.percentage : "N/A";
      }),
      st.averageScore,
      st.totalCompleted,
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gradebook_${group?.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyInviteLink = () => {
    if (typeof window === "undefined" || !group) return;
    const origin = window.location.origin;
    const link = `${origin}/auth?code=${group.code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getDueDateStatus = (dueDateStr?: string) => {
    if (!dueDateStr) return { label: "NO DEADLINE", style: "text-on-surface-variant bg-white/[0.04]" };
    const due = new Date(dueDateStr).getTime();
    const now = Date.now();
    const diffHours = (due - now) / (1000 * 60 * 60);

    if (diffHours < 0) {
      return {
        label: "PAST DUE",
        style: "text-red-400 bg-red-500/10 border-red-500/30",
        isPastDue: true,
      };
    }
    if (diffHours <= 24) {
      return {
        label: `DUE IN ${Math.max(1, Math.round(diffHours))}H`,
        style: "text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse",
      };
    }
    return {
      label: `DUE ${new Date(dueDateStr).toLocaleDateString()}`,
      style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    };
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="text-xs font-mono text-on-surface-variant animate-pulse">
            Connecting to Cohort Neural Network...
          </p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-xl font-bold text-white">Cohort Not Found or Access Denied</h1>
          <p className="text-xs text-on-surface-variant mt-2">
            You might not be enrolled in this cohort workspace.
          </p>
          <Link
            href="/groups"
            className="mt-4 px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-semibold"
          >
            Back to Cohorts Hub
          </Link>
        </main>
      </div>
    );
  }

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const unpinnedMessages = messages.filter((m) => !m.isPinned);

  return (
    <div className="min-h-screen bg-[#070913] text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      {/* Main Workspace Frame */}
      <div className="flex-1 w-full max-w-[1720px] mx-auto px-2 sm:px-4 pt-20 pb-3 flex flex-col lg:flex-row gap-3 h-[calc(100vh-0.5rem)] min-h-[640px] overflow-hidden">
        {/* ==================== LEFT SIDEBAR ==================== */}
        <aside
          className={`lg:w-72 xl:w-80 shrink-0 bg-[#0a0e1f]/95 backdrop-blur-2xl border border-white/10 rounded-2xl flex flex-col justify-between overflow-hidden shadow-2xl transition-all duration-300 z-20 ${
            mobileSidebarOpen ? "fixed inset-x-2 top-20 bottom-4 z-40 lg:static" : "hidden lg:flex"
          }`}
        >
          {/* Sidebar Top / Cohort Header */}
          <div className="p-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <Link
                href="/groups"
                className="text-xs text-on-surface-variant hover:text-white flex items-center gap-1.5 transition-colors font-medium group"
              >
                <span className="material-symbols-outlined text-sm group-hover:-translate-x-0.5 transition-transform">
                  arrow_back
                </span>
                <span>Cohorts Hub</span>
              </Link>

              {mobileSidebarOpen && (
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="lg:hidden text-on-surface-variant hover:text-white p-1"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-tertiary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0 shadow-md">
                {group.name.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-white truncate leading-tight" title={group.name}>
                    {group.name}
                  </h1>
                  {/* Live WebSocket Status Dot */}
                  <span
                    title={isConnected ? "WebSocket Online & Synced" : "Connecting WebSocket..."}
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isConnected
                        ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                        : "bg-amber-400"
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-primary border border-primary/25 text-[11px] font-mono font-bold cursor-pointer transition-colors"
                    title="Click to copy cohort code"
                  >
                    <span>{group.code}</span>
                    <span className="material-symbols-outlined text-[10px]">
                      {copiedCode ? "check" : "content_copy"}
                    </span>
                  </button>

                  {group.isLocked && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {group.description && (
              <p className="text-[11px] text-on-surface-variant mt-2.5 line-clamp-2 leading-relaxed">
                {group.description}
              </p>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
              <button
                onClick={handleCopyInviteLink}
                className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs text-tertiary">
                  {copiedLink ? "check" : "share"}
                </span>
                <span>{copiedLink ? "Copied!" : "Share Invite"}</span>
              </button>

              {isCreatorOrAdmin && (
                <button
                  onClick={handleOpenAssignModal}
                  className="py-1.5 px-3 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-[11px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  title="Assign Quiz to this Cohort"
                >
                  <span className="material-symbols-outlined text-xs">post_add</span>
                  <span>Assign</span>
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Channels / Navigation Tabs */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            <span className="block px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-outline">
              Cohort Navigation
            </span>

            {/* 1. Discussion Room */}
            <button
              onClick={() => {
                setActiveTab("discussion");
                setMobileSidebarOpen(false);
              }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                activeTab === "discussion"
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-on-surface-variant hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base">forum</span>
                <span>Discussion Room</span>
              </div>
              <div className="flex items-center gap-1.5">
                {isConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === "discussion" ? "bg-white/20 text-white" : "bg-white/10 text-on-surface-variant"
                  }`}
                >
                  {messages.length}
                </span>
              </div>
            </button>

            {/* 2. Assigned Quizzes */}
            <button
              onClick={() => {
                setActiveTab("quizzes");
                setMobileSidebarOpen(false);
              }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                activeTab === "quizzes"
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-on-surface-variant hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Assigned Quizzes</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === "quizzes" ? "bg-white/20 text-white" : "bg-white/10 text-on-surface-variant"
                }`}
              >
                {quizzes.length}
              </span>
            </button>

            {/* 3. Cohort Gradebook (Admin/Creator) */}
            {isCreatorOrAdmin && (
              <button
                onClick={() => {
                  setActiveTab("gradebook");
                  setMobileSidebarOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                  activeTab === "gradebook"
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-on-surface-variant hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-base">table_chart</span>
                  <span>Cohort Gradebook</span>
                </div>
                <span className="text-[10px] font-mono uppercase text-tertiary">Matrix</span>
              </button>
            )}

            {/* 4. Members */}
            <button
              onClick={() => {
                setActiveTab("members");
                setMobileSidebarOpen(false);
              }}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                activeTab === "members"
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-on-surface-variant hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base">people</span>
                <span>Members &amp; Roster</span>
              </div>
              <div className="flex items-center gap-1.5">
                {pendingMembers.length > 0 && isCreatorOrAdmin && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black font-bold text-[10px]">
                    {pendingMembers.length}
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === "members" ? "bg-white/20 text-white" : "bg-white/10 text-on-surface-variant"
                  }`}
                >
                  {members.length}
                </span>
              </div>
            </button>

            {/* 5. Cohort Settings (Admin/Creator) */}
            {isCreatorOrAdmin && (
              <button
                onClick={() => {
                  setActiveTab("settings");
                  setMobileSidebarOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2.5 ${
                  activeTab === "settings"
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-on-surface-variant hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-base">tune</span>
                <span>Cohort Settings</span>
              </button>
            )}
          </nav>

          {/* Sidebar Footer / Telemetry Status */}
          <div className="p-3.5 border-t border-white/10 bg-white/[0.01] text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary">sensors</span>
                Presence:
              </span>
              <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeCadetsCount} {activeCadetsCount === 1 ? "Cadet" : "Cadets"} Active
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
              <span>Sync Engine:</span>
              <span className={isConnected ? "text-emerald-400" : "text-amber-400"}>
                {isConnected ? "WebSocket Live" : "Polling Mode"}
              </span>
            </div>
          </div>
        </aside>

        {/* ==================== MAIN EXPANSIVE WORKSPACE AREA ==================== */}
        <main className="flex-1 min-w-0 bg-[#0a0e1f]/85 backdrop-blur-2xl border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
          {/* Guest / Non-member Banner */}
          {!isMember && (
            <div className="p-3 bg-tertiary/15 border-b border-tertiary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-tertiary shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base shrink-0">info</span>
                <span>You are viewing this public cohort as a guest. Join to participate in discussions and mission quizzes!</span>
              </div>
              <button
                onClick={handleJoinCohortDirectly}
                className="px-3 py-1 rounded-xl bg-tertiary text-black font-bold hover:bg-tertiary/90 transition-all shrink-0 cursor-pointer shadow-md text-xs"
              >
                Join Cohort Now
              </button>
            </div>
          )}

          {/* Alerts Banner */}
          {error && (
            <div className="p-3 bg-red-500/15 border-b border-red-500/30 text-red-200 text-xs flex items-center justify-between shrink-0">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-base">error</span>
                {error}
              </span>
              <button onClick={() => setError(null)} className="cursor-pointer text-red-400 hover:text-white">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between shrink-0">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                {success}
              </span>
              <button onClick={() => setSuccess(null)} className="cursor-pointer text-emerald-400 hover:text-white">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* ==================== TAB 1: DISCUSSION ROOM (EXPANDED TO FULL HEIGHT) ==================== */}
          {activeTab === "discussion" && (
            <div className="flex-1 flex flex-col h-full min-h-0">
              {/* Channel Top Header Bar */}
              <div className="h-14 px-4 sm:px-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setMobileSidebarOpen(true)}
                    className="lg:hidden p-1.5 rounded-lg bg-white/[0.04] text-white hover:bg-white/[0.08]"
                    title="Open Cohort Channels"
                  >
                    <span className="material-symbols-outlined text-base">menu</span>
                  </button>

                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary text-xl">forum</span>
                    <h2 className="font-headline-sm text-sm sm:text-base font-bold text-white truncate">
                      Cohort Discussion Stream
                    </h2>
                  </div>

                  {/* WebSocket Live Badge */}
                  <span
                    className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                      isConnected
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                      }`}
                    />
                    {isConnected ? "WebSocket Real-Time" : "Reconnecting..."}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Pinned Announcements Toggle */}
                  {pinnedMessages.length > 0 && (
                    <button
                      onClick={() => setShowPinnedDropdown(!showPinnedDropdown)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                        showPinnedDropdown
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                      }`}
                      title="View Pinned Instructor Notices"
                    >
                      <span className="material-symbols-outlined text-xs">keep</span>
                      <span>{pinnedMessages.length} Pinned</span>
                    </button>
                  )}

                  <span className="text-on-surface-variant text-xs font-mono hidden md:inline">
                    {messages.length} messages
                  </span>
                </div>
              </div>

              {/* Pinned Announcements Collapsible Panel */}
              {pinnedMessages.length > 0 && showPinnedDropdown && (
                <div className="p-3.5 bg-amber-500/10 border-b border-amber-500/25 text-xs animate-fadeIn shrink-0">
                  <div className="flex items-center justify-between mb-2 text-amber-400 font-bold">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">keep</span>
                      <span>Pinned Instructor Announcements ({pinnedMessages.length})</span>
                    </div>
                    <button
                      onClick={() => setShowPinnedDropdown(false)}
                      className="text-amber-400 hover:text-white"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {pinnedMessages.map((pm) => (
                      <div
                        key={pm.messageId}
                        className="p-2 rounded-lg bg-black/40 border border-amber-500/20 text-amber-100 flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="text-[10px] text-amber-300 font-bold mb-0.5">
                            {pm.authorName || pm.senderName} &bull;{" "}
                            {new Date(pm.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <p className="whitespace-pre-wrap">{pm.content}</p>
                        </div>
                        {isCreatorOrAdmin && (
                          <button
                            onClick={() => handlePinMessage(pm.messageId)}
                            className="text-amber-400 hover:text-white p-1"
                            title="Unpin"
                          >
                            <span className="material-symbols-outlined text-xs">keep_off</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Main Scroll Stream (Massive Space) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                {unpinnedMessages.length === 0 && pinnedMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant p-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-3 text-tertiary">
                      <span className="material-symbols-outlined text-3xl">chat_bubble_outline</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">Discussion Room Initialized</h3>
                    <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
                      Be the first cadet to start a study discussion, ask about quiz questions, or share insights!
                    </p>
                  </div>
                ) : (
                  unpinnedMessages.map((msg) => {
                    const authorId = msg.authorId || msg.senderId;
                    const isMine = authorId === user?.userId;
                    const authorName = msg.authorName || msg.senderName || "Cadet Pilot";
                    const authorRole = msg.authorRole || msg.senderRole;

                    return (
                      <div
                        key={msg.messageId}
                        className={`flex flex-col ${isMine ? "items-end" : "items-start"} animate-fadeIn`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[11px]">
                          <span className="font-semibold text-white">
                            {isMine ? "You" : authorName}
                          </span>
                          {authorRole && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-mono font-bold ${
                                authorRole === "SUPER_ADMIN"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : authorRole === "ORG_ADMIN"
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : authorRole === "ORG_PARTNER"
                                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                  : "bg-white/10 text-on-surface-variant border border-white/10"
                              }`}
                            >
                              {authorRole}
                            </span>
                          )}
                          <span className="text-outline text-[10px]">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div
                          className={`max-w-2xl rounded-2xl p-4 text-xs text-white relative group shadow-md transition-all ${
                            isMine
                              ? "bg-primary text-white shadow-primary/20"
                              : "bg-white/[0.05] border border-white/10 hover:border-white/20"
                          }`}
                        >
                          {/* Linked Question Context Snippet */}
                          {msg.questionContext && (
                            <div className="mb-2.5 p-3 rounded-xl bg-black/50 border border-white/10 text-[11px]">
                              <div className="flex items-center gap-1.5 text-tertiary font-bold mb-1">
                                <span className="material-symbols-outlined text-xs">help</span>
                                <span>Question In Reference:</span>
                              </div>
                              <p className="text-white font-medium italic leading-relaxed">
                                "{msg.questionContext.questionSnippet}"
                              </p>
                              {msg.questionContext.quizTitle && (
                                <span className="text-[10px] text-on-surface-variant mt-1.5 block font-mono">
                                  Quiz: {msg.questionContext.quizTitle}
                                </span>
                              )}
                            </div>
                          )}

                          <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>

                          {/* Hover Actions: Pin (Partner/Admin) or Delete */}
                          <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-black/80 rounded-lg p-1 backdrop-blur-sm border border-white/10">
                            {isCreatorOrAdmin && (
                              <button
                                onClick={() => handlePinMessage(msg.messageId)}
                                className="text-on-surface-variant hover:text-amber-400 p-0.5 cursor-pointer"
                                title="Pin Announcement"
                              >
                                <span className="material-symbols-outlined text-xs">keep</span>
                              </button>
                            )}
                            {(isMine || isCreatorOrAdmin) && (
                              <button
                                onClick={() => handleDeleteMessage(msg.messageId)}
                                className="text-on-surface-variant hover:text-red-400 p-0.5 cursor-pointer"
                                title="Delete Message"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Real-Time Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-tertiary font-mono animate-pulse pt-2">
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                    <span>
                      {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Question Context Attached Banner */}
              {questionContext && (
                <div className="px-4 py-2 bg-primary/10 border-t border-primary/25 flex items-center justify-between text-xs shrink-0">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="material-symbols-outlined text-primary text-sm shrink-0">
                      help_center
                    </span>
                    <span className="text-white truncate">
                      Linked: <em>"{questionContext.questionSnippet}"</em> ({questionContext.quizTitle})
                    </span>
                  </div>
                  <button
                    onClick={() => setQuestionContext(null)}
                    className="text-on-surface-variant hover:text-white cursor-pointer ml-2"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              )}

              {/* Message Input Bar (Pinned at Bottom of Chat Viewport) */}
              <div className="p-3 sm:p-4 border-t border-white/10 bg-white/[0.02] shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuestionSelector(!showQuestionSelector)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                      showQuestionSelector || questionContext
                        ? "bg-tertiary/20 text-tertiary border-tertiary/40"
                        : "bg-white/[0.04] hover:bg-white/[0.08] text-on-surface-variant hover:text-tertiary border-white/10"
                    }`}
                    title="Link a specific quiz question to your discussion"
                  >
                    <span className="material-symbols-outlined text-base">help_outline</span>
                  </button>

                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      sendTyping();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a message to your cohort... (Press Enter to send)"
                    className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-xs sm:text-sm text-white outline-none transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={sendingMessage || (!messageText.trim() && !questionContext)}
                    className="p-3 rounded-xl bg-primary hover:bg-primary/90 text-white disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-primary/25 flex items-center justify-center shrink-0"
                    title="Send Message"
                  >
                    {sendingMessage ? (
                      <span className="material-symbols-outlined text-base animate-spin">
                        progress_activity
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-base">send</span>
                    )}
                  </button>
                </form>

                {/* Question Selector Drawer / Modal */}
                {showQuestionSelector && (
                  <div className="mt-3 p-3.5 rounded-xl border border-white/10 bg-[#070914] text-xs max-h-52 overflow-y-auto shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">link</span>
                        Select a Quiz Question to Link:
                      </span>
                      <button
                        onClick={() => setShowQuestionSelector(false)}
                        className="text-on-surface-variant hover:text-white"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>

                    {quizzes.length === 0 ? (
                      <p className="text-on-surface-variant text-[11px] p-2 text-center">
                        No quizzes currently assigned in this cohort to link questions from.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {quizzes.flatMap((q) =>
                          (q.questions || []).map((quest, idx) => (
                            <button
                              key={`${q.quizId}-${quest.questionId || idx}`}
                              type="button"
                              onClick={() => {
                                setQuestionContext({
                                  quizId: q.quizId,
                                  quizTitle: q.title,
                                  questionId: quest.questionId || `q-${idx}`,
                                  questionSnippet: quest.question,
                                });
                                setShowQuestionSelector(false);
                              }}
                              className="w-full text-left p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-colors flex items-center justify-between gap-2"
                            >
                              <span className="truncate text-white">
                                <strong className="text-primary">{q.title}</strong>: {quest.question}
                              </span>
                              <span className="material-symbols-outlined text-xs text-primary shrink-0">
                                add_circle
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: ASSIGNED QUIZZES (EXPANDED GRID) ==================== */}
          {activeTab === "quizzes" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Assigned Mission Quizzes</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Quizzes released for study revision, timed tests, and cohort benchmarks.
                  </p>
                </div>

                {isCreatorOrAdmin && (
                  <button
                    onClick={handleOpenAssignModal}
                    className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span className="material-symbols-outlined text-sm">post_add</span>
                    <span>Assign Quiz</span>
                  </button>
                )}
              </div>

              {quizzes.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-12 text-center my-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 text-primary">
                    <span className="material-symbols-outlined text-3xl">assignment_late</span>
                  </div>
                  <h3 className="text-base font-bold text-white">No Quizzes Assigned Yet</h3>
                  <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                    Your instructor hasn't posted any mission quizzes to this cohort yet. Check back soon!
                  </p>
                  {isCreatorOrAdmin && (
                    <button
                      onClick={handleOpenAssignModal}
                      className="mt-4 px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-semibold cursor-pointer"
                    >
                      Assign First Quiz
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {quizzes.map((quiz) => {
                    const dueInfo = getDueDateStatus(quiz.dueDate);
                    return (
                      <div
                        key={quiz.quizId}
                        className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 hover:border-primary/40 transition-all flex flex-col justify-between shadow-xl group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${dueInfo.style}`}
                            >
                              {dueInfo.label}
                            </span>
                            <span className="text-[11px] text-on-surface-variant font-mono">
                              {quiz.questions?.length ?? 0} Questions
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white mt-1 group-hover:text-primary transition-colors">
                            {quiz.title}
                          </h3>
                          <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-1">
                            Mode: {quiz.deploymentType || "ANYTIME"} &bull; Created by {quiz.ownerEmail}
                          </p>
                        </div>

                        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                          <Link
                            href={`/quiz/review/${quiz.quizId}`}
                            className="text-xs text-on-surface-variant hover:text-white transition-colors"
                          >
                            Telemetry
                          </Link>

                          <Link
                            href={`/quiz/attempt/${quiz.quizId}`}
                            className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                            <span>{dueInfo.isPastDue ? "Practice Exam" : "Attempt Mission"}</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: GRADEBOOK MATRIX (WIDE HORIZONTAL SPREAD) ==================== */}
          {activeTab === "gradebook" && isCreatorOrAdmin && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Cohort Performance Matrix</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Real-time gradebook, accuracy percentiles, and submission matrices across all assigned quizzes.
                  </p>
                </div>

                <button
                  onClick={handleExportGradebookCSV}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                >
                  <span className="material-symbols-outlined text-sm text-emerald-400">download</span>
                  <span>Export Gradebook CSV</span>
                </button>
              </div>

              {!gradebook || gradebook.students.length === 0 ? (
                <div className="p-16 text-center text-on-surface-variant text-xs">
                  No student attempts recorded in this cohort yet.
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/[0.04] text-on-surface-variant border-b border-white/10 font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3.5 px-4">Cadet Student</th>
                          {gradebook.quizzes.map((q) => (
                            <th key={q.quizId} className="py-3.5 px-4 text-center max-w-[140px] truncate">
                              {q.title}
                            </th>
                          ))}
                          <th className="py-3.5 px-4 text-center">Avg Score</th>
                          <th className="py-3.5 px-4 text-center">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-on-surface">
                        {gradebook.students.map((student) => (
                          <tr key={student.userId} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-white">
                              <p>{student.fullName || student.username}</p>
                              <span className="text-[10px] text-on-surface-variant font-mono">
                                {student.email}
                              </span>
                            </td>
                            {gradebook.quizzes.map((q) => {
                              const result = student.scores[q.quizId];
                              return (
                                <td key={q.quizId} className="py-3.5 px-4 text-center">
                                  {result ? (
                                    <span
                                      className={`px-2.5 py-1 rounded-md font-mono font-bold text-[11px] ${
                                        result.percentage >= 80
                                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                          : result.percentage >= 50
                                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                                      }`}
                                    >
                                      {result.percentage}%
                                    </span>
                                  ) : (
                                    <span className="text-outline text-xs">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-3.5 px-4 text-center font-bold text-white text-sm">
                              {student.averageScore}%
                            </td>
                            <td className="py-3.5 px-4 text-center text-on-surface-variant font-mono">
                              {student.totalCompleted} / {gradebook.quizzes.length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 4: MEMBERS & ROSTER ==================== */}
          {activeTab === "members" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-lg font-extrabold text-white">Enrolled Cadets &amp; Instructors</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Cohort membership directory, participation credentials, and permissions.
                </p>
              </div>

              {/* Pending Approval Queue */}
              {pendingMembers.length > 0 && isCreatorOrAdmin && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 shadow-lg">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-3">
                    <span className="material-symbols-outlined text-base">how_to_reg</span>
                    Pending Admission Requests ({pendingMembers.length})
                  </div>
                  <div className="space-y-2">
                    {pendingMembers.map((pending) => (
                      <div
                        key={pending.userId}
                        className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {pending.fullName || pending.username}
                          </p>
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            {pending.email}
                          </span>
                        </div>
                        <button
                          onClick={() => handleApproveMember(pending.userId)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors cursor-pointer"
                        >
                          Approve Admission
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members List */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-white/10 font-bold text-xs text-white uppercase tracking-wider">
                  Enrolled Members ({members.length})
                </div>
                <div className="divide-y divide-white/5 text-xs">
                  {members.map((member) => (
                    <div
                      key={member.userId}
                      className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 border border-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                          {(member.fullName || member.username).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {member.fullName || member.username}
                          </p>
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            {member.email}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          member.role === "SUPER_ADMIN"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : member.role === "ORG_ADMIN"
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : member.role === "ORG_PARTNER"
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            : "bg-white/[0.05] text-on-surface-variant border border-white/10"
                        }`}
                      >
                        {member.role || "MEMBER"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 5: COHORT SETTINGS ==================== */}
          {activeTab === "settings" && isCreatorOrAdmin && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="pb-4 border-b border-white/10">
                <h2 className="text-lg font-extrabold text-white">Cohort Security &amp; Access Controls</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Configure admission requirements, invitation codes, and lock parameters.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Regenerate Code Card */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-on-surface-variant font-medium">Active Invite Code</span>
                    <p className="text-2xl font-bold font-mono text-primary mt-1.5">{group.code}</p>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                      Regenerating immediately invalidates previous link access. Cadets using the old code will no longer be able to join.
                    </p>
                  </div>
                  <button
                    onClick={handleRegenerateCode}
                    className="mt-4 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs border border-white/10 transition-colors cursor-pointer flex items-center gap-2 justify-center"
                  >
                    <span className="material-symbols-outlined text-sm">sync</span>
                    <span>Regenerate 6-Char Code</span>
                  </button>
                </div>

                {/* Lock & Approval Toggles */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLocked}
                      onChange={(e) => setIsLocked(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-primary cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-bold text-white">Lock Cohort</span>
                      <span className="block text-[11px] text-on-surface-variant mt-0.5">
                        Disallow all new code admissions. Existing members retain full access.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireApproval}
                      onChange={(e) => setRequireApproval(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-primary cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-bold text-white">Require Instructor Approval</span>
                      <span className="block text-[11px] text-on-surface-variant mt-0.5">
                        Cadets entering the code must be approved by the instructor before entering.
                      </span>
                    </div>
                  </label>

                  <button
                    onClick={handleSaveSecuritySettings}
                    className="w-full mt-2 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold cursor-pointer shadow-md transition-all"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== MODAL: ASSIGN QUIZ ==================== */}
      {showAssignQuizModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0b0e1b] border border-white/15 p-6 shadow-2xl relative animate-fadeIn">
            <button
              onClick={() => setShowAssignQuizModal(false)}
              className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex items-center gap-2 mb-4 text-primary">
              <span className="material-symbols-outlined text-xl">post_add</span>
              <h2 className="text-lg font-bold text-white">Assign Quiz to Cohort</h2>
            </div>

            <form onSubmit={handleAssignQuiz} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-on-surface-variant">
                  Select Quiz <span className="text-primary">*</span>
                </label>
                <select
                  required
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#0b0e1b]">-- Choose a Quiz --</option>
                  {myAvailableQuizzes.map((q) => (
                    <option key={q.quizId} value={q.quizId} className="bg-[#0b0e1b]">
                      {q.title} ({q.questions?.length ?? 0} Qs)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-on-surface-variant">
                  Submission Due Date &amp; Time <span className="text-outline text-[11px]">(Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={quizDueDate}
                  onChange={(e) => setQuizDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none"
                />
                <p className="text-[11px] text-on-surface-variant">
                  Quizzes past the deadline switch to open practice mode and flag submissions.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAssignQuizModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningQuiz || !selectedQuizId}
                  className="px-5 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {assigningQuiz ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">
                        progress_activity
                      </span>
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <span>Assign to Cohort</span>
                      <span className="material-symbols-outlined text-sm">check</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
