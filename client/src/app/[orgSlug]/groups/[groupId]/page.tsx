"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import OrgWorkspaceGuard from "@/components/org/OrgWorkspaceGuard";
import { groupService } from "@/lib/api/group-service";
import { quizService } from "@/lib/api/quiz-service";
import { useAuth } from "@/lib/auth/auth-context";
import {
  Group,
  GroupMessage,
  GroupGradebookResponse,
  Quiz,
  OrgMember,
  GroupQuestionContext,
} from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

type GroupTab = "quizzes" | "discussion" | "gradebook" | "members";

export default function GroupWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) || "";
  const groupId = (params?.groupId as string) || "";
  const { user, isLoading: authLoading } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<OrgMember[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [gradebook, setGradebook] = useState<GroupGradebookResponse | null>(null);

  const [activeTab, setActiveTab] = useState<GroupTab>("quizzes");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Discussion state
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [questionContext, setQuestionContext] = useState<GroupQuestionContext | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
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

  const isCreatorOrAdmin =
    user?.userId === group?.creatorId ||
    user?.role === "ORG_ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    Boolean(user?.isSuperAdmin);

  useEffect(() => {
    if (!authLoading && user && groupId) {
      loadGroupWorkspace();
    }
  }, [authLoading, user, groupId]);

  // Polling for discussion messages every 6 seconds when on discussion tab
  useEffect(() => {
    if (activeTab !== "discussion" || !groupId) return;
    const interval = setInterval(async () => {
      try {
        const res = await groupService.getGroupMessages(groupId);
        if (res?.data?.messages) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        // Silent poll error
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [activeTab, groupId]);

  const loadGroupWorkspace = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupRes, quizzesRes, messagesRes] = await Promise.all([
        groupService.getGroupById(groupId),
        groupService.getGroupQuizzes(groupId),
        groupService.getGroupMessages(groupId),
      ]);

      if (groupRes?.data) {
        setGroup(groupRes.data.group);
        setMembers(groupRes.data.members || []);
        setPendingMembers(groupRes.data.pendingMembers || []);
        setIsLocked(groupRes.data.group.isLocked);
        setRequireApproval(groupRes.data.group.requireApproval);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && !questionContext) return;
    setSendingMessage(true);
    try {
      const res = await groupService.postGroupMessage(groupId, {
        content: messageText.trim(),
        questionContext: questionContext || undefined,
      });

      if (res?.data) {
        setMessages((prev) => [...prev, res.data]);
        setMessageText("");
        setQuestionContext(null);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const res = await groupService.pinGroupMessage(groupId, messageId);
      if (res?.data?.message) {
        setMessages((prev) =>
          prev.map((m) => (m.messageId === messageId ? res.data.message : m))
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
      setSuccess("Member admitted into the group!");
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
    if (!confirm("Regenerate group code? The old code will expire immediately.")) return;
    try {
      const res = await groupService.regenerateGroupCode(groupId);
      if (res?.data?.code && group) {
        setGroup({ ...group, code: res.data.code });
        setSuccess(`New group code generated: ${res.data.code}`);
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
        setSuccess("Group security preferences updated.");
      }
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
      setSuccess("Quiz successfully assigned to group!");
      setShowAssignQuizModal(false);
      setSelectedQuizId("");
      setQuizDueDate("");
      // Reload quizzes
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

  // Helper for Quiz Due Date Status
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
        <span className="material-symbols-outlined text-4xl text-primary animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-xl font-bold text-white">Group Not Found or Access Denied</h1>
          <p className="text-xs text-on-surface-variant mt-2">
            You might not be enrolled in this group workspace.
          </p>
          <Link
            href={`/${orgSlug}/groups`}
            className="mt-4 px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-semibold"
          >
            Back to Groups Hub
          </Link>
        </main>
      </div>
    );
  }

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const unpinnedMessages = messages.filter((m) => !m.isPinned);

  return (
    <OrgWorkspaceGuard orgSlug={orgSlug}>
      {() => (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
          <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16 flex flex-col">
        {/* Workspace Top Banner */}
        <div className="rounded-3xl bg-[#0b0e1b]/80 border border-white/10 p-6 sm:p-8 backdrop-blur-xl mb-6 shadow-2xl relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href={`/${orgSlug}/groups`}
                  className="text-xs text-on-surface-variant hover:text-white transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Cohorts Hub</span>
                </Link>
                <span className="text-on-surface-variant text-xs">&bull;</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {group.code}
                </span>
                {group.isLocked && (
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                    Locked
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {group.name}
              </h1>
              {group.description && (
                <p className="text-xs text-on-surface-variant mt-1.5 max-w-2xl">
                  {group.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyInviteLink}
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm text-tertiary">
                  {copiedLink ? "check" : "share"}
                </span>
                <span>{copiedLink ? "Invite Link Copied!" : "Share Invite Code"}</span>
              </button>

              {isCreatorOrAdmin && (
                <button
                  onClick={handleOpenAssignModal}
                  className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">post_add</span>
                  <span>Assign Quiz</span>
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === "quizzes"
                  ? "bg-primary-container text-white shadow-md shadow-primary-container/20 border border-white/10"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">quiz</span>
              <span>Assigned Quizzes ({quizzes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("discussion")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === "discussion"
                  ? "bg-primary-container text-white shadow-md shadow-primary-container/20 border border-white/10"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">forum</span>
              <span>Discussion Room</span>
              {messages.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                  {messages.length}
                </span>
              )}
            </button>

            {isCreatorOrAdmin && (
              <button
                onClick={() => setActiveTab("gradebook")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === "gradebook"
                    ? "bg-primary-container text-white shadow-md shadow-primary-container/20 border border-white/10"
                    : "text-on-surface-variant hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-sm">table_chart</span>
                <span>Cohort Gradebook</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab("members")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === "members"
                  ? "bg-primary-container text-white shadow-md shadow-primary-container/20 border border-white/10"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">people</span>
              <span>Members ({members.length})</span>
              {pendingMembers.length > 0 && isCreatorOrAdmin && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold text-[10px]">
                  {pendingMembers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-400 text-base">error</span>
              {error}
            </span>
            <button onClick={() => setError(null)} className="cursor-pointer">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
              {success}
            </span>
            <button onClick={() => setSuccess(null)} className="cursor-pointer">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* TAB 1: ASSIGNED QUIZZES */}
        {activeTab === "quizzes" && (
          <div className="space-y-4">
            {quizzes.length === 0 ? (
              <div className="rounded-2xl bg-[#0b0e1b]/60 border border-white/10 p-12 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3 text-primary">
                  <span className="material-symbols-outlined text-2xl">assignment_late</span>
                </div>
                <h3 className="text-base font-bold text-white">No Quizzes Assigned Yet</h3>
                <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto">
                  Your instructor hasn't posted any mission quizzes to this group. Check back soon or
                  start a conversation in the discussion room.
                </p>
                {isCreatorOrAdmin && (
                  <button
                    onClick={handleOpenAssignModal}
                    className="mt-4 px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-semibold cursor-pointer"
                  >
                    Assign Quiz to Cohort
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => {
                  const dueInfo = getDueDateStatus(quiz.dueDate);
                  return (
                    <div
                      key={quiz.quizId}
                      className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 p-5 hover:border-primary/40 transition-all flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${dueInfo.style}`}
                          >
                            {dueInfo.label}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {quiz.questions?.length ?? 0} Questions
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-white mt-1">{quiz.title}</h3>
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          Mode: {quiz.deploymentType || "ANYTIME"} &bull; Created by {quiz.ownerEmail}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                        <Link
                          href={`/quiz/review/${quiz.quizId}`}
                          className="text-xs text-on-surface-variant hover:text-white transition-colors"
                        >
                          Telemetry &amp; Stats
                        </Link>

                        <Link
                          href={`/quiz/attempt/${quiz.quizId}`}
                          className="px-4 py-1.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
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

        {/* TAB 2: DISCUSSION ROOM */}
        {activeTab === "discussion" && (
          <div className="flex-1 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 overflow-hidden flex flex-col h-[650px] shadow-2xl">
            {/* Header info */}
            <div className="p-3.5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-base">forum</span>
                Cohort Discussion Stream
              </span>
              <span className="text-on-surface-variant text-[11px]">
                Auto-syncs real-time &bull; {messages.length} messages
              </span>
            </div>

            {/* Pinned Announcements Bar */}
            {pinnedMessages.length > 0 && (
              <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                  <span className="material-symbols-outlined text-sm">keep</span>
                  <span>Pinned Instructor Notice</span>
                </div>
                {pinnedMessages.map((pm) => (
                  <div key={pm.messageId} className="text-amber-100 pl-4 py-0.5">
                    &bull; {pm.content}
                  </div>
                ))}
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {unpinnedMessages.length === 0 && pinnedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl mb-2 text-outline">
                    chat_bubble_outline
                  </span>
                  <p className="text-xs">No discussion messages yet.</p>
                  <p className="text-[11px] text-outline mt-1">
                    Ask a question about a quiz problem or start a cohort study thread!
                  </p>
                </div>
              ) : (
                unpinnedMessages.map((msg) => {
                  const isMine = msg.senderId === user?.userId;
                  return (
                    <div
                      key={msg.messageId}
                      className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-[11px]">
                        <span className="font-semibold text-white">
                          {isMine ? "You" : msg.senderName}
                        </span>
                        {msg.senderRole && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-mono font-bold ${
                              msg.senderRole === "SUPER_ADMIN"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : msg.senderRole === "ORG_ADMIN"
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : msg.senderRole === "ORG_PARTNER"
                                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                : "bg-white/10 text-on-surface-variant border border-white/10"
                            }`}
                          >
                            {msg.senderRole}
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
                        className={`max-w-lg rounded-2xl p-3.5 text-xs text-white relative group ${
                          isMine
                            ? "bg-primary-container text-white shadow-md shadow-primary-container/20 border border-white/10"
                            : "bg-white/[0.06] border border-white/10"
                        }`}
                      >
                        {/* Linked Question Context Snippet */}
                        {msg.questionContext && (
                          <div className="mb-2 p-2.5 rounded-xl bg-black/40 border border-white/10 text-[11px]">
                            <div className="flex items-center gap-1.5 text-tertiary font-bold mb-1">
                              <span className="material-symbols-outlined text-xs">help</span>
                              <span>Regarding Quiz Question:</span>
                            </div>
                            <p className="text-white font-medium italic">
                              "{msg.questionContext.questionSnippet}"
                            </p>
                            {msg.questionContext.quizTitle && (
                              <span className="text-[10px] text-on-surface-variant mt-1 block">
                                In: {msg.questionContext.quizTitle}
                              </span>
                            )}
                          </div>
                        )}

                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                        {/* Hover Actions: Pin (Partner/Admin) or Delete */}
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-black/70 rounded-lg p-1 backdrop-blur-sm">
                          {isCreatorOrAdmin && (
                            <button
                              onClick={() => handlePinMessage(msg.messageId)}
                              className="text-on-surface-variant hover:text-amber-400 p-0.5 cursor-pointer"
                              title="Pin Notice"
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
              <div ref={messagesEndRef} />
            </div>

            {/* Question Context Preview Banner */}
            {questionContext && (
              <div className="p-2.5 bg-primary/10 border-t border-primary/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="material-symbols-outlined text-primary text-sm shrink-0">
                    help_center
                  </span>
                  <span className="text-white truncate">
                    Question Context: <em>"{questionContext.questionSnippet}"</em>
                  </span>
                </div>
                <button
                  onClick={() => setQuestionContext(null)}
                  className="text-on-surface-variant hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setShowQuestionSelector(!showQuestionSelector)}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-tertiary transition-colors cursor-pointer"
                title="Link a Quiz Question"
              >
                <span className="material-symbols-outlined text-lg">help_outline</span>
              </button>

              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write a message to your cohort..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-xs text-white outline-none transition-colors"
              />

              <button
                type="submit"
                disabled={sendingMessage || (!messageText.trim() && !questionContext)}
                className="p-2.5 rounded-xl bg-primary-container text-white hover:bg-primary-container/90 disabled:opacity-40 transition-all cursor-pointer shadow-md shadow-primary-container/25 border border-white/10 flex items-center justify-center active:scale-95"
              >
                <span className="material-symbols-outlined text-base">send</span>
              </button>
            </form>

            {/* Question Selector Drawer / Modal */}
            {showQuestionSelector && (
              <div className="p-4 border-t border-white/10 bg-[#090c17] text-xs max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">Select a Question to Link:</span>
                  <button
                    onClick={() => setShowQuestionSelector(false)}
                    className="text-on-surface-variant hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                {quizzes.length === 0 ? (
                  <p className="text-on-surface-variant text-[11px]">
                    No quizzes assigned in this group to link questions from.
                  </p>
                ) : (
                  <div className="space-y-2">
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
                          className="w-full text-left p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-white">
                            <strong>{q.title}</strong>: {quest.question}
                          </span>
                          <span className="material-symbols-outlined text-xs text-primary shrink-0">
                            add
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GRADEBOOK MATRIX */}
        {activeTab === "gradebook" && isCreatorOrAdmin && (
          <div className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Cohort Performance Matrix</h2>
                <p className="text-[11px] text-on-surface-variant">
                  Scores, attempt completion rates, and class matrix.
                </p>
              </div>

              <button
                onClick={handleExportGradebookCSV}
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-sm text-emerald-400">
                  download
                </span>
                <span>Export CSV</span>
              </button>
            </div>

            {!gradebook || gradebook.students.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant text-xs">
                No students or submissions recorded in this cohort yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.03] text-on-surface-variant border-b border-white/10 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      {gradebook.quizzes.map((q) => (
                        <th key={q.quizId} className="py-3 px-4 text-center max-w-[120px] truncate">
                          {q.title}
                        </th>
                      ))}
                      <th className="py-3 px-4 text-center">Average</th>
                      <th className="py-3 px-4 text-center">Completed</th>
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
                                  className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                    result.percentage >= 80
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : result.percentage >= 50
                                      ? "bg-amber-500/10 text-amber-400"
                                      : "bg-red-500/10 text-red-400"
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
                        <td className="py-3.5 px-4 text-center font-bold text-white">
                          {student.averageScore}%
                        </td>
                        <td className="py-3.5 px-4 text-center text-on-surface-variant">
                          {student.totalCompleted} / {gradebook.quizzes.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEMBERS & GROUP SECURITY SETTINGS */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {/* PENDING APPROVAL QUEUE */}
            {pendingMembers.length > 0 && isCreatorOrAdmin && (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 shadow-lg">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-3">
                  <span className="material-symbols-outlined text-base">how_to_reg</span>
                  Pending Enrollment Requests ({pendingMembers.length})
                </div>
                <div className="space-y-2">
                  {pendingMembers.map((pending) => (
                    <div
                      key={pending.userId}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs"
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
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
                      >
                        Approve Admission
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GROUP SECURITY CONTROLS (PARTNER/ADMIN) */}
            {isCreatorOrAdmin && (
              <div className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 p-5 shadow-lg">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">security</span>
                  Group Security &amp; Access Controls
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Regenerate Code Card */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-on-surface-variant">Active Invite Code</span>
                      <p className="text-xl font-bold font-mono text-primary mt-1">
                        {group.code}
                      </p>
                      <p className="text-[11px] text-on-surface-variant mt-1">
                        Regenerating immediately invalidates previous link access.
                      </p>
                    </div>
                    <button
                      onClick={handleRegenerateCode}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 justify-center"
                    >
                      <span className="material-symbols-outlined text-sm">sync</span>
                      <span>Regenerate 6-Char Code</span>
                    </button>
                  </div>

                  {/* Lock & Approval Toggles */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLocked}
                        onChange={(e) => setIsLocked(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary cursor-pointer"
                      />
                      <span className="text-xs text-white">
                        <strong>Lock Group:</strong> Disallow all new code admissions.
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requireApproval}
                        onChange={(e) => setRequireApproval(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary cursor-pointer"
                      />
                      <span className="text-xs text-white">
                        <strong>Require Approval:</strong> Place new entrants in queue.
                      </span>
                    </label>

                    <button
                      onClick={handleSaveSecuritySettings}
                      className="w-full mt-2 py-1.5 rounded-lg bg-primary-container text-white text-xs font-semibold cursor-pointer"
                    >
                      Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MEMBER ROSTER */}
            <div className="rounded-2xl bg-[#0b0e1b]/80 border border-white/10 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-white/10 font-bold text-xs text-white uppercase tracking-wider">
                Enrolled Members ({members.length})
              </div>
              <div className="divide-y divide-white/5 text-xs">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="p-3.5 flex items-center justify-between hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
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
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        member.role === "SUPER_ADMIN"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : member.role === "ORG_ADMIN"
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : member.role === "ORG_PARTNER"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "bg-white/[0.05] text-on-surface-variant"
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

        {/* MODAL: ASSIGN QUIZ */}
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
                        <span>Assign to Group</span>
                        <span className="material-symbols-outlined text-sm">check</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
          </main>
        </div>
      )}
    </OrgWorkspaceGuard>
  );
}
