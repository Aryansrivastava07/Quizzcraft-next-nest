"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import AuthFooter from "@/components/layout/AuthFooter";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import { quizService } from "@/lib/api/quiz-service";
import { PublicQuizItem } from "@/lib/api/types";

type StatusFilter = "ALL" | "LIVE" | "ANYTIME" | "SCHEDULED" | "ENDED";

export default function PublicQuizzesPage() {
  const router = useRouter();

  const [quizzes, setQuizzes] = useState<PublicQuizItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("ALL");
  const [copiedPin, setCopiedPin] = useState<string | null>(null);

  // Quick PIN join input
  const [quickPin, setQuickPin] = useState("");

  const fetchQuizzes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await quizService.getPublicQuizzes();
      if (res?.data?.quizzes) {
        setQuizzes(res.data.quizzes);
      } else {
        setQuizzes([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load public arenas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Copy PIN helper
  const copyToClipboard = (pin: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2000);
  };

  // Quick PIN submit
  const handleQuickPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickPin.replace(/\D/g, "");
    if (clean.length === 6) {
      router.push(`/join?pin=${clean}`);
    }
  };

  // Filtered Quizzes (Strictly deployed and not in draft)
  const deployedQuizzes = useMemo(() => {
    return quizzes.filter((q) => q.isDeployed === true && q.status !== "DRAFT");
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    return deployedQuizzes.filter((q) => {
      // Status filter
      if (activeFilter !== "ALL" && q.status !== activeFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = q.title.toLowerCase().includes(query);
        const matchesPin = q.pin ? q.pin.includes(query) : false;
        const matchesCreator = q.creator?.username.toLowerCase().includes(query);
        return matchesTitle || matchesPin || matchesCreator;
      }
      return true;
    });
  }, [deployedQuizzes, activeFilter, searchQuery]);

  // Counts for pills
  const counts = useMemo(() => {
    return {
      ALL: deployedQuizzes.length,
      LIVE: deployedQuizzes.filter((q) => q.status === "LIVE").length,
      ANYTIME: deployedQuizzes.filter((q) => q.status === "ANYTIME").length,
      SCHEDULED: deployedQuizzes.filter((q) => q.status === "SCHEDULED").length,
      ENDED: deployedQuizzes.filter((q) => q.status === "ENDED").length,
    };
  }, [deployedQuizzes]);

  return (
    <div className="relative min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary/30 selection:text-white">
      {/* Background Ambience */}
      <CosmicCanvas />

      {/* Navigation */}
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-20 relative z-10">
        
        {/* Header Hero */}
        <ParallaxReveal direction="up" distance={30} duration={600}>
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-tertiary text-xs font-label-code uppercase tracking-wider mb-4 shadow-sm">
              <span className="material-symbols-outlined text-sm animate-pulse">public</span>
              Public Knowledge Arenas
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-headline-sm font-extrabold text-white tracking-tight leading-tight mb-4">
              Explore & Battle in <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-tertiary">Community Arenas</span>
            </h1>
            
            <p className="text-sm sm:text-base text-on-surface-variant font-body-md leading-relaxed">
              Browse public quizzes deployed by educators, commanders, and community pilots. Pick any active arena to test your mastery or view historical analytics and leaderboards.
            </p>
          </div>
        </ParallaxReveal>

        {/* Quick PIN Entry & Search Bar */}
        <ParallaxReveal direction="up" distance={20} duration={600} delay={100}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
            
            {/* Quick PIN Join Card */}
            <div className="lg:col-span-5 bg-surface-container-low/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-tertiary/15 border border-tertiary/30 flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-xl">pin</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Have a Game PIN?</div>
                  <div className="text-[11px] text-on-surface-variant">Enter 6-digit room PIN</div>
                </div>
              </div>

              <form onSubmit={handleQuickPinSubmit} className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  maxLength={6}
                  value={quickPin}
                  onChange={(e) => setQuickPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 849201"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-container/70 border border-white/10 text-white font-mono text-center text-sm font-bold tracking-widest focus:outline-none focus:border-tertiary transition-colors"
                />
                <button
                  type="submit"
                  disabled={quickPin.length !== 6}
                  className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                >
                  Join
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </form>
            </div>

            {/* Keyword Search Input */}
            <div className="lg:col-span-7 bg-surface-container-low/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant text-xl pl-1">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search arenas by title, creator, or PIN..."
                className="w-full bg-transparent text-sm text-white placeholder:text-on-surface-variant/60 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-on-surface-variant hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

          </div>
        </ParallaxReveal>

        {/* Filter Pills & Refresh */}
        <ParallaxReveal direction="up" distance={20} duration={600} delay={150}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "ALL", label: "All Deployed", count: counts.ALL },
                  { id: "LIVE", label: "🟢 Live Now", count: counts.LIVE },
                  { id: "ANYTIME", label: "⚡ Anytime Arenas", count: counts.ANYTIME },
                  { id: "SCHEDULED", label: "⏱️ Scheduled", count: counts.SCHEDULED },
                  { id: "ENDED", label: "🏁 Concluded", count: counts.ENDED },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-headline-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeFilter === tab.id
                      ? "bg-primary-container text-white border border-white/10 shadow-md shadow-primary-container/20 font-semibold"
                      : "bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-white border border-outline-variant/40 font-medium"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={fetchQuizzes}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-outline-variant/40 text-on-surface hover:text-white text-xs font-headline-sm font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm ${isLoading ? "animate-spin" : ""}`}>
                refresh
              </span>
              <span>Refresh</span>
            </button>
          </div>
        </ParallaxReveal>

        {/* Quiz Grid or States */}
        {isLoading ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-surface-container-low/60 border border-white/10 rounded-2xl p-6 h-72 animate-pulse flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-5 w-24 bg-white/10 rounded-full" />
                    <div className="h-5 w-16 bg-white/10 rounded-full" />
                  </div>
                  <div className="h-6 w-3/4 bg-white/10 rounded-md" />
                  <div className="h-4 w-1/2 bg-white/10 rounded-md" />
                </div>
                <div className="h-10 w-full bg-white/10 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="rounded-2xl p-12 bg-red-950/20 border border-red-500/30 text-center max-w-lg mx-auto my-12">
            <span className="material-symbols-outlined text-4xl text-red-400 mb-3 block">error</span>
            <h3 className="text-lg font-bold text-white mb-2">Failed to Load Quizzes</h3>
            <p className="text-xs text-red-200/80 mb-6">{error}</p>
            <button
              onClick={fetchQuizzes}
              className="px-4 py-2 rounded-xl bg-red-500/30 hover:bg-red-500/40 text-red-100 text-xs font-bold transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl p-12 bg-surface-container-low/60 border border-white/10 text-center max-w-lg mx-auto my-12 backdrop-blur-xl">
            <div className="w-16 h-16 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mx-auto mb-4 text-tertiary">
              <span className="material-symbols-outlined text-3xl">sports_esports</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No Deployed Arenas Found</h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
              {searchQuery || activeFilter !== "ALL"
                ? "No quizzes matched your active filter or search query. Try clearing filters or searching for something else."
                : "No public quizzes have been deployed yet. Be the first commander to create and deploy an arena!"}
            </p>
            <div className="flex items-center justify-center gap-3">
              {(searchQuery || activeFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("ALL");
                  }}
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-bright border border-outline-variant/40 text-on-surface hover:text-white font-headline-sm text-xs font-medium transition-all cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <Link
                href="/create"
                className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Create Quiz
              </Link>
            </div>
          </div>
        ) : (
          /* Main Quiz Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz, index) => {
              const isLive = quiz.status === "LIVE";
              const isScheduled = quiz.status === "SCHEDULED";
              const isAnytime = quiz.status === "ANYTIME";
              const isEnded = quiz.status === "ENDED";

              const statusColor = isLive
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : isAnytime
                ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                : isScheduled
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-slate-500/15 border-slate-500/40 text-slate-300";

              const statusIcon = isLive
                ? "sensors"
                : isAnytime
                ? "bolt"
                : isScheduled
                ? "schedule"
                : "flag";

              return (
                <ParallaxReveal
                  key={quiz.quizId}
                  direction="up"
                  distance={20}
                  duration={500}
                  delay={(index % 6) * 50}
                >
                  <div className="group relative bg-surface-container-low/80 hover:bg-surface-container-low border border-white/10 hover:border-tertiary/40 rounded-2xl p-5 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between h-full overflow-hidden">
                    
                    <div>
                      {/* Related Cover Image Banner */}
                      <div className="relative w-full h-36 rounded-xl overflow-hidden mb-3.5 bg-surface-container border border-white/10">
                        <img
                          src={quiz.coverImage || "/stitch/screen-6-cosmic-portal-3d.png"}
                          alt={quiz.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/stitch/screen-6-cosmic-portal-3d.png";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low/90 via-transparent to-black/30" />

                        {/* Badges on image overlay */}
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${statusColor}`}>
                            <span className="material-symbols-outlined text-xs">{statusIcon}</span>
                            {quiz.status}
                          </span>

                          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white font-mono text-[10px] font-semibold">
                            {quiz.questionsCount} Qs
                          </span>
                        </div>
                      </div>

                      {/* Quiz Title */}
                      <h3 className="text-base font-headline-sm font-bold text-white group-hover:text-tertiary transition-colors mb-2 line-clamp-2 leading-snug">
                        {quiz.title}
                      </h3>

                      {/* Room PIN Tag */}
                      {quiz.pin && (
                        <div className="flex items-center gap-2 mb-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container border border-white/10 text-xs font-mono text-tertiary">
                            <span className="text-[10px] text-on-surface-variant font-sans font-bold uppercase">PIN:</span>
                            <span className="font-bold">{quiz.pin}</span>
                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(quiz.pin!, e)}
                              className="text-on-surface-variant hover:text-white transition-colors ml-0.5"
                              title="Copy PIN"
                            >
                              <span className="material-symbols-outlined text-xs">
                                {copiedPin === quiz.pin ? "check" : "content_copy"}
                              </span>
                            </button>
                          </div>
                          {copiedPin === quiz.pin && (
                            <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>
                          )}
                        </div>
                      )}

                      {/* Metadata Stats Pill */}
                      <div className="grid grid-cols-2 gap-2 bg-surface-container/50 border border-white/5 rounded-xl p-3 mb-5 text-xs text-on-surface-variant">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-tertiary">group</span>
                          <span><strong className="text-white">{quiz.attemptsCount}</strong> Attempts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-primary">timer</span>
                          <span><strong className="text-white">{quiz.questime || 60}s</strong> / Quest</span>
                        </div>
                      </div>

                      {/* Scheduled Time info if applicable */}
                      {isScheduled && quiz.scheduledFor && (
                        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-amber-400">event</span>
                          <span>
                            Starts: {new Date(quiz.scheduledFor).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}

                      {/* Creator Info */}
                      <div className="flex items-center gap-2.5 mb-6 text-xs text-on-surface-variant border-t border-white/5 pt-3">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center text-white text-[10px] font-bold uppercase overflow-hidden shrink-0">
                          {quiz.creator?.avatar ? (
                            <img src={quiz.creator.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            quiz.creator?.username?.[0] || "C"
                          )}
                        </div>
                        <span className="truncate">By <strong className="text-on-surface font-semibold">@{quiz.creator?.username || "creator"}</strong></span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2">
                      {/* Primary Attempt / Join Button */}
                      {isEnded ? (
                        <div className="w-full py-2.5 rounded-xl bg-surface-container/80 border border-outline-variant/30 text-on-surface-variant text-center font-headline-sm text-xs font-semibold">
                          Arena Concluded
                        </div>
                      ) : isScheduled ? (
                        <Link
                          href={`/join?pin=${quiz.pin || ""}`}
                          className="w-full py-2.5 rounded-xl bg-amber-accent/15 hover:bg-amber-accent/25 border border-amber-accent/40 text-amber-accent font-headline-sm text-center text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">notifications</span>
                          Join Launch Waitlist
                        </Link>
                      ) : (
                        <Link
                          href={quiz.pin ? `/join?pin=${quiz.pin}` : `/quiz?quizId=${quiz.quizId}`}
                          className="w-full py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-center text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">sports_esports</span>
                          Attempt Quiz Arena
                        </Link>
                      )}

                      {/* Secondary Review & Leaderboard Button */}
                      <Link
                        href={`/quiz/review/${quiz.quizId}`}
                        className="w-full py-2 rounded-xl bg-surface-container hover:bg-surface-bright border border-outline-variant/40 text-on-surface hover:text-white font-headline-sm text-center text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm text-tertiary">leaderboard</span>
                        View Leaderboard & Stats
                      </Link>
                    </div>

                  </div>
                </ParallaxReveal>
              );
            })}
          </div>
        )}

      </main>

      {/* Footer */}
      <AuthFooter />
    </div>
  );
}
