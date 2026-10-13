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
import { orgService } from "@/lib/api/org-service";
import { OrgMember } from "@/lib/api/types";
import QRCode from "qrcode";

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
  const orgSlugParam = searchParams.get("orgSlug");

  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  // Organization workspace & role telemetry
  const [quizOrgId, setQuizOrgId] = useState<string | null>(null);
  const [isPracticeQuiz, setIsPracticeQuiz] = useState<boolean>(false);
  const [userOrgSlug, setUserOrgSlug] = useState<string | null>(null);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);

  // Peer sharing roster for learner training quiz
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [peerSearchQuery, setPeerSearchQuery] = useState("");
  const [copiedPeerLink, setCopiedPeerLink] = useState(false);
  const [copiedPeerUserId, setCopiedPeerUserId] = useState<string | null>(null);

  // Security & Proctoring
  const [antiCheat, setAntiCheat] = useState(true);
  const [fullScreenLock, setFullScreenLock] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [allowRetries, setAllowRetries] = useState(false);

  // Quiz Metadata
  const [quizId, setQuizId] = useState("QC-9804-QBIT");
  const [pin, setPin] = useState("884-219");
  const [quizTitle, setQuizTitle] = useState("Quantum Computing Principles");
  const [coverImage, setCoverImage] = useState<string>("");
  const [questionCount, setQuestionCount] = useState(15);
  const [totalXp, setTotalXp] = useState(2250);

  // Access Mode: PUBLIC | PRIVATE | ORGANIZATION
  const [accessMode, setAccessMode] = useState<"PUBLIC" | "PRIVATE" | "ORGANIZATION">("PUBLIC");
  const [organizationDomain, setOrganizationDomain] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);

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

  // Cover Image Customization
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverInputUrl, setCoverInputUrl] = useState("");
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const handleSaveCover = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!coverInputUrl.trim() || !quizId) return;
    setIsSavingCover(true);
    setCoverError(null);
    try {
      await quizService.updateQuiz(quizId, { coverImage: coverInputUrl.trim() });
      setCoverImage(coverInputUrl.trim());
      setShowCoverModal(false);
      try {
        const cached = localStorage.getItem("qc_active_quiz");
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.coverImage = coverInputUrl.trim();
          localStorage.setItem("qc_active_quiz", JSON.stringify(parsed));
        }
      } catch (e) {}
    } catch (err: any) {
      setCoverError(err?.message || "Failed to update cover image");
    } finally {
      setIsSavingCover(false);
    }
  };

  // Instant Access Mode & Security persistence
  const [isUpdatingAccessMode, setIsUpdatingAccessMode] = useState(false);
  const [accessModeFeedback, setAccessModeFeedback] = useState<string | null>(null);

  const handleUpdateAccessMode = async (newMode: "PUBLIC" | "PRIVATE" | "ORGANIZATION") => {
    setAccessMode(newMode);
    if (!quizId) return;

    if (newMode === "ORGANIZATION" && userOrgEmails.length === 0) {
      setShowLinkOrgEmailModal(true);
      return;
    }

    setIsUpdatingAccessMode(true);
    setDeployError(null);
    try {
      const activeOrgDomain = newMode === "ORGANIZATION"
        ? (organizationDomain || (userOrgEmails[0] ? userOrgEmails[0].split("@")[1]?.toLowerCase() : undefined))
        : undefined;

      await quizService.updateQuiz(quizId, {
        accessMode: newMode,
        organizationDomain: activeOrgDomain,
      });

      setAccessModeFeedback(`Access mode updated to ${newMode}`);
      setTimeout(() => setAccessModeFeedback(null), 3500);

      try {
        const cached = localStorage.getItem("qc_active_quiz");
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.accessMode = newMode;
          if (newMode === "ORGANIZATION" && activeOrgDomain) {
            parsed.organizationDomain = activeOrgDomain;
          }
          localStorage.setItem("qc_active_quiz", JSON.stringify(parsed));
        }
      } catch (e) {}
    } catch (err: any) {
      setDeployError(err?.message || "Failed to update access mode");
    } finally {
      setIsUpdatingAccessMode(false);
    }
  };

  const handleUpdateDomain = async (newDomain: string) => {
    setOrganizationDomain(newDomain);
    if (!quizId || accessMode !== "ORGANIZATION") return;
    try {
      await quizService.updateQuiz(quizId, {
        accessMode: "ORGANIZATION",
        organizationDomain: newDomain,
      });
      setAccessModeFeedback(`Organization domain updated to @${newDomain}`);
      setTimeout(() => setAccessModeFeedback(null), 3500);
    } catch (err: any) {
      setDeployError(err?.message || "Failed to update organization domain");
    }
  };

  const handleToggleSecurity = async (
    key: "antiCheat" | "fullScreenLock" | "shuffleChoices" | "allowRetries",
    value: boolean
  ) => {
    if (key === "antiCheat") setAntiCheat(value);
    if (key === "fullScreenLock") setFullScreenLock(value);
    if (key === "shuffleChoices") setShuffleChoices(value);
    if (key === "allowRetries") setAllowRetries(value);

    if (!quizId) return;
    try {
      await quizService.updateQuiz(quizId, { [key]: value });
      setAccessModeFeedback("Assessment settings updated");
      setTimeout(() => setAccessModeFeedback(null), 2500);
    } catch (e) {}
  };

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
            targetId = cachedQuiz?.quizId || cachedQuiz?.id;
          }
        } catch (e) {
          console.warn("Could not read cached quiz:", e);
        }
      }

      if (targetId) {
        try {
          const res = await quizService.getQuiz(targetId);
          const q = res.data?.quiz || res.data || cachedQuiz;
          if (q) {
            setQuizId(q.quizId || targetId);
            setQuizTitle(q.title || "Quantum Computing Principles");
            if (q.coverImage) {
              setCoverImage(q.coverImage);
            }
            if (q.orgId) {
              setQuizOrgId(q.orgId);
            }
            if (q.isPractice !== undefined) {
              setIsPracticeQuiz(Boolean(q.isPractice));
            }
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
            if (q.deploymentType === "ANYTIME" || q.status === "ANYTIME") {
              setAnytimeActive(true);
            }
            if (q.scheduledFor) {
              setScheduleSuccessInfo({
                scheduledFor: new Date(q.scheduledFor).toLocaleString(),
                liveUntil: q.liveUntil ? new Date(q.liveUntil).toLocaleString() : "",
              });
            }
            if (q.antiCheat !== undefined) setAntiCheat(Boolean(q.antiCheat));
            if (q.fullScreenLock !== undefined) setFullScreenLock(Boolean(q.fullScreenLock));
            if (q.shuffleChoices !== undefined) setShuffleChoices(Boolean(q.shuffleChoices));
            if (q.allowRetries !== undefined) setAllowRetries(Boolean(q.allowRetries));
            if (Array.isArray(q.questions) && q.questions.length > 0) {
              setQuestionCount(q.questions.length);
              const xpSum = q.questions.reduce((sum: number, item: any) => sum + (item.xp || 200), 0);
              setTotalXp(xpSum);
            }
          }
        } catch (err) {
          console.warn("Could not fetch quiz for deploy:", err);
          if (cachedQuiz) {
            setQuizId(cachedQuiz.quizId || cachedQuiz.id || "QC-9804-QBIT");
            setQuizTitle(cachedQuiz.title || "Quantum Computing Principles");
            if (cachedQuiz.coverImage) setCoverImage(cachedQuiz.coverImage);
            if (cachedQuiz.orgId) setQuizOrgId(cachedQuiz.orgId);
            if (cachedQuiz.isPractice !== undefined) setIsPracticeQuiz(Boolean(cachedQuiz.isPractice));
            if (cachedQuiz.accessMode) setAccessMode(cachedQuiz.accessMode);
            if (cachedQuiz.antiCheat !== undefined) setAntiCheat(Boolean(cachedQuiz.antiCheat));
            if (cachedQuiz.fullScreenLock !== undefined) setFullScreenLock(Boolean(cachedQuiz.fullScreenLock));
            if (cachedQuiz.shuffleChoices !== undefined) setShuffleChoices(Boolean(cachedQuiz.shuffleChoices));
            if (cachedQuiz.allowRetries !== undefined) setAllowRetries(Boolean(cachedQuiz.allowRetries));
            if (cachedQuiz.pin) {
              const rawPin = String(cachedQuiz.pin).replace(/\D/g, "");
              setPin(rawPin.length === 6 ? `${rawPin.slice(0, 3)}-${rawPin.slice(3)}` : rawPin);
            }
          }
        }
      }

      // Fetch User's Linked Emails to check organization status
      try {
        const meRes = await authService.getMe();
        const user = meRes?.data?.user;
        if (user) {
          setUserRole(user.role || null);
          setUserOrgSlug(user.orgSlug || null);
          setUserOrgId(user.orgId || null);
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

  // ==================== RBAC & WORKSPACE MAPPING ====================
  const isOrgAdminOrInstructor =
    userRole === "ORG_ADMIN" ||
    userRole === "ORG_PARTNER" ||
    userRole === "SUPER_ADMIN";

  const isOrgLearner =
    userRole === "ORG_STD" ||
    userRole === "ORG_USER";

  // Check whether the quiz was created inside an organization workspace
  const isInsideOrgQuiz = Boolean(quizOrgId || orgSlugParam);

  // A learner's org training quiz strictly requires:
  // 1. Created inside an org workspace (quizOrgId or orgSlugParam)
  // 2. The user is a learner/student (isOrgLearner is true and isOrgAdminOrInstructor is false)
  const isLearnerOrgTrainingQuiz = isInsideOrgQuiz && isOrgLearner && !isOrgAdminOrInstructor;
  const effectiveOrgSlug = orgSlugParam || userOrgSlug;

  // Fetch organization peers for learner training quiz
  useEffect(() => {
    if (!isLearnerOrgTrainingQuiz) return;

    let isMounted = true;
    async function fetchPeers() {
      setIsLoadingMembers(true);
      try {
        if (effectiveOrgSlug) {
          const res = await orgService.getOrgMembersBySlug(effectiveOrgSlug);
          if (isMounted && res?.data?.members) {
            setOrgMembers(res.data.members);
            return;
          }
        }
        const res = await orgService.getOrgMembers();
        if (isMounted && res?.data?.members) {
          setOrgMembers(res.data.members);
        }
      } catch (err) {
        console.warn("Could not load organization members for peer sharing:", err);
      } finally {
        if (isMounted) setIsLoadingMembers(false);
      }
    }

    fetchPeers();
    return () => {
      isMounted = false;
    };
  }, [isLearnerOrgTrainingQuiz, effectiveOrgSlug]);

  const baseOrigin = typeof window !== "undefined" ? window.location.origin : "https://quizzcraft.app";
  const rawPinClean = pin.replace(/\D/g, "");
  const peerPracticeUrl = `${baseOrigin}/quiz?quizId=${encodeURIComponent(quizId)}&practice=true${rawPinClean ? `&pin=${rawPinClean}` : ""}`;

  const handleCopyPeerLink = () => {
    navigator.clipboard.writeText(peerPracticeUrl);
    setCopiedPeerLink(true);
    setTimeout(() => setCopiedPeerLink(false), 2500);
  };

  const handleCopyInviteForPeer = (member: OrgMember) => {
    const inviteText = `Hey @${member.username}! Here's our study assessment "${quizTitle}": ${peerPracticeUrl} (PIN: ${pin})`;
    navigator.clipboard.writeText(inviteText);
    setCopiedPeerUserId(member.userId);
    setTimeout(() => setCopiedPeerUserId(null), 2500);
  };

  const filteredPeers = orgMembers.filter((m) => {
    if (!peerSearchQuery.trim()) return true;
    const q = peerSearchQuery.toLowerCase().trim();
    return (
      m.username?.toLowerCase().includes(q) ||
      m.fullName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  });

  const handleCopyPin = () => {
    const rawPin = pin.replace(/\D/g, "");
    navigator.clipboard.writeText(rawPin || pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyUrl = () => {
    const rawPin = pin.replace(/\D/g, "");
    const base = typeof window !== "undefined" ? window.location.origin : "https://quizzcraft.app";
    const url = rawPin ? `${base}/join?pin=${rawPin}` : `${base}/join`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Generate QR Code Data URL for direct join URL with room PIN
  useEffect(() => {
    const rawPin = pin.replace(/\D/g, "");
    const base = typeof window !== "undefined" ? window.location.origin : "https://quizzcraft.app";
    const joinUrl = rawPin ? `${base}/join?pin=${rawPin}` : `${base}/join`;
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0b0f19",
        light: "#ffffff",
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error("QR Generation error:", err));
  }, [pin]);

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
      const isStudentUser = userRole === "ORG_STD" || userRole === "ORG_USER";
      const res = await quizService.deployQuiz(quizId, {
        deploymentType: "LIVE",
        accessMode: isStudentUser ? "PRIVATE" : accessMode,
        organizationDomain: (!isStudentUser && accessMode === "ORGANIZATION") ? organizationDomain : undefined,
        liveDurationMinutes,
        antiCheat,
        fullScreenLock,
        shuffleChoices,
        allowRetries,
        isPractice: isStudentUser ? true : undefined,
      });

      // Redirect directly to the Quiz Review & Leaderboard Panel!
      router.push(`/quiz/review/${encodeURIComponent(quizId)}`);
    } catch (err: any) {
      setDeployError(err?.message || "Failed to launch live room");
      setIsStartingLive(false);
    }
  };

  // PROTOCOL 2: Schedule for Later -> Creates DB record, activates 1-minute scheduler, sends email 5m before
  const handleConfirmSchedule = async () => {
    setDeployError(null);

    const isStudentUser = userRole === "ORG_STD" || userRole === "ORG_USER";
    if (!isStudentUser && accessMode === "ORGANIZATION" && userOrgEmails.length === 0) {
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
        accessMode: isStudentUser ? "PRIVATE" : accessMode,
        organizationDomain: (!isStudentUser && accessMode === "ORGANIZATION") ? organizationDomain : undefined,
        antiCheat,
        fullScreenLock,
        shuffleChoices,
        allowRetries,
        isPractice: isStudentUser ? true : undefined,
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

    const isStudentUser = userRole === "ORG_STD" || userRole === "ORG_USER";
    if (!isStudentUser && accessMode === "ORGANIZATION" && userOrgEmails.length === 0) {
      setShowLinkOrgEmailModal(true);
      return;
    }

    setIsDeployingAnytime(true);
    try {
      await quizService.deployQuiz(quizId, {
        deploymentType: "ANYTIME",
        accessMode: isStudentUser ? "PRIVATE" : accessMode,
        organizationDomain: (!isStudentUser && accessMode === "ORGANIZATION") ? organizationDomain : undefined,
        antiCheat,
        fullScreenLock,
        shuffleChoices,
        allowRetries,
        isPractice: isStudentUser ? true : undefined,
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
        {/* Learner Org Training Sandbox Notice (Shown ONLY if user creates a quiz inside org workspace) */}
        {isLearnerOrgTrainingQuiz && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border border-primary/30 flex items-start gap-4 shadow-xl backdrop-blur-xl animate-fadeIn">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-2xl">school</span>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                  Organization Learner Sandbox
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 font-mono">
                  Training Only • Non-Deployable
                </span>
              </div>
              <p className="text-sm font-bold text-white">
                This quiz is for your training only.
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                As a learner in this organization workspace, formal live hosting and scheduled cohort deployment protocols are reserved for instructors. You can launch solo practice immediately to master these materials, or share this training quiz with your organization peers to study together.
              </p>
            </div>
          </div>
        )}

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
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-code text-xs ${
                    isLearnerOrgTrainingQuiz
                      ? "bg-primary/20 border border-primary/40 text-primary"
                      : "bg-surface-container-high border border-outline-variant/40 text-tertiary"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isLearnerOrgTrainingQuiz ? "bg-primary" : "bg-tertiary animate-pulse"}`} />
                    {isLearnerOrgTrainingQuiz ? "Training Sandbox • Non-Deployable" : "Validated & Ready to Deploy"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-label-code text-xs border border-secondary-container/60">
                    PIN: {pin}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-headline-xl text-on-surface tracking-tight font-extrabold">
                  {quizTitle}
                </h1>

                <p className="text-on-surface-variant font-body-md text-xs sm:text-sm max-w-2xl leading-relaxed">
                  {questionCount} Questions • {totalXp.toLocaleString()} Potential XP • {isLearnerOrgTrainingQuiz ? "Learner Training Assessment. Launch solo practice or collaborate with your organization peers below." : "Dynamic Adaptive Scoring. Configure your global access mode and launch protocol below."}
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
              <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0 rounded-2xl overflow-hidden p-1.5 bg-surface-container-high border border-white/10 shadow-2xl group">
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-surface-container-lowest">
                  <img
                    src={coverImage || "/stitch/screen-6-cosmic-portal-3d.png"}
                    alt={quizTitle}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/stitch/screen-6-cosmic-portal-3d.png";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent pointer-events-none" />
                  
                  {/* Edit Cover Overlay Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setCoverInputUrl(coverImage || "");
                      setCoverError(null);
                      setShowCoverModal(true);
                    }}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white cursor-pointer z-10 backdrop-blur-[2px]"
                    title="Change Quiz Cover Image"
                  >
                    <span className="material-symbols-outlined text-2xl text-tertiary">photo_camera</span>
                    <span className="text-[10px] font-headline-sm font-semibold tracking-wider uppercase">Change Cover</span>
                  </button>

                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] font-label-code text-primary-fixed-dim bg-surface-container-low/80 backdrop-blur-sm px-2 py-1 rounded pointer-events-none z-0">
                    <span>MISSION ENGINE</span>
                    <span className="text-tertiary font-bold">{isLearnerOrgTrainingQuiz ? "PRACTICE READY" : "READY"}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ParallaxReveal>

        {/* Global Access Mode Selector (Public vs Private vs Organization) - Hidden for Learner Org Training Quiz */}
        {!isLearnerOrgTrainingQuiz && (
          <ParallaxReveal direction="up" distance={25} delay={60} duration={700}>
            <section className="rounded-xl p-5 bg-surface-container-low/90 backdrop-blur-xl border border-primary/30 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">vpn_lock</span>
                    <h3 className="font-headline-sm text-sm font-bold text-white uppercase tracking-wider">
                      Global Quiz Access Mode
                    </h3>
                    {isUpdatingAccessMode && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-tertiary animate-pulse ml-2">
                        <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                        Syncing...
                      </span>
                    )}
                    {accessModeFeedback && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-fadeIn ml-2">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        {accessModeFeedback}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Live synced: Changes take effect immediately across all active, anytime, and scheduled rooms.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container-high border border-outline-variant/40">
                  {/* Public Mode */}
                  <button
                    type="button"
                    onClick={() => handleUpdateAccessMode("PUBLIC")}
                    disabled={isUpdatingAccessMode}
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
                    onClick={() => handleUpdateAccessMode("PRIVATE")}
                    disabled={isUpdatingAccessMode}
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
                    onClick={() => handleUpdateAccessMode("ORGANIZATION")}
                    disabled={isUpdatingAccessMode}
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
                          onChange={(e) => handleUpdateDomain(e.target.value)}
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
        )}

        {/* Universal Quiz ID & Quick Share Bar */}
        <ParallaxReveal direction="up" distance={25} delay={80} duration={700}>
          <section className="rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 border border-primary-container/30 bg-surface-container-low/90 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-11 h-11 rounded-xl bg-primary-container/20 flex items-center justify-center border border-primary/30 text-primary shrink-0">
                <span className="material-symbols-outlined text-2xl">fingerprint</span>
              </div>
              <div>
                <div className="text-on-surface-variant font-label-code text-[11px] uppercase tracking-wider">
                  {isLearnerOrgTrainingQuiz ? "Assigned Training Room PIN" : "Assigned Universal Room PIN"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-stat-counter text-xl sm:text-2xl text-primary tracking-widest font-extrabold">
                    {pin}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-label-code font-bold uppercase">
                    {isLearnerOrgTrainingQuiz ? "Training PIN" : "Ready"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end text-xs font-label-code">
              <button
                onClick={handleCopyPin}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/40 hover:border-primary text-on-surface transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-primary">pin</span>
                <span>{copiedPin ? "Copied Room PIN!" : "Copy Room PIN"}</span>
              </button>
              <button
                onClick={isLearnerOrgTrainingQuiz ? handleCopyPeerLink : handleCopyUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/40 hover:border-tertiary text-on-surface transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-tertiary">link</span>
                <span>
                  {isLearnerOrgTrainingQuiz
                    ? copiedPeerLink
                      ? "Copied Peer Link!"
                      : "Copy Peer Training Link"
                    : copiedUrl
                    ? "Copied Join Link!"
                    : "Copy Direct Join URL"}
                </span>
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

        {/* Core Deployment Protocol Cards (For Instructors & Public Users) OR Learner Practice & Peer Collaboration Hub */}
        {isLearnerOrgTrainingQuiz ? (
          <ParallaxReveal direction="up" distance={30} delay={140} duration={800}>
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-headline-lg text-on-surface font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-2xl">local_library</span>
                    <span>Practice &amp; Peer Collaboration Hub</span>
                  </h2>
                  <p className="text-on-surface-variant text-xs font-body-sm mt-0.5">
                    Formal live hosting and scheduled deployment are reserved for instructors. You can launch your private practice attempt or share with fellow organization cadets.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-mono text-xs font-semibold">
                  Sandbox Active
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT CARD (5 cols): SOLO PRACTICE */}
                <div className="lg:col-span-5 rounded-2xl p-6 bg-surface-container-low/90 backdrop-blur-xl border-2 border-primary/40 shadow-xl flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
                  <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 font-label-code text-xs uppercase font-bold tracking-wider">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                        Solo Practice
                      </span>
                      <span className="material-symbols-outlined text-primary text-2xl">verified</span>
                    </div>

                    <div>
                      <h3 className="text-lg font-headline-sm font-bold text-white mb-1.5">
                        Start Solo Training Attempt
                      </h3>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Test your mastery right away in a distraction-free environment. Includes anti-cheat proctoring simulation, per-question timer enforcement, and immediate explanatory debriefs.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-outline-variant/30 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-on-surface-variant">
                        <span>Total Questions:</span>
                        <strong className="text-white font-mono">{questionCount} questions</strong>
                      </div>
                      <div className="flex items-center justify-between text-on-surface-variant">
                        <span>XP Bounty:</span>
                        <strong className="text-amber-400 font-mono">+{totalXp} XP</strong>
                      </div>
                      <div className="flex items-center justify-between text-on-surface-variant">
                        <span>Attempt Protocol:</span>
                        <span className="text-emerald-400 font-bold font-mono">Private Sandbox</span>
                      </div>
                      <div className="flex items-center justify-between text-on-surface-variant">
                        <span>Telemetry:</span>
                        <span className="text-primary font-mono">Included in Profile XP</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-outline-variant/30 mt-6">
                    <Link
                      href={`/quiz?quizId=${encodeURIComponent(quizId)}&practice=true`}
                      className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-surface-container-lowest font-headline-sm text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">play_arrow</span>
                      <span>Launch Solo Practice 🚀</span>
                    </Link>
                  </div>
                </div>

                {/* RIGHT CARD (7 cols): SHARE WITH YOUR PEERS */}
                <div className="lg:col-span-7 rounded-2xl p-6 bg-surface-container-low/90 backdrop-blur-xl border border-outline-variant/40 shadow-xl flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container/30 text-tertiary-fixed border border-tertiary/40 font-label-code text-xs uppercase font-bold tracking-wider">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        Peer Collaboration
                      </span>
                      <span className="text-xs font-mono text-on-surface-variant">
                        {orgMembers.length} Organization Member{orgMembers.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-headline-sm font-bold text-white mb-1.5">
                        Share with Your Peers
                      </h3>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Study collaboratively! Invite members and cohort peers from your organization to practice this training quiz with you.
                      </p>
                    </div>

                    {/* Quick Link & PIN Copy Bar */}
                    <div className="p-3 rounded-xl bg-surface-container-high/50 border border-outline-variant/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-tertiary text-base">link</span>
                        <span className="text-on-surface-variant font-mono">Peer Join Link:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyPeerLink}
                          className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-bright border border-white/10 text-white font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs text-tertiary">
                            {copiedPeerLink ? "check" : "content_copy"}
                          </span>
                          <span>{copiedPeerLink ? "Copied!" : "Copy Training Link"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQrModal(true)}
                          className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-bright border border-white/10 text-secondary font-mono text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-xs">qr_code_2</span>
                          <span>QR</span>
                        </button>
                      </div>
                    </div>

                    {/* Search Peer Filter */}
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                        search
                      </span>
                      <input
                        type="text"
                        value={peerSearchQuery}
                        onChange={(e) => setPeerSearchQuery(e.target.value)}
                        placeholder="Search organization peers by name or username..."
                        className="w-full pl-9 pr-3 py-2 bg-surface-container-high/60 border border-outline-variant/40 rounded-xl text-xs text-white placeholder:text-on-surface-variant/60 focus:outline-none focus:border-tertiary transition-colors"
                      />
                    </div>

                    {/* Organization Members Roster */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {isLoadingMembers ? (
                        <div className="py-8 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-base animate-spin text-tertiary">sync</span>
                          <span>Loading organization roster...</span>
                        </div>
                      ) : filteredPeers.length === 0 ? (
                        <div className="py-6 text-center text-xs text-on-surface-variant bg-surface-container/30 rounded-xl border border-white/5">
                          {peerSearchQuery
                            ? `No members matching "${peerSearchQuery}"`
                            : "No other members enrolled in this organization yet."}
                        </div>
                      ) : (
                        filteredPeers.map((member) => {
                          const isCopied = copiedPeerUserId === member.userId;
                          return (
                            <div
                              key={member.userId}
                              className="p-2.5 rounded-xl bg-surface-container/50 border border-white/5 hover:border-white/15 flex items-center justify-between gap-3 text-xs transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                                  {member.profilePicture ? (
                                    <img src={member.profilePicture} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    member.username?.[0] || "C"
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white truncate text-xs">
                                    {member.fullName || member.username}
                                  </div>
                                  <div className="text-[11px] text-on-surface-variant font-mono truncate">
                                    @{member.username}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  member.role === "ORG_ADMIN"
                                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                    : member.role === "ORG_PARTNER"
                                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                    : "bg-surface-container-high text-on-surface-variant border border-white/10"
                                }`}>
                                  {member.role === "ORG_ADMIN" ? "Admin" : member.role === "ORG_PARTNER" ? "Instructor" : "Peer Cadet"}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleCopyInviteForPeer(member)}
                                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-tertiary hover:text-surface-container-lowest text-on-surface-variant border border-white/10 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                                  title={`Copy invite for @${member.username}`}
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {isCopied ? "check" : "share"}
                                  </span>
                                  <span>{isCopied ? "Copied!" : "Invite"}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </ParallaxReveal>
        ) : (
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
                <div className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border-2 border-primary/50 bg-surface-container-low/90 backdrop-blur-xl shadow-xl">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
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
                      <span className="text-primary font-bold">Quiz Review & Leaderboard</span>
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
                <div className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border border-outline-variant/40 bg-surface-container-low/80 backdrop-blur-xl hover:border-secondary/60 transition-all shadow-xl">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-secondary/70" />

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
                          className="w-full bg-surface-container-high text-on-surface border border-outline-variant/50 rounded-lg px-2.5 py-1.5 text-xs outline-none"
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
                <div className="rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden border border-tertiary/40 bg-surface-container-low/80 backdrop-blur-xl shadow-xl">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-tertiary" />
                  <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-tertiary/15 blur-3xl pointer-events-none" />

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container/30 text-tertiary-fixed border border-tertiary/40 font-label-code text-xs uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-tertiary" />
                        {accessMode === "PUBLIC" ? "Async • Public Access" : accessMode === "PRIVATE" ? "Async • Private Access" : "Async • Org Restricted"}
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
        )}

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
                  onChange={(e) => handleToggleSecurity("antiCheat", e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary cursor-pointer"
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
                  onChange={(e) => handleToggleSecurity("fullScreenLock", e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary cursor-pointer"
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
                  onChange={(e) => handleToggleSecurity("shuffleChoices", e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary cursor-pointer"
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
                  onChange={(e) => handleToggleSecurity("allowRetries", e.target.checked)}
                  className="rounded border-outline-variant bg-surface-container text-primary cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0b0f19] border border-primary/40 rounded-3xl p-6 sm:p-7 max-w-sm w-full text-center space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="font-headline-sm text-sm text-primary font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">qr_code_2</span>
                <span>Instant Room QR Portal</span>
              </span>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Scan with any mobile device camera to navigate directly into this quiz room.
            </p>

            <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-primary/20">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code for PIN ${pin}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-black text-xs gap-2">
                  <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
                  <span>Generating QR...</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-label-code text-xs text-on-surface-variant">
                Universal Game PIN
              </div>
              <div className="font-stat-counter text-2xl text-primary font-extrabold tracking-widest">
                {pin}
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {qrCodeDataUrl && (
                <a
                  href={qrCodeDataUrl}
                  download={`quiz-room-pin-${pin.replace(/\D/g, "")}.png`}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Download QR Image</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full py-2 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-label-code transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-tertiary">content_copy</span>
                <span>{copiedUrl ? "Copied Direct Link!" : "Copy Direct Join Link"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-1.5 text-on-surface-variant hover:text-white text-xs font-label-code cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Cover Modal */}
      {showCoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0b0f19] border border-white/15 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <span className="font-headline-sm text-sm text-white font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-tertiary">photo_library</span>
                <span>Customize Assessment Cover Image</span>
              </span>
              <button
                onClick={() => setShowCoverModal(false)}
                className="text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Enter any high-resolution image URL (Wikimedia, Unsplash, or custom CDN) to use as the visual cover for this assessment.
            </p>

            {coverError && (
              <div className="p-3 rounded-xl bg-error/20 border border-error/50 text-error text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{coverError}</span>
              </div>
            )}

            {/* Live Preview */}
            <div className="w-full h-44 rounded-2xl overflow-hidden bg-black/40 border border-white/10 relative">
              <img
                src={coverInputUrl.trim() || coverImage || "/stitch/screen-6-cosmic-portal-3d.png"}
                alt="Cover Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/stitch/screen-6-cosmic-portal-3d.png";
                }}
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-tertiary">
                LIVE PREVIEW
              </div>
            </div>

            <form onSubmit={handleSaveCover} className="space-y-4">
              <div>
                <label className="block text-[11px] font-label-code text-on-surface-variant mb-1">
                  Image Direct URL:
                </label>
                <input
                  type="url"
                  required
                  value={coverInputUrl}
                  onChange={(e) => setCoverInputUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or https://upload.wikimedia.org/..."
                  className="w-full bg-white/[0.04] text-white border border-white/15 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-tertiary transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCoverModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCover || !coverInputUrl.trim()}
                  className="px-5 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 disabled:opacity-40 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>{isSavingCover ? "Saving..." : "Save Cover Image"}</span>
                </button>
              </div>
            </form>
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
