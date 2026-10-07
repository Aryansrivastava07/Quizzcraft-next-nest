"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import AuthFooter from "@/components/layout/AuthFooter";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import { quizService } from "@/lib/api/quiz-service";
import { QuizReviewData } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function QuizReviewPage({ params }: PageProps) {
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

  useEffect(() => {
    async function loadReview() {
      setIsLoading(true);
      setErrorStatus(null);
      setErrorMessage(null);

      try {
        const res = await quizService.getQuizReview(quizId);
        if (res?.data) {
          setReviewData(res.data);
        } else {
          setErrorStatus(404);
          setErrorMessage("Quiz review could not be loaded");
        }
      } catch (err: any) {
        setErrorStatus(err?.status || 500);
        setErrorMessage(
          err?.message || "Failed to load quiz review and telemetry"
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (quizId) {
      loadReview();
    }
  }, [quizId]);

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

                    {reviewData.isOwner && (
                      <Link
                        href={`/quiz/admin?quizId=${reviewData.quiz.quizId}`}
                        className="px-5 py-2.5 rounded-2xl bg-surface-container hover:bg-surface-bright border border-outline-variant/40 text-on-surface hover:text-white font-headline-sm font-medium text-xs text-center transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base text-purple-400">tune</span>
                        Admin Mission Control
                      </Link>
                    )}
                  </div>

                </div>
              </div>
            </ParallaxReveal>

            {/* Metrics HUD Grid */}
            <ParallaxReveal direction="up" distance={20} duration={600} delay={100}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                
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

                {/* Metric 2: Average Score */}
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

                {/* Metric 3: Highest Score */}
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

                {/* Metric 4: Pass Rate */}
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

      {/* Footer */}
      <AuthFooter />
    </div>
  );
}
