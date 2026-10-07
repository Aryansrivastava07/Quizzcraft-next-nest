"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import GlassCard from "@/components/ui/GlassCard";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { quizService } from "@/lib/api/quiz-service";

interface CadetAttempt {
  sessionId: string;
  userId: string;
  username: string;
  fullName: string;
  avatar: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  isActive: boolean;
  lastUpdateAt: string;
}

function QuizAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizIdParam = searchParams.get("quizId");

  const [quizData, setQuizData] = useState<any>(null);
  const [attendeesCount, setAttendeesCount] = useState(0);
  const [activeAttendeesCount, setActiveAttendeesCount] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [waitingCadetsCount, setWaitingCadetsCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<CadetAttempt[]>([]);
  const [isOwner, setIsOwner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const fetchAdminTelemetry = useCallback(async () => {
    let targetQuizId = quizIdParam;
    if (!targetQuizId) {
      try {
        const cached = localStorage.getItem("qc_active_quiz");
        if (cached) {
          const parsed = JSON.parse(cached);
          targetQuizId = parsed?.quizId;
        }
      } catch (e) {
        console.warn("Could not read cached quiz:", e);
      }
    }

    if (!targetQuizId) {
      setError("No quiz ID provided");
      setLoading(false);
      return;
    }

    try {
      const res = await quizService.getQuizAdminData(targetQuizId);
      if (res?.data) {
        setQuizData(res.data.quiz);
        setAttendeesCount(res.data.attendeesCount || 0);
        setActiveAttendeesCount(res.data.activeAttendeesCount || 0);
        setAverageScore(res.data.averageScore || 0);
        setWaitingCadetsCount(res.data.waitingCadetsCount || 0);
        setLeaderboard(res.data.leaderboard || []);
        setIsOwner(res.data.isOwner !== false);
      }
    } catch (err: any) {
      console.error("Error fetching admin telemetry:", err);
      setError(err?.message || "Failed to load admin telemetry");
    } finally {
      setLoading(false);
    }
  }, [quizIdParam]);

  useEffect(() => {
    fetchAdminTelemetry();
    // Poll telemetry every 4 seconds for real-time live arena updates
    const interval = setInterval(fetchAdminTelemetry, 4000);
    return () => clearInterval(interval);
  }, [fetchAdminTelemetry]);

  const rawPin = quizData?.pin ? String(quizData.pin).replace(/\D/g, "") : "";
  const formattedPin =
    rawPin.length === 6 ? `${rawPin.slice(0, 3)}-${rawPin.slice(3)}` : rawPin || "--- ---";

  const handleCopyPin = () => {
    if (!rawPin) return;
    navigator.clipboard.writeText(rawPin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://quizzcraft.app";
    const joinUrl = `${origin}/join?pin=${rawPin}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCloseQuiz = async () => {
    if (!quizData?.quizId) return;
    if (!confirm("Are you sure you want to end this live quiz session? Cadets will no longer be able to submit answers.")) {
      return;
    }
    setIsEnding(true);
    try {
      await quizService.closeQuiz(quizData.quizId);
      await fetchAdminTelemetry();
    } catch (err: any) {
      alert(err?.message || "Failed to end quiz");
    } finally {
      setIsEnding(false);
    }
  };

  // Compute live remaining time
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  useEffect(() => {
    if (!quizData?.liveUntil) {
      setTimeRemaining("");
      return;
    }
    const updateCountdown = () => {
      const diff = new Date(quizData.liveUntil).getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining("Session Expired");
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(
        hrs > 0
          ? `${hrs}h ${mins}m ${secs}s remaining`
          : `${mins}m ${secs}s remaining`
      );
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [quizData?.liveUntil]);

  const isLive = quizData?.status === "LIVE";
  const isScheduled = quizData?.status === "SCHEDULED";
  const isEnded = quizData?.status === "ENDED";

  return (
    <div className="min-h-screen text-on-surface font-body-md antialiased relative flex flex-col justify-between overflow-x-hidden">
      <CosmicCanvas />
      <Navbar />

      <main className="relative z-10 w-full max-w-max-width-canvas mx-auto px-4 sm:px-8 pt-28 pb-16 flex-1 flex flex-col gap-6">
        {/* Top Mission Control Banner */}
        <ParallaxReveal direction="up" distance={25} duration={700}>
          <div className="rounded-2xl p-6 sm:p-8 bg-surface-container-low/85 backdrop-blur-2xl border border-outline-variant/40 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary/40" />
            <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-primary/20 blur-[90px] pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {quizData?.coverImage && (
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-primary/30 shrink-0 shadow-lg bg-surface-container-highest group">
                    <img
                      src={quizData.coverImage}
                      alt={quizData?.title || "Arena cover"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/stitch/screen-6-cosmic-portal-3d.png';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/60 via-transparent to-transparent pointer-events-none" />
                  </div>
                )}

                <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-code text-xs font-bold uppercase tracking-wider ${
                      isLive
                        ? "bg-primary-container/30 text-primary border border-primary/40"
                        : isScheduled
                        ? "bg-tertiary-container/30 text-tertiary border border-tertiary/40"
                        : "bg-surface-container-high text-on-surface-variant border border-outline-variant/40"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isLive
                          ? "bg-primary animate-ping"
                          : isScheduled
                          ? "bg-tertiary animate-pulse"
                          : "bg-outline"
                      }`}
                    />
                    {isLive
                      ? "LIVE ARENA ACTIVE"
                      : isScheduled
                      ? "SCHEDULED EVENT"
                      : isEnded
                      ? "SESSION CONCLUDED"
                      : "STANDBY"}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/40 text-on-surface-variant font-label-code text-xs">
                    PROTOCOL: {quizData?.deploymentType || "LIVE HOST"}
                  </span>

                  {quizData?.accessMode && (
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-container/30 text-secondary border border-secondary/40 font-label-code text-xs uppercase">
                      {quizData.accessMode}
                      {quizData.organizationDomain ? ` • @${quizData.organizationDomain}` : ""}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline-xl font-extrabold text-white tracking-tight">
                  {quizData?.title || "Quantum Quiz Arena"}
                </h1>

                <p className="text-on-surface-variant font-body-md text-xs sm:text-sm max-w-2xl">
                  Host Command Dashboard. Real-time telemetry, attendance monitoring, and live cadet leaderboard ranking.
                </p>

                {timeRemaining && isLive && (
                  <div className="inline-flex items-center gap-2 text-xs font-label-code px-3 py-1 rounded-lg bg-surface-container/70 border border-outline-variant/40 text-tertiary">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>{timeRemaining}</span>
                  </div>
                )}
              </div>
              </div>

              {/* Host PIN & Quick Action Cluster */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="p-3 rounded-xl bg-surface-container/90 border border-primary/40 flex items-center justify-between sm:justify-start gap-4 shadow-lg">
                  <div>
                    <div className="text-[10px] font-label-code text-on-surface-variant uppercase tracking-wider">
                      Room PIN
                    </div>
                    <div className="font-stat-counter text-xl sm:text-2xl font-extrabold text-primary tracking-widest">
                      {formattedPin}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyPin}
                    className="p-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors cursor-pointer"
                    title="Copy PIN"
                  >
                    <span className="material-symbols-outlined text-base">
                      {copiedPin ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/50 hover:border-tertiary text-on-surface hover:text-white font-headline-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-tertiary">link</span>
                    <span>{copiedLink ? "Link Copied!" : "Share Link"}</span>
                  </button>

                  <button
                    onClick={() => setShowQrModal(true)}
                    className="px-3 py-3 rounded-xl bg-surface-container-high border border-outline-variant/50 hover:border-secondary text-secondary transition-all cursor-pointer"
                    title="QR Code"
                  >
                    <span className="material-symbols-outlined text-base">qr_code_2</span>
                  </button>

                  {isLive && (
                    <button
                      onClick={handleCloseQuiz}
                      disabled={isEnding}
                      className="px-4 py-3 rounded-xl bg-error/20 hover:bg-error/30 text-error border border-error/40 font-headline-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">stop_circle</span>
                      <span>{isEnding ? "Ending..." : "End Session"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ParallaxReveal>

        {/* 4 Live Telemetry Metrics */}
        <ParallaxReveal direction="up" distance={25} delay={100} duration={750}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="p-5 rounded-xl border-outline-variant/30 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label-code text-on-surface-variant uppercase">
                  Total Attendees
                </span>
                <span className="material-symbols-outlined text-primary text-xl">groups</span>
              </div>
              <div className="mt-3">
                <span className="font-stat-counter text-3xl font-extrabold text-white">
                  {attendeesCount}
                </span>
                <span className="block text-[11px] text-on-surface-variant mt-0.5">
                  Cadets Attempted
                </span>
              </div>
            </GlassCard>

            <GlassCard className="p-5 rounded-xl border-outline-variant/30 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label-code text-on-surface-variant uppercase">
                  Active in Arena
                </span>
                <span className="material-symbols-outlined text-tertiary text-xl">sensors</span>
              </div>
              <div className="mt-3">
                <span className="font-stat-counter text-3xl font-extrabold text-tertiary">
                  {activeAttendeesCount}
                </span>
                <span className="block text-[11px] text-on-surface-variant mt-0.5">
                  Currently Solving
                </span>
              </div>
            </GlassCard>

            <GlassCard className="p-5 rounded-xl border-outline-variant/30 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label-code text-on-surface-variant uppercase">
                  Average Mastery
                </span>
                <span className="material-symbols-outlined text-secondary text-xl">insights</span>
              </div>
              <div className="mt-3">
                <span className="font-stat-counter text-3xl font-extrabold text-secondary">
                  {averageScore}%
                </span>
                <span className="block text-[11px] text-on-surface-variant mt-0.5">
                  Across Submissions
                </span>
              </div>
            </GlassCard>

            <GlassCard className="p-5 rounded-xl border-outline-variant/30 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label-code text-on-surface-variant uppercase">
                  {isScheduled ? "Waitlist Queue" : "Quiz Questions"}
                </span>
                <span className="material-symbols-outlined text-amber-accent text-xl">
                  {isScheduled ? "hourglass_top" : "quiz"}
                </span>
              </div>
              <div className="mt-3">
                <span className="font-stat-counter text-3xl font-extrabold text-amber-accent">
                  {isScheduled ? waitingCadetsCount : quizData?.questions?.length || 0}
                </span>
                <span className="block text-[11px] text-on-surface-variant mt-0.5">
                  {isScheduled ? "Waiting for Launch" : "Active Items"}
                </span>
              </div>
            </GlassCard>
          </div>
        </ParallaxReveal>

        {/* Live Cadet Leaderboard Table */}
        <ParallaxReveal direction="up" distance={30} delay={180} duration={800}>
          <div className="rounded-2xl p-6 bg-surface-container-low/85 backdrop-blur-2xl border border-outline-variant/40 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-headline-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">trophy</span>
                  <span>Live Cadet Leaderboard</span>
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Real-time scores dynamically updated as answers are submitted.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-label-code text-on-surface-variant">
                  Live Sync (4s polling)
                </span>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-surface-container/30 border border-outline-variant/20 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-2xl">sports_esports</span>
                </div>
                <h3 className="font-headline-sm font-semibold text-white text-base">
                  No Attendees in the Arena Yet
                </h3>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  Share Room PIN <strong className="text-primary font-mono">{formattedPin}</strong> or the direct join link with your cadets to begin streaming scores.
                </p>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-white font-headline-sm text-xs font-semibold hover:bg-primary-container/90 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  <span>Copy Join Link</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-[11px] font-label-code text-on-surface-variant uppercase tracking-wider">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Cadet Pilot</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Mastery</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Last Telemetry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 text-xs">
                    {leaderboard.map((cadet, idx) => {
                      const isTop1 = idx === 0;
                      const isTop2 = idx === 1;
                      const isTop3 = idx === 2;

                      return (
                        <tr
                          key={cadet.sessionId}
                          className="hover:bg-surface-container/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <span
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center font-stat-counter font-bold text-xs ${
                                isTop1
                                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/50"
                                  : isTop2
                                  ? "bg-slate-300/20 text-slate-200 border border-slate-300/50"
                                  : isTop3
                                  ? "bg-amber-700/20 text-amber-500 border border-amber-700/50"
                                  : "text-on-surface-variant"
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {cadet.avatar ? (
                                <img
                                  src={cadet.avatar}
                                  alt={cadet.username}
                                  className="w-8 h-8 rounded-full object-cover border border-outline-variant/40"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs">
                                  {cadet.username.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="block font-semibold text-white">
                                  {cadet.fullName}
                                </span>
                                <span className="block font-mono text-[10px] text-on-surface-variant">
                                  @{cadet.username}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-primary">
                            {cadet.score} / {cadet.totalQuestions}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-primary h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(0, cadet.percentage))}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs font-semibold">
                                {cadet.percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-label-code font-bold uppercase ${
                                cadet.isActive
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  cadet.isActive ? "bg-primary animate-ping" : "bg-emerald-400"
                                }`}
                              />
                              {cadet.isActive ? "Solving" : "Submitted"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[11px] text-on-surface-variant">
                            {cadet.lastUpdateAt
                              ? new Date(cadet.lastUpdateAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : "Just now"}
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
      </main>

      {/* QR Portal Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/40 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="font-headline-sm text-sm text-primary font-bold">
                QR Cosmic Portal
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="w-48 h-48 mx-auto bg-white p-3 rounded-xl flex items-center justify-center shadow-lg">
              <div className="w-full h-full border-4 border-black p-2 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-10 h-10 bg-black" />
                  <div className="w-10 h-10 bg-black" />
                </div>
                <div className="text-[10px] font-mono text-black font-extrabold tracking-tighter">
                  SCAN TO JOIN
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-10 h-10 bg-black" />
                  <div className="w-6 h-6 bg-black" />
                </div>
              </div>
            </div>

            <div className="font-label-code text-xs text-on-surface-variant">
              Room PIN: <span className="text-primary font-bold text-sm">{formattedPin}</span>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-label-code"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuizAdminPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-surface-container-lowest" />}>
        <QuizAdminContent />
      </Suspense>
    </ProtectedRoute>
  );
}
