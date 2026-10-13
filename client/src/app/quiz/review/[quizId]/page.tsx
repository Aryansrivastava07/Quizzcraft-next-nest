"use client";

import React, { useState, useEffect, useMemo, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import AuthFooter from "@/components/layout/AuthFooter";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import { quizService } from "@/lib/api/quiz-service";
import { QuizReviewData, LeaderboardEntry } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import CopyQuizModal from "@/components/quiz/CopyQuizModal";

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatAvgTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return "0.0s";
  return `${Number(seconds).toFixed(1)}s`;
}

interface QuizReviewPageProps {
  params: Promise<{ quizId: string }>;
}

export default function QuizReviewPage({ params }: QuizReviewPageProps) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.quizId;
  const router = useRouter();
  const { user } = useAuth();

  const [reviewData, setReviewData] = useState<QuizReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search participant filter
  const [searchParticipant, setSearchParticipant] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedAntiCheatEntry, setSelectedAntiCheatEntry] = useState<LeaderboardEntry | null>(null);
  const [isEndingLive, setIsEndingLive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  const loadReview = useCallback(async (isPolling = false) => {
    if (!isPolling) {
      setIsLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);
    }

    try {
      const res = await quizService.getQuizReview(quizId);
      if (res?.data) {
        setReviewData(res.data);
      } else if (!isPolling) {
        setErrorStatus(404);
        setErrorMessage("Quiz review could not be loaded");
      }
    } catch (err: any) {
      if (!isPolling) {
        setErrorStatus(err?.status || 500);
        setErrorMessage(
          err?.message || "Failed to load quiz review and telemetry"
        );
      }
    } finally {
      if (!isPolling) {
        setIsLoading(false);
      }
    }
  }, [quizId]);

  useEffect(() => {
    if (quizId) {
      loadReview(false);
    }
  }, [quizId, loadReview]);

  // Real-time polling if quiz is currently LIVE
  useEffect(() => {
    if (reviewData?.quiz.status !== "LIVE") return;
    const interval = setInterval(() => {
      loadReview(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [reviewData?.quiz.status, loadReview]);

  // Live countdown timer if liveUntil exists
  useEffect(() => {
    if (!reviewData?.quiz.liveUntil || reviewData.quiz.status !== "LIVE") {
      setTimeRemaining("");
      return;
    }

    const updateCountdown = () => {
      const diff = new Date(reviewData.quiz.liveUntil!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining("Session Expired");
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      if (hrs > 0) {
        setTimeRemaining(`${hrs}h ${mins}m ${secs}s remaining`);
      } else {
        setTimeRemaining(`${mins}m ${secs}s remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [reviewData?.quiz.liveUntil, reviewData?.quiz.status]);

  // End live quiz action for owner
  const handleCloseQuiz = async () => {
    if (!reviewData?.quiz.quizId) return;
    if (
      !confirm(
        "Are you sure you want to end this live quiz session? Cadets will no longer be able to submit new responses."
      )
    ) {
      return;
    }
    setIsEndingLive(true);
    try {
      await quizService.closeQuiz(reviewData.quiz.quizId);
      await loadReview(false);
    } catch (err: any) {
      alert(err?.message || "Failed to end quiz session");
    } finally {
      setIsEndingLive(false);
    }
  };

  // Copy Review Link
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Copy PIN
  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Filtered leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (!reviewData?.leaderboard) return [];
    if (!searchParticipant.trim()) return reviewData.leaderboard;
    const q = searchParticipant.toLowerCase().trim();
    return reviewData.leaderboard.filter(
      (entry) =>
        entry.username.toLowerCase().includes(q) ||
        entry.fullName.toLowerCase().includes(q)
    );
  }, [reviewData, searchParticipant]);

  const topThree = useMemo(() => {
    if (!reviewData?.leaderboard) return [];
    return reviewData.leaderboard.slice(0, 3);
  }, [reviewData]);

  const rawPin = reviewData?.quiz.pin ? String(reviewData.quiz.pin).replace(/\D/g, "") : "";
  const formattedPin =
    rawPin.length === 6 ? `${rawPin.slice(0, 3)}-${rawPin.slice(3)}` : rawPin;
  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join${rawPin ? `?pin=${rawPin}` : ""}`
    : `https://quizzcraft.app/join`;

  return (
    <div className="relative min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary/30 selection:text-white">
      {/* Background Ambience */}
      <CosmicCanvas />

      {/* Floating Navbar */}
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20 relative z-10">
        
        {/* Loading State */}
        {isLoading && (
          <div className="py-24 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mx-auto mb-4 animate-spin text-tertiary">
              <span className="material-symbols-outlined text-2xl">sync</span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Loading Arena Telemetry & Leaderboard...
            </h3>
            <p className="text-xs text-on-surface-variant font-mono">
              Synchronizing participant scores and statistics
            </p>
          </div>
        )}

        {/* Access Restricted / Forbidden State */}
        {!isLoading && errorStatus === 403 && (
          <div className="py-16 max-w-lg mx-auto text-center">
            <div className="bg-surface-container-low/90 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-5 text-red-400">
                <span className="material-symbols-outlined text-3xl">lock</span>
              </div>

              <span className="inline-block px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 font-mono text-[11px] font-bold uppercase tracking-wider mb-3">
                Private Cadet Review
              </span>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                Creator Access Only
              </h2>

              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed mb-8">
                {errorMessage ||
                  "This quiz review is private. Only the quiz creator has authorized credentials to view its telemetry, participants, and leaderboard."}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/quizzes"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-white/10 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">explore</span>
                  Browse Public Arenas
                </Link>

                {!user && (
                  <Link
                    href="/auth"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">login</span>
                    Sign In with Creator Account
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Not Found / Error State */}
        {!isLoading && errorStatus && errorStatus !== 403 && (
          <div className="py-16 max-w-lg mx-auto text-center">
            <div className="bg-surface-container-low/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mx-auto mb-4 text-tertiary">
                <span className="material-symbols-outlined text-3xl">sentiment_dissatisfied</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Quiz Not Found</h2>
              <p className="text-xs text-on-surface-variant mb-6">
                {errorMessage || "The requested quiz could not be located in our arena registry."}
              </p>
              <Link
                href="/quizzes"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all"
              >
                Back to Public Quizzes
              </Link>
            </div>
          </div>
        )}

        {/* Main Review Dashboard */}
        {!isLoading && reviewData && (
          <>
            {/* Breadcrumb & Navigation Top Bar */}
            <div className="flex items-center justify-between gap-4 mb-6 text-xs text-on-surface-variant">
              <div className="flex items-center gap-2 overflow-hidden">
                <Link href="/quizzes" className="hover:text-white transition-colors shrink-0">
                  Public Arenas
                </Link>
                <span>/</span>
                <span className="text-white truncate max-w-xs">{reviewData.quiz.title}</span>
                <span>/</span>
                <span className="text-tertiary font-semibold shrink-0">Review & Leaderboard</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-primary-container/20 hover:bg-primary-container/30 border border-primary/40 text-primary hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Create a Copy in Different Workspace"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  <span>Copy to Workspace</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl bg-surface-container/70 hover:bg-surface-container border border-white/10 text-on-surface hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedLink ? "check" : "share"}
                  </span>
                  <span>{copiedLink ? "Link Copied!" : "Share Review"}</span>
                </button>
              </div>
            </div>

            {/* Quiz Hero Banner Card */}
            <ParallaxReveal direction="up" distance={25} duration={600}>
              <div className="relative overflow-hidden bg-surface-container-low/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl mb-8">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  
                  {/* Left: Titles & Badges */}
                  <div className="space-y-3 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                        reviewData.quiz.status === "LIVE"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : reviewData.quiz.status === "ANYTIME"
                          ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                          : reviewData.quiz.status === "SCHEDULED"
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                          : "bg-slate-500/15 border-slate-500/40 text-slate-300"
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {reviewData.quiz.status}
                      </span>

                      {/* Access Mode */}
                      <span className="px-3 py-1 rounded-full bg-surface-container/70 border border-white/10 text-on-surface font-mono text-[11px] uppercase tracking-wider">
                        {reviewData.isPublic ? "🌐 Public Arena" : "🔒 Creator Only"}
                      </span>

                      {/* Live Window Countdown Badge */}
                      {timeRemaining && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono bg-amber-500/15 border border-amber-500/40 text-amber-300">
                          <span className="material-symbols-outlined text-xs">timer</span>
                          {timeRemaining}
                        </span>
                      )}

                      {/* Total Questions Count Badge */}
                      <span className="px-3 py-1 rounded-full bg-surface-container/70 border border-white/10 text-white font-mono text-[11px] font-semibold">
                        {reviewData.quiz.totalQuestions} Questions Total
                      </span>

                      {/* Creator badge */}
                      {reviewData.isOwner && (
                        <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono text-[11px] font-bold">
                          👑 You Created This Quiz
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-4xl font-headline-sm font-extrabold text-white tracking-tight leading-snug">
                      {reviewData.quiz.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant pt-1">
                      {/* Creator info */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-[10px] font-bold uppercase overflow-hidden shrink-0">
                          {reviewData.owner.avatar ? (
                            <img src={reviewData.owner.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            reviewData.owner.username?.[0] || "C"
                          )}
                        </div>
                        <span>Created by <strong className="text-white">@{reviewData.owner.username}</strong></span>
                      </div>

                      {/* Room PIN */}
                      {reviewData.quiz.pin && (
                        <div className="flex items-center gap-1.5 bg-surface-container/80 px-2.5 py-1 rounded-lg border border-white/10 text-tertiary font-mono">
                          <span className="text-[10px] text-on-surface-variant uppercase font-sans font-bold">Room PIN:</span>
                          <strong className="font-bold">{reviewData.quiz.pin}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopyPin(reviewData.quiz.pin!)}
                            className="text-on-surface-variant hover:text-white transition-colors"
                            title="Copy PIN"
                          >
                            <span className="material-symbols-outlined text-xs">
                              {copiedPin ? "check" : "content_copy"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: Quiz Related Cover Art Showcase */}
                  <div className="relative w-full sm:w-56 lg:w-64 h-36 rounded-2xl overflow-hidden shrink-0 border border-white/15 shadow-2xl bg-surface-container-high group/img">
                    <img
                      src={reviewData.quiz.coverImage || "/stitch/screen-6-cosmic-portal-3d.png"}
                      alt={reviewData.quiz.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/stitch/screen-6-cosmic-portal-3d.png";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-label-code text-on-surface-variant bg-surface-container-lowest/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/5">
                      <span className="flex items-center gap-1 text-tertiary font-semibold">
                        <span className="material-symbols-outlined text-xs">auto_awesome</span>
                        Arena Intel
                      </span>
                      <span className="text-[10px] uppercase font-bold text-white/80 font-mono">
                        {reviewData.quiz.status}
                      </span>
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                    {reviewData.canAttempt && (
                      <Link
                        href={reviewData.quiz.pin ? `/join?pin=${reviewData.quiz.pin}` : `/quiz?quizId=${reviewData.quiz.quizId}`}
                        className="px-6 py-3 rounded-2xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm font-semibold text-xs tracking-wider text-center shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">sports_esports</span>
                        Attempt This Quiz
                      </Link>
                    )}

                    {/* QR Code Presentation Modal */}
                    {reviewData.quiz.pin && (
                      <button
                        type="button"
                        onClick={() => setShowQrModal(true)}
                        className="px-5 py-2.5 rounded-2xl bg-surface-container hover:bg-surface-bright border border-outline-variant/40 text-on-surface hover:text-white font-headline-sm font-medium text-xs text-center transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base text-cyan-400">qr_code_2</span>
                        Show QR Code
                      </button>
                    )}

                    {/* End Live Session Button (Owner only when LIVE) */}
                    {reviewData.isOwner && reviewData.quiz.status === "LIVE" && (
                      <button
                        type="button"
                        onClick={handleCloseQuiz}
                        disabled={isEndingLive}
                        className="px-5 py-2.5 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 hover:text-red-200 font-headline-sm font-semibold text-xs text-center transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">cancel</span>
                        {isEndingLive ? "Ending..." : "End Live Session"}
                      </button>
                    )}
                  </div>

                </div>
              </div>
            </ParallaxReveal>

            {/* Metrics HUD Grid (Cohort-Wide Creator Telemetry) */}
            <ParallaxReveal direction="up" distance={20} duration={600} delay={100}>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                
                {/* Metric 1: Total Cadets Attempted */}
                <div className="bg-surface-container-low/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center justify-between text-tertiary mb-2">
                    <span className="text-xs font-label-code uppercase tracking-wider font-bold">Total Attempts</span>
                    <span className="material-symbols-outlined text-xl">group</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono mb-1">
                    {reviewData.stats.totalAttempts}
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">{reviewData.stats.completedAttempts} finished</span>
                    {reviewData.stats.activeAttempts > 0 && (
                      <span>&bull; {reviewData.stats.activeAttempts} active</span>
                    )}
                  </div>
                </div>

                {/* Metric 2: Average Time Across All Attempts */}
                <div className="bg-surface-container-low/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center justify-between text-cyan-400 mb-2">
                    <span className="text-xs font-label-code uppercase tracking-wider font-bold">Avg Time (All Attempts)</span>
                    <span className="material-symbols-outlined text-xl">timer</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono mb-1">
                    {formatDuration(reviewData.stats.averageTimeSeconds)}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {reviewData.stats.averageTimePerQuestion
                      ? `${reviewData.stats.averageTimePerQuestion}s avg / question across all attempts`
                      : "Across all completed cadet sessions"}
                  </div>
                </div>

                {/* Metric 3: Correct vs Incorrect for All Attempts */}
                <div className="bg-surface-container-low/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center justify-between text-emerald-400 mb-2">
                    <span className="text-xs font-label-code uppercase tracking-wider font-bold">Correct vs. Incorrect (All Attempts)</span>
                    <span className="material-symbols-outlined text-xl">pie_chart</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono mb-1">
                    {reviewData.stats.overallCorrectRate !== undefined
                      ? `${reviewData.stats.overallCorrectRate}%`
                      : `${reviewData.stats.averageScore}%`}
                  </div>
                  <div className="text-[11px] text-on-surface-variant truncate">
                    {reviewData.stats.totalCorrectAnswers !== undefined ? (
                      <span>
                        <strong className="text-emerald-400">{reviewData.stats.totalCorrectAnswers} Correct</strong>
                        {" • "}
                        <strong className="text-rose-400">{reviewData.stats.totalIncorrectAnswers} Incorrect</strong>
                      </span>
                    ) : (
                      "Aggregate accuracy across all cadets"
                    )}
                  </div>
                </div>

                {/* Metric 4: Average Score */}
                <div className="bg-surface-container-low/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center justify-between text-primary mb-2">
                    <span className="text-xs font-label-code uppercase tracking-wider font-bold">Average Score</span>
                    <span className="material-symbols-outlined text-xl">analytics</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono mb-1">
                    {reviewData.stats.averageScore}%
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    Across all completed cadet sessions
                  </div>
                </div>

                {/* Metric 5: Highest Score */}
                <div className="bg-surface-container-low/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center justify-between text-amber-400 mb-2">
                    <span className="text-xs font-label-code uppercase tracking-wider font-bold">Highest Score</span>
                    <span className="material-symbols-outlined text-xl">military_tech</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono mb-1">
                    {reviewData.stats.highestScore} <span className="text-sm font-normal text-on-surface-variant">/ {reviewData.quiz.totalQuestions}</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    Lowest: {reviewData.stats.lowestScore} / {reviewData.quiz.totalQuestions}
                  </div>
                </div>

                {/* Metric 6: Pass Rate */}
                <div className="bg-surface-container-low/80 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center justify-between text-emerald-400 mb-2">
                    <span className="text-xs font-label-code uppercase tracking-wider font-bold">Pass Rate (&ge;50%)</span>
                    <span className="material-symbols-outlined text-xl">verified</span>
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono mb-1">
                    {reviewData.stats.passRate}%
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {reviewData.quiz.questime || 60}s per question time limit
                  </div>
                </div>

              </div>

              {/* Cohort-Wide Aggregate Performance Card */}
              {reviewData.stats.completedAttempts > 0 && reviewData.stats.totalCorrectAnswers !== undefined && (
                <div className="mb-10 rounded-2xl p-5 bg-surface-container-low/80 border border-white/10 backdrop-blur-xl shadow-lg space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary text-base">bar_chart</span>
                        Cohort Aggregate Accuracy &amp; Time Distribution (All Attempts)
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        Combined performance telemetry across all {reviewData.stats.completedAttempts} finished session(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-emerald-400 font-bold">
                        {reviewData.stats.totalCorrectAnswers} Correct ({reviewData.stats.overallCorrectRate}%)
                      </span>
                      <span>•</span>
                      <span className="text-rose-400 font-bold">
                        {reviewData.stats.totalIncorrectAnswers} Incorrect ({reviewData.stats.overallIncorrectRate}%)
                      </span>
                    </div>
                  </div>

                  {/* Stacked Aggregate Visual Bar */}
                  <div className="w-full h-3 rounded-full bg-surface-container-highest overflow-hidden flex p-0.5 border border-white/10">
                    <div
                      className="h-full bg-emerald-400 rounded-l-full transition-all duration-700"
                      style={{ width: `${reviewData.stats.overallCorrectRate || 0}%` }}
                      title={`All Attempts Correct: ${reviewData.stats.totalCorrectAnswers} (${reviewData.stats.overallCorrectRate}%)`}
                    />
                    <div
                      className="h-full bg-rose-500 rounded-r-full transition-all duration-700"
                      style={{ width: `${reviewData.stats.overallIncorrectRate || 0}%` }}
                      title={`All Attempts Incorrect: ${reviewData.stats.totalIncorrectAnswers} (${reviewData.stats.overallIncorrectRate}%)`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-on-surface-variant pt-1 font-mono">
                    <span>
                      Avg Cohort Attempt Duration: <strong className="text-white">{formatDuration(reviewData.stats.averageTimeSeconds)}</strong>
                    </span>
                    <span>
                      Avg Cadets Response Latency: <strong className="text-cyan-300">{formatAvgTime(reviewData.stats.averageTimePerQuestion)}/question</strong>
                    </span>
                  </div>
                </div>
              )}
            </ParallaxReveal>

            {/* Top 3 Podium (If participants exist) */}
            {topThree.length > 0 && (
              <ParallaxReveal direction="up" distance={20} duration={600} delay={150}>
                <div className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-amber-400">emoji_events</span>
                    <h2 className="text-lg font-headline-sm font-bold text-white tracking-tight">
                      Arena Podium &bull; Top Performers
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {topThree.map((pilot, idx) => {
                      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                      const borderGlow =
                        idx === 0
                          ? "border-amber-400/50 bg-surface-container-low/90"
                          : idx === 1
                          ? "border-slate-300/40 bg-surface-container-low/90"
                          : "border-amber-700/50 bg-surface-container-low/90";

                      return (
                        <div
                          key={pilot.sessionId}
                          className={`rounded-2xl p-6 border ${borderGlow} backdrop-blur-xl shadow-xl flex items-center justify-between gap-4`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{medal}</div>
                            <div className="w-11 h-11 rounded-full bg-surface-container border border-white/10 flex items-center justify-center font-bold text-white text-sm overflow-hidden">
                              {pilot.avatar ? (
                                <img src={pilot.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                pilot.username?.[0] || "C"
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white leading-tight">
                                {pilot.fullName}
                              </div>
                              <div className="text-xs text-on-surface-variant font-mono">
                                @{pilot.username}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-bold text-white font-mono">
                              {pilot.score} / {pilot.totalQuestions}
                            </div>
                            <div className="text-xs font-bold text-tertiary">
                              {pilot.percentage}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ParallaxReveal>
            )}

            {/* Leaderboard & All Attempts Table */}
            <ParallaxReveal direction="up" distance={20} duration={600} delay={200}>
              <div className="bg-surface-container-low/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl mb-8">
                
                {/* Header & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-headline-sm font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-tertiary">leaderboard</span>
                      Full Cadet Leaderboard & Attempts
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Ranked by score and completion accuracy
                    </p>
                  </div>

                  {/* Filter / Search by cadet name */}
                  <div className="relative w-full sm:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchParticipant}
                      onChange={(e) => setSearchParticipant(e.target.value)}
                      placeholder="Search cadets..."
                      className="w-full pl-9 pr-3 py-1.5 bg-surface-container/70 border border-white/10 rounded-xl text-xs text-white placeholder:text-on-surface-variant/60 focus:outline-none focus:border-tertiary"
                    />
                  </div>
                </div>

                {/* Table or Empty State */}
                {reviewData.leaderboard.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                      <span className="material-symbols-outlined text-2xl">group_off</span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">
                      No Attempts Recorded Yet
                    </h3>
                    <p className="text-xs text-on-surface-variant max-w-sm mx-auto mb-4">
                      No cadets have attempted this quiz arena yet. Share the quiz link or room PIN to start battles!
                    </p>
                    {reviewData.quiz.pin && (
                      <button
                        onClick={() => handleCopyPin(reviewData.quiz.pin!)}
                        className="px-4 py-2 rounded-xl bg-surface-container border border-white/10 text-tertiary text-xs font-bold hover:bg-surface-bright transition-colors"
                      >
                        Copy Room PIN: {reviewData.quiz.pin}
                      </button>
                    )}
                  </div>
                ) : filteredLeaderboard.length === 0 ? (
                  <div className="py-8 text-center text-xs text-on-surface-variant">
                    No cadets matched your search query &ldquo;{searchParticipant}&rdquo;.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-on-surface-variant font-mono uppercase text-[10px]">
                          <th className="py-3 px-4 w-14">Rank</th>
                          <th className="py-3 px-4">Cadet Pilot</th>
                          <th className="py-3 px-4 text-center">Score</th>
                          <th className="py-3 px-4 text-center">Accuracy</th>
                          <th className="py-3 px-4 text-center">Integrity &amp; Proctoring</th>
                          <th className="py-3 px-4 text-center">Session Status</th>
                          <th className="py-3 px-4 text-right">Attempted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredLeaderboard.map((entry, index) => {
                          const rank = index + 1;
                          const isTopRank = rank <= 3;
                          const rankColor =
                            rank === 1
                              ? "text-amber-400 font-bold"
                              : rank === 2
                              ? "text-slate-300 font-bold"
                              : rank === 3
                              ? "text-amber-600 font-bold"
                              : "text-on-surface-variant font-mono";

                          const tabSwitches = entry.tabSwitchesCount || 0;
                          const copyAttempts = entry.copyAttemptsCount || 0;
                          const fullscreenExits = entry.fullscreenExitsCount || 0;
                          const totalViolations = tabSwitches + copyAttempts + fullscreenExits;
                          const hasViolations = totalViolations > 0;

                          return (
                            <tr
                              key={entry.sessionId}
                              className="hover:bg-white/[0.02] transition-colors"
                            >
                              {/* Rank */}
                              <td className="py-3.5 px-4 font-mono">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${
                                  rank === 1
                                    ? "bg-amber-400/15 border border-amber-400/30"
                                    : rank === 2
                                    ? "bg-slate-300/15 border border-slate-300/30"
                                    : rank === 3
                                    ? "bg-amber-700/15 border border-amber-700/30"
                                    : "bg-surface-container"
                                } ${rankColor}`}>
                                  {rank === 1 ? "1" : rank === 2 ? "2" : rank === 3 ? "3" : `#${rank}`}
                                </span>
                              </td>

                              {/* Cadet User */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-surface-container border border-white/10 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                                    {entry.avatar ? (
                                      <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      entry.username?.[0] || "C"
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white leading-tight">
                                      {entry.fullName}
                                    </div>
                                    <div className="text-[11px] text-on-surface-variant font-mono">
                                      @{entry.username}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Raw Score */}
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                                {entry.score} <span className="text-on-surface-variant font-normal">/ {entry.totalQuestions}</span>
                              </td>

                              {/* Percentage Progress Bar */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex items-center gap-2">
                                  <div className="w-16 bg-surface-container rounded-full h-2 overflow-hidden border border-white/5">
                                    <div
                                      className={`h-full rounded-full ${
                                        entry.percentage >= 80
                                          ? "bg-emerald-400"
                                          : entry.percentage >= 50
                                          ? "bg-tertiary"
                                          : "bg-amber-400"
                                      }`}
                                      style={{ width: `${Math.min(100, entry.percentage)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-white text-[11px]">
                                    {entry.percentage}%
                                  </span>
                                </div>
                              </td>

                              {/* Integrity & Proctoring */}
                              <td className="py-3.5 px-4 text-center">
                                {reviewData.quiz.antiCheat ? (
                                  <div className="inline-flex flex-col items-center">
                                    {hasViolations ? (
                                      reviewData.isOwner ? (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAntiCheatEntry(entry)}
                                          className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 hover:border-rose-500/50 transition-all cursor-pointer shadow-sm"
                                          title="Click to view detailed security incident audit logs"
                                        >
                                          <span className="material-symbols-outlined text-xs group-hover:scale-110 transition-transform">
                                            security_update_warning
                                          </span>
                                          <span>{totalViolations} {totalViolations === 1 ? "Incident" : "Incidents"}</span>
                                          <span className="material-symbols-outlined text-[10px] text-rose-400">chevron_right</span>
                                        </button>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/10 border border-rose-500/20 text-rose-300">
                                          <span className="material-symbols-outlined text-xs">warning</span>
                                          <span>{totalViolations} flagged</span>
                                        </span>
                                      )
                                    ) : reviewData.isOwner && entry.antiCheatLogs && entry.antiCheatLogs.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAntiCheatEntry(entry)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all cursor-pointer"
                                        title="Click to view audit session log"
                                      >
                                        <span className="material-symbols-outlined text-xs">verified_user</span>
                                        <span>Clean</span>
                                        <span className="material-symbols-outlined text-[10px] text-emerald-400">chevron_right</span>
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                        <span className="material-symbols-outlined text-xs">verified_user</span>
                                        <span>Clean 100%</span>
                                      </span>
                                    )}

                                    {hasViolations && (
                                      <div className="text-[9px] text-on-surface-variant font-mono mt-1 flex items-center gap-1.5">
                                        {tabSwitches > 0 && <span>{tabSwitches} tabs</span>}
                                        {copyAttempts > 0 && <span>{copyAttempts} copies</span>}
                                        {fullscreenExits > 0 && <span>{fullscreenExits} fs-exits</span>}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-on-surface-variant/40 text-[11px] font-mono">
                                    Standard
                                  </span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  entry.isActive
                                    ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                                    : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                                }`}>
                                  {entry.isActive ? "In Progress" : "Completed"}
                                </span>
                              </td>

                              {/* Attempted Time */}
                              <td className="py-3.5 px-4 text-right text-on-surface-variant font-mono text-[11px]">
                                {entry.lastUpdateAt
                                  ? new Date(entry.lastUpdateAt).toLocaleDateString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Recently"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </ParallaxReveal>

            {/* Question Integrity Disclaimer Box */}
            <div className="bg-surface-container/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex items-center gap-3 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-tertiary text-lg shrink-0">verified_user</span>
              <p className="leading-relaxed">
                <strong className="text-white">Fair Competition & Question Integrity:</strong> Specific question statements, choices, and answer solutions are intentionally withheld from public telemetry to protect active quiz pools and prevent unauthorized answer leaks.
              </p>
            </div>

          </>
        )}

      </main>

      {/* QR Code Presentation Modal */}
      {showQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-surface-container-lowest border border-white/15 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono font-bold text-tertiary tracking-wider uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">qr_code_2</span>
                Scan To Join Arena
              </span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-on-surface-variant hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* QR Code Image */}
            <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/20">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`}
                alt="Quiz Join QR Code"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-mono text-on-surface-variant">ROOM PIN</div>
              <div className="text-2xl font-black text-white font-mono tracking-widest text-primary">
                {formattedPin || "------"}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(joinUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {copiedLink ? "check" : "link"}
                </span>
                <span>{copiedLink ? "Join Link Copied!" : "Copy Direct Join Link"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2 rounded-xl text-on-surface-variant hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-Cheat Incident Audit Log Modal (Owner Only) */}
      {selectedAntiCheatEntry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedAntiCheatEntry(null)}
        >
          <div
            className="bg-surface-container-lowest border border-white/15 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-6 shadow-2xl relative max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <span className="material-symbols-outlined text-xl">shield_locked</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Proctoring &amp; Integrity Audit Log
                  </h3>
                  <p className="text-[11px] text-on-surface-variant font-mono">
                    Session: {selectedAntiCheatEntry.sessionId.slice(0, 16)}...
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAntiCheatEntry(null)}
                className="text-on-surface-variant hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Cadet Summary Banner */}
            <div className="bg-surface-container/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container border border-white/10 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                  {selectedAntiCheatEntry.avatar ? (
                    <img src={selectedAntiCheatEntry.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    selectedAntiCheatEntry.username?.[0] || "C"
                  )}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">
                    {selectedAntiCheatEntry.fullName}
                  </div>
                  <div className="text-xs text-on-surface-variant font-mono">
                    @{selectedAntiCheatEntry.username}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-white font-mono">
                  {selectedAntiCheatEntry.score} / {selectedAntiCheatEntry.totalQuestions}
                </div>
                <div className="text-xs font-bold text-tertiary">
                  {selectedAntiCheatEntry.percentage}% Score
                </div>
              </div>
            </div>

            {/* Incident Counter Metric Cards */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-surface-container/50 border border-white/10 rounded-xl p-3 text-center">
                <span className="material-symbols-outlined text-amber-400 text-lg mb-1">
                  tab_unselected
                </span>
                <div className="text-xl font-bold font-mono text-white">
                  {selectedAntiCheatEntry.tabSwitchesCount || 0}
                </div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">
                  Tab Switches
                </div>
              </div>

              <div className="bg-surface-container/50 border border-white/10 rounded-xl p-3 text-center">
                <span className="material-symbols-outlined text-rose-400 text-lg mb-1">
                  content_copy
                </span>
                <div className="text-xl font-bold font-mono text-white">
                  {selectedAntiCheatEntry.copyAttemptsCount || 0}
                </div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">
                  Copy Tries
                </div>
              </div>

              <div className="bg-surface-container/50 border border-white/10 rounded-xl p-3 text-center">
                <span className="material-symbols-outlined text-purple-400 text-lg mb-1">
                  fullscreen_exit
                </span>
                <div className="text-xl font-bold font-mono text-white">
                  {selectedAntiCheatEntry.fullscreenExitsCount || 0}
                </div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono">
                  Fullscreen Exits
                </div>
              </div>
            </div>

            {/* Chronological Incident Timeline */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[140px] max-h-[260px]">
              <div className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center justify-between pb-1">
                <span>Chronological Event Stream</span>
                <span className="text-[10px] text-on-surface-variant">
                  {selectedAntiCheatEntry.antiCheatLogs?.length || 0} event(s)
                </span>
              </div>

              {(!selectedAntiCheatEntry.antiCheatLogs || selectedAntiCheatEntry.antiCheatLogs.length === 0) ? (
                <div className="py-8 text-center bg-surface-container/30 border border-dashed border-white/10 rounded-2xl">
                  <span className="material-symbols-outlined text-emerald-400 text-2xl mb-1">
                    check_circle
                  </span>
                  <p className="text-xs text-white font-medium">No Security Incidents Detected</p>
                  <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                    Cadet did not trigger tab switches, copy events, or fullscreen escapes.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedAntiCheatEntry.antiCheatLogs.map((log, idx) => {
                    const isTab = log.eventType?.includes("TAB") || log.eventType?.includes("BLUR");
                    const isCopy = log.eventType?.includes("COPY");

                    const badgeColor = isCopy
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                      : isTab
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                      : "bg-purple-500/15 border-purple-500/30 text-purple-300";

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-surface-container/40 border border-white/5 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border uppercase tracking-wider shrink-0 mt-0.5 ${badgeColor}`}>
                            {log.eventType}
                          </span>
                          <div>
                            <div className="text-white font-medium text-xs">
                              {log.details || "Security event triggered"}
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-on-surface-variant shrink-0 mt-0.5">
                          {log.timestamp
                            ? new Date(log.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : `#${idx + 1}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer action */}
            <div className="pt-2 border-t border-white/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAntiCheatEntry(null)}
                className="px-5 py-2 rounded-xl bg-surface-container hover:bg-surface-bright border border-white/10 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Quiz Modal */}
      {reviewData && (
        <CopyQuizModal
          isOpen={showCopyModal}
          quiz={{
            quizId: reviewData.quiz.quizId,
            title: reviewData.quiz.title,
            accessMode: reviewData.isPublic ? "PUBLIC" : "ORGANIZATION",
          }}
          onClose={() => setShowCopyModal(false)}
        />
      )}

      {/* Footer */}
      <AuthFooter />
    </div>
  );
}
