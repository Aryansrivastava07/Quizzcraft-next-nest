"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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

export default function JoinQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, refreshUser } = useAuth();

  const [pinCode, setPinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Arena status states
  const [scheduledData, setScheduledData] = useState<ScheduledQuizData | null>(null);
  const [restrictedData, setRestrictedData] = useState<RestrictedQuizData | null>(null);
  const [endedData, setEndedData] = useState<EndedQuizData | null>(null);

  // Waitlist action state
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [waitlistSuccessMsg, setWaitlistSuccessMsg] = useState<string | null>(null);

  // Link Organization Email form state
  const [orgEmailInput, setOrgEmailInput] = useState("");
  const [isLinkingOrg, setIsLinkingOrg] = useState(false);
  const [orgLinkError, setOrgLinkError] = useState<string | null>(null);
  const [orgLinkSuccess, setOrgLinkSuccess] = useState<string | null>(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isOver: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: false });

  // Handle URL pin prefill (e.g. /join?pin=123456)
  useEffect(() => {
    const pinParam = searchParams.get("pin");
    if (pinParam) {
      const raw = pinParam.replace(/\D/g, "").slice(0, 6);
      if (raw.length > 3) {
        setPinCode(`${raw.slice(0, 3)}-${raw.slice(3)}`);
      } else {
        setPinCode(raw);
      }
    }
  }, [searchParams]);

  // Format PIN input
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
    if (raw.length > 3) {
      setPinCode(`${raw.slice(0, 3)}-${raw.slice(3)}`);
    } else {
      setPinCode(raw);
    }
    if (pinError) setPinError(null);
  };

  // Perform Join / Verification check against backend
  const checkPinAndJoin = useCallback(
    async (targetPin: string, userEmail?: string) => {
      const cleanPin = targetPin.replace(/\D/g, "");
      if (cleanPin.length !== 6) {
        setPinError("Please enter a valid 6-digit game PIN.");
        return;
      }

      setIsJoining(true);
      setPinError(null);

      try {
        const res = await quizService.getQuizByPin(cleanPin, userEmail || user?.email);

        // Case 1: Organization Restriction
        if (res?.data?.isRestricted) {
          setRestrictedData({
            organizationDomain: res.data.organizationDomain,
            userEmail: res.data.userEmail,
            message: res.data.message,
            pin: cleanPin,
          });
          setScheduledData(null);
          setEndedData(null);
          return;
        }

        // Case 2: Scheduled Quiz (Waitlist mode)
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
          setRestrictedData(null);
          setEndedData(null);
          return;
        }

        // Case 3: Ended Quiz
        if (res?.data?.isEnded) {
          setEndedData({
            quizId: res.data.quizId,
            title: res.data.title,
            message:
              res.data.message ||
              "This quiz arena session has concluded and is no longer accepting answers.",
          });
          setRestrictedData(null);
          setScheduledData(null);
          return;
        }

        // Case 4: Live / Active Quiz
        if (res?.data?.quiz) {
          localStorage.setItem("qc_active_quiz", JSON.stringify(res.data.quiz));
          router.push(`/quiz?quizId=${res.data.quiz.quizId}&pin=${cleanPin}`);
        } else {
          throw new Error("Quiz not found");
        }
      } catch (err: any) {
        console.error("Error joining quiz by PIN:", err);
        const message =
          err?.message ||
          `Invalid Game PIN (${cleanPin}). No active quiz room was found. Please check with your host.`;
        setPinError(message);
      } finally {
        setIsJoining(false);
      }
    },
    [router, user?.email]
  );

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push(`/auth?redirect=/join${pinCode ? `?pin=${pinCode.replace(/\D/g, "")}` : ""}`);
      return;
    }
    const cleanPin = pinCode.replace(/\D/g, "");
    checkPinAndJoin(cleanPin, user.email);
  };

  // Live Countdown calculations for scheduled launch
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
          // Launched live!
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

      // Immediately retry entering arena with new linked email
      setTimeout(() => {
        checkPinAndJoin(restrictedData.pin, emailToLink);
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

  // Reset to PIN entry screen
  const handleResetToPin = () => {
    setScheduledData(null);
    setRestrictedData(null);
    setEndedData(null);
    setPinError(null);
    setWaitlistSuccessMsg(null);
    setOrgLinkError(null);
    setOrgLinkSuccess(null);
  };

  return (
    <main className="min-h-screen relative overflow-x-hidden flex flex-col justify-between">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Universal Top Navbar */}
      <Navbar />

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex items-center justify-center pt-24 pb-12 px-4 sm:px-6">
        <ParallaxReveal direction="up" distance={25} delay={80} duration={750} className="w-full max-w-lg mx-auto">
          {/* ============================================================ */}
          {/* STATE 1: ORGANIZATION DOMAIN RESTRICTION SCREEN              */}
          {/* ============================================================ */}
          {restrictedData ? (
            <div className="w-full rounded-2xl glass-kage border border-amber-500/40 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl animate-fadeIn space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <span className="material-symbols-outlined text-2xl">verified_user</span>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-label-code text-[11px] mb-1">
                    <span className="material-symbols-outlined text-xs">corporate_fare</span>
                    <span>ORGANIZATION RESTRICTED</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-headline-lg font-bold text-white tracking-tight">
                    Institutional Access Required
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1">
                    This quiz arena is exclusive to verified members of:
                  </p>
                  <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-surface-container-high border border-outline-variant/40 font-label-code text-sm font-bold text-amber-300">
                    @{restrictedData.organizationDomain}
                  </div>
                </div>
              </div>

              {/* Current Account Status */}
              <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30 text-xs space-y-1">
                <span className="text-[10px] uppercase font-label-code text-on-surface-variant">
                  Current Account Email
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white truncate">
                    {user?.email || restrictedData.userEmail}
                  </span>
                  <span className="text-[10px] font-label-code text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">
                    Not Authorized
                  </span>
                </div>
              </div>

              {/* Form to link institutional email */}
              <form onSubmit={handleLinkOrgEmail} className="space-y-3.5 pt-2 border-t border-outline-variant/20">
                <div>
                  <label className="block text-xs font-semibold text-white uppercase tracking-wider font-label-code mb-1.5">
                    Link Your Institutional Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={orgEmailInput}
                      onChange={(e) => setOrgEmailInput(e.target.value)}
                      placeholder={`e.g. cadet@${restrictedData.organizationDomain}`}
                      className="w-full px-4 py-3 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface placeholder:text-outline text-xs focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-base">
                      mail
                    </span>
                  </div>
                  <p className="text-[11px] font-label-code text-on-surface-variant mt-1">
                    Linking will connect your institutional credentials to this account so you can enter.
                  </p>
                </div>

                {orgLinkError && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm shrink-0">error</span>
                    <span>{orgLinkError}</span>
                  </div>
                )}

                {orgLinkSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm shrink-0">check_circle</span>
                    <span>{orgLinkSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLinkingOrg || !orgEmailInput.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black font-headline-sm text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLinkingOrg ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">
                        progress_activity
                      </span>
                      <span>Authorizing Domain...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">link</span>
                      <span>Link @{restrictedData.organizationDomain} &amp; Enter Arena</span>
                    </>
                  )}
                </button>
              </form>

              {/* Navigation Options */}
              <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResetToPin}
                  className="text-on-surface-variant hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Try another PIN</span>
                </button>
                <Link
                  href={`/auth?redirect=/join?pin=${restrictedData.pin}`}
                  className="text-tertiary hover:underline font-medium"
                >
                  Switch Account →
                </Link>
              </div>
            </div>
          ) : scheduledData ? (
            /* ============================================================ */
            /* STATE 2: SCHEDULED QUIZ COSMIC WAITLIST SCREEN               */
            /* ============================================================ */
            <div className="w-full rounded-2xl glass-kage border border-primary/30 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl animate-fadeIn space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/30 border border-primary/40 text-primary-fixed font-headline-sm text-xs shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span>SCHEDULED LAUNCH • WAITLIST ACTIVE</span>
                </div>
                <h1 className="font-headline-lg text-2xl sm:text-3xl text-white font-bold tracking-tight">
                  {scheduledData.title}
                </h1>
                <p className="font-label-code text-xs text-on-surface-variant">
                  Room PIN: <span className="font-bold text-tertiary">{scheduledData.pin}</span>
                </p>
              </div>

              {/* Countdown Clock Display */}
              <div className="p-5 rounded-2xl bg-surface-container/70 border border-outline-variant/30 text-center space-y-3">
                <span className="text-[11px] font-label-code uppercase tracking-wider text-outline">
                  Mission Launch Countdown
                </span>

                <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-xs mx-auto">
                  <div className="p-2 sm:p-3 rounded-xl bg-surface-container-high border border-outline-variant/30 flex flex-col items-center">
                    <span className="font-stat-counter text-xl sm:text-2xl font-bold text-white">
                      {String(timeLeft.days).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase font-label-code text-outline mt-0.5">
                      Days
                    </span>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl bg-surface-container-high border border-outline-variant/30 flex flex-col items-center">
                    <span className="font-stat-counter text-xl sm:text-2xl font-bold text-white">
                      {String(timeLeft.hours).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase font-label-code text-outline mt-0.5">
                      Hours
                    </span>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl bg-surface-container-high border border-outline-variant/30 flex flex-col items-center">
                    <span className="font-stat-counter text-xl sm:text-2xl font-bold text-white">
                      {String(timeLeft.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase font-label-code text-outline mt-0.5">
                      Mins
                    </span>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl bg-surface-container-high border border-outline-variant/30 flex flex-col items-center">
                    <span className="font-stat-counter text-xl sm:text-2xl font-bold text-tertiary animate-pulse">
                      {String(timeLeft.seconds).padStart(2, "0")}
                    </span>
                    <span className="text-[9px] uppercase font-label-code text-outline mt-0.5">
                      Secs
                    </span>
                  </div>
                </div>

                <p className="text-[11px] font-label-code text-on-surface-variant">
                  Scheduled for:{" "}
                  <span className="text-white font-medium">
                    {new Date(scheduledData.scheduledFor).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </span>
                </p>
              </div>

              {/* Live telemetry row */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                  <span className="block text-[10px] uppercase font-label-code text-outline">
                    Waiting Cadets
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-stat-counter text-base font-bold text-emerald-400">
                      {scheduledData.waitingCadetsCount}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                  <span className="block text-[10px] uppercase font-label-code text-outline">
                    Questions
                  </span>
                  <span className="font-stat-counter text-base font-bold text-white mt-1 block">
                    {scheduledData.questionCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                  <span className="block text-[10px] uppercase font-label-code text-outline">
                    Mission XP
                  </span>
                  <span className="font-stat-counter text-base font-bold text-amber-accent mt-1 block">
                    {scheduledData.totalXp} XP
                  </span>
                </div>
              </div>

              {/* Waitlist action state banner */}
              {scheduledData.isWaiting ? (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-center space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 text-emerald-300 font-semibold text-xs">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>You are registered on the Launch Waitlist</span>
                  </div>
                  <p className="text-[11px] font-label-code text-emerald-300/80">
                    Stay on this station. You will be automatically routed into the quiz arena when the host initiates launch.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleJoinWaitlist}
                  disabled={isJoiningWaitlist}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-50 text-white font-headline-sm text-sm font-semibold shadow-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isJoiningWaitlist ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">
                        progress_activity
                      </span>
                      <span>Reserving Launch Seat...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">how_to_reg</span>
                      <span>Join Launch Waitlist ({scheduledData.waitingCadetsCount} Waiting)</span>
                    </>
                  )}
                </button>
              )}

              {waitlistSuccessMsg && (
                <p className="text-center text-xs text-emerald-400 font-label-code">
                  {waitlistSuccessMsg}
                </p>
              )}

              {/* Manual refresh / status check */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResetToPin}
                  className="text-on-surface-variant hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Enter another PIN</span>
                </button>
                <button
                  type="button"
                  onClick={() => checkPinAndJoin(scheduledData.pin, user?.email)}
                  disabled={isJoining}
                  className="text-tertiary hover:text-white font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span
                    className={`material-symbols-outlined text-sm ${isJoining ? "animate-spin" : ""}`}
                  >
                    refresh
                  </span>
                  <span>Check Status</span>
                </button>
              </div>
            </div>
          ) : endedData ? (
            /* ============================================================ */
            /* STATE 3: ARENA SESSION CONCLUDED SCREEN                      */
            /* ============================================================ */
            <div className="w-full rounded-2xl glass-kage border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl animate-fadeIn text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-3xl">timer_off</span>
              </div>
              <div>
                <h2 className="text-2xl font-headline-lg font-bold text-white tracking-tight">
                  Arena Session Concluded
                </h2>
                {endedData.title && (
                  <p className="text-sm font-semibold text-tertiary mt-1">{endedData.title}</p>
                )}
                <p className="text-xs text-on-surface-variant mt-2 max-w-sm mx-auto">
                  {endedData.message}
                </p>
              </div>

              <div className="pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetToPin}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-semibold cursor-pointer transition-colors"
                >
                  Enter Different PIN
                </button>
                <Link
                  href="/create"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  Create New Quiz
                </Link>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* STATE 4: NORMAL PIN ENTRY LOBBY                              */
            /* ============================================================ */
            <div className="w-full rounded-2xl glass-kage border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
              {/* Header */}
              <div className="text-left mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high/80 border border-primary/30 text-tertiary font-headline-sm text-xs mb-3 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                  <span>LIVE QUIZ ARENA</span>
                </div>
                <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
                  Join a Live Game
                </h1>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1.5">
                  Enter the 6-digit room PIN provided by your instructor or host.
                </p>
              </div>

              {/* User Authentication Status Section */}
              {isLoading ? (
                /* Loading Skeleton */
                <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30 mb-6 flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-32 bg-surface-container-high rounded" />
                    <div className="h-2.5 w-48 bg-surface-container-high rounded" />
                  </div>
                </div>
              ) : !user ? (
                /* Unauthenticated State */
                <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-container/20 border border-primary/30 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-xl">account_circle</span>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-white">
                        Login first to join a quiz
                      </p>
                      <p className="text-[11px] font-label-code text-on-surface-variant">
                        Authentication required to enter arena
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/auth?redirect=/join${pinCode ? `?pin=${pinCode.replace(/\D/g, "")}` : ""}`}
                    className="px-3.5 py-1.5 rounded-lg bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm transition-all shrink-0 active:scale-95"
                  >
                    Sign In
                  </Link>
                </div>
              ) : (
                /* Authenticated Player Profile */
                <div className="p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/30 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-container/80 border border-primary/40 flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0 overflow-hidden">
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>
                          {(user.username || user.email || "P").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold text-white truncate">
                          {user.username || "Cadet Pilot"}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0"
                          title="Active Account"
                        />
                      </div>
                      <p className="text-[11px] font-label-code text-on-surface-variant truncate">
                        {user.email}
                        {Array.isArray(user.emails) && user.emails.length > 1 && (
                          <span className="ml-1 text-tertiary">
                            (+{user.emails.length - 1} linked)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <span className="text-[10px] font-label-code text-tertiary bg-tertiary/10 px-2 py-0.5 rounded border border-tertiary/25 font-medium">
                      Ready
                    </span>
                    <Link
                      href={`/auth?redirect=/join${pinCode ? `?pin=${pinCode.replace(/\D/g, "")}` : ""}`}
                      className="text-[10px] text-outline hover:text-primary transition-colors"
                    >
                      Switch
                    </Link>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleJoinSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5 uppercase tracking-wider text-tertiary font-label-code">
                    Game PIN
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={7}
                      value={pinCode}
                      onChange={handlePinChange}
                      placeholder="e.g. 884-219"
                      className="w-full px-4 py-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface placeholder:text-outline text-xl font-label-code font-bold tracking-widest text-center focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                      pin
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1.5 text-center font-label-code">
                    Enter the 6-digit room PIN provided by your host to connect.
                  </p>
                </div>

                {/* Error Banner */}
                {pinError && (
                  <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center justify-between gap-2.5 animate-fadeIn">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-red-400 text-base shrink-0">
                        error
                      </span>
                      <span className="leading-snug">{pinError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPinError(null)}
                      className="text-red-400 hover:text-white transition-colors shrink-0 p-1"
                      aria-label="Dismiss error"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!user || isJoining || pinCode.replace(/\D/g, "").length !== 6}
                  className="w-full mt-3 py-3.5 px-4 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary-container text-white font-headline-sm text-sm font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isJoining ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">
                        progress_activity
                      </span>
                      <span>Verifying PIN &amp; Entering Arena...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">login</span>
                      <span>Enter Quiz Arena</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
                <span>Want to create a quiz instead?</span>
                <Link href="/create" className="text-tertiary hover:underline font-medium">
                  Launch Studio →
                </Link>
              </div>
            </div>
          )}
        </ParallaxReveal>
      </div>

      {/* Footer */}
      <AuthFooter />
    </main>
  );
}
