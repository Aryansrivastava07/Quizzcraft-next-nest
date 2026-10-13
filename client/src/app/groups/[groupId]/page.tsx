"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  ClipboardList,
  MessageSquare,
  FileText,
  Users,
  Search,
  Pin,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Clock,
  Trophy,
  Target,
  Calendar,
  Play,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  HelpCircle,
  Award,
  TrendingUp,
  BarChart3,
  Flame,
  UserCheck,
} from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import { groupService } from "@/lib/api/group-service";
import { quizService } from "@/lib/api/quiz-service";
import { useAuth } from "@/lib/auth/auth-context";
import { useCohortSocket } from "@/lib/hooks/useCohortSocket";
import {
  Group,
  GroupMessage,
  Quiz,
  OrgMember,
  GroupQuestionContext,
  CohortQuizResultsResponse,
} from "@/lib/api/types";
import { formatApiError } from "@/lib/api/client";

// Only "discussion" and "quizzes" tabs as requested ("dont include cohort gradebook, cohort settings")
type CohortTab = "discussion" | "quizzes";

export default function GroupWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const { user, isLoading: authLoading } = useAuth();

  // Core cohort state
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<OrgMember[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);

  // Navigation
  const [activeTab, setActiveTab] = useState<CohortTab>("discussion");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Discussion state
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [questionContext, setQuestionContext] = useState<GroupQuestionContext | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const activeTabRef = useRef<CohortTab>("discussion");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Copy buttons
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Assign Quiz Modal & Arena Scheduling state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [myAvailableQuizzes, setMyAvailableQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [isArenaMode, setIsArenaMode] = useState(true);
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [arenaDurationMinutes, setArenaDurationMinutes] = useState(60);
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assigningQuiz, setAssigningQuiz] = useState(false);

  // Cohort Results & Leaderboard Modal state ("results are shown to everyone")
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [activeResultsQuizId, setActiveResultsQuizId] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<CohortQuizResultsResponse | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Server-computed membership status
  const [serverIsMember, setServerIsMember] = useState(false);
  const [serverIsCreator, setServerIsCreator] = useState(false);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === "discussion") {
      setUnreadCount(0);
    }
  }, [activeTab]);

  const isCreator =
    serverIsCreator ||
    Boolean(user?.userId && group?.creatorId && user.userId === group.creatorId) ||
    Boolean(
      user?.username &&
        group?.creator?.username &&
        user.username.toLowerCase() === group.creator.username.toLowerCase()
    );

  const isMember =
    serverIsMember ||
    isCreator ||
    Boolean(user?.userId && group?.memberIds?.includes(user.userId)) ||
    Boolean(user?.userId && members.some((m) => m.userId === user.userId)) ||
    Boolean(
      user?.username &&
        members.some((m) => m.username?.toLowerCase() === user.username.toLowerCase())
    );

  const isCreatorOrAdmin =
    isCreator ||
    user?.role === "ORG_ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    Boolean(user?.isSuperAdmin);

  // Real-time WebSocket integration
  const { isConnected, activeCadetsCount, typingUsers, sendTyping } = useCohortSocket({
    groupId,
    userId: user?.userId,
    username: user?.username || user?.fullName,
    onNewMessage: (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === newMsg.messageId)) return prev;
        return [...prev, newMsg];
      });
      if (activeTabRef.current !== "discussion") {
        setUnreadCount((prev) => prev + 1);
      }
    },
    onMessagePinned: (messageId, isPinned) => {
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, isPinned } : m))
      );
    },
    onMessageDeleted: (messageId) => {
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
    },
    onQuizAssigned: (assignedQuiz) => {
      setQuizzes((prev) => {
        if (prev.some((q) => q.quizId === assignedQuiz.quizId)) return prev;
        return [assignedQuiz, ...prev];
      });
      setSuccess(`New quiz mission assigned: ${assignedQuiz.title}`);
    },
  });

  useEffect(() => {
    if (!authLoading && user?.userId && groupId) {
      loadCohortData();
    }
  }, [authLoading, user?.userId, groupId]);

  const loadCohortData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupRes, quizzesRes, messagesRes] = await Promise.all([
        groupService.getGroupById(groupId),
        groupService.getGroupQuizzes(groupId),
        groupService.getGroupMessages(groupId),
      ]);

      if (groupRes?.data) {
        if (groupRes.data.isMember !== undefined) setServerIsMember(Boolean(groupRes.data.isMember));
        if (groupRes.data.isCreator !== undefined) setServerIsCreator(Boolean(groupRes.data.isCreator));
      }

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
      }

      if (quizzesRes?.data?.quizzes) {
        setQuizzes(quizzesRes.data.quizzes);
      }
      if (messagesRes?.data?.messages) {
        setMessages(messagesRes.data.messages);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom on new message
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
    if (!confirm("Are you sure you want to delete this transmission?")) return;
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
      setSuccess("Cadet admitted into cohort roster!");
      const approved = pendingMembers.find((p) => p.userId === targetUserId);
      setPendingMembers((prev) => prev.filter((p) => p.userId !== targetUserId));
      if (approved) {
        setMembers((prev) => [...prev, approved]);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined" || !group) return;
    const origin = window.location.origin;
    const link = `${origin}/groups?code=${group.code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Open Assign Quiz Modal and fetch instructor's quizzes
  const handleOpenAssignModal = async () => {
    setShowAssignModal(true);
    // Set default scheduled start time to current local time formatted for datetime-local
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledStartTime(localIso);

    try {
      const res = await quizService.getUserQuizzes();
      if (res?.data?.quizzes) {
        setMyAvailableQuizzes(res.data.quizzes);
        if (res.data.quizzes.length > 0 && !selectedQuizId) {
          setSelectedQuizId(res.data.quizzes[0].quizId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Quiz Assignment (with Arena option)
  const handleAssignQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;
    setAssigningQuiz(true);
    try {
      await groupService.assignQuiz(groupId, {
        quizId: selectedQuizId,
        isArena: isArenaMode,
        scheduledFor: isArenaMode && scheduledStartTime ? new Date(scheduledStartTime).toISOString() : undefined,
        durationMinutes: isArenaMode ? Number(arenaDurationMinutes) || 60 : undefined,
        dueDate: !isArenaMode && assignmentDueDate ? new Date(assignmentDueDate).toISOString() : undefined,
      });

      setSuccess(
        isArenaMode
          ? "Group Arena scheduled successfully! All cohort members can compete and review live results."
          : "Quiz successfully assigned to cohort missions!"
      );
      setShowAssignModal(false);

      // Refresh cohort quizzes list
      const qRes = await groupService.getGroupQuizzes(groupId);
      if (qRes?.data?.quizzes) {
        setQuizzes(qRes.data.quizzes);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setAssigningQuiz(false);
    }
  };

  // Remove / Unassign quiz from cohort
  const handleUnassignQuiz = async (quizId: string) => {
    if (!confirm("Are you sure you want to remove this quiz from the cohort?")) return;
    try {
      await groupService.unassignQuiz(groupId, quizId);
      setQuizzes((prev) => prev.filter((q) => q.quizId !== quizId));
      setSuccess("Quiz removed from cohort.");
    } catch (err: any) {
      setError(formatApiError(err));
    }
  };

  // Open Cohort Results & Leaderboard Modal ("results are shown to everyone")
  const handleOpenResults = async (quizId: string) => {
    setActiveResultsQuizId(quizId);
    setShowResultsModal(true);
    setLoadingResults(true);
    try {
      const res = await groupService.getQuizResults(groupId, quizId);
      if (res?.data) {
        setResultsData(res.data);
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setLoadingResults(false);
    }
  };

  // Helper for initials
  const getInitials = (name?: string) => {
    if (!name) return "CD";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Helper for message time
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Helper for Arena status calculation
  const getArenaStatus = (q: Quiz) => {
    const now = Date.now();
    if (q.deploymentType === "SCHEDULED" || q.status === "SCHEDULED") {
      if (q.scheduledFor) {
        const start = new Date(q.scheduledFor).getTime();
        const end = q.liveUntil ? new Date(q.liveUntil).getTime() : start + (q.liveDurationMinutes || 60) * 60000;
        if (now < start) {
          return {
            badge: "ARENA SCHEDULED",
            color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
            active: false,
            desc: `Starts ${new Date(start).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`,
          };
        } else if (now <= end) {
          return {
            badge: "ARENA LIVE NOW",
            color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40 animate-pulse",
            active: true,
            desc: `Live until ${new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          };
        } else {
          return {
            badge: "ARENA CONCLUDED",
            color: "text-slate-400 bg-slate-800 border-slate-700",
            active: false,
            desc: "Arena window has closed",
          };
        }
      }
    }

    if (q.status === "LIVE") {
      return {
        badge: "ARENA LIVE NOW",
        color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40 animate-pulse",
        active: true,
        desc: q.liveUntil ? `Live until ${new Date(q.liveUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Active now",
      };
    }

    if (q.dueDate) {
      const due = new Date(q.dueDate).getTime();
      if (now > due) {
        return {
          badge: "PAST DUE",
          color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
          active: false,
          desc: `Due date passed`,
        };
      }
      return {
        badge: "OPEN MISSION",
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
        active: true,
        desc: `Due ${new Date(due).toLocaleDateString()}`,
      };
    }

    return {
      badge: "ANYTIME MISSION",
      color: "text-violet-400 bg-violet-500/10 border-violet-500/30",
      active: true,
      desc: "Open for cohort cadets",
    };
  };

  // Filter messages by search query and pinned status
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (showPinnedOnly && !m.isPinned) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contentMatch = m.content.toLowerCase().includes(q);
        const authorMatch = (m.authorName || m.senderName || "").toLowerCase().includes(q);
        return contentMatch || authorMatch;
      }
      return true;
    });
  }, [messages, showPinnedOnly, searchQuery]);

  const pinnedCount = useMemo(() => messages.filter((m) => m.isPinned).length, [messages]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400 animate-pulse">
            Establishing Cohort Neural Uplink...
          </p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 pt-28 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
          <h1 className="text-xl font-bold">Cohort Workspace Unavailable</h1>
          <p className="text-xs text-slate-400 mt-2 max-w-md">
            This cohort does not exist or you are not authorized to access this private terminal.
          </p>
          <Link
            href="/groups"
            className="mt-5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition"
          >
            Return to Cohorts Hub
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden relative bg-[#070913] text-white flex flex-col selection:bg-violet-500 selection:text-white">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Global Navigation Header */}
      <Navbar activeChapter="cohorts" />

      {/* Main 3-Column Workspace Container - Offset top padding to clear fixed floating pill Navbar */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 sm:px-4 md:px-6 pt-20 sm:pt-24 pb-3 sm:pb-4 flex flex-col min-h-0 relative z-10">
        {/* Banner feedback */}
        {error && (
          <div className="mb-2.5 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-2.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3-COLUMN LAYOUT: Sized to prevent laptop window scrollbar while ensuring minimum height on smaller displays */}
        <div className="flex flex-col lg:flex-row gap-3.5 xl:gap-4 flex-1 min-h-[520px] lg:min-h-[460px] lg:h-[calc(100vh-170px)] xl:h-[calc(100vh-180px)] lg:max-h-[760px] xl:max-h-[820px]">
          {/* ========================================================= */}
          {/* COLUMN 1: LEFT SIDEBAR (COHORT PROFILE & NAVIGATION)     */}
          {/* ========================================================= */}
          <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-3.5 bg-[#0b0f19]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-xl overflow-hidden min-h-0">
            {/* Top Back Navigation Link */}
            <Link
              href="/groups"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span>Cohorts Hub</span>
            </Link>

            {/* Cohort Avatar & Identity Card */}
            <div className="flex items-center gap-3 pt-1">
              <div className="w-12 h-12 rounded-xl bg-[#13192b] border border-white/10 flex items-center justify-center font-bold text-base text-slate-200 tracking-wider shadow-inner flex-shrink-0">
                {group.name ? getInitials(group.name) : "QC"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white truncate" title={group.name}>
                    {group.name}
                  </h2>
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] flex-shrink-0"
                    title="Active Cohort"
                  />
                </div>
                {/* Cohort Code Badge */}
                <div className="mt-1">
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#13192b] hover:bg-[#1c243d] border border-white/10 text-xs font-mono text-slate-300 hover:text-white transition group"
                    title="Click to copy invite code"
                  >
                    <span>{group.code}</span>
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400 group-hover:text-white" />
                    )}
                    {copiedCode && (
                      <span className="text-[10px] text-emerald-400 font-sans font-medium ml-0.5">
                        Copied!
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Link under header */}
            <div className="text-[11px] text-slate-500 hover:text-slate-400 cursor-pointer transition">
              Report bugs here
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#13192b] hover:bg-[#1a233c] border border-white/10 text-xs font-medium text-slate-200 hover:text-white transition shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Invite Cadets</span>
              </button>

              {isCreatorOrAdmin && (
                <button
                  onClick={handleOpenAssignModal}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:shadow-violet-600/50"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Assign</span>
                </button>
              )}
            </div>

            {/* Section Heading: COHORT NAVIGATION */}
            <div className="mt-2">
              <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-1">
                COHORT NAVIGATION
              </span>
            </div>

            {/* Nav Items (Only Discussion Room and Assigned Quizzes) */}
            <nav className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
              {/* 1. Discussion Room */}
              <button
                onClick={() => setActiveTab("discussion")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === "discussion"
                    ? "bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4" />
                  <span>Discussion Room</span>
                </div>
                {unreadCount > 0 && activeTab !== "discussion" && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* 2. Assigned Quizzes */}
              <button
                onClick={() => setActiveTab("quizzes")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                  activeTab === "quizzes"
                    ? "bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  <span>Assigned Quizzes</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold border border-white/10">
                  {quizzes.length}
                </span>
              </button>
            </nav>

            {/* Sidebar Footer: WebSocket status */}
            <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  }`}
                />
                <span>{isConnected ? "Comms Live" : "Reconnecting..."}</span>
              </span>
              <span className="font-mono text-[10px]">{group.accessMode || "PUBLIC"}</span>
            </div>
          </aside>

          {/* ========================================================= */}
          {/* COLUMN 2: MIDDLE STAGE (DISCUSSION STREAM / QUIZZES)      */}
          {/* ========================================================= */}
          <section className="flex-1 min-w-0 bg-[#080c16]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl flex flex-col h-full overflow-hidden shadow-2xl min-h-[480px] sm:min-h-[520px] lg:min-h-0">
            {activeTab === "discussion" ? (
              /* TAB: DISCUSSION STREAM */
              <div className="flex flex-col h-full">
                {/* Header Bar matching mockup */}
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-[#0a0f1e]/60 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Discussion Stream</h3>
                      <p className="text-[11px] font-mono text-slate-400">
                        Real-time Cadet Mission Comms
                      </p>
                    </div>
                  </div>

                  {/* Right Header Controls: Search, Members count, Menu */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#101423] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 w-32 sm:w-48 focus:outline-none focus:border-violet-500/60 transition"
                      />
                    </div>

                    <div
                      className="px-2.5 py-1.5 rounded-xl bg-[#101423] border border-white/10 text-xs text-slate-300 font-medium flex items-center gap-1.5"
                      title="Total Cohort Members"
                    >
                      <Users className="w-3.5 h-3.5 text-violet-400" />
                      <span>{members.length}</span>
                    </div>

                    {pinnedCount > 0 && (
                      <button
                        onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                        className={`p-1.5 rounded-xl border border-white/10 transition ${
                          showPinnedOnly
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-[#101423] text-slate-400 hover:text-white"
                        }`}
                        title={showPinnedOnly ? "Show all transmissions" : "Filter pinned announcements"}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question attachment pill preview (if student attached a context) */}
                {questionContext && (
                  <div className="px-4 py-2 bg-violet-950/40 border-b border-violet-500/20 flex items-center justify-between text-xs text-violet-200">
                    <div className="flex items-center gap-2 truncate">
                      <HelpCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                      <span className="font-semibold text-white">Referencing Question:</span>
                      <span className="truncate italic">"{questionContext.questionSnippet}"</span>
                    </div>
                    <button
                      onClick={() => setQuestionContext(null)}
                      className="text-violet-400 hover:text-white ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Messages Feed */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                  {/* "Today" date divider pill */}
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/[0.06]"></div>
                    <span className="flex-shrink mx-4 px-3 py-0.5 rounded-full bg-[#101423] border border-white/[0.08] text-[11px] font-medium text-slate-400">
                      Today
                    </span>
                    <div className="flex-grow border-t border-white/[0.06]"></div>
                  </div>

                  {filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                      <MessageSquare className="w-10 h-10 stroke-[1.5] mb-2 text-slate-600" />
                      <p className="text-xs">No comms transmissions yet.</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Send the first message to ignite the cohort discussion!
                      </p>
                    </div>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isOwnMessage =
                        Boolean(user?.userId && msg.authorId && user.userId === msg.authorId) ||
                        Boolean(user?.userId && msg.senderId && user.userId === msg.senderId) ||
                        Boolean(
                          user?.username &&
                            (msg.authorName || msg.senderName) &&
                            user.username.toLowerCase() ===
                              (msg.authorName || msg.senderName)?.toLowerCase()
                        );

                      const authorName = msg.authorName || msg.senderName || "Cadet";
                      const authorId = msg.authorId || msg.senderId;
                      const isInstructorMsg =
                        Boolean(authorId && group.creatorId && authorId === group.creatorId) ||
                        Boolean(
                          group.creator?.username &&
                            authorName.toLowerCase() === group.creator.username.toLowerCase()
                        ) ||
                        msg.authorRole === "ORG_ADMIN" ||
                        msg.authorRole === "SUPER_ADMIN" ||
                        msg.senderRole === "INSTRUCTOR";

                      if (isOwnMessage) {
                        /* ======================================================== */
                        /* "YOU" MESSAGE BUBBLE - MATCHING ZOOMED MOCKUP IMAGE       */
                        /* ======================================================== */
                        return (
                          <div
                            key={msg.messageId}
                            className="flex flex-col items-end group relative"
                          >
                            {/* Header above bubble: "You [INSTRUCTOR] 12:01 PM" */}
                            <div className="flex items-center gap-2 mb-1 justify-end">
                              <span className="text-xs font-semibold text-white">You</span>
                              {isInstructorMsg && (
                                <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.2 rounded-full uppercase tracking-wider">
                                  Instructor
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>

                            {/* Message Bubble: Soft Violet/Purple Gradient Squircle with ambient glow */}
                            <div className="bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white font-medium text-xs px-4 py-2.5 rounded-2xl max-w-lg shadow-[0_4px_16px_rgba(139,92,246,0.35)] leading-relaxed relative">
                              {msg.questionContext && (
                                <div className="mb-2 p-2 rounded-lg bg-black/20 border border-white/10 text-[11px] text-white/90">
                                  <div className="flex items-center gap-1 font-semibold text-violet-200">
                                    <HelpCircle className="w-3 h-3" />
                                    <span>Clarification on Question</span>
                                  </div>
                                  <p className="italic mt-0.5 line-clamp-2">
                                    "{msg.questionContext.questionSnippet}"
                                  </p>
                                </div>
                              )}
                              <span>{msg.content}</span>
                            </div>

                            {/* Message Actions on Hover */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 pr-1">
                              {isCreatorOrAdmin && (
                                <button
                                  onClick={() => handlePinMessage(msg.messageId)}
                                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 text-[10px]"
                                  title={msg.isPinned ? "Unpin message" : "Pin message"}
                                >
                                  <Pin className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMessage(msg.messageId)}
                                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400 text-[10px]"
                                title="Delete transmission"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      /* ======================================================== */
                      /* OTHER CADET MESSAGE BUBBLE - MATCHING MOCKUP              */
                      /* ======================================================== */
                      return (
                        <div key={msg.messageId} className="flex items-start gap-2.5 group">
                          {/* Initials Avatar Circle */}
                          <div className="w-8 h-8 rounded-full bg-[#13192b] border border-white/10 flex items-center justify-center font-bold text-xs text-cyan-300 flex-shrink-0 mt-0.5">
                            {getInitials(authorName)}
                          </div>

                          <div className="flex flex-col items-start max-w-lg">
                            {/* Header: "Aryan 02:30 AM" */}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-200">
                                {authorName}
                              </span>
                              {isInstructorMsg && (
                                <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.2 rounded-full uppercase tracking-wider">
                                  Instructor
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500">
                                {formatTime(msg.createdAt)}
                              </span>
                              {msg.isPinned && (
                                <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                  <Pin className="w-2.5 h-2.5 fill-amber-400" />
                                  <span>Pinned</span>
                                </span>
                              )}
                            </div>

                            {/* Dark Rounded Bubble */}
                            <div className="bg-[#121626] border border-white/[0.08] text-white/95 rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm">
                              {msg.questionContext && (
                                <div className="mb-2 p-2 rounded-lg bg-black/30 border border-white/10 text-[11px] text-slate-300">
                                  <div className="flex items-center gap-1 font-semibold text-violet-400">
                                    <HelpCircle className="w-3 h-3" />
                                    <span>Question Reference</span>
                                  </div>
                                  <p className="italic mt-0.5 line-clamp-2">
                                    "{msg.questionContext.questionSnippet}"
                                  </p>
                                </div>
                              )}
                              <span>{msg.content}</span>
                            </div>

                            {/* Actions on Hover for Admin */}
                            {isCreatorOrAdmin && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 pl-1">
                                <button
                                  onClick={() => handlePinMessage(msg.messageId)}
                                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 text-[10px]"
                                  title={msg.isPinned ? "Unpin message" : "Pin message"}
                                >
                                  <Pin className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg.messageId)}
                                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400 text-[10px]"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing Indicator */}
                  {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 italic pt-1">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce delay-100" />
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce delay-200" />
                      </div>
                      <span>{typingUsers.join(", ")} typing...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Bar matching mockup */}
                <div className="p-3 bg-[#0a0f1e]/80 border-t border-white/[0.08] flex flex-col gap-1 flex-shrink-0">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    {/* Attachment Paperclip Button (Attach Quiz Question) */}
                    <button
                      type="button"
                      onClick={() => setShowQuestionSelector(!showQuestionSelector)}
                      className={`w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center transition flex-shrink-0 ${
                        showQuestionSelector || questionContext
                          ? "bg-violet-600/30 text-violet-300 border-violet-500/40"
                          : "bg-[#121626] hover:bg-[#1a2138] text-slate-400 hover:text-white"
                      }`}
                      title="Attach quiz question context"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Text Input */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        disabled={sendingMessage}
                        className="w-full bg-[#121626] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/60 transition"
                      />
                    </div>

                    {/* Emoji Smiley Button */}
                    <button
                      type="button"
                      onClick={() => setMessageText((prev) => prev + " 🚀 ")}
                      className="w-10 h-10 rounded-xl bg-[#121626] hover:bg-[#1a2138] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition flex-shrink-0"
                      title="Insert emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>

                    {/* Purple Circular/Squircle Send Button */}
                    <button
                      type="submit"
                      disabled={sendingMessage || (!messageText.trim() && !questionContext)}
                      className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 transition flex-shrink-0"
                      title="Send transmission"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Subtext helper: "Press Enter to send" */}
                  <div className="text-[10px] text-slate-500 pl-12">
                    Press Enter to send
                  </div>

                  {/* Dropdown question selector if paperclip clicked */}
                  {showQuestionSelector && (
                    <div className="mt-2 p-3 rounded-xl bg-[#121626] border border-white/10 flex flex-col gap-2 max-h-48 overflow-y-auto">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span>Select Cohort Question to Clarify:</span>
                        <button
                          onClick={() => setShowQuestionSelector(false)}
                          className="text-slate-500 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {quizzes.length === 0 ? (
                        <p className="text-[11px] text-slate-500">
                          No quizzes assigned to this cohort yet.
                        </p>
                      ) : (
                        quizzes.map((q) => (
                          <div key={q.quizId} className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-violet-400 truncate">
                              {q.title}
                            </span>
                            <button
                              onClick={() => {
                                setQuestionContext({
                                  quizId: q.quizId,
                                  quizTitle: q.title,
                                  questionId: "general",
                                  questionSnippet: `Discussion on mission: ${q.title}`,
                                });
                                setShowQuestionSelector(false);
                              }}
                              className="text-left px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-violet-600/20 text-xs text-slate-300 transition"
                            >
                              Attach quiz discussion reference
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB: ASSIGNED QUIZZES (WITH GROUP ARENA & LEADERBOARD) */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-[#0a0f1e]/60 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Assigned Quizzes</h3>
                      <p className="text-[11px] font-mono text-slate-400">
                        Cohort Missions & Exclusive Arenas
                      </p>
                    </div>
                  </div>

                  {isCreatorOrAdmin && (
                    <button
                      onClick={handleOpenAssignModal}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>Assign Quiz</span>
                    </button>
                  )}
                </div>

                {/* Quizzes Grid */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {quizzes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-slate-500">
                        <FileText className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-bold text-white">No Quizzes Assigned Yet</h4>
                      <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                        {isCreatorOrAdmin
                          ? "You haven't assigned any quizzes to this cohort. Click Assign Quiz above to schedule an exclusive arena or open homework mission."
                          : "The instructor has not assigned any quiz missions to this cohort yet. Transmissions will appear here once posted."}
                      </p>
                      {isCreatorOrAdmin && (
                        <button
                          onClick={handleOpenAssignModal}
                          className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition"
                        >
                          Assign Generated Quiz
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {quizzes.map((quiz) => {
                        const arenaStatus = getArenaStatus(quiz);

                        return (
                          <div
                            key={quiz.quizId}
                            className="p-4 rounded-2xl bg-[#0b0f19] border border-white/[0.08] hover:border-violet-500/40 transition flex flex-col justify-between gap-4 group shadow-lg"
                          >
                            <div className="space-y-2.5">
                              {/* Status Badge & Code */}
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border uppercase ${arenaStatus.color}`}
                                >
                                  {arenaStatus.badge}
                                </span>
                                {quiz.pin && (
                                  <span className="font-mono text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                    PIN: {quiz.pin}
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <h4 className="text-sm font-bold text-white group-hover:text-violet-300 transition line-clamp-2">
                                {quiz.title}
                              </h4>

                              {/* Timing & Question Specs */}
                              <div className="space-y-1 text-xs text-slate-400">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-violet-400" />
                                  <span>{arenaStatus.desc}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>{quiz.questionCount || quiz.questions?.length || 10} Questions</span>
                                  {quiz.liveDurationMinutes && (
                                    <>
                                      <span>•</span>
                                      <span>{quiz.liveDurationMinutes}m Duration</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions Row */}
                            <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                              {/* Start / Launch button */}
                              <button
                                onClick={() => {
                                  const pinParam = quiz.pin ? `&pin=${encodeURIComponent(quiz.pin)}` : "";
                                  router.push(`/quiz?quizId=${encodeURIComponent(quiz.quizId)}${pinParam}`);
                                }}
                                className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-md shadow-violet-600/25 transition"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Enter Quiz</span>
                              </button>

                              {/* View Cohort Results / Leaderboard (Visible to everyone!) */}
                              <button
                                onClick={() => handleOpenResults(quiz.quizId)}
                                className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#13192b] hover:bg-[#1a233c] border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition"
                                title="View Cohort Scoreboard & Rankings"
                              >
                                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                <span>Cohort Results</span>
                              </button>

                              {/* Instructor Remove button */}
                              {isCreatorOrAdmin && (
                                <button
                                  onClick={() => handleUnassignQuiz(quiz.quizId)}
                                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                                  title="Unassign quiz from cohort"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ========================================================= */}
          {/* COLUMN 3: RIGHT SIDEBAR (MEMBERS PANEL)                   */}
          {/* ========================================================= */}
          <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-3.5 bg-[#0b0f19]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-xl overflow-hidden min-h-0 max-h-80 lg:max-h-none">
            {/* Header matching mockup */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold text-white">Members ({members.length})</h3>
              <div className="w-7 h-7 rounded-lg bg-[#13192b] border border-white/10 flex items-center justify-center text-slate-400">
                <Users className="w-4 h-4" />
              </div>
            </div>

            {/* Pending Admission Queue (for Instructor) */}
            {isCreatorOrAdmin && pendingMembers.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col gap-2">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Pending Admission ({pendingMembers.length})
                </span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {pendingMembers.map((pending) => (
                    <div
                      key={pending.userId}
                      className="flex items-center justify-between text-xs text-white"
                    >
                      <span className="truncate">{pending.fullName || pending.username}</span>
                      <button
                        onClick={() => handleApproveMember(pending.userId)}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white transition"
                      >
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members Roster List matching mockup */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {members.map((member) => {
                const isCurrent =
                  Boolean(user?.userId && member.userId === user.userId) ||
                  Boolean(user?.username && member.username?.toLowerCase() === user.username.toLowerCase());

                const isInstructor =
                  Boolean(group.creatorId && member.userId === group.creatorId) ||
                  Boolean(
                    group.creator?.username &&
                      member.username?.toLowerCase() === group.creator.username.toLowerCase()
                  ) ||
                  member.role === "ORG_ADMIN" ||
                  member.role === "SUPER_ADMIN";

                const displayName = isCurrent ? "You" : member.fullName || member.username;

                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition group"
                  >
                    {/* Left: Avatar + Name + Green Active Dot */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Initials Avatar */}
                      <div className="w-8 h-8 rounded-full bg-[#13192b] border border-white/10 flex items-center justify-center font-bold text-xs text-slate-200 flex-shrink-0 shadow-sm">
                        {getInitials(displayName === "You" ? user?.username || "AS" : displayName)}
                      </div>

                      {/* Display name with green status dot */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-xs truncate ${
                            isCurrent ? "font-bold text-white" : "font-medium text-slate-200"
                          }`}
                        >
                          {displayName}
                        </span>
                        {/* Green online dot */}
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] flex-shrink-0"
                          title="Online Cadet"
                        />
                      </div>
                    </div>

                    {/* Right: Role Pill matching mockup */}
                    <div>
                      {isInstructor ? (
                        <span className="text-amber-300 bg-amber-500/10 border border-amber-500/30 text-[10px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                          Instructor
                        </span>
                      ) : (
                        <span className="text-slate-300 bg-slate-800/80 border border-slate-700/50 text-[10px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">
                          Cadet
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL: ASSIGN QUIZ & SCHEDULE GROUP ARENA                */}
      {/* ========================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0e1424]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Assign Quiz to Cohort</h3>
                  <p className="text-[11px] text-slate-400">
                    Host a live Arena or assign homework to this group
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignQuiz} className="p-5 space-y-4">
              {/* Select Existing Quiz */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Generated Quiz:
                </label>
                {myAvailableQuizzes.length === 0 ? (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center justify-between">
                    <span>No quizzes found in your library.</span>
                    <Link
                      href="/create"
                      className="text-violet-400 hover:underline font-semibold ml-2"
                    >
                      + Generate Quiz
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedQuizId}
                    onChange={(e) => setSelectedQuizId(e.target.value)}
                    required
                    className="w-full bg-[#121626] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                  >
                    <option value="" disabled>
                      Choose a quiz...
                    </option>
                    {myAvailableQuizzes.map((q) => (
                      <option key={q.quizId} value={q.quizId}>
                        {q.title} ({q.questions?.length || 10} Qs)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Assignment Protocol: Group Arena vs Standard Mission */}
              <div className="p-3.5 rounded-xl bg-[#121626] border border-white/10 space-y-3">
                <span className="block text-xs font-bold text-slate-200">
                  Deployment Protocol:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsArenaMode(true)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      isArenaMode
                        ? "bg-violet-600/20 border-violet-500/60 text-white shadow-md shadow-violet-600/20"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>Cohort Arena</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Time-locked battle window. Live scoreboard visible to everyone.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsArenaMode(false)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                      !isArenaMode
                        ? "bg-violet-600/20 border-violet-500/60 text-white shadow-md shadow-violet-600/20"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span>Open Mission</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Flexible homework deadline. Cadets complete at their pace.
                    </span>
                  </button>
                </div>

                {isArenaMode ? (
                  <div className="space-y-3 pt-2 border-t border-white/[0.08]">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Arena Start Time (Scheduled Window):
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledStartTime}
                        onChange={(e) => setScheduledStartTime(e.target.value)}
                        required={isArenaMode}
                        className="w-full bg-[#0b0f19] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Arena Duration Window:
                      </label>
                      <select
                        value={arenaDurationMinutes}
                        onChange={(e) => setArenaDurationMinutes(Number(e.target.value))}
                        className="w-full bg-[#0b0f19] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes (Standard)</option>
                        <option value={90}>90 Minutes</option>
                        <option value={120}>2 Hours</option>
                        <option value={1440}>24 Hours</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-white/[0.08]">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Due Date (Optional):
                    </label>
                    <input
                      type="datetime-local"
                      value={assignmentDueDate}
                      onChange={(e) => setAssignmentDueDate(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningQuiz || !selectedQuizId}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition flex items-center gap-1.5"
                >
                  {assigningQuiz ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Deploying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{isArenaMode ? "Launch Arena" : "Assign to Cohort"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: COHORT RESULTS & LEADERBOARD (VISIBLE TO ALL)     */}
      {/* ========================================================= */}
      {showResultsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0e1424]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {resultsData?.quiz?.title || "Cohort Arena Results"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Live Scoreboard & Cadet Rankings • Visible to All Cohort Members
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResultsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingResults ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs text-slate-400">Compiling Cohort Telemetry & Scores...</p>
                </div>
              ) : resultsData ? (
                <>
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-[#121626] border border-white/10 flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        Submissions
                      </span>
                      <span className="text-lg font-bold text-white mt-0.5">
                        {resultsData.stats.totalAttempts} / {resultsData.stats.totalMembers}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#121626] border border-white/10 flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        Cohort Avg Score
                      </span>
                      <span className="text-lg font-bold text-violet-400 mt-0.5">
                        {resultsData.stats.avgScore} pts
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#121626] border border-white/10 flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        Cohort Accuracy
                      </span>
                      <span className="text-lg font-bold text-emerald-400 mt-0.5">
                        {resultsData.stats.avgAccuracy}%
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#121626] border border-white/10 flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        Avg Time
                      </span>
                      <span className="text-lg font-bold text-cyan-400 mt-0.5">
                        {Math.floor(resultsData.stats.avgTimeSeconds / 60)}m{" "}
                        {resultsData.stats.avgTimeSeconds % 60}s
                      </span>
                    </div>
                  </div>

                  {/* Leaderboard Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                      Ranked Scoreboard
                    </h4>
                    {resultsData.leaderboard.length === 0 ? (
                      <div className="p-8 rounded-xl bg-white/[0.02] border border-white/10 text-center text-slate-400 text-xs">
                        No submissions yet. Be the first cadet to complete this quiz!
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/10 overflow-hidden bg-[#121626]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#0e1424] text-slate-400 text-[10px] uppercase font-semibold border-b border-white/10">
                            <tr>
                              <th className="px-3.5 py-2.5">Rank</th>
                              <th className="px-3.5 py-2.5">Cadet</th>
                              <th className="px-3.5 py-2.5 text-right">Score</th>
                              <th className="px-3.5 py-2.5 text-right">Accuracy</th>
                              <th className="px-3.5 py-2.5 text-right">Time Spent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {resultsData.leaderboard.map((entry) => {
                              const isTop1 = entry.rank === 1;
                              const isTop2 = entry.rank === 2;
                              const isTop3 = entry.rank === 3;

                              return (
                                <tr
                                  key={entry.userId}
                                  className={`hover:bg-white/[0.03] transition ${
                                    entry.userId === user?.userId ? "bg-violet-600/10" : ""
                                  }`}
                                >
                                  {/* Rank */}
                                  <td className="px-3.5 py-2.5 font-bold">
                                    {isTop1 ? (
                                      <span className="text-amber-400 flex items-center gap-1">
                                        🥇 1
                                      </span>
                                    ) : isTop2 ? (
                                      <span className="text-slate-300 flex items-center gap-1">
                                        🥈 2
                                      </span>
                                    ) : isTop3 ? (
                                      <span className="text-amber-600 flex items-center gap-1">
                                        🥉 3
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">#{entry.rank}</span>
                                    )}
                                  </td>

                                  {/* Cadet Name */}
                                  <td className="px-3.5 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-slate-800 text-[10px] font-bold text-slate-200 flex items-center justify-center">
                                        {getInitials(entry.fullName || entry.username)}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-white">
                                          {entry.fullName || entry.username}
                                        </span>
                                        {entry.userId === user?.userId && (
                                          <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.2 rounded font-bold">
                                            YOU
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Score */}
                                  <td className="px-3.5 py-2.5 text-right font-bold text-violet-300">
                                    {entry.score} pts
                                  </td>

                                  {/* Accuracy */}
                                  <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-400">
                                    {entry.accuracy}%
                                  </td>

                                  {/* Time */}
                                  <td className="px-3.5 py-2.5 text-right text-slate-400 font-mono">
                                    {Math.floor(entry.timeSpentSeconds / 60)}m{" "}
                                    {entry.timeSpentSeconds % 60}s
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Awaiting Responses */}
                  {resultsData.unattemptedMembers.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Awaiting Response ({resultsData.unattemptedMembers.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {resultsData.unattemptedMembers.map((m) => (
                          <div
                            key={m.userId}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>{m.fullName || m.username}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Failed to load cohort results.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-[#0e1424] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Cohort results update live upon member completion
              </span>
              <button
                onClick={() => setShowResultsModal(false)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition"
              >
                Close Scoreboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: INVITE CADETS                                      */}
      {/* ========================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0e1424]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Invite Cadets</h3>
                  <p className="text-[11px] text-slate-400">Share cohort code or direct link</p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Cohort Code Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cohort Invite Code:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#121626] border border-white/10 rounded-xl px-4 py-2.5 font-mono text-base font-bold text-white tracking-widest text-center shadow-inner">
                    {group.code}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition flex items-center gap-1.5"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Direct Link Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Direct Enrollment URL:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/groups?code=${group.code}` : ""}
                    className="flex-1 bg-[#121626] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition flex items-center gap-1.5"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/[0.08] bg-[#0e1424] flex justify-end">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
