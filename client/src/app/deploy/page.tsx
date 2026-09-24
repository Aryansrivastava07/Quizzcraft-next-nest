"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { quizService } from "@/lib/api/quiz-service";
import { profileService } from "@/lib/api/profile-service";
import { authService } from "@/lib/api/auth-service";

const PUBLIC_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "gmx.com",
];

function isOrgEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  return !PUBLIC_EMAIL_DOMAINS.includes(domain);
}

function DeployScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizIdParam = searchParams.get("quizId");

  const [copiedId, setCopiedId] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Security & Proctoring
  const [antiCheat, setAntiCheat] = useState(true);
  const [fullScreenLock, setFullScreenLock] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [allowRetries, setAllowRetries] = useState(false);

  // Quiz Metadata
  const [quizId, setQuizId] = useState("QC-9804-QBIT");
  const [pin, setPin] = useState("884-219");
  const [quizTitle, setQuizTitle] = useState("Quantum Computing Principles");
  const [questionCount, setQuestionCount] = useState(15);
  const [totalXp, setTotalXp] = useState(2250);

  // Access Mode: PUBLIC | PRIVATE | ORGANIZATION
  const [accessMode, setAccessMode] = useState<"PUBLIC" | "PRIVATE" | "ORGANIZATION">("PUBLIC");
  const [organizationDomain, setOrganizationDomain] = useState<string>("");

  // User Emails & Org Detection
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const [userOrgEmails, setUserOrgEmails] = useState<string[]>([]);
  const [showLinkOrgEmailModal, setShowLinkOrgEmailModal] = useState(false);
  const [newOrgEmailInput, setNewOrgEmailInput] = useState("");
  const [linkEmailError, setLinkEmailError] = useState<string | null>(null);
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);

  // Protocol 1: Live Duration
  const [liveDurationMinutes, setLiveDurationMinutes] = useState(60);
  const [isStartingLive, setIsStartingLive] = useState(false);

  // Protocol 2: Schedule State
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [scheduledDurationMinutes, setScheduledDurationMinutes] = useState(60);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleSuccessInfo, setScheduleSuccessInfo] = useState<{
    scheduledFor: string;
    liveUntil: string;
  } | null>(null);

  // Protocol 3: Anytime State
  const [isDeployingAnytime, setIsDeployingAnytime] = useState(false);
  const [anytimeActive, setAnytimeActive] = useState(false);

  // General deploy error
  const [deployError, setDeployError] = useState<string | null>(null);

  // Set default schedule time to tomorrow at 10:00 AM
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(localIso);
  }, []);

  // Fetch Quiz & User Account Data
  useEffect(() => {
    async function loadData() {
      let targetId = quizIdParam;
      let cachedQuiz: any = null;

      if (!targetId) {
        try {
          const cached = localStorage.getItem("qc_active_quiz");
          if (cached) {
            cachedQuiz = JSON.parse(cached);
            targetId = cachedQuiz?.quizId;
          }
        } catch (e) {
          console.warn("Could not read cached quiz:", e);
        }
      }

      if (targetId) {
        try {
          const res = await quizService.getQuiz(targetId);
          const q = res.data?.quiz || cachedQuiz;
          if (q) {
            setQuizId(q.quizId);
            setQuizTitle(q.title || "Quantum Computing Principles");
            if (q.pin) {
              const rawPin = String(q.pin).replace(/\D/g, "");
              setPin(rawPin.length === 6 ? `${rawPin.slice(0, 3)}-${rawPin.slice(3)}` : rawPin);
            }
            if (q.accessMode) {
              setAccessMode(q.accessMode);
            }
            if (q.organizationDomain) {
              setOrganizationDomain(q.organizationDomain);
            }
            if (q.deploymentType === "ANYTIME") {
              setAnytimeActive(true);
            }
            if (q.scheduledFor) {
              setScheduleSuccessInfo({
                scheduledFor: new Date(q.scheduledFor).toLocaleString(),
                liveUntil: q.liveUntil ? new Date(q.liveUntil).toLocaleString() : "",
              });
            }
            if (Array.isArray(q.questions) && q.questions.length > 0) {
              setQuestionCount(q.questions.length);
              const xpSum = q.questions.reduce((sum: number, item: any) => sum + (item.xp || 200), 0);
              setTotalXp(xpSum);
            }
          }
        } catch (err) {
          console.warn("Could not fetch quiz for deploy:", err);
          if (cachedQuiz) {
            setQuizId(cachedQuiz.quizId || "QC-9804-QBIT");
            setQuizTitle(cachedQuiz.title || "Quantum Computing Principles");
            if (cachedQuiz.pin) {
              const rawPin = String(cachedQuiz.pin).replace(/\D/g, "");
              setPin(rawPin.length === 6 ? `${rawPin.slice(0, 3)}-${rawPin.slice(3)}` : rawPin);
            }
          }
        }
      }

      // Fetch User's Linked Emails to check organization status
      try {
        const meRes = await authService.me();
        const user = meRes?.data?.user;
        if (user) {
          const emails = Array.isArray(user.emails) && user.emails.length > 0
            ? user.emails
            : [user.email];
          setUserEmails(emails);
          const orgs = emails.filter((e) => isOrgEmail(e));
          setUserOrgEmails(orgs);
          if (orgs.length > 0 && !organizationDomain) {
            setOrganizationDomain(orgs[0].split("@")[1]?.toLowerCase() || "");
          }
        }
      } catch (e) {
        console.warn("Could not load user profile for email validation:", e);
      }
    }

    loadData();
  }, [quizIdParam]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(quizId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyUrl = () => {
    const rawPin = pin.replace(/\D/g, "");
    const base = typeof window !== "undefined" ? window.location.origin : "https://quizzcraft.app";
    const url = rawPin ? `${base}/join?pin=${rawPin}` : `${base}/join`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Link Organization Email handler
  const handleLinkOrgEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkEmailError(null);
    const emailToLink = newOrgEmailInput.trim().toLowerCase();

    if (!isOrgEmail(emailToLink)) {
      setLinkEmailError("Please provide an institutional/organization email (e.g. name@university.edu or name@company.com), not a public consumer domain.");
      return;
    }

    setIsLinkingEmail(true);
    try {
      const res = await profileService.linkEmail(emailToLink);
      if (res?.data?.emails) {
        setUserEmails(res.data.emails);
        const orgs = res.data.emails.filter((em) => isOrgEmail(em));
        setUserOrgEmails(orgs);
        setOrganizationDomain(emailToLink.split("@")[1].toLowerCase());
      }
      setShowLinkOrgEmailModal(false);
      setNewOrgEmailInput("");
    } catch (err: any) {
      setLinkEmailError(err?.message || "Failed to link organization email");
    } finally {
      setIsLinkingEmail(false);
    }
  };

  // PROTOCOL 1: Launch Live Room Now -> Redirects directly to Quiz Admin Panel
  const handleStartLiveNow = async () => {
    setDeployError(null);

    if (accessMode === "ORGANIZATION" && userOrgEmails.length === 0) {
      setShowLinkOrgEmailModal(true);
      return;
    }

    setIsStartingLive(true);
    try {
      const res = await quizService.deployQuiz(quizId, {
        deploymentType: "LIVE",
        accessMode,
        organizationDomain: accessMode === "ORGANIZATION" ? organizationDomain : undefined,
        liveDurationMinutes,
        antiCheat,
        fullScreenLock,
        shuffleChoices,
        allowRetries,
      });

      // Redirect directly to the Quiz Admin Panel!
      router.push(`/quiz/admin?quizId=${encodeURIComponent(quizId)}`);
    } catch (err: any) {
      setDeployError(err?.message || "Failed to launch live room");
      setIsStartingLive(false);
    }
  };

  // PROTOCOL 2: Schedule for Later -> Creates DB record, activates 1-minute scheduler, sends email 5m before
  const handleConfirmSchedule = async () => {
    setDeployError(null);

    if (accessMode === "ORGANIZATION" && userOrgEmails.length === 0) {
      setShowLinkOrgEmailModal(true);
      return;
    }

    if (!scheduledDateTime) {
      setDeployError("Please select a target launch date and time");
      return;
    }

    const scheduledDate = new Date(scheduledDateTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setDeployError("Target launch time must be in the future");
      return;
    }

    setIsScheduling(true);
    try {
      const res = await quizService.deployQuiz(quizId, {
        deploymentType: "SCHEDULED",
        scheduledFor: scheduledDate.toISOString(),
        liveDurationMinutes: scheduledDurationMinutes,
        accessMode,
        organizationDomain: accessMode === "ORGANIZATION" ? organizationDomain : undefined,
        antiCheat,
        fullScreenLock,
        shuffleChoices,
        allowRetries,
      });

      const liveUntilDate = new Date(scheduledDate.getTime() + scheduledDurationMinutes * 60000);
      setScheduleSuccessInfo({
        scheduledFor: scheduledDate.toLocaleString(),
        liveUntil: liveUntilDate.toLocaleString(),
      });
    } catch (err: any) {
      setDeployError(err?.message || "Failed to schedule quiz");
    } finally {
      setIsScheduling(false);
    }
  };

  // PROTOCOL 3: Anytime Self-Paced Mode -> Activates async access and displays share tools
  const handleEnableAnytime = async () => {
    setDeployError(null);

    if (accessMode === "ORGANIZATION" && userOrgEmails.length === 0) {
      setShowLinkOrgEmailModal(true);
      return;
    }

    setIsDeployingAnytime(true);
    try {
      await quizService.deployQuiz(quizId, {
        deploymentType: "ANYTIME",
        accessMode,
        organizationDomain: accessMode === "ORGANIZATION" ? organizationDomain : undefined,
        antiCheat,
        fullScreenLock,
        shuffleChoices,
        allowRetries,
      });
      setAnytimeActive(true);
    } catch (err: any) {
      setDeployError(err?.message || "Failed to activate Anytime portal");
    } finally {
      setIsDeployingAnytime(false);
    }
  };

  return (
    <div className="min-h-screen text-on-surface font-body-md selection:bg-primary selection:text-on-primary antialiased relative flex flex-col justify-between overflow-x-hidden">
      <CosmicCanvas />
      <Navbar />

      <main className="relative z-10 w-full max-w-max-width-canvas mx-auto px-4 sm:px-8 pt-28 pb-16 flex-1 flex flex-col gap-6">
        {/* Error Banner */}
        {deployError && (
          <div className="p-4 rounded-xl bg-error/20 border border-error/50 text-error flex items-center justify-between gap-3 text-xs font-label-code">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{deployError}</span>
            </div>
            <button
              onClick={() => setDeployError(null)}
              className="text-error hover:text-white"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Top Hero Banner */}
        <ParallaxReveal direction="up" distance={25} duration={700}>
          <section className="relative w-full rounded-2xl p-6 sm:p-8 overflow-hidden bg-surface-container-low/75 backdrop-blur-2xl border border-outline-variant/30 shadow-2xl">
            <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-primary-container/20 blur-[100px] pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-tertiary-container/15 blur-[90px] pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/40 font-label-code text-xs text-tertiary">
                    <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                    Validated & Ready to Deploy
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-label-code text-xs border border-secondary-container/60">
                    PIN: {pin}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-headline-xl text-on-surface tracking-tight font-extrabold">
                  {quizTitle}
                </h1>

                <p className="text-on-surface-variant font-body-md text-xs sm:text-sm max-w-2xl leading-relaxed">
                  {questionCount} Questions • {totalXp.toLocaleString()} Potential XP • Dynamic Adaptive Scoring. Configure your global access mode and launch protocol below.
                </p>

                <div className="pt-1 flex flex-wrap items-center gap-3 text-on-surface-variant font-label-code text-xs">
                  <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30">
                    <span className="material-symbols-outlined text-base text-primary">timer</span>
                    <span>Configured Live Window</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30">
                    <span className="material-symbols-outlined text-base text-tertiary">hub</span>
                    <span>Access Mode: {accessMode}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30">
                    <span className="material-symbols-outlined text-base text-secondary">verified_user</span>
                    <span>Integrity Guard: Active</span>
                  </div>
                </div>
              </div>

              {/* 3D Holographic Sphere Thumbnail */}
              <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0 rounded-2xl overflow-hidden p-1.5 bg-gradient-to-b from-primary/30 via-outline-variant/20 to-tertiary/20 shadow-2xl">
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-surface-container-lowest">
                  <img
                    src="/stitch/screen-6-cosmic-portal-3d.png"
                    alt="Holographic Quantum Sphere representing quiz telemetry engine"
                    className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] font-label-code text-primary-fixed-dim bg-surface-container-low/80 backdrop-blur-sm px-2 py-1 rounded">
                    <span>MISSION ENGINE</span>
                    <span className="text-tertiary font-bold">READY</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ParallaxReveal>

        {/* Global Access Mode Selector (Public vs Private vs Organization) */}
        <ParallaxReveal direction="up" distance={25} delay={60} duration={700}>
          <section className="rounded-xl p-5 bg-surface-container-low/90 backdrop-blur-xl border border-primary/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">vpn_lock</span>
                  <h3 className="font-headline-sm text-sm font-bold text-white uppercase tracking-wider">
                    Global Quiz Access Mode
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  This rule governs all deployment protocols. Restrict access to open public, private invitation, or verified organization domain.
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container-high border border-outline-variant/40">
                {/* Public Mode */}
                <button
                  type="button"
                  onClick={() => setAccessMode("PUBLIC")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    accessMode === "PUBLIC"
                      ? "bg-primary text-surface-container-lowest shadow"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">public</span>
                  <span>Public</span>
                </button>

                {/* Private Mode */}
                <button
                  type="button"
                  onClick={() => setAccessMode("PRIVATE")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    accessMode === "PRIVATE"
                      ? "bg-secondary text-surface-container-lowest shadow"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  <span>Private</span>
                </button>

                {/* Organization Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setAccessMode("ORGANIZATION");
                    if (userOrgEmails.length === 0) {
                      setShowLinkOrgEmailModal(true);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-headline-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    accessMode === "ORGANIZATION"
                      ? "bg-tertiary text-surface-container-lowest shadow"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">corporate_fare</span>
                  <span>Organization</span>
                </button>
              </div>
            </div>

            {/* Organization Specific Settings & Verification */}
            {accessMode === "ORGANIZATION" && (
              <div className="p-4 rounded-xl bg-tertiary/10 border border-tertiary/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="block font-semibold text-xs text-white">
                      Organization Domain Restriction
                    </span>
                    <span className="block text-[11px] text-on-surface-variant">
                      Only cadets logged in with a verified email from this domain will be permitted to join.
                    </span>
                  </div>

                  {userOrgEmails.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowLinkOrgEmailModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary text-surface-container-lowest text-xs font-bold hover:bg-tertiary/90 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add_link</span>
                      <span>Link Organization Email</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-on-surface-variant">Domain:</span>
                      <select
                        value={organizationDomain}
                        onChange={(e) => setOrganizationDomain(e.target.value)}
                        className="bg-surface-container-high border border-outline-variant text-white rounded-lg px-2.5 py-1 text-xs outline-none focus:border-tertiary font-mono"
                      >
                        {userOrgEmails.map((em) => {
                          const dom = em.split("@")[1]?.toLowerCase();
                          return (
                            <option key={em} value={dom}>
                              @{dom} ({em})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {userOrgEmails.length === 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">warning</span>
                    <span>
                      You must link an organization email to your account (e.g. school or company email) before deploying an organization-restricted quiz.
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        </ParallaxReveal>

        {/* Universal Quiz ID & Quick Share Bar */}
        <ParallaxReveal direction="up" distance={25} delay={80} duration={700}>
          <section className="rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 border border-primary-container/30 bg-surface-container-low/90 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-11 h-11 rounded-xl bg-primary-container/20 flex items-center justify-center border border-primary/30 text-primary shrink-0">
                <span className="material-symbols-outlined text-2xl">fingerprint</span>
              </div>
              <div>
                <div className="text-on-surface-variant font-label-code text-[11px] uppercase tracking-wider">
                  Assigned Universal Room PIN
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-stat-counter text-xl sm:text-2xl text-primary tracking-widest font-extrabold">
                    {pin}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-label-code font-bold uppercase">
                    Ready
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end text-xs font-label-code">
              <button
                onClick={handleCopyId}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/40 hover:border-primary text-on-surface transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-primary">content_copy</span>
                <span>{copiedId ? "Copied ID!" : "Copy Quiz ID"}</span>
              </button>
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/40 hover:border-tertiary text-on-surface transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-tertiary">link</span>
                <span>{copiedUrl ? "Copied Join Link!" : "Copy Direct Join URL"}</span>
              </button>
              <button
                onClick={() => setShowQrModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/40 hover:border-secondary text-on-surface transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-secondary">qr_code_2</span>
                <span>QR Portal</span>
              </button>
            </div>
          </section>
        </ParallaxReveal>

        {/* Core 3 Deployment Protocol Cards */}
        <ParallaxReveal direction="up" distance={30} delay={140} duration={800}>
          <section className="space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end">
              <div>
                <h2 className="text-xl sm:text-2xl font-headline-lg text-on-surface font-semibold">
                  Select Deployment Protocol
                </h2>
                <p className="text-on-surface-variant text-xs font-body-sm">
                  Choose live host session (with admin telemetry), scheduled release, or anytime self-paced access.
                </p>
              </div>
              <span className="text-on-surface-variant font-label-code text-xs mt-1 md:mt-0 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-primary">hub</span>
                BACKEND PROTOCOL ROUTING
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* CARD 1: Launch Real-Time Live Quiz -> Admin Command Center */}
              <div className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border-2 border-primary/50 bg-gradient-to-b from-surface-container-low/95 to-surface-container-lowest shadow-xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-container to-secondary" />
                <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container/30 text-primary-fixed border border-primary/40 font-label-code text-xs uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      Live Host
                    </span>
                    <span className="material-symbols-outlined text-primary text-2xl">sensors</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-headline-sm text-on-surface font-semibold mb-2">
                    Launch Real-Time Live Quiz
                  </h3>
                  <p className="text-on-surface-variant text-xs font-body-sm mb-4 leading-relaxed">
                    Starts a live arena session. Directs you directly to the <strong>Quiz Admin Panel</strong> to monitor attendance, average score, and real-time leaderboard ranking.
                  </p>

                  <div className="p-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 space-y-2 mb-4 text-xs">
                    <label className="block text-[11px] font-label-code text-on-surface-variant">
                      Live Duration Window:
                    </label>
                    <select
                      value={liveDurationMinutes}
                      onChange={(e) => setLiveDurationMinutes(Number(e.target.value))}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-primary"
                    >
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes (Default)</option>
                      <option value={120}>2 Hours</option>
                      <option value={1440}>24 Hours</option>
                    </select>
                    <span className="block text-[10px] text-on-surface-variant">
                      Quiz automatically closes after this duration has elapsed.
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-outline-variant/30">
                  <div className="flex items-center justify-between text-xs font-label-code text-on-surface-variant bg-surface-container-high/60 px-3 py-2 rounded-lg border border-outline-variant/30">
                    <span>Host Destination:</span>
                    <span className="text-primary font-bold">Quiz Admin Control Center</span>
                  </div>
                  <button
                    onClick={handleStartLiveNow}
                    disabled={isStartingLive}
                    className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-surface-container-lowest font-headline-sm text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">dashboard</span>
                    <span>{isStartingLive ? "Opening Admin..." : "Start Live Room Now 🚀"}</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: Schedule for Later -> Automated Mail 5m Before & Waitlist */}
              <div className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border border-outline-variant/40 bg-gradient-to-b from-surface-container-low/70 to-surface-container-lowest hover:border-secondary/60 transition-all shadow-xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary-container via-secondary to-primary-fixed-dim opacity-70" />

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-secondary border border-secondary/40 font-label-code text-xs uppercase tracking-wider">
                      <span className="material-symbols-outlined text-xs">event</span>
                      Scheduled
                    </span>
                    <span className="material-symbols-outlined text-secondary text-2xl">alarm</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-headline-sm text-on-surface font-semibold mb-2">
                    Schedule for Later
                  </h3>
                  <p className="text-on-surface-variant text-xs font-body-sm mb-4 leading-relaxed">
                    Automated scheduled release. A reminder email is dispatched <strong>5 minutes before</strong> launch, and early cadets enter a real-time Waitlist.
                  </p>

                  <div className="space-y-2.5 mb-4 bg-surface-container-lowest/60 p-3 rounded-xl border border-outline-variant/30 text-xs">
                    <div>
                      <label className="block text-[11px] font-label-code text-on-surface-variant mb-1">
                        Target Launch Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="w-full bg-surface-container-high text-on-surface border border-outline-variant/50 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-secondary outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-label-code text-on-surface-variant mb-1">
                        Live Duration Window After Launch:
                      </label>
                      <select
                        value={scheduledDurationMinutes}
                        onChange={(e) => setScheduledDurationMinutes(Number(e.target.value))}
                        className="w-full bg-surface-container-high text-on-surface border border-outline-variant/50 rounded-lg px-2 py-1.5 text-xs outline-none"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes (Default)</option>
                        <option value={120}>2 Hours</option>
                        <option value={1440}>24 Hours</option>
                      </select>
                    </div>
                  </div>

                  {scheduleSuccessInfo && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Quiz Scheduled in Backend</span>
                      </div>
                      <div>Launch: {scheduleSuccessInfo.scheduledFor}</div>
                      <div>Pre-launch email will fire 5 minutes before.</div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-outline-variant/30">
                  <button
                    onClick={handleConfirmSchedule}
                    disabled={isScheduling}
                    className="w-full py-3 px-4 rounded-xl bg-surface-container-high hover:bg-secondary-container hover:text-white text-on-surface font-headline-sm text-xs sm:text-sm border border-outline-variant/40 hover:border-secondary transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-secondary">calendar_month</span>
                    <span>{isScheduling ? "Scheduling..." : "Confirm Schedule 📅"}</span>
                  </button>
                </div>
              </div>

              {/* CARD 3: Anytime Mode / Self-Paced Access -> Invite Link & PIN */}
              <div className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border border-tertiary/40 bg-gradient-to-b from-surface-container-low/80 to-surface-container-lowest shadow-xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tertiary-container via-tertiary to-primary" />
                <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-tertiary/15 blur-3xl pointer-events-none" />

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container/30 text-tertiary-fixed border border-tertiary/40 font-label-code text-xs uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-tertiary" />
                      Async • Open Access
                    </span>
                    <span className="material-symbols-outlined text-tertiary text-2xl">all_inclusive</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-headline-sm text-on-surface font-semibold mb-2">
                    Anytime Mode / Self-Paced
                  </h3>
                  <p className="text-on-surface-variant text-xs font-body-sm mb-4 leading-relaxed">
                    Learners engage anytime at their own pace using the Room PIN or direct link. Ideal for homework, revision, and continuous study.
                  </p>

                  <div className="space-y-2 mb-4 text-on-surface-variant text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-high/40 border border-outline-variant/30">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary text-base">pin</span>
                        <span>Room PIN:</span>
                      </div>
                      <span className="font-mono text-tertiary font-bold">{pin}</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-high/40 border border-outline-variant/30">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary text-base">link</span>
                        <span>Invite URL:</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="text-[11px] text-primary hover:underline font-mono"
                      >
                        {copiedUrl ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant/30">
                  <button
                    onClick={handleEnableAnytime}
                    disabled={isDeployingAnytime}
                    className="w-full py-3 px-4 rounded-xl bg-surface-container-high hover:bg-tertiary/20 text-on-surface font-headline-sm text-xs sm:text-sm border border-outline-variant/40 hover:border-tertiary transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-tertiary">lock_open</span>
                    <span>{anytimeActive ? "Anytime Active ✓" : "Activate Anytime Access"}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </ParallaxReveal>

        {/* Security & Proctoring Controls */}
        <ParallaxReveal direction="up" distance={25} delay={200} duration={700}>
          <section className="rounded-xl p-5 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-xl">shield_lock</span>
              <h3 className="font-headline-sm text-sm font-semibold text-on-surface">
                Security, Anti-Cheat & Identity Guard
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-container/60 border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <span className="block text-on-surface font-medium">AI Anti-Cheat</span>
                  <span className="text-outline text-[11px]">Detect tab switching</span>
                </div>
                <input
                  type="checkbox"
                  checked={antiCheat}
                  onChange={(e) => setAntiCheat(e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-container/60 border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <span className="block text-on-surface font-medium">Full-Screen Lock</span>
                  <span className="text-outline text-[11px]">Enforce kiosk mode</span>
                </div>
                <input
                  type="checkbox"
                  checked={fullScreenLock}
                  onChange={(e) => setFullScreenLock(e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-container/60 border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <span className="block text-on-surface font-medium">Shuffle Choices</span>
                  <span className="text-outline text-[11px]">Per-cadet randomization</span>
                </div>
                <input
                  type="checkbox"
                  checked={shuffleChoices}
                  onChange={(e) => setShuffleChoices(e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-container/60 border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <span className="block text-on-surface font-medium">Allow Retakes</span>
                  <span className="text-outline text-[11px]">Record best score</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowRetries}
                  onChange={(e) => setAllowRetries(e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary"
                />
              </div>
            </div>
          </section>
        </ParallaxReveal>
      </main>

      {/* Link Organization Email Modal */}
      {showLinkOrgEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-surface-container-low border border-tertiary/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="font-headline-sm text-sm text-tertiary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">corporate_fare</span>
                <span>Link Organization Email</span>
              </span>
              <button
                onClick={() => setShowLinkOrgEmailModal(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              To host an organization-restricted quiz, your account must be verified with an organization email domain (e.g. university or enterprise email).
            </p>

            {linkEmailError && (
              <div className="p-3 rounded-lg bg-error/20 border border-error/50 text-error text-xs">
                {linkEmailError}
              </div>
            )}

            <form onSubmit={handleLinkOrgEmail} className="space-y-4">
              <div>
                <label className="block text-[11px] font-label-code text-on-surface-variant mb-1">
                  Organization / Institutional Email Address:
                </label>
                <input
                  type="email"
                  required
                  value={newOrgEmailInput}
                  onChange={(e) => setNewOrgEmailInput(e.target.value)}
                  placeholder="e.g. yourname@stanford.edu or user@company.com"
                  className="w-full bg-surface-container-high text-white border border-outline-variant/60 rounded-xl px-3 py-2 text-xs outline-none focus:border-tertiary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkOrgEmailModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container text-xs text-on-surface-variant hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLinkingEmail}
                  className="px-4 py-2 rounded-lg bg-tertiary text-surface-container-lowest text-xs font-bold hover:bg-tertiary/90 transition-all flex items-center gap-1"
                >
                  <span>{isLinkingEmail ? "Linking..." : "Link & Verify"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/40 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="font-headline-sm text-sm text-primary font-bold">QR Cosmic Portal</span>
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
              Room PIN: <span className="text-primary font-bold text-sm">{pin}</span>
            </div>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-label-code"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest/80 backdrop-blur-md border-t border-outline-variant/20 py-4 px-6 relative z-10 text-xs font-label-code text-on-surface-variant">
        <div className="max-w-max-width-canvas mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>QuizzCraft Deployment Hub • Node Cluster US-EAST-1 Active</span>
          <div className="flex items-center gap-4">
            <Link href="/join" className="text-tertiary hover:underline">
              Join Arena Portal →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function DeploySchedulePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-surface-container-lowest" />}>
        <DeployScheduleContent />
      </Suspense>
    </ProtectedRoute>
  );
}
