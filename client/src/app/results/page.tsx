"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { quizService } from "@/lib/api/quiz-service";
import { AttemptResultData } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatAvgTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0.0s";
  return `${Number(seconds).toFixed(1)}s`;
}

function getTierInfo(accuracy: number) {
  if (accuracy >= 90) {
    return {
      tier: "COSMIC GRANDMASTER TIER",
      badgeBg: "bg-amber-400/15 border-amber-400/40 text-amber-300",
      icon: "military_tech",
      summary: "Supreme mastery demonstrated across all questions. Outstanding telemetry convergence.",
    };
  }
  if (accuracy >= 75) {
    return {
      tier: "FLEET COMMANDER TIER",
      badgeBg: "bg-primary/15 border-primary/40 text-primary",
      icon: "workspace_premium",
      summary: "Impressive operational accuracy. High-level precision maintained across the mission.",
    };
  }
  if (accuracy >= 50) {
    return {
      tier: "CADET VANGUARD TIER",
      badgeBg: "bg-tertiary/15 border-tertiary/40 text-tertiary",
      icon: "verified",
      summary: "Solid foundational knowledge demonstrated. Review the solutions below to sharpen skills.",
    };
  }
  return {
    tier: "NOVICE RECRUIT TIER",
    badgeBg: "bg-surface-container-high border-outline-variant/40 text-on-surface-variant",
    icon: "psychology",
    summary: "Room for tactical improvement. Analyze the pedagogical feedback below and retake to master concepts.",
  };
}

function QuizResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const sessionIdParam = searchParams.get("sessionId");
  const quizIdParam = searchParams.get("quizId");

  const [resultData, setResultData] = useState<AttemptResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterReview, setFilterReview] = useState<"all" | "correct" | "incorrect">("all");
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAttemptResult() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        let data: AttemptResultData | null = null;

        // 1. If explicit sessionId is in query params
        if (sessionIdParam) {
          try {
            const res = await quizService.getAttemptResult(sessionIdParam);
            if (res?.data) {
              data = res.data;
            }
          } catch (sessionErr) {
            console.warn("Could not query attempt result by sessionId:", sessionErr);
          }
        }

        // 2. If quizId is provided without sessionId, fetch user's latest attempt for that quiz
        if (!data && quizIdParam) {
          try {
            const res = await quizService.getLatestAttemptResult(quizIdParam);
            if (res?.data) {
              data = res.data;
            }
          } catch (e) {
            console.warn("Could not query latest attempt by quizId:", e);
          }
        }

        // 3. Fallback: check cached attempt in localStorage
        if (!data && typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("qc_last_attempt");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.sessionId) {
                const res = await quizService.getAttemptResult(parsed.sessionId);
                if (res?.data) {
                  data = res.data;
                }
              }
            }
          } catch (e) {
            console.warn("Could not load cached attempt:", e);
          }
        }

        // 4. Fallback: query user's latest overall completed attempt
        if (!data) {
          try {
            const res = await quizService.getLatestAttemptResult();
            if (res?.data) {
              data = res.data;
            }
          } catch (e) {
            console.warn("Could not load latest user attempt:", e);
          }
        }

        if (!isMounted) return;

        if (data) {
          setResultData(data);
        } else {
          setErrorMessage(
            "No recorded assessment session found. Complete a quiz to view your real-time results, accuracy, and telemetry."
          );
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Results loading error:", err);
        setErrorMessage(
          err?.message || "Failed to load assessment telemetry from mission control."
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAttemptResult();

    return () => {
      isMounted = false;
    };
  }, [sessionIdParam, quizIdParam]);

  // Filter solutions
  const filteredQuestions = useMemo(() => {
    if (!resultData?.questions) return [];
    if (filterReview === "correct") {
      return resultData.questions.filter((q) => q.isCorrect);
    }
    if (filterReview === "incorrect") {
      return resultData.questions.filter((q) => !q.isCorrect);
    }
    return resultData.questions;
  }, [resultData, filterReview]);

  // Derived user statistics
  const stats = useMemo(() => {
    if (!resultData) return null;
    const { attempt, quiz, questions } = resultData;

    const totalXp = questions.reduce((sum, q) => sum + (q.xp || 200), 0);
    const earnedXp = questions
      .filter((q) => q.isCorrect)
      .reduce((sum, q) => sum + (q.xp || 200), 0);

    // Fast vs slow questions
    const questionTimes = questions
      .map((q) => q.timeSpentSeconds || 0)
      .filter((t) => t > 0);
    const fastestQTime = questionTimes.length > 0 ? Math.min(...questionTimes) : attempt.averageTimePerQuestion;
    const slowestQTime = questionTimes.length > 0 ? Math.max(...questionTimes) : attempt.averageTimePerQuestion;

    const tierInfo = getTierInfo(attempt.accuracy);

    return {
      totalXp,
      earnedXp,
      fastestQTime,
      slowestQTime,
      tierInfo,
    };
  }, [resultData]);

  const topThree = useMemo(() => {
    if (!resultData?.leaderboard) return [];
    return resultData.leaderboard.slice(0, 3);
  }, [resultData]);

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen text-on-surface font-body-md relative overflow-hidden flex flex-col justify-between">
        <CosmicCanvas />
        <Navbar />
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mb-4 animate-spin text-primary">
            <span className="material-symbols-outlined text-2xl">sync</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">
            Analyzing Assessment Telemetry...
          </h2>
          <p className="text-xs text-on-surface-variant font-mono">
            Evaluating user responses, accuracy, and response latency
          </p>
        </main>
      </div>
    );
  }

  // Error / No Result Found Screen
  if (!resultData || errorMessage) {
    return (
      <div className="min-h-screen text-on-surface font-body-md relative overflow-hidden flex flex-col justify-between">
        <CosmicCanvas />
        <Navbar />
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
          <div className="rounded-3xl p-8 bg-surface-container-low/90 border border-outline-variant/30 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-container border border-outline-variant/30 flex items-center justify-center mx-auto text-tertiary">
              <span className="material-symbols-outlined text-3xl">analytics</span>
            </div>
            <h2 className="text-xl font-bold text-white">No Results Found</h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {errorMessage || "You haven't completed any assessments yet or this session ID is invalid."}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/quizzes"
                className="px-4 py-2.5 rounded-xl bg-primary-container text-white text-xs font-semibold hover:bg-primary-container/90 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">explore</span>
                Browse Public Quizzes
              </Link>
              <Link
                href="/create"
                className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border border-white/10"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Create A Quiz
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { attempt, quiz, questions } = resultData;

  return (
    <div className="min-h-screen text-on-surface font-body-md selection:bg-primary selection:text-on-primary relative overflow-x-hidden antialiased">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Universal Top Navbar */}
      <Navbar />

      {/* Main Canvas Content */}
      <main className="relative z-10 max-w-max-width-canvas mx-auto px-4 sm:px-8 pt-28 pb-20 space-y-8">
        
        {/* =================================================================== */}
        {/* 1. Hero Result & XP Banner Section (Real User Data)               */}
        {/* =================================================================== */}
        <ParallaxReveal direction="up" distance={25} duration={750}>
          <section className="rounded-3xl p-6 sm:p-8 relative overflow-hidden bg-surface-container-low/85 backdrop-blur-2xl border border-outline-variant/30 shadow-2xl">
            <div className="absolute -right-16 -top-16 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-tertiary/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              
              {/* Rank & Headline */}
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-label-code font-bold tracking-wide ${stats?.tierInfo.badgeBg}`}>
                    <span className="material-symbols-outlined text-sm">
                      {stats?.tierInfo.icon}
                    </span>
                    <span>
                      {attempt.percentile >= 90 ? `TOP ${Math.max(1, 100 - attempt.percentile)}% • ` : ""}
                      {stats?.tierInfo.tier}
                    </span>
                  </div>

                  {quiz.pin && (
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container-highest border border-white/10 text-on-surface-variant font-mono text-[11px]">
                      PIN: {quiz.pin}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl font-headline-xl text-on-surface font-extrabold tracking-tight flex flex-wrap items-center gap-2">
                  <span>Rank #{attempt.rank}</span>
                  <span className="text-on-surface-variant font-body-lg text-lg font-normal">
                    of {attempt.totalParticipants} Participant{attempt.totalParticipants === 1 ? "" : "s"}
                  </span>
                  <span className="px-2.5 py-1 text-xs rounded-lg bg-surface-container-high border border-outline-variant/40 text-primary font-label-code font-bold">
                    Grade {attempt.grade}
                  </span>
                </h1>

                <p className="text-xs sm:text-sm font-body-md text-on-surface-variant leading-relaxed">
                  {stats?.tierInfo.summary} Completed assessment for <strong className="text-white">&ldquo;{quiz.title}&rdquo;</strong>.
                </p>
              </div>

              {/* Metric Cluster (Individual User Metrics) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                
                {/* Metric 1: Final XP */}
                <div className="bg-surface-container-high/60 border border-outline-variant/30 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center">
                  <span className="font-label-code text-[10px] text-on-surface-variant uppercase tracking-wider">
                    XP Earned
                  </span>
                  <span className="font-stat-counter text-xl sm:text-2xl text-primary font-bold">
                    {stats?.earnedXp.toLocaleString()}
                  </span>
                  <span className="font-label-code text-[10px] text-tertiary">
                    / {stats?.totalXp.toLocaleString()} Max
                  </span>
                </div>

                {/* Metric 2: Accuracy */}
                <div className="bg-surface-container-high/60 border border-outline-variant/30 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center">
                  <span className="font-label-code text-[10px] text-on-surface-variant uppercase tracking-wider">
                    Accuracy
                  </span>
                  <span className="font-stat-counter text-xl sm:text-2xl text-tertiary font-bold">
                    {attempt.accuracy}%
                  </span>
                  <span className="font-label-code text-[10px] text-on-surface-variant">
                    {attempt.correctCount}/{attempt.totalQuestions} Correct
                  </span>
                </div>

                {/* Metric 3: User Average Time Per Question */}
                <div className="bg-surface-container-high/60 border border-outline-variant/30 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center">
                  <span className="font-label-code text-[10px] text-on-surface-variant uppercase tracking-wider">
                    Avg Time / Q
                  </span>
                  <span className="font-stat-counter text-xl sm:text-2xl text-on-surface font-bold">
                    {formatAvgTime(attempt.averageTimePerQuestion)}
                  </span>
                  <span className="font-label-code text-[10px] text-on-surface-variant">
                    Total {formatDuration(attempt.totalTimeSpentSeconds)}
                  </span>
                </div>

                {/* Metric 4: Score */}
                <div className="bg-surface-container-high/60 border border-outline-variant/30 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center">
                  <span className="font-label-code text-[10px] text-on-surface-variant uppercase tracking-wider">
                    Score
                  </span>
                  <span className="font-stat-counter text-xl sm:text-2xl text-emerald-400 font-bold">
                    {attempt.score}
                  </span>
                  <span className="font-label-code text-[10px] text-on-surface-variant">
                    out of {attempt.totalQuestions}
                  </span>
                </div>

              </div>
            </div>

            {/* Quick Action Anchor Pills */}
            <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-3 text-xs font-headline-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href="#analytics-grid"
                  className="px-3 py-1.5 rounded-full bg-surface-container-highest/60 hover:bg-primary-container/30 hover:text-primary transition-all flex items-center gap-1.5 text-on-surface"
                >
                  <span className="material-symbols-outlined text-sm">monitoring</span>
                  <span>Accuracy &amp; Time Telemetry</span>
                </a>
                <a
                  href="#solutions-section"
                  className="px-3 py-1.5 rounded-full bg-surface-container-highest/60 hover:bg-primary-container/30 hover:text-primary transition-all flex items-center gap-1.5 text-on-surface"
                >
                  <span className="material-symbols-outlined text-sm">fact_check</span>
                  <span>Question Solutions</span>
                </a>
                <a
                  href="#leaderboard-section"
                  className="px-3 py-1.5 rounded-full bg-surface-container-highest/60 hover:bg-primary-container/30 hover:text-primary transition-all flex items-center gap-1.5 text-on-surface"
                >
                  <span className="material-symbols-outlined text-sm">trophy</span>
                  <span>Fleet Leaderboard</span>
                </a>
              </div>

              <div className="flex items-center gap-2 font-label-code">
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-bright text-white text-xs font-medium flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">share</span>
                  <span>Share Score</span>
                </button>
                <Link
                  href={quiz.pin ? `/join?pin=${quiz.pin}` : `/quiz?quizId=${quiz.quizId}`}
                  className="px-3.5 py-1.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-semibold flex items-center gap-1 shadow-sm border border-white/10 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">replay</span>
                  <span>Retake Assessment</span>
                </Link>
              </div>
            </div>
          </section>
        </ParallaxReveal>

        {/* =================================================================== */}
        {/* 2. Telemetry Section: Correct vs Incorrect & User Avg Time per Q   */}
        {/* =================================================================== */}
        <ParallaxReveal direction="up" distance={25} delay={100} duration={750}>
          <section className="space-y-4" id="analytics-grid">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-xl">
                  monitoring
                </span>
                <h2 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-semibold tracking-tight">
                  Cadet Telemetry &amp; Performance Metrics
                </h2>
              </div>
              <span className="text-[11px] font-mono text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full border border-white/5">
                Individual Assessment Mode
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Telemetry Card 1: Correct vs Incorrect Data for this User */}
              <div className="rounded-2xl p-5 sm:p-6 bg-surface-container-low/85 border border-outline-variant/30 backdrop-blur-xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-headline-sm text-sm font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                      Correct vs. Incorrect Breakdown
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Your precision ratio across {attempt.totalQuestions} evaluated questions
                    </p>
                  </div>
                  <span className="text-lg font-mono font-bold text-tertiary">
                    {attempt.accuracy}%
                  </span>
                </div>

                {/* Comparative Visual Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-3.5 rounded-full bg-surface-container-highest overflow-hidden flex p-0.5 border border-white/10">
                    <div
                      className="h-full bg-emerald-400 rounded-l-full transition-all duration-1000"
                      style={{ width: `${attempt.accuracy}%` }}
                      title={`Correct: ${attempt.correctCount} (${attempt.accuracy}%)`}
                    />
                    <div
                      className="h-full bg-error rounded-r-full transition-all duration-1000"
                      style={{ width: `${100 - attempt.accuracy}%` }}
                      title={`Incorrect: ${attempt.incorrectCount} (${100 - attempt.accuracy}%)`}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{attempt.correctCount} Correct ({attempt.accuracy}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-error font-bold">
                      <span className="w-2 h-2 rounded-full bg-error" />
                      <span>{attempt.incorrectCount} Incorrect ({100 - attempt.accuracy}%)</span>
                    </div>
                  </div>
                </div>

                {/* Sub-Metric Tiles */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/20 text-center">
                  <div className="p-2.5 rounded-xl bg-surface-container-highest/40 border border-emerald-500/20">
                    <span className="block text-[10px] font-label-code text-on-surface-variant uppercase">
                      Correct
                    </span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {attempt.correctCount}
                    </span>
                    <span className="block text-[10px] text-emerald-300/80">
                      +{stats?.earnedXp || 0} XP
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-container-highest/40 border border-error/20">
                    <span className="block text-[10px] font-label-code text-on-surface-variant uppercase">
                      Incorrect
                    </span>
                    <span className="text-base font-bold text-error font-mono">
                      {attempt.incorrectCount}
                    </span>
                    <span className="block text-[10px] text-error/80">
                      0 XP
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-container-highest/40 border border-white/10">
                    <span className="block text-[10px] font-label-code text-on-surface-variant uppercase">
                      Unanswered
                    </span>
                    <span className="text-base font-bold text-on-surface font-mono">
                      {attempt.unansweredCount || 0}
                    </span>
                    <span className="block text-[10px] text-on-surface-variant">
                      Skipped
                    </span>
                  </div>
                </div>
              </div>

              {/* Telemetry Card 2: User Average Time per Question */}
              <div className="rounded-2xl p-5 sm:p-6 bg-surface-container-low/85 border border-outline-variant/30 backdrop-blur-xl flex flex-col justify-between space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-headline-sm text-sm font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">timer</span>
                      Average Time Per Question
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Your answer latency and pacing analysis across this session
                    </p>
                  </div>
                  <span className="text-lg font-mono font-bold text-primary">
                    {formatAvgTime(attempt.averageTimePerQuestion)}
                  </span>
                </div>

                {/* Latency Summary Highlight */}
                <div className="p-4 rounded-xl bg-surface-container-highest/40 border border-outline-variant/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant">Mean Time per Question:</span>
                    <span className="font-mono font-bold text-white">{formatAvgTime(attempt.averageTimePerQuestion)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant">Total Duration Taken:</span>
                    <span className="font-mono font-bold text-white">{formatDuration(attempt.totalTimeSpentSeconds)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant">Temporal Limit Target:</span>
                    <span className="font-mono text-tertiary">{quiz.questime || 60}s max / question</span>
                  </div>
                </div>

                {/* Pacing Speed Indicator Pill */}
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-[11px] font-mono">
                  <span className="text-on-surface-variant">
                    {attempt.averageTimePerQuestion <= (quiz.questime || 60) * 0.5 ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        Lightning Response Pace
                      </span>
                    ) : attempt.averageTimePerQuestion <= (quiz.questime || 60) ? (
                      <span className="text-primary font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check</span>
                        Within Tactical Time Limit
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        Deliberate Careful Pacing
                      </span>
                    )}
                  </span>
                  <span className="text-on-surface-variant">
                    Fastest: {formatAvgTime(stats?.fastestQTime || 0)}
                  </span>
                </div>
              </div>

            </div>
          </section>
        </ParallaxReveal>

        {/* =================================================================== */}
        {/* 3. Question Solutions Breakdown Section (Real Quiz Questions)      */}
        {/* =================================================================== */}
        <ParallaxReveal direction="up" distance={25} delay={100} duration={750}>
          <section className="space-y-4" id="solutions-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-tertiary text-xl">
                    fact_check
                  </span>
                  <h2 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-semibold tracking-tight">
                    Full Question Breakdown &amp; Solutions
                  </h2>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Review verified solutions, your answers, explanations, and time spent per question
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 font-headline-sm text-xs">
                <button
                  type="button"
                  onClick={() => setFilterReview("all")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    filterReview === "all"
                      ? "bg-primary text-on-primary font-semibold"
                      : "bg-surface-container-high text-on-surface hover:text-primary"
                  }`}
                >
                  All ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterReview("correct")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    filterReview === "correct"
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-surface-container-high text-on-surface hover:text-primary"
                  }`}
                >
                  Correct ({attempt.correctCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterReview("incorrect")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    filterReview === "incorrect"
                      ? "bg-error text-on-error font-semibold"
                      : "bg-surface-container-high text-on-surface hover:text-primary"
                  }`}
                >
                  Incorrect ({attempt.incorrectCount})
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {filteredQuestions.length === 0 ? (
                <div className="p-8 rounded-2xl bg-surface-container-low/80 border border-outline-variant/30 text-center text-xs text-on-surface-variant">
                  No questions match the selected filter ({filterReview}).
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const isCorrect = q.isCorrect;
                  const borderClass = isCorrect
                    ? "border-emerald-500/40 bg-surface-container-low/85"
                    : "border-error/40 bg-surface-container-low/85";

                  return (
                    <div
                      key={q.questionId}
                      className={`rounded-2xl p-5 border ${borderClass} space-y-3 backdrop-blur-xl shadow-md transition-all`}
                    >
                      {/* Card Header */}
                      <div className="flex flex-wrap justify-between items-center text-xs pb-2 border-b border-outline-variant/20 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-label-code font-bold text-primary">
                            #{q.id.toString().padStart(2, "0")}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-label-code font-bold text-[10px] border ${
                              isCorrect
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-error-container/30 text-error border-error/40"
                            }`}
                          >
                            {isCorrect ? `CORRECT (+${q.xp} XP)` : "INCORRECT (0 XP)"}
                          </span>
                          {q.timeSpentSeconds !== undefined && q.timeSpentSeconds > 0 && (
                            <span className="text-on-surface-variant font-mono text-[11px] flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">timer</span>
                              Time: {formatDuration(q.timeSpentSeconds)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-label-code text-[10px] uppercase px-2 py-0.5 rounded bg-surface-container border border-white/5 text-on-surface-variant">
                            {q.level}
                          </span>
                        </div>
                      </div>

                      {/* Question Statement */}
                      <p className="text-sm font-headline-sm text-on-surface font-medium leading-relaxed">
                        {q.question}
                      </p>

                      {/* Reference Media if present */}
                      {q.reference?.mediaUrl && (
                        <div className="my-2 rounded-xl overflow-hidden max-h-48 border border-white/10 bg-black/40">
                          <img
                            src={q.reference.mediaUrl}
                            alt={q.reference.caption || "Question reference"}
                            className="w-full h-full object-contain max-h-48"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      {/* Answer Feedback Box */}
                      <div
                        className={`p-3.5 rounded-xl text-xs space-y-1.5 border ${
                          isCorrect
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                            : "bg-error-container/20 border-error/30 text-error"
                        }`}
                      >
                        <div className="font-bold font-label-code">
                          <span>Your Response: </span>
                          <span className={isCorrect ? "text-emerald-200" : "text-rose-300 underline"}>
                            {q.userAnswer ? `[${q.userAnswer}]` : "No answer selected"}
                          </span>
                        </div>

                        {!isCorrect && (
                          <div className="font-bold font-label-code text-emerald-300">
                            <span>Correct Answer: </span>
                            <span>[{q.correctAnswer}]</span>
                          </div>
                        )}

                        {q.explanation && (
                          <p className="text-on-surface-variant text-[11px] mt-1.5 leading-relaxed pt-1 border-t border-white/10">
                            <strong className="text-white">Explanation: </strong>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </ParallaxReveal>

        {/* =================================================================== */}
        {/* 4. Fleet Leaderboard Section (Real Participants)                  */}
        {/* =================================================================== */}
        <ParallaxReveal direction="up" distance={30} delay={100} duration={800}>
          <section className="space-y-4" id="leaderboard-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-xl">
                    emoji_events
                  </span>
                  <h2 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-semibold tracking-tight">
                    Cosmic Fleet Leaderboard
                  </h2>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Verified standings for {quiz.title} ({resultData.leaderboard.length} Cadets Ranked)
                </p>
              </div>

              <div className="inline-flex p-1 rounded-full bg-surface-container-high border border-outline-variant/30 text-xs font-headline-sm">
                <span className="px-3 py-0.5 rounded-full font-semibold bg-primary text-on-primary shadow-sm">
                  All Cadets ({resultData.leaderboard.length})
                </span>
              </div>
            </div>

            {/* Podium (Top 3) */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-3">
                {topThree.map((pilot, idx) => {
                  const isFirst = idx === 0;
                  const isSecond = idx === 1;
                  const isThird = idx === 2;

                  const orderClass = isFirst
                    ? "order-1 md:order-2"
                    : isSecond
                    ? "order-2 md:order-1"
                    : "order-3";

                  const medalBadge = isFirst
                    ? "1st • GRAND CHAMPION"
                    : isSecond
                    ? "2nd PLACE"
                    : "3rd PLACE";

                  const borderGlow = isFirst
                    ? "border-2 border-tertiary/60 md:-translate-y-2 shadow-xl shadow-tertiary/20"
                    : isSecond
                    ? "border border-primary/40 shadow-lg shadow-primary/10"
                    : "border border-outline-variant/40 shadow-lg";

                  return (
                    <div
                      key={pilot.sessionId}
                      className={`${orderClass} rounded-2xl p-5 border relative bg-surface-container-low/90 backdrop-blur-md ${borderGlow}`}
                    >
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-surface-container-highest text-white text-[10px] font-label-code font-bold uppercase tracking-wider flex items-center gap-1 shadow-md border border-white/10">
                        <span className="material-symbols-outlined text-xs">
                          {isFirst ? "military_tech" : isSecond ? "star" : "workspace_premium"}
                        </span>
                        <span>{pilot.isCurrentUser ? `${medalBadge} • YOU` : medalBadge}</span>
                      </div>

                      <div className="flex flex-col items-center text-center mt-2">
                        <div className="w-14 h-14 rounded-full border-2 border-primary p-0.5 mb-2 relative bg-surface-container flex items-center justify-center font-bold text-lg text-primary overflow-hidden">
                          {pilot.avatar ? (
                            <img src={pilot.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            pilot.username?.[0]?.toUpperCase() || "C"
                          )}
                          <span className="absolute bottom-0 right-0 bg-primary text-on-primary text-[10px] font-label-code font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {idx + 1}
                          </span>
                        </div>

                        <h4 className="font-headline-sm text-base text-on-surface font-bold truncate max-w-xs">
                          {pilot.fullName}
                        </h4>
                        <span className="font-label-code text-xs text-primary">
                          @{pilot.username}
                        </span>

                        <div className="mt-3 w-full bg-surface-container-highest/50 rounded-xl p-2 flex justify-around text-center text-xs">
                          <div>
                            <span className="block text-[10px] font-label-code text-on-surface-variant">SCORE</span>
                            <span className="font-stat-counter text-sm text-primary font-bold">
                              {pilot.score}/{attempt.totalQuestions}
                            </span>
                          </div>
                          <div className="w-[1px] bg-outline-variant/30" />
                          <div>
                            <span className="block text-[10px] font-label-code text-on-surface-variant">ACC</span>
                            <span className="font-stat-counter text-sm text-tertiary font-bold">
                              {pilot.percentage}%
                            </span>
                          </div>
                          <div className="w-[1px] bg-outline-variant/30" />
                          <div>
                            <span className="block text-[10px] font-label-code text-on-surface-variant">TIME</span>
                            <span className="font-stat-counter text-sm text-on-surface font-bold">
                              {formatDuration(pilot.totalTimeSpentSeconds || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Standings Table */}
            <div className="rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-low/85 backdrop-blur-xl shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant/30 bg-surface-container-highest/40 text-on-surface-variant font-label-code text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Cadet Pilot</th>
                      <th className="py-3 px-4 text-center">Score</th>
                      <th className="py-3 px-4 text-right">Accuracy</th>
                      <th className="py-3 px-4 text-right">Avg Response</th>
                      <th className="py-3 px-4 text-right">Total Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-body-md">
                    {resultData.leaderboard.map((entry) => {
                      const isMe = entry.isCurrentUser;
                      return (
                        <tr
                          key={entry.sessionId}
                          className={`transition-colors ${
                            isMe
                              ? "bg-primary-container/15 hover:bg-primary-container/25 border-l-4 border-l-primary"
                              : "hover:bg-surface-container-high/40"
                          }`}
                        >
                          <td className="py-3 px-4 font-label-code font-bold text-tertiary">
                            #{entry.rank.toString().padStart(2, "0")}
                          </td>
                          <td className="py-3 px-4 font-semibold text-on-surface">
                            <div className="flex items-center gap-2">
                              {isMe && (
                                <span className="px-1.5 py-0.5 rounded bg-primary text-on-primary text-[10px] font-label-code font-bold">
                                  YOU
                                </span>
                              )}
                              <span>{entry.fullName}</span>
                              <span className="text-[11px] text-on-surface-variant font-normal">
                                (@{entry.username})
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-white">
                            {entry.score} / {attempt.totalQuestions}
                          </td>
                          <td className="py-3 px-4 text-right font-label-code text-tertiary font-semibold">
                            {entry.percentage}%
                          </td>
                          <td className="py-3 px-4 text-right font-label-code text-on-surface">
                            {entry.avgResponseTime ? `${entry.avgResponseTime}s` : "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-label-code text-on-surface-variant">
                            {formatDuration(entry.totalTimeSpentSeconds || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </ParallaxReveal>

      </main>

      {/* Share Score Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <span className="material-symbols-outlined text-4xl text-primary">emoji_events</span>
            <h3 className="font-headline-sm text-base text-on-surface font-bold">
              Share Your Assessment Score
            </h3>
            <p className="text-xs text-on-surface-variant">
              Rank #{attempt.rank} • {attempt.score}/{attempt.totalQuestions} Correct ({attempt.accuracy}%) on &ldquo;{quiz.title}&rdquo;
            </p>
            <div className="p-3 rounded-lg bg-surface-container-high text-xs font-label-code text-primary break-all">
              {typeof window !== "undefined"
                ? `${window.location.origin}/quiz?quizId=${quiz.quizId}`
                : quiz.title}
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/quiz?quizId=${quiz.quizId}`
                  );
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all cursor-pointer"
            >
              {copiedLink ? "Link Copied to Clipboard!" : "Copy Quiz Link"}
            </button>
            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              className="w-full py-1.5 text-on-surface-variant hover:text-on-surface text-xs font-label-code cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest/80 backdrop-blur-md border-t border-outline-variant/20 py-6 px-6 relative z-10 text-xs font-label-code text-on-surface-variant">
        <div className="max-w-max-width-canvas mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold">QuizzCraft.app</span>
            <span>© 2026 QuizzCraft</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <Link href="/quizzes" className="hover:text-primary transition-colors">
              Explore Arenas
            </Link>
            <Link href="/create" className="hover:text-primary transition-colors">
              Create Another Quiz
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function QuizResultsPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen text-on-surface flex items-center justify-center">
            <div className="animate-spin text-primary material-symbols-outlined text-3xl">
              sync
            </div>
          </div>
        }
      >
        <QuizResultsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
