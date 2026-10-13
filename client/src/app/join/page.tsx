"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import AuthFooter from "@/components/layout/AuthFooter";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import { useAuth } from "@/lib/auth/auth-context";
import { quizService } from "@/lib/api/quiz-service";
import { profileService } from "@/lib/api/profile-service";

interface ScheduledQuizData {
  quizId: string;
  title: string;
  pin: string;
  scheduledFor: string;
  waitingCadetsCount: number;
  questionCount: number;
  totalXp: number;
  isWaiting: boolean;
}

interface RestrictedQuizData {
  organizationDomain: string;
  userEmail: string;
  message: string;
  pin: string;
}

interface EndedQuizData {
  quizId?: string;
  title?: string;
  message: string;
}

interface UndeployedQuizData {
  quizId?: string;
  title?: string;
  pin: string;
  message: string;
}

function JoinQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, refreshUser } = useAuth();

  const [pinCode, setPinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Brief / Preview state
  const [quizBrief, setQuizBrief] = useState<any | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // Status-specific states
  const [undeployedData, setUndeployedData] = useState<UndeployedQuizData | null>(null);
  const [scheduledData, setScheduledData] = useState<ScheduledQuizData | null>(null);
  const [restrictedData, setRestrictedData] = useState<RestrictedQuizData | null>(null);
  const [endedData, setEndedData] = useState<EndedQuizData | null>(null);

  // Waitlist action state
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [waitlistSuccessMsg, setWaitlistSuccessMsg] = useState<string | null>(null);

  // Link Organization Email state
  const [orgEmailInput, setOrgEmailInput] = useState("");
  const [isLinkingOrg, setIsLinkingOrg] = useState(false);
  const [orgLinkError, setOrgLinkError] = useState<string | null>(null);
  const [orgLinkSuccess, setOrgLinkSuccess] = useState<string | null>(null);

  // Countdown timer state for scheduled quizzes
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isOver: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: false });

  // Handle URL pin prefill (e.g. /join?pin=123456 or /join?code=QC-SURD)
  useEffect(() => {
    const pinParam = searchParams.get("pin") || searchParams.get("code");
    if (pinParam) {
      if (pinParam.toUpperCase().startsWith("QC-")) {
        router.push(`/groups?code=${encodeURIComponent(pinParam.toUpperCase())}`);
        return;
      }
      const raw = pinParam.replace(/\D/g, "").slice(0, 6);
      if (raw.length > 3) {
        setPinCode(`${raw.slice(0, 3)}-${raw.slice(3)}`);
      } else {
        setPinCode(raw);
      }
    }
  }, [searchParams, router]);

  // Fetch quiz brief as soon as 6-digit PIN is entered
  const fetchBriefForPin = useCallback(
    async (targetPin: string) => {
      const cleanPin = targetPin.replace(/\D/g, "");
      if (cleanPin.length !== 6) {
        setQuizBrief(null);
        setBriefError(null);
        setUndeployedData(null);
        setScheduledData(null);
        setRestrictedData(null);
        setEndedData(null);
        return;
      }

      setIsBriefLoading(true);
      setBriefError(null);
      setPinError(null);

      try {
        const res = await quizService.getQuizByPin(cleanPin, user?.email);

        if (res?.data?.isUndeployed) {
          setUndeployedData({
            quizId: res.data.quizId,
            title: res.data.title,
            pin: res.data.pin || cleanPin,
            message:
              res.data.message ||
              "This quiz has not been deployed yet. Please wait for the host to launch it live before entering.",
          });
          setQuizBrief(res.data);
          setRestrictedData(null);
          setScheduledData(null);
          setEndedData(null);
          return;
        }

        if (res?.data?.isRestricted) {
          setRestrictedData({
            organizationDomain: res.data.organizationDomain,
            userEmail: res.data.userEmail,
            message: res.data.message,
            pin: cleanPin,
          });
          setQuizBrief(res.data);
          setUndeployedData(null);
          setScheduledData(null);
          setEndedData(null);
          return;
        }

        if (res?.data?.isScheduled) {
          setScheduledData({
            quizId: res.data.quizId,
            title: res.data.title,
            pin: res.data.pin || cleanPin,
            scheduledFor: res.data.scheduledFor,
            waitingCadetsCount: res.data.waitingCadetsCount || 0,
            questionCount: res.data.questionCount || 0,
            totalXp: res.data.totalXp || 0,
            isWaiting: Boolean(res.data.isWaiting),
          });
          setQuizBrief(res.data);
          setUndeployedData(null);
          setRestrictedData(null);
          setEndedData(null);
          return;
        }

        if (res?.data?.isEnded) {
          setEndedData({
            quizId: res.data.quizId,
            title: res.data.title,
            message:
              res.data.message ||
              "This quiz arena session has concluded and is no longer accepting answers.",
          });
          setQuizBrief(res.data);
          setUndeployedData(null);
          setRestrictedData(null);
          setScheduledData(null);
          return;
        }

        if (res?.data?.quiz) {
          setQuizBrief(res.data);
          setUndeployedData(null);
          setRestrictedData(null);
          setScheduledData(null);
          setEndedData(null);
        } else {
          setBriefError(`No active arena found matching PIN ${cleanPin}`);
        }
      } catch (err: any) {
        console.warn("Error fetching quiz brief:", err);
        setBriefError(
          err?.message || `Invalid game PIN (${cleanPin}). No arena was found.`
        );
        setQuizBrief(null);
      } finally {
        setIsBriefLoading(false);
      }
    },
    [user?.email]
  );

  // Watch pinCode and auto-fetch brief on 6 digits
  useEffect(() => {
    const cleanPin = pinCode.replace(/\D/g, "");
    if (cleanPin.length === 6) {
      fetchBriefForPin(cleanPin);
    } else {
      setQuizBrief(null);
      setBriefError(null);
      setUndeployedData(null);
      setScheduledData(null);
      setRestrictedData(null);
      setEndedData(null);
    }
  }, [pinCode, fetchBriefForPin]);

  // Format PIN input
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val.toUpperCase().startsWith("QC-") || /^[A-Za-z]{2}-[A-Za-z0-9]{3,6}$/.test(val)) {
      router.push(`/groups?code=${encodeURIComponent(val.toUpperCase())}`);
      return;
    }
    const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
    if (raw.length > 3) {
      setPinCode(`${raw.slice(0, 3)}-${raw.slice(3)}`);
    } else {
      setPinCode(raw);
    }
    if (pinError) setPinError(null);
  };

  // Launch into the active arena
  const handleJoinArena = () => {
    const cleanPin = pinCode.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setPinError("Please enter a valid 6-digit game PIN.");
      return;
    }

    if (!user) {
      router.push(`/auth?redirect=/join?pin=${cleanPin}`);
      return;
    }

    if (quizBrief?.quiz) {
      setIsJoining(true);
      try {
        localStorage.setItem("qc_active_quiz", JSON.stringify(quizBrief.quiz));
      } catch (e) {
        console.warn("Could not cache active quiz:", e);
      }
      router.push(`/quiz?quizId=${quizBrief.quiz.quizId}&pin=${cleanPin}`);
    } else {
      // Re-fetch and navigate
      fetchBriefForPin(cleanPin);
    }
  };

  const handlePinFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoinArena();
  };

  // Countdown timer calculations for scheduled launch
  useEffect(() => {
    if (!scheduledData?.scheduledFor) return;

    const calculateTime = () => {
      const target = new Date(scheduledData.scheduledFor).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isOver: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [scheduledData?.scheduledFor]);

  // Periodic polling for scheduled quiz to detect when host launches it live
  useEffect(() => {
    if (!scheduledData || !user?.email) return;

    const interval = setInterval(async () => {
      try {
        const res = await quizService.getQuizByPin(scheduledData.pin, user.email);
        if (res?.data?.quiz) {
          localStorage.setItem("qc_active_quiz", JSON.stringify(res.data.quiz));
          router.push(`/quiz?quizId=${res.data.quiz.quizId}&pin=${scheduledData.pin}`);
        } else if (res?.data?.waitingCadetsCount !== undefined) {
          setScheduledData((prev) =>
            prev ? { ...prev, waitingCadetsCount: res.data.waitingCadetsCount } : null
          );
        }
      } catch (e) {
        // Silently ignore polling hiccups
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [scheduledData, user?.email, router]);

  // Periodic polling for undeployed quiz
  useEffect(() => {
    if (!undeployedData || !user?.email) return;

    const interval = setInterval(async () => {
      try {
        const res = await quizService.getQuizByPin(undeployedData.pin, user.email);
        if (res?.data?.quiz) {
          localStorage.setItem("qc_active_quiz", JSON.stringify(res.data.quiz));
          router.push(`/quiz?quizId=${res.data.quiz.quizId}&pin=${undeployedData.pin}`);
        }
      } catch (e) {
        // Silently ignore
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [undeployedData, user?.email, router]);

  // Join waitlist action handler
  const handleJoinWaitlist = async () => {
    if (!scheduledData || !user?.email) return;
    setIsJoiningWaitlist(true);
    setWaitlistSuccessMsg(null);
    try {
      const res = await quizService.joinWaitlist(scheduledData.quizId, user.email);
      setScheduledData((prev) =>
        prev
          ? {
              ...prev,
              isWaiting: true,
              waitingCadetsCount: res?.data?.waitingCadetsCount ?? prev.waitingCadetsCount + 1,
            }
          : null
      );
      setWaitlistSuccessMsg("You have secured your place on the launch waitlist! 🚀");
    } catch (err: any) {
      console.error("Failed to join waitlist:", err);
      setPinError(err?.message || "Failed to join waitlist. Please try again.");
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  // Link Organization Email handler
  const handleLinkOrgEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restrictedData) return;
    setOrgLinkError(null);
    setOrgLinkSuccess(null);

    const emailToLink = orgEmailInput.trim().toLowerCase();
    if (!emailToLink || !emailToLink.includes("@")) {
      setOrgLinkError("Please enter a valid email address.");
      return;
    }

    const domain = emailToLink.split("@")[1];
    if (domain !== restrictedData.organizationDomain.toLowerCase()) {
      setOrgLinkError(
        `Email must belong to domain @${restrictedData.organizationDomain}. Provided: @${domain}`
      );
      return;
    }

    setIsLinkingOrg(true);
    try {
      await profileService.linkEmail(emailToLink);
      await refreshUser();
      setOrgLinkSuccess(`Email linked successfully! Entering quiz arena...`);

      setTimeout(() => {
        handleJoinArena();
      }, 900);
    } catch (err: any) {
      console.error("Failed to link email:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to link email. It may already be linked to another account.";
      setOrgLinkError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsLinkingOrg(false);
    }
  };

  const activeQuiz = quizBrief?.quiz;
  const cleanPin = pinCode.replace(/\D/g, "");

  return (
    <main className="min-h-screen relative overflow-x-hidden flex flex-col justify-between">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Universal Top Navbar */}
      <Navbar />

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex items-center justify-center pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl mx-auto">
          <ParallaxReveal direction="up" distance={25} delay={80} duration={700}>
            
            {/* Page Header */}
            <div className="text-center max-w-2xl mx-auto mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high/80 border border-primary/30 text-tertiary font-headline-sm text-xs mb-3 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                <span>LIVE BATTLE ARENA</span>
              </div>
              <h1 className="font-headline-lg text-2xl sm:text-4xl text-white font-extrabold tracking-tight">
                Join a Live Battle Arena
              </h1>
              <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-2 leading-relaxed">
                Enter your 6-digit game PIN to inspect the battle intel, security protocols, and join the active quiz.
              </p>
            </div>

            {/* 2-Column Responsive Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* ============================================================ */}
              {/* LEFT COLUMN (5 cols): GAME PIN ENTRY CARD                   */}
              {/* ============================================================ */}
              <div className="lg:col-span-5 w-full rounded-3xl glass-kage border border-white/10 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl space-y-6">
                <div>
                  <h2 className="text-lg font-headline-sm font-bold text-white tracking-tight">
                    Enter Room PIN
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-label-code">
                    Credentials required for portal entry
                  </p>
                </div>

                {/* User Authentication Status Section */}
                {isLoading ? (
                  <div className="p-3.5 rounded-2xl bg-surface-container/60 border border-outline-variant/30 flex items-center gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-surface-container-high" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-28 bg-surface-container-high rounded" />
                      <div className="h-2.5 w-40 bg-surface-container-high rounded" />
                    </div>
                  </div>
                ) : !user ? (
                  <div className="p-3.5 rounded-2xl bg-surface-container/60 border border-outline-variant/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary-container/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-lg">account_circle</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">Login Required</p>
                        <p className="text-[10px] font-label-code text-on-surface-variant">
                          Sign in to record your XP &amp; ranking
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/auth?redirect=/join${cleanPin ? `?pin=${cleanPin}` : ""}`}
                      className="px-3 py-1.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm transition-all shrink-0 active:scale-95"
                    >
                      Sign In
                    </Link>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-surface-container/60 border border-outline-variant/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary-container/80 border border-primary/40 flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0 overflow-hidden">
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{(user.username || user.email || "P").slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white truncate">
                            {user.username || "Cadet Pilot"}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        </div>
                        <p className="text-[10px] font-label-code text-on-surface-variant truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-label-code text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full border border-tertiary/25 font-medium shrink-0">
                      Ready
                    </span>
                  </div>
                )}

                {/* PIN Input Form */}
                <form onSubmit={handlePinFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-tertiary mb-1.5 uppercase tracking-wider font-label-code">
                      6-Digit Game PIN
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={7}
                        value={pinCode}
                        onChange={handlePinChange}
                        placeholder="e.g. 884-219"
                        className="w-full px-4 py-3.5 rounded-2xl bg-surface-container/70 border border-white/15 text-white placeholder:text-outline text-2xl font-mono font-black tracking-widest text-center focus:outline-none focus:border-tertiary transition-colors shadow-inner"
                      />
                      <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
                        dialpad
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-1.5 text-center font-label-code">
                      Intel card on the right updates instantly as PIN is set.
                    </p>
                  </div>

                  {/* Pin Error */}
                  {pinError && (
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-sm text-red-400 shrink-0">
                          error
                        </span>
                        <span className="leading-snug">{pinError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPinError(null)}
                        className="text-red-400 hover:text-white transition-colors p-0.5"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  )}

                  {/* Primary Button */}
                  <button
                    type="submit"
                    disabled={!user || isJoining || cleanPin.length !== 6 || isBriefLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-headline-sm text-xs sm:text-sm font-semibold shadow-md shadow-primary-container/25 border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isJoining ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">
                          progress_activity
                        </span>
                        <span>Launching Arena Portal...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">sports_esports</span>
                        <span>{activeQuiz ? "Enter Quiz Arena 🚀" : "Verify & Inspect Brief"}</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Additional Exploration Links */}
                <div className="pt-4 border-t border-outline-variant/20 space-y-2 text-xs text-on-surface-variant">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-primary">groups</span>
                      Cohort admission code?
                    </span>
                    <Link href="/groups" className="text-primary hover:underline font-medium">
                      Join Cohort →
                    </Link>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-tertiary">explore</span>
                      Open public battles?
                    </span>
                    <Link href="/quizzes" className="text-tertiary hover:underline font-medium">
                      Public Arenas →
                    </Link>
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* RIGHT COLUMN (7 cols): QUIZ BRIEF & TELEMETRY PREVIEW CARD  */}
              {/* ============================================================ */}
              <div className="lg:col-span-7 w-full rounded-3xl glass-kage border border-white/10 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl min-h-[460px] flex flex-col justify-between">
                
                {/* CASE A: BRIEF IS LOADING */}
                {isBriefLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="relative w-16 h-16 rounded-2xl bg-tertiary/10 border border-tertiary/30 flex items-center justify-center text-tertiary">
                      <span className="material-symbols-outlined text-3xl animate-spin">
                        radar
                      </span>
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-tertiary animate-ping" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white font-headline-sm">
                        Scanning Arena Frequencies...
                      </h3>
                      <p className="text-xs text-on-surface-variant font-mono mt-1">
                        Decrypting room PIN <span className="text-tertiary font-bold">{cleanPin}</span> telemetry
                      </p>
                    </div>
                  </div>
                ) : briefError ? (
                  /* CASE B: BRIEF ERROR / NOT FOUND */
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                      <span className="material-symbols-outlined text-3xl">wrong_location</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white font-headline-sm">
                        Arena Not Found
                      </h3>
                      <p className="text-xs text-on-surface-variant max-w-sm mt-1.5 leading-relaxed">
                        {briefError}
                      </p>
                    </div>
                    <p className="text-[11px] font-mono text-outline">
                      Verify the 6-digit room PIN with your instructor or arena host.
                    </p>
                  </div>
                ) : quizBrief ? (
                  /* CASE C: QUIZ BRIEF LOADED */
                  <div className="flex-1 flex flex-col justify-between space-y-5">
                    <div>
                      {/* Cover Image Banner */}
                      <div className="relative w-full h-40 rounded-2xl overflow-hidden mb-4 bg-surface-container border border-white/10 group shadow-lg">
                        <img
                          src={
                            activeQuiz?.coverImage ||
                            quizBrief.coverImage ||
                            "/stitch/screen-6-cosmic-portal-3d.png"
                          }
                          alt={activeQuiz?.title || quizBrief.title || "Arena Cover"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/stitch/screen-6-cosmic-portal-3d.png";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-transparent to-black/40" />

                        {/* Badges on Cover Overlay */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                            activeQuiz?.status === "LIVE"
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : activeQuiz?.status === "ANYTIME"
                              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                              : activeQuiz?.status === "SCHEDULED"
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                              : "bg-purple-500/20 border-purple-500/40 text-purple-300"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                            {activeQuiz?.status || (quizBrief.isScheduled ? "SCHEDULED" : "STANDBY")}
                          </span>

                          {/* Anti-Cheat Shield Badge */}
                          {(activeQuiz?.antiCheat ?? quizBrief.antiCheat) && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md bg-purple-950/80 border border-purple-500/50 text-purple-200 shadow-md">
                              <span className="material-symbols-outlined text-sm text-purple-400">
                                shield
                              </span>
                              Proctored Arena
                            </span>
                          )}
                        </div>

                        {/* PIN watermark on bottom right */}
                        <div className="absolute bottom-2.5 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono text-tertiary font-bold">
                          PIN: {cleanPin}
                        </div>
                      </div>

                      {/* Title & Creator */}
                      <div className="space-y-1 mb-4">
                        <h2 className="text-xl sm:text-2xl font-headline-sm font-bold text-white tracking-tight leading-snug">
                          {activeQuiz?.title || quizBrief.title || "Interactive Arena"}
                        </h2>

                        <div className="flex items-center gap-2 text-xs text-on-surface-variant font-label-code pt-0.5">
                          <span>Created by</span>
                          <strong className="text-white">
                            @{activeQuiz?.creator?.username || activeQuiz?.ownerUsername || "Host"}
                          </strong>
                          <span>•</span>
                          <span className="text-tertiary">
                            {activeQuiz?.accessMode || "PUBLIC"}
                          </span>
                        </div>
                      </div>

                      {/* Proctored Security Notice */}
                      {(activeQuiz?.antiCheat ?? quizBrief.antiCheat) && (
                        <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-start gap-2.5 text-xs text-purple-200 mb-4 shadow-sm">
                          <span className="material-symbols-outlined text-purple-400 text-base mt-0.5 shrink-0">
                            verified_user
                          </span>
                          <div className="leading-relaxed">
                            <span className="font-bold text-white block">
                              Anti-Cheat Protocol Active
                            </span>
                            Tab switches, clipboard copy actions, and fullscreen exits are monitored and logged directly to the instructor.
                          </div>
                        </div>
                      )}

                      {/* Arena Telemetry Stats Row */}
                      <div className="grid grid-cols-3 gap-2.5 text-center mb-4">
                        <div className="p-3 rounded-2xl bg-surface-container/60 border border-white/5">
                          <span className="block text-[10px] uppercase font-label-code text-outline">
                            Questions
                          </span>
                          <span className="font-stat-counter text-base font-bold text-white mt-0.5 block">
                            {activeQuiz?.questions?.length ||
                              activeQuiz?.totalQuestions ||
                              quizBrief.questionCount ||
                              "—"}
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-surface-container/60 border border-white/5">
                          <span className="block text-[10px] uppercase font-label-code text-outline">
                            Timer
                          </span>
                          <span className="font-stat-counter text-base font-bold text-tertiary mt-0.5 block">
                            {activeQuiz?.questime || 60}s / Q
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-surface-container/60 border border-white/5">
                          <span className="block text-[10px] uppercase font-label-code text-outline">
                            Participants
                          </span>
                          <span className="font-stat-counter text-base font-bold text-emerald-400 mt-0.5 block">
                            {quizBrief.stats?.peopleAttempted || 0}
                          </span>
                        </div>
                      </div>

                      {/* Status-specific action / context */}
                      {undeployedData && (
                        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 text-center space-y-2">
                          <div className="flex items-center justify-center gap-2 font-bold text-white">
                            <span className="material-symbols-outlined text-base text-amber-400 animate-spin">sync</span>
                            <span>Pending Deployment Signal</span>
                          </div>
                          <p className="text-[11px] text-amber-300/80 leading-relaxed">
                            {undeployedData.message}
                          </p>
                        </div>
                      )}

                      {scheduledData && (
                        <div className="p-4 rounded-2xl bg-secondary-container/20 border border-secondary/40 text-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-label-code text-secondary font-bold uppercase">
                              Launch Countdown
                            </span>
                            <span className="text-xs font-mono text-white">
                              {timeLeft.isOver
                                ? "Ready for Launch!"
                                : `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`}
                            </span>
                          </div>

                          {scheduledData.isWaiting ? (
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-center font-medium">
                              ✓ You are on the Launch Waitlist
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleJoinWaitlist}
                              disabled={isJoiningWaitlist}
                              className="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/90 text-surface-container-lowest font-headline-sm text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm">how_to_reg</span>
                              <span>Join Launch Waitlist ({scheduledData.waitingCadetsCount} Waiting)</span>
                            </button>
                          )}
                        </div>
                      )}

                      {restrictedData && (
                        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-xs space-y-3">
                          <div className="flex items-center gap-2 font-bold text-amber-300">
                            <span className="material-symbols-outlined text-base">corporate_fare</span>
                            <span>@{restrictedData.organizationDomain} Restricted</span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant">
                            {restrictedData.message}
                          </p>

                          <form onSubmit={handleLinkOrgEmail} className="space-y-2">
                            <input
                              type="email"
                              required
                              value={orgEmailInput}
                              onChange={(e) => setOrgEmailInput(e.target.value)}
                              placeholder={`cadet@${restrictedData.organizationDomain}`}
                              className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/40 text-xs text-white focus:outline-none focus:border-amber-400"
                            />
                            {orgLinkError && (
                              <p className="text-[11px] text-red-400">{orgLinkError}</p>
                            )}
                            <button
                              type="submit"
                              disabled={isLinkingOrg || !orgEmailInput.trim()}
                              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs transition-all flex items-center justify-center gap-1"
                            >
                              <span>{isLinkingOrg ? "Linking..." : "Link Email & Enter"}</span>
                            </button>
                          </form>
                        </div>
                      )}

                      {endedData && (
                        <div className="p-4 rounded-2xl bg-surface-container border border-white/10 text-xs text-center space-y-1.5 text-on-surface-variant">
                          <p className="font-bold text-white">Session Concluded</p>
                          <p>{endedData.message}</p>
                        </div>
                      )}
                    </div>

                    {/* Direct Launch Button on Brief Card */}
                    {activeQuiz && !undeployedData && !restrictedData && !endedData && (
                      <div className="pt-3 border-t border-white/10">
                        <button
                          type="button"
                          onClick={handleJoinArena}
                          disabled={isJoining || !user}
                          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary to-primary-container hover:from-primary/90 hover:to-primary-container/90 text-white font-headline-sm text-sm font-bold shadow-lg shadow-primary/25 border border-white/15 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isJoining ? (
                            <>
                              <span className="material-symbols-outlined text-base animate-spin">
                                progress_activity
                              </span>
                              <span>Launching Battle Arena...</span>
                            </>
                          ) : (
                            <>
                              <span>Join &amp; Launch Arena Now</span>
                              <span className="material-symbols-outlined text-base">
                                arrow_forward
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* CASE D: STANDBY STATE (NO 6-DIGIT PIN YET) */
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="relative w-16 h-16 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center text-outline">
                      <span className="material-symbols-outlined text-3xl">radar</span>
                    </div>

                    <div className="max-w-sm space-y-1.5">
                      <h3 className="text-base font-bold text-white font-headline-sm">
                        Arena Intelligence Standby
                      </h3>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Enter your 6-digit game PIN on the left to reveal the mission briefing, question pool stats, anti-cheat protocols, and join the active quiz.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 w-full max-w-xs pt-4 border-t border-white/5 text-[11px] font-mono text-outline">
                      <div className="p-2 rounded-xl bg-surface-container/40 border border-white/5">
                        🛡️ Anti-Cheat
                      </div>
                      <div className="p-2 rounded-xl bg-surface-container/40 border border-white/5">
                        ⚡ Live XP
                      </div>
                      <div className="p-2 rounded-xl bg-surface-container/40 border border-white/5">
                        🏆 Podium
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </ParallaxReveal>
        </div>
      </div>

      {/* Footer */}
      <AuthFooter />
    </main>
  );
}

export default function JoinQuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">
            progress_activity
          </span>
        </div>
      }
    >
      <JoinQuizContent />
    </Suspense>
  );
}
