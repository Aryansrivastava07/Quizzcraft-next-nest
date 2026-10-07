"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import AuthFooter from "@/components/layout/AuthFooter";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import { useAuth } from "@/lib/auth/auth-context";
import { profileService } from "@/lib/api/profile-service";
import { authService } from "@/lib/api/auth-service";
import { formatApiError } from "@/lib/api/client";
import { UserSettings } from "@/lib/api/types";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

type ActiveTab =
  | "profile"
  | "my-quizzes"
  | "quiz-attempted"
  | "faqs"
  | "contact-support"
  | "notifications"
  | "settings"
  | "security";

function ProfileContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as ActiveTab) || "profile";
  const [currentTab, setCurrentTab] = useState<ActiveTab>(initialTab);

  // Sync tab with URL search parameter if changed
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") as ActiveTab;
    if (
      tabFromUrl &&
      [
        "profile",
        "my-quizzes",
        "quiz-attempted",
        "faqs",
        "contact-support",
        "notifications",
        "settings",
        "security",
      ].includes(tabFromUrl)
    ) {
      setCurrentTab(tabFromUrl);
    }
  }, [searchParams]);

  const { user, isLoading: authLoading, logout, refreshUser } = useAuth();
  const [backendProfileLoading, setBackendProfileLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Profile form state initialized strictly from real auth user
  const [fullName, setFullName] = useState(user?.username || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [institution, setInstitution] = useState("");
  const [bio, setBio] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [address, setAddress] = useState("");
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || "");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [userXp, setUserXp] = useState<number>(user?.xp || 0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Multi-email & Institutional Credentials state
  const [linkedEmails, setLinkedEmails] = useState<string[]>(
    user?.emails || (user?.email ? [user.email] : [])
  );
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [showAddEmailForm, setShowAddEmailForm] = useState(false);
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);
  const [linkEmailError, setLinkEmailError] = useState<string | null>(null);
  const [unlinkingEmail, setUnlinkingEmail] = useState<string | null>(null);

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Real-time debounced username availability state
  const [usernameCheck, setUsernameCheck] = useState<{
    status: "idle" | "checking" | "available" | "taken" | "invalid";
    message: string;
  }>({ status: "idle", message: "" });

  // Settings & Preferences state
  const [settings, setSettings] = useState<UserSettings>({
    starfieldMotion: true,
    highContrast: false,
    kioskAutoLock: true,
    liveArenaInvites: true,
    leaderboardSurgeAlerts: true,
    weeklyDigest: true,
  });

  // Support ticket form state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("Technical & Live Arena");
  const [ticketUrgency, setTicketUrgency] = useState("Normal");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmittedId, setTicketSubmittedId] = useState<string | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // FAQs search and category state
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCategory, setFaqCategory] = useState("All");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // My Quizzes filter & search
  const [quizSearch, setQuizSearch] = useState("");
  const [quizFilter, setQuizFilter] = useState<"ALL" | "ACTIVE" | "DRAFT">("ALL");

  // Real Created Quizzes state from Backend
  const [createdQuizzes, setCreatedQuizzes] = useState<any[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState<boolean>(true);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);

  // Real Attempted Quizzes state from Backend
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<any[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState<boolean>(true);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Reset Password workflow state (Security tab / modal)
  const [resetEmail, setResetEmail] = useState(user?.email || "");
  const [resetStep, setResetStep] = useState<"init" | "otp" | "new-password" | "success">("init");
  const [resetOtp, setResetOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetShowPassword, setResetShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetCooldown, setResetCooldown] = useState(0);
  const resetOtpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Initial sync from user auth context
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
      setResetEmail((prev) => prev || user.email);
      if (user.username) {
        setUsername(user.username);
        setFullName((prev) => prev || user.username);
      }
      if (user.profilePicture) {
        setProfilePicture(user.profilePicture);
      }
      if (typeof (user as any).xp === "number") {
        setUserXp((user as any).xp);
      }
      if (Array.isArray(user.emails) && user.emails.length > 0) {
        setLinkedEmails(user.emails);
      } else if (user.email) {
        setLinkedEmails([user.email]);
      }
    }
  }, [user]);

  // Real-time debounced username availability checking
  useEffect(() => {
    if (!username) {
      setUsernameCheck({ status: "invalid", message: "Username is required" });
      return;
    }
    const clean = username.toLowerCase().trim();
    if (!/^[a-z0-9]{3,30}$/.test(clean)) {
      setUsernameCheck({
        status: "invalid",
        message: "Must be 3-30 lowercase letters or numbers with no symbols",
      });
      return;
    }

    if (user?.username && clean === user.username.toLowerCase()) {
      setUsernameCheck({
        status: "available",
        message: "Current username",
      });
      return;
    }

    setUsernameCheck({ status: "checking", message: "Checking availability..." });
    const timer = setTimeout(async () => {
      try {
        const res = await profileService.checkUsername(clean);
        if (res?.data?.available) {
          setUsernameCheck({
            status: "available",
            message: res.data.message || "Username is available",
          });
        } else {
          setUsernameCheck({
            status: "taken",
            message: res?.data?.message || "Username is already taken",
          });
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || "Username is unavailable";
        setUsernameCheck({
          status: "taken",
          message: Array.isArray(msg) ? msg[0] : msg,
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, user?.username]);

  // Compress and resize image client-side to ensure lightweight transmission
  const compressImage = (file: File, maxWidth = 512, maxHeight = 512, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
      };
      reader.onerror = () => reject(new Error("Failed to read image"));
    });
  };

  // Handle uploading avatar file directly from device
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    if (!file.type.startsWith("image/")) {
      const msg = "Please select a valid image file (PNG, JPG, WEBP)";
      setAvatarError(msg);
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    // Check raw file size limit (e.g. max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      const msg = "Image size too large. Maximum file size is 10MB.";
      setAvatarError(msg);
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const compressedBase64 = await compressImage(file);
      setProfilePicture(compressedBase64);
      await profileService.updateProfile({
        email: user?.email || email,
        profilePicture: compressedBase64,
      });
      await refreshUser();
      setAvatarError(null);
      setToastMessage("Profile picture updated successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to update profile picture:", err);
      const isTooLarge =
        err?.statusCode === 413 ||
        err?.status === 413 ||
        err?.message?.toLowerCase().includes("too large") ||
        err?.response?.data?.message?.toLowerCase().includes("too large");
      const errorMsg = isTooLarge
        ? "Image size too large. Please select a smaller photo."
        : "Failed to upload image. Please try again.";
      setAvatarError(errorMsg);
      setToastMessage(errorMsg);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = "";
    }
  };

  // Load complete profile and settings from backend
  const loadBackendProfile = useCallback(async () => {
    const targetEmail = user?.email || email;
    if (!targetEmail) return;
    setBackendProfileLoading(true);
    try {
      const res = await profileService.getProfile(targetEmail);
      if (res?.data) {
        const d = res.data;
        if (d.username) setUsername(d.username);
        if (d.fullName) setFullName(d.fullName);
        else if (d.username) setFullName(d.username);
        if (d.email) setEmail(d.email);
        if (d.institution) setInstitution(d.institution);
        if (d.bio) setBio(d.bio);
        if (d.profilePicture) setProfilePicture(d.profilePicture);
        if (d.mobileNo) setMobileNo(String(d.mobileNo));
        if (d.address) setAddress(d.address);
        if (d.dateOfBirth) setDateOfBirth(d.dateOfBirth.slice(0, 10));
        if (typeof d.xp === "number") setUserXp(d.xp);
        if (Array.isArray(d.emails) && d.emails.length > 0) {
          setLinkedEmails(d.emails);
        } else if (d.email) {
          setLinkedEmails([d.email]);
        }

        if (d.settings) {
          setSettings(d.settings);
          if (typeof document !== "undefined") {
            document.documentElement.setAttribute(
              "data-starfield-motion",
              String(d.settings.starfieldMotion)
            );
            document.documentElement.setAttribute(
              "data-high-contrast",
              String(d.settings.highContrast)
            );
          }
        }
        setBackendError(null);
      }
    } catch (err: any) {
      setBackendError(formatApiError(err));
    } finally {
      setBackendProfileLoading(false);
    }
  }, [user?.email, email]);

  const loadCreatedQuizzes = useCallback(async () => {
    setQuizzesLoading(true);
    setQuizzesError(null);
    try {
      const res = await profileService.getQuizzes();
      if (res?.data?.quizzes) {
        const mapped = res.data.quizzes.map((q: any) => ({
          id: q.quizId || q._id,
          title: q.title || "AI Generated Quiz",
          questionsCount: q.questions?.length || 0,
          playsCount: 0,
          avgScore: q.isDeployed ? "Active" : "Draft",
          status: q.isDeployed ? (q.status || "DEPLOYED") : "DRAFT",
          isDeployed: Boolean(q.isDeployed),
          topic: q.questions?.[0]?.question ? "AI & Science" : "General Study",
          date: q.createdAt
            ? new Date(q.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Active Node",
        }));
        setCreatedQuizzes(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load quizzes:", err);
      setQuizzesError(formatApiError(err));
    } finally {
      setQuizzesLoading(false);
    }
  }, []);

  const loadAttemptedQuizzes = useCallback(async () => {
    setAttemptsLoading(true);
    setAttemptsError(null);
    try {
      const res = await profileService.getHistory();
      const rawHistory = res?.data?.history || res?.data?.quizzes || [];
      const mapped = rawHistory.map((attempt: any) => {
        const totalQ = attempt.totalQuestions || attempt.Responses?.length || 10;
        const scoreVal = typeof attempt.score === "number" ? attempt.score : 0;
        const scorePct = totalQ > 0 ? `${Math.round((scoreVal / totalQ) * 100)}%` : "0%";
        const xpEarned = scoreVal * 150;
        const status = attempt.isActive
          ? "IN PROGRESS"
          : scoreVal / totalQ >= 0.8
          ? "EXCELLENT"
          : "COMPLETED";

        return {
          title: attempt.title || "Interactive Arena Challenge",
          sessionCode: attempt.sessionId
            ? `SES-${attempt.sessionId.slice(0, 8).toUpperCase()}`
            : "ACTIVE-RUN",
          scorePct,
          correctAnswers: `${scoreVal}/${totalQ}`,
          xpEarned,
          timeSpent: "Active Session",
          rank: attempt.isActive ? "Active" : "Evaluated",
          date: attempt.lastUpdateAt
            ? new Date(attempt.lastUpdateAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recent",
          status,
          sessionId: attempt.sessionId,
          quizId: attempt.quizId,
        };
      });
      setAttemptedQuizzes(mapped);
    } catch (err: any) {
      console.error("Failed to load attempts:", err);
      setAttemptsError(formatApiError(err));
    } finally {
      setAttemptsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackendProfile();
    loadCreatedQuizzes();
    loadAttemptedQuizzes();
  }, [loadBackendProfile, loadCreatedQuizzes, loadAttemptedQuizzes]);

  // Handle saving profile changes to backend
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackendError(null);

    const cleanUsername = username.toLowerCase().trim();
    if (!/^[a-z0-9]{3,30}$/.test(cleanUsername)) {
      setToastMessage("Username must contain only lowercase letters and numbers (3-30 characters)");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (usernameCheck.status === "taken") {
      setToastMessage("Please choose an available username before saving");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    try {
      await profileService.updateProfile({
        email,
        userName: cleanUsername,
        fullName,
        institution,
        bio,
        profilePicture,
        mobileNo: mobileNo ? Number(mobileNo) : null,
        address,
        dateOfBirth: dateOfBirth || null,
        xp: userDatabaseXp,
      });
      await refreshUser();
      setToastMessage("Profile settings updated successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setBackendError(formatApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle linking institutional / additional email
  const handleLinkNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkEmailError(null);
    const clean = newOrgEmail.trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setLinkEmailError("Please provide a valid email address");
      return;
    }
    if (linkedEmails.includes(clean)) {
      setLinkEmailError("This email is already linked to your account");
      return;
    }

    setIsLinkingEmail(true);
    try {
      const res = await profileService.linkEmail(clean);
      if (res?.data?.emails) {
        setLinkedEmails(res.data.emails);
      } else {
        setLinkedEmails((prev) => [...prev, clean]);
      }
      await refreshUser();
      setNewOrgEmail("");
      setShowAddEmailForm(false);
      setToastMessage("Institutional / Secondary email linked successfully!");
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error("Failed to link email:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to link email. It might already belong to another account.";
      setLinkEmailError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsLinkingEmail(false);
    }
  };

  // Handle unlinking secondary email
  const handleUnlinkEmail = async (emailToRemove: string) => {
    if (emailToRemove === user?.email || emailToRemove === email) {
      setToastMessage("Primary account email cannot be unlinked.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setUnlinkingEmail(emailToRemove);
    try {
      const res = await profileService.unlinkEmail(emailToRemove);
      if (res?.data?.emails) {
        setLinkedEmails(res.data.emails);
      } else {
        setLinkedEmails((prev) => prev.filter((e) => e !== emailToRemove));
      }
      await refreshUser();
      setToastMessage(`Email ${emailToRemove} unlinked.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to unlink email:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to unlink email.";
      setToastMessage(Array.isArray(msg) ? msg[0] : msg);
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setUnlinkingEmail(null);
    }
  };

  // Handle saving a single setting change immediately to backend
  const handleToggleSetting = async (key: keyof UserSettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    if (typeof document !== "undefined") {
      if (key === "starfieldMotion") {
        document.documentElement.setAttribute("data-starfield-motion", String(value));
      }
      if (key === "highContrast") {
        document.documentElement.setAttribute("data-high-contrast", String(value));
      }
    }

    try {
      await profileService.updateSettings({ [key]: value });
      setToastMessage("Preferences updated in database");
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err: any) {
      console.error("Failed to update setting in database:", err);
      setToastMessage("Notice: Setting saved locally");
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Handle support ticket submission
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    setIsSubmittingTicket(true);
    setBackendError(null);
    try {
      const res = await profileService.createTicket({
        category: ticketCategory,
        urgency: ticketUrgency,
        subject: ticketSubject,
        message: ticketMessage,
      });
      const generatedId =
        res?.data?.ticketId || `TICK-${Math.floor(1000 + Math.random() * 9000)}-QC`;
      setTicketSubmittedId(generatedId);
      setToastMessage(
        `Support ticket ${generatedId} submitted! Confirmation email dispatched.`
      );
      setTicketSubject("");
      setTicketMessage("");
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      setBackendError(formatApiError(err));
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Reset Password Cooldown Timer
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const interval = setInterval(() => {
      setResetCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetCooldown]);

  // Focus OTP first input when step changes to 'otp'
  useEffect(() => {
    if (resetStep === "otp") {
      setTimeout(() => {
        resetOtpInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [resetStep]);

  // Reset OTP input change handler
  const handleResetOtpChange = (index: number, val: string) => {
    const clean = val.replace(/[^0-9]/g, "");
    if (!clean) {
      const copy = [...resetOtp];
      copy[index] = "";
      setResetOtp(copy);
      return;
    }

    if (clean.length === 1) {
      const copy = [...resetOtp];
      copy[index] = clean;
      setResetOtp(copy);
      if (index < 5) {
        resetOtpInputsRef.current[index + 1]?.focus();
      }
    } else if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split("");
      const copy = [...resetOtp];
      pasted.forEach((d, idx) => {
        if (index + idx < 6) copy[index + idx] = d;
      });
      setResetOtp(copy);
      const nextIdx = Math.min(index + pasted.length, 5);
      resetOtpInputsRef.current[nextIdx]?.focus();
    }
  };

  const handleResetOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !resetOtp[index] && index > 0) {
      resetOtpInputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      resetOtpInputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      resetOtpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleResetOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split("");
    const copy = [...resetOtp];
    digits.forEach((d, idx) => {
      if (idx < 6) copy[idx] = d;
    });
    setResetOtp(copy);
    const targetIdx = Math.min(digits.length, 5);
    resetOtpInputsRef.current[targetIdx]?.focus();
  };

  // Step 1: Send Password Reset Mail with OTP
  const handleSendResetOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = (resetEmail || user?.email || email || "").trim();
    if (!targetEmail) {
      setResetError("Please select or enter a valid email address.");
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccessMessage(null);
    try {
      await authService.sendPasswordResetMail({ email: targetEmail });
      setResetSuccessMessage(`A 6-digit cryptographic verification code has been dispatched to ${targetEmail}`);
      setResetStep("otp");
      setResetCooldown(60);
      setResetOtp(["", "", "", "", "", ""]);
    } catch (err: any) {
      console.error("Failed to send reset email:", err);
      setResetError(formatApiError(err));
    } finally {
      setResetLoading(false);
    }
  };

  // Resend Password Reset OTP
  const handleResendResetOtp = async () => {
    if (resetCooldown > 0 || resetLoading) return;
    const targetEmail = (resetEmail || user?.email || email || "").trim();
    if (!targetEmail) return;

    setResetLoading(true);
    setResetError(null);
    try {
      await authService.resendPasswordResetOTP({ email: targetEmail });
      setResetSuccessMessage(`A fresh 6-digit verification code was dispatched to ${targetEmail}`);
      setResetCooldown(60);
      setResetOtp(["", "", "", "", "", ""]);
      resetOtpInputsRef.current[0]?.focus();
    } catch (err: any) {
      setResetError(formatApiError(err));
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: Verify Password Reset OTP
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = (resetEmail || user?.email || email || "").trim();
    const fullOtp = resetOtp.join("");
    if (fullOtp.length < 6) {
      setResetError("Please enter all 6 digits of the verification code.");
      return;
    }

    setResetLoading(true);
    setResetError(null);
    try {
      await authService.verifyPasswordResetOTP({ email: targetEmail, OTP: fullOtp });
      setResetSuccessMessage("Identity verified! Set your new password below.");
      setResetStep("new-password");
    } catch (err: any) {
      setResetError(formatApiError(err));
    } finally {
      setResetLoading(false);
    }
  };

  // Step 3: Complete Password Reset
  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = (resetEmail || user?.email || email || "").trim();

    if (resetNewPassword.length < 8) {
      setResetError("Password must be at least 8 characters long.");
      return;
    }
    const hasUpper = /[A-Z]/.test(resetNewPassword);
    const hasLower = /[a-z]/.test(resetNewPassword);
    const hasNum = /[0-9]/.test(resetNewPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(resetNewPassword);
    if (!hasUpper || !hasLower || !hasNum || !hasSpecial) {
      setResetError(
        "Password must contain uppercase, lowercase, numbers, and symbols."
      );
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match. Please verify both fields.");
      return;
    }

    setResetLoading(true);
    setResetError(null);
    try {
      await authService.resetPassword({
        email: targetEmail,
        password: resetNewPassword,
      });
      setResetStep("success");
      setToastMessage("Password updated successfully!");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setResetError(formatApiError(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetWorkflowRestart = () => {
    setResetStep("init");
    setResetOtp(["", "", "", "", "", ""]);
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetError(null);
    setResetSuccessMessage(null);
  };

  // Telemetry Calculations
  const userDatabaseXp = userXp || (user as any)?.xp || 0;
  const quizEarnedXp = attemptedQuizzes.reduce((acc, curr) => acc + (curr.xpEarned || 0), 0);
  const totalExp = userDatabaseXp + quizEarnedXp;
  const avgScorePct =
    attemptedQuizzes.length > 0
      ? Math.round(
          attemptedQuizzes.reduce((sum, a) => {
            const pctNum = parseInt(a.scorePct, 10) || 0;
            return sum + pctNum;
          }, 0) / attemptedQuizzes.length
        )
      : 0;
  const excellentAttemptsCount = attemptedQuizzes.filter(
    (a) => a.status === "EXCELLENT" || parseInt(a.scorePct, 10) >= 80
  ).length;
  const winRate =
    attemptedQuizzes.length > 0
      ? `${Math.round((excellentAttemptsCount / attemptedQuizzes.length) * 100)}%`
      : "0%";

  const userLevel = Math.max(1, Math.floor(totalExp / 1000) + 1);
  const userRankTitle =
    totalExp >= 10000
      ? "Grandmaster"
      : totalExp >= 5000
      ? "Master Quizzer"
      : totalExp >= 2000
      ? "Scholar"
      : "Novice";

  const displayName = fullName || username || user?.username || "Educator";
  const displayId = (user?.userId || (user as any)?._id || "QC-USER")
    .slice(-8)
    .toUpperCase();

  // FAQs data
  const faqs = [
    {
      category: "Creating Quizzes",
      q: "How does the AI document ingestion work with PDFs and slides?",
      a: "QuizzCraft extracts raw text, mathematical formulas, and visual diagrams from PDF, DOCX, and slide decks. The AI then organizes concepts by difficulty tier and formulates balanced 3D questions with verifiable pedagogical explanations.",
    },
    {
      category: "Creating Quizzes",
      q: "Can I customize questions and answers before publishing?",
      a: "Yes! The Quiz Editor gives you complete control over question prompts, difficulty ratings (Easy, Medium, Hard), correct answer assignments, rationale explanations, and custom EXP reward values.",
    },
    {
      category: "Hosting & Arena",
      q: "What is the difference between Live Arena and Anytime Mode?",
      a: "Live Arena is a synchronized real-time competition where the host controls question timers, live leaderboards, and interactive podium celebrations. Anytime Mode allows learners to access the quiz asynchronously at their own pace using the Universal Quiz ID.",
    },
    {
      category: "Hosting & Arena",
      q: "How many cadets can participate simultaneously in a Live Room?",
      a: "QuizzCraft rooms support up to 250 simultaneous participants per room on standard accounts, and up to 2,500 on enterprise institutional tiers with sub-50ms synchronized telemetry.",
    },
    {
      category: "Scoring & Anti-Cheat",
      q: "How are EXP points, streaks, and leaderboards calculated?",
      a: "Each question awards a base EXP value (typically 150 XP). Answering consecutive questions correctly generates streak multipliers (up to 2x bonus XP), while answer speed boosts overall leaderboard rank in tiebreaker situations.",
    },
    {
      category: "Scoring & Anti-Cheat",
      q: "How does the AI Anti-Cheat and Kiosk Lock work?",
      a: "When enabled, QuizzCraft monitors tab-switching, detects split-screen multi-tasking, and enforces full-screen kiosk locks with per-cadet answer randomization.",
    },
    {
      category: "Account & Access",
      q: "Do students need to create an account to join a game?",
      a: "Students enter the 6-digit room PIN or follow a direct link, log in or authenticate, and immediately participate in the live arena.",
    },
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCat = faqCategory === "All" || faq.category === faqCategory;
    const matchesSearch =
      faq.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      faq.a.toLowerCase().includes(faqSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredCreatedQuizzes = createdQuizzes.filter((q) => {
    const matchesFilter = quizFilter === "ALL" || q.status === quizFilter;
    const matchesSearch =
      q.title.toLowerCase().includes(quizSearch.toLowerCase()) ||
      q.topic.toLowerCase().includes(quizSearch.toLowerCase()) ||
      q.id.toLowerCase().includes(quizSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen text-on-surface font-body-md selection:bg-primary selection:text-on-primary antialiased relative flex flex-col justify-between overflow-x-hidden">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Universal Top Navbar */}
      <Navbar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-surface-container-high/95 border border-primary/40 text-white text-xs font-semibold shadow-2xl backdrop-blur-xl animate-bounce">
          <span className="material-symbols-outlined text-primary text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-max-width-canvas mx-auto px-4 sm:px-8 pt-28 pb-20 flex-1 flex flex-col gap-6">
        {/* Explicit Backend Error Banner */}
        {backendError && (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-start gap-3 animate-fadeIn">
            <span className="material-symbols-outlined text-red-400 text-xl shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-red-200 text-sm">Server Communication Notice</p>
                <button
                  type="button"
                  onClick={loadBackendProfile}
                  className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Retry Connection
                </button>
              </div>
              <p className="mt-1 opacity-90 leading-relaxed break-words">{backendError}</p>
            </div>
          </div>
        )}

        {/* Profile Header Card */}
        <ParallaxReveal direction="up" distance={20} duration={650}>
          <div className="rounded-3xl p-6 sm:p-8 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-tertiary/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Left: Avatar & Identity */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
                <div className="relative group flex flex-col items-center">
                  <div className="relative">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-primary/40 p-1 bg-surface-container overflow-hidden shadow-2xl shadow-primary/30 flex items-center justify-center relative cursor-pointer group"
                      title="Click to Upload Profile Picture"
                    >
                      {profilePicture ? (
                        <img
                          src={profilePicture}
                          alt={displayName}
                          className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-headline-xl font-bold text-2xl">
                          {(displayName || "E").slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Centered Upload Overlay */}
                      <div
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200 rounded-full"
                      >
                        {isUploadingAvatar ? (
                          <span className="material-symbols-outlined text-2xl animate-spin">progress_activity</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-2xl">photo_camera</span>
                            <span className="text-[10px] font-semibold mt-0.5">Upload</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Hidden file input for uploading profile pic */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                    />

                    {/* Online Badge */}
                    <span
                      className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-surface-container-lowest shadow-md z-10"
                      title="Active Account"
                    />
                  </div>

                  {/* Explicit UI Alert if Image Size is Too Large */}
                  {avatarError && (
                    <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] font-label-code flex items-center gap-1.5 animate-fadeIn max-w-[240px] text-center justify-center">
                      <span className="material-symbols-outlined text-sm text-red-400 shrink-0">error</span>
                      <span className="leading-tight">{avatarError}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-headline-xl text-white font-bold tracking-tight">
                      {displayName}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary-container/30 text-primary-fixed border border-primary/40 font-label-code text-xs font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-primary">
                        {user?.verified ? "verified" : "shield"}
                      </span>
                      <span>{user?.verified ? "Verified Member" : "Active Member"}</span>
                    </span>
                  </div>

                  <p className="font-label-code text-xs sm:text-sm text-on-surface-variant flex items-center justify-center sm:justify-start gap-1.5">
                    <span className="text-tertiary">@{username || "user"}</span>
                    <span>•</span>
                    <span>{email || "user@quizzcraft.app"}</span>
                  </p>

                  <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs font-label-code text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-outline">
                        calendar_month
                      </span>
                      <span>
                        {user?.createdAt
                          ? `Joined ${new Date(user.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              year: "numeric",
                            })}`
                          : "Active Member"}
                      </span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-tertiary">
                        school
                      </span>
                      <span>Level {userLevel} • {userRankTitle}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Quick Launch Studio Action */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                <Link
                  href="/create"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold flex items-center justify-center gap-2 shadow-sm border border-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  <span>Create New Quiz</span>
                </Link>
                <Link
                  href="/join"
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface hover:text-white font-headline-sm text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-base text-tertiary">
                    sports_esports
                  </span>
                  <span>Join Live Game</span>
                </Link>
              </div>
            </div>
          </div>
        </ParallaxReveal>

        {/* Elevated Stat Badges (Pure real data from database) */}
        <ParallaxReveal direction="up" distance={20} delay={60} duration={700}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Pill 1: Quizzes Created */}
            <div
              onClick={() => setCurrentTab("my-quizzes")}
              className="p-4 rounded-2xl bg-surface-container-low/75 border border-primary/30 hover:border-primary/60 transition-all cursor-pointer backdrop-blur-xl group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary-container/20 border border-primary/40 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-xl">edit_document</span>
                </div>
                <div>
                  <span className="block font-label-code text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Quizzes Created
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-stat-counter text-2xl font-bold text-white">
                      {quizzesLoading ? "..." : createdQuizzes.length}
                    </span>
                    <span className="text-xs text-primary font-label-code font-semibold">
                      ({createdQuizzes.filter((q) => q.status === "ACTIVE").length} Active)
                    </span>
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all text-lg">
                arrow_forward
              </span>
            </div>

            {/* Pill 2: Average Score */}
            <div className="p-4 rounded-2xl bg-surface-container-low/75 border border-emerald-500/30 hover:border-emerald-500/60 transition-all backdrop-blur-xl shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-xl">star</span>
                </div>
                <div>
                  <span className="block font-label-code text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Average Score
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-stat-counter text-2xl font-bold text-emerald-400">
                      {attemptsLoading ? "..." : attemptedQuizzes.length > 0 ? `${avgScorePct}%` : "—"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-label-code font-bold">
                      {attemptedQuizzes.length === 0
                        ? "No Attempts"
                        : avgScorePct >= 90
                        ? "Grade A+"
                        : avgScorePct >= 75
                        ? "Grade A"
                        : avgScorePct >= 50
                        ? "Grade B"
                        : "Evaluated"}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-label-code text-emerald-400 font-bold">
                {attemptedQuizzes.length > 0 ? "Real Score" : "Pending"}
              </span>
            </div>

            {/* Pill 3: Quizzes Attempted */}
            <div
              onClick={() => setCurrentTab("quiz-attempted")}
              className="p-4 rounded-2xl bg-surface-container-low/75 border border-tertiary/30 hover:border-tertiary/60 transition-all cursor-pointer backdrop-blur-xl group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-tertiary-container/20 border border-tertiary/40 flex items-center justify-center text-tertiary group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-xl">fact_check</span>
                </div>
                <div>
                  <span className="block font-label-code text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Quizzes Attempted
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-stat-counter text-2xl font-bold text-white">
                      {attemptsLoading ? "..." : attemptedQuizzes.length}
                    </span>
                    <span className="text-xs text-tertiary font-label-code font-semibold">
                      ({winRate} Win Rate)
                    </span>
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-tertiary group-hover:translate-x-1 transition-all text-lg">
                arrow_forward
              </span>
            </div>

            {/* Pill 4: Total EXP */}
            <div className="p-4 rounded-2xl bg-surface-container-low/75 border border-amber-accent/30 hover:border-amber-accent/60 transition-all backdrop-blur-xl shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-accent/15 border border-amber-accent/40 flex items-center justify-center text-amber-accent">
                  <span className="material-symbols-outlined text-xl">military_tech</span>
                </div>
                <div>
                  <span className="block font-label-code text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Total EXP Awarded
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-stat-counter text-2xl font-bold text-amber-accent">
                      {attemptsLoading ? "..." : totalExp.toLocaleString()}
                    </span>
                    <span className="text-xs text-on-surface-variant font-label-code">XP</span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-label-code text-amber-accent font-bold">
                {userRankTitle}
              </span>
            </div>
          </div>
        </ParallaxReveal>

        {/* Main Workspace Layout (Sidebar + Dynamic Right Content) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sidebar Navigation */}
          <aside className="lg:col-span-3 flex flex-col gap-4 sticky top-24">
            <ParallaxReveal direction="up" distance={20} delay={90} duration={700}>
              <div className="rounded-2xl p-4 bg-surface-container-low/80 border border-outline-variant/30 backdrop-blur-xl shadow-2xl flex flex-col gap-5">
                {/* Group 1: Management */}
                <div className="space-y-1.5">
                  <span className="font-headline-sm text-[11px] font-bold text-outline uppercase tracking-wider px-3">
                    Management
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentTab("profile")}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "profile"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">account_circle</span>
                      <span>Profile</span>
                    </div>
                    {currentTab === "profile" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentTab("my-quizzes")}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "my-quizzes"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">edit_document</span>
                      <span>My Quizzes</span>
                    </div>
                    <span className="text-[10px] font-label-code px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      {createdQuizzes.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentTab("quiz-attempted")}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "quiz-attempted"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">fact_check</span>
                      <span>Quiz Attempted</span>
                    </div>
                    <span className="text-[10px] font-label-code px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      {attemptedQuizzes.length}
                    </span>
                  </button>
                </div>

                {/* Group 2: Support & Knowledge */}
                <div className="space-y-1.5">
                  <span className="font-headline-sm text-[11px] font-bold text-outline uppercase tracking-wider px-3">
                    Support &amp; Community
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentTab("faqs")}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "faqs"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">help</span>
                      <span>FAQs</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentTab("contact-support")}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "contact-support"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">support_agent</span>
                      <span>Contact Support</span>
                    </div>
                  </button>
                </div>

                {/* Group 3: System Preferences */}
                <div className="space-y-1.5">
                  <span className="font-headline-sm text-[11px] font-bold text-outline uppercase tracking-wider px-3">
                    Preferences
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentTab("notifications")}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "notifications"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">notifications</span>
                      <span>Notifications</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentTab("settings")}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "settings"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">settings</span>
                      <span>Settings</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab("security");
                      setResetError(null);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-headline-sm text-xs transition-all cursor-pointer ${
                      currentTab === "security"
                        ? "bg-primary-container text-white font-semibold shadow-md shadow-primary-container/30 border border-white/10"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-lg">lock_reset</span>
                      <span>Security &amp; Password</span>
                    </div>
                    {currentTab === "security" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </button>
                </div>

                {/* Sidebar Footer Logout */}
                <div className="pt-3 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-on-surface-variant hover:text-error hover:bg-error-container/10 transition-colors text-xs font-headline-sm cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">logout</span>
                      <span>Sign Out</span>
                    </span>
                    <span className="text-[10px] font-label-code text-outline">SECURE</span>
                  </button>
                </div>
              </div>
            </ParallaxReveal>
          </aside>

          {/* Right Content Area */}
          <section className="lg:col-span-9 flex flex-col gap-6">
            {/* TAB 1: PROFILE & ACCOUNT DETAILS */}
            {currentTab === "profile" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="rounded-2xl p-6 sm:p-8 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-2xl shadow-2xl space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-headline-lg font-bold text-white">
                        Account Details
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Manage your educator credentials, display persona, and security authentication
                      </p>
                    </div>
                    <span className="font-label-code text-xs px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/30 font-semibold">
                      ID: {displayId}
                    </span>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your display name"
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      {/* Username */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                            Username
                          </label>
                          <span className="text-[10px] font-label-code text-on-surface-variant">
                            lowercase alphanumeric only
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline font-label-code text-xs">
                            @
                          </span>
                          <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) =>
                              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
                            }
                            placeholder="username"
                            className={`w-full pl-8 pr-10 py-2.5 rounded-xl bg-surface-container/60 border text-on-surface text-xs focus:outline-none transition-colors ${
                              usernameCheck.status === "taken" || usernameCheck.status === "invalid"
                                ? "border-red-500/50 focus:border-red-500"
                                : usernameCheck.status === "available"
                                ? "border-emerald-500/50 focus:border-emerald-500"
                                : "border-outline-variant/40 focus:border-primary"
                            }`}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                            {usernameCheck.status === "checking" && (
                              <span className="material-symbols-outlined text-sm text-tertiary animate-spin">
                                progress_activity
                              </span>
                            )}
                            {usernameCheck.status === "available" && (
                              <span className="material-symbols-outlined text-sm text-emerald-400">
                                check_circle
                              </span>
                            )}
                            {usernameCheck.status === "taken" && (
                              <span className="material-symbols-outlined text-sm text-red-400">
                                cancel
                              </span>
                            )}
                            {usernameCheck.status === "invalid" && (
                              <span className="material-symbols-outlined text-sm text-amber-400">
                                error
                              </span>
                            )}
                          </div>
                        </div>
                        {usernameCheck.message && (
                          <p
                            className={`text-[11px] font-label-code flex items-center gap-1 ${
                              usernameCheck.status === "available"
                                ? "text-emerald-400"
                                : usernameCheck.status === "taken"
                                ? "text-red-400"
                                : usernameCheck.status === "checking"
                                ? "text-tertiary"
                                : "text-amber-400"
                            }`}
                          >
                            {usernameCheck.message}
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                            Email Address
                          </label>
                          <span className="text-[10px] text-emerald-400 font-label-code font-bold">
                            ✓ Verified
                          </span>
                        </div>
                        <input
                          type="email"
                          required
                          disabled
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-container/40 border border-outline-variant/30 text-on-surface/80 text-xs focus:outline-none cursor-not-allowed"
                        />
                      </div>

                      {/* Institution / Department */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Affiliated Institution
                        </label>
                        <input
                          type="text"
                          value={institution}
                          onChange={(e) => setInstitution(e.target.value)}
                          placeholder="University, school, or organization"
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      {/* Mobile No */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Phone Number (Optional)
                        </label>
                        <input
                          type="tel"
                          value={mobileNo}
                          onChange={(e) => setMobileNo(e.target.value)}
                          placeholder="e.g. +1 555-0199"
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      {/* Address / Location */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Base Location
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="City, Country"
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      {/* Date of Birth */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      {/* XP Points */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Total Account XP
                        </label>
                        <div className="w-full px-4 py-2.5 rounded-xl bg-surface-container/40 border border-outline-variant/30 text-amber-accent text-xs font-label-code font-bold flex items-center justify-between">
                          <span>{totalExp.toLocaleString()} XP</span>
                          <span className="text-[10px] text-on-surface-variant font-normal">Level {userLevel} • {userRankTitle}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                        Curator Bio &amp; Pedagogical Specialty
                      </label>
                      <textarea
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell students and colleagues about your academic specialty..."
                        className="w-full p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors resize-none"
                      />
                    </div>

                    {/* Linked Authentication & Institutional Emails */}
                    <div className="pt-4 border-t border-outline-variant/20 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="block text-xs font-headline-sm font-semibold text-white uppercase tracking-wider">
                            Linked Authentication &amp; Institutional Emails
                          </span>
                          <p className="text-[11px] font-label-code text-on-surface-variant mt-0.5">
                            Log in with any linked email and seamlessly access private organization quizzes matching your domain.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddEmailForm(!showAddEmailForm);
                            setLinkEmailError(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container border border-outline-variant/40 text-tertiary font-headline-sm text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {showAddEmailForm ? "close" : "add_link"}
                          </span>
                          <span>{showAddEmailForm ? "Cancel" : "Link Institutional Email"}</span>
                        </button>
                      </div>

                      {/* Add Institutional Email Form */}
                      {showAddEmailForm && (
                        <div className="p-4 rounded-2xl bg-surface-container/80 border border-primary/40 space-y-3 animate-fadeIn">
                          <span className="text-xs font-semibold text-white uppercase tracking-wider font-label-code block">
                            Link New Institutional / Alternate Email
                          </span>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="email"
                              value={newOrgEmail}
                              onChange={(e) => setNewOrgEmail(e.target.value)}
                              placeholder="e.g. cadet@mit.edu or researcher@company.com"
                              className="flex-1 px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={handleLinkNewEmail}
                              disabled={isLinkingEmail || !newOrgEmail.trim()}
                              className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 text-white font-headline-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                            >
                              {isLinkingEmail ? (
                                <>
                                  <span className="material-symbols-outlined text-sm animate-spin">
                                    progress_activity
                                  </span>
                                  <span>Linking...</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-sm">add</span>
                                  <span>Link Email</span>
                                </>
                              )}
                            </button>
                          </div>
                          {linkEmailError && (
                            <p className="text-xs text-red-400 font-label-code flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              <span>{linkEmailError}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Grid of linked emails */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Array.from(new Set(linkedEmails.length > 0 ? linkedEmails : [email])).map(
                          (emailItem) => {
                            const isPrimary = emailItem === (user?.email || email);
                            const domain = emailItem.split("@")[1] || "quizzcraft.app";
                            return (
                              <div
                                key={emailItem}
                                className="p-3.5 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-center justify-between text-xs gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-primary shrink-0">
                                    <span className="material-symbols-outlined text-base">
                                      {isPrimary ? "verified_user" : "corporate_fare"}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-white block truncate">
                                        {emailItem}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-on-surface-variant font-label-code">
                                      Domain: @{domain}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isPrimary ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-label-code text-[10px] font-bold">
                                      Primary
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleUnlinkEmail(emailItem)}
                                      disabled={unlinkingEmail === emailItem}
                                      className="p-1 text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                      title="Unlink this email"
                                    >
                                      {unlinkingEmail === emailItem ? (
                                        <span className="material-symbols-outlined text-sm animate-spin">
                                          progress_activity
                                        </span>
                                      ) : (
                                        <span className="material-symbols-outlined text-sm">
                                          delete
                                        </span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Account Security & Password Reset Quick Access Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/30 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-container/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-xl">lock_reset</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-white text-sm">
                              Account Security &amp; Credentials
                            </span>
                            <span className="text-[11px] text-on-surface-variant font-label-code">
                              Password protected with bcrypt &amp; 2FA cryptographic email verification
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTab("security");
                            setResetStep("init");
                            setResetError(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-primary-container/20 hover:bg-primary-container/30 border border-primary/40 text-primary hover:text-white font-headline-sm text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                        >
                          <span className="material-symbols-outlined text-base">vpn_key</span>
                          <span>Reset Password</span>
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {usernameCheck.status === "available" && (
                          <span className="text-xs text-emerald-400 font-label-code flex items-center gap-1 font-semibold">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            Credentials valid &amp; ready
                          </span>
                        )}
                        {usernameCheck.status === "taken" && (
                          <span className="text-xs text-red-400 font-label-code flex items-center gap-1 font-semibold">
                            <span className="material-symbols-outlined text-xs">cancel</span>
                            Username already taken
                          </span>
                        )}
                        {usernameCheck.status === "invalid" && (
                          <span className="text-xs text-amber-400 font-label-code flex items-center gap-1 font-semibold">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            Check username format
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setFullName(user?.username || "");
                            setUsername(user?.username || "");
                            setEmail(user?.email || "");
                            setInstitution("");
                            setBio("");
                            setMobileNo("");
                            setAddress("");
                            setDateOfBirth("");
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-headline-sm transition-colors cursor-pointer"
                        >
                          Clear Edits
                        </button>
                        <button
                          type="submit"
                          disabled={
                            isSaving ||
                            usernameCheck.status === "taken" ||
                            usernameCheck.status === "invalid" ||
                            usernameCheck.status === "checking"
                          }
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {isSaving ? (
                            <>
                              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-base">save</span>
                              <span>Save Changes</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </ParallaxReveal>
            )}

            {/* TAB 2: MY QUIZZES (QUIZ CREATED) */}
            {currentTab === "my-quizzes" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="space-y-4">
                  {/* Header & Filter Bar */}
                  <div className="rounded-2xl p-5 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-xl shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <div className="relative w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                          search
                        </span>
                        <input
                          type="text"
                          value={quizSearch}
                          onChange={(e) => setQuizSearch(e.target.value)}
                          placeholder="Search your created quizzes..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-container-high/70 border border-outline-variant/30 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="inline-flex p-1 rounded-full bg-surface-container-high border border-outline-variant/30 text-xs font-headline-sm">
                        <button
                          type="button"
                          onClick={() => setQuizFilter("ALL")}
                          className={`px-3 py-1 rounded-full font-semibold transition-all ${
                            quizFilter === "ALL"
                              ? "bg-primary text-on-primary shadow-sm"
                              : "text-on-surface-variant hover:text-white"
                          }`}
                        >
                          All ({createdQuizzes.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuizFilter("ACTIVE")}
                          className={`px-3 py-1 rounded-full font-semibold transition-all ${
                            quizFilter === "ACTIVE"
                              ? "bg-primary text-on-primary shadow-sm"
                              : "text-on-surface-variant hover:text-white"
                          }`}
                        >
                          Active ({createdQuizzes.filter((q) => q.status === "ACTIVE").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuizFilter("DRAFT")}
                          className={`px-3 py-1 rounded-full font-semibold transition-all ${
                            quizFilter === "DRAFT"
                              ? "bg-primary text-on-primary shadow-sm"
                              : "text-on-surface-variant hover:text-white"
                          }`}
                        >
                          Drafts ({createdQuizzes.filter((q) => q.status === "DRAFT").length})
                        </button>
                      </div>

                      <Link
                        href="/create"
                        className="px-3.5 py-1.5 rounded-full bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-xs flex items-center gap-1 shadow-sm border border-white/10 active:scale-95 transition-all shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>New Quiz</span>
                      </Link>
                    </div>
                  </div>

                  {/* Quizzes Loading State */}
                  {quizzesLoading && (
                    <div className="rounded-2xl p-12 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-xl shadow-lg flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <p className="font-headline-sm text-sm font-semibold text-white">
                        Loading Created Quizzes...
                      </p>
                      <p className="font-label-code text-xs text-on-surface-variant">
                        Querying database records from backend repository
                      </p>
                    </div>
                  )}

                  {/* Quizzes Error State */}
                  {!quizzesLoading && quizzesError && (
                    <div className="rounded-2xl p-6 bg-red-500/15 border border-red-500/40 backdrop-blur-xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-red-400 text-2xl shrink-0 mt-0.5">
                          error
                        </span>
                        <div>
                          <h4 className="font-headline-sm font-bold text-red-200 text-sm">
                            Failed to Load Quizzes
                          </h4>
                          <p className="font-body-md text-xs text-red-300/90 mt-0.5">
                            {quizzesError}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={loadCreatedQuizzes}
                        className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 font-headline-sm text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {/* Quizzes Empty State */}
                  {!quizzesLoading && !quizzesError && filteredCreatedQuizzes.length === 0 && (
                    <div className="rounded-2xl p-12 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-xl shadow-lg flex flex-col items-center justify-center text-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-surface-container-high/80 border border-outline-variant/40 flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-3xl text-primary">
                          edit_document
                        </span>
                      </div>
                      <div className="max-w-md space-y-1">
                        <h3 className="font-headline-md text-base font-bold text-white">
                          {quizSearch || quizFilter !== "ALL"
                            ? "No Matching Quizzes Found"
                            : "No Quizzes Created Yet"}
                        </h3>
                        <p className="font-body-md text-xs text-on-surface-variant">
                          {quizSearch || quizFilter !== "ALL"
                            ? "No quizzes match your active search or filter criteria. Try adjusting your query."
                            : "Generate your first AI-crafted assessment from documents, topics, or custom prompts."}
                        </p>
                      </div>
                      <Link
                        href="/create"
                        className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 border border-white/10 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">add_circle</span>
                        <span>Create New Quiz</span>
                      </Link>
                    </div>
                  )}

                  {/* Quizzes List */}
                  {!quizzesLoading && !quizzesError && filteredCreatedQuizzes.length > 0 && (
                    <div className="space-y-3">
                      {filteredCreatedQuizzes.map((quiz) => (
                        <div
                          key={quiz.id}
                          className="rounded-2xl p-5 bg-surface-container-low/75 border border-outline-variant/30 hover:border-primary/40 backdrop-blur-xl shadow-lg transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-label-code text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-high text-tertiary border border-outline-variant/40 font-bold">
                                {quiz.id}
                              </span>
                              <span
                                className={`text-[10px] font-label-code px-2 py-0.5 rounded font-bold uppercase ${
                                  quiz.status === "DRAFT"
                                    ? "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                                    : quiz.status === "LIVE"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                }`}
                              >
                                {quiz.status}
                              </span>
                              <span className="text-[11px] font-label-code text-on-surface-variant">
                                {quiz.topic}
                              </span>
                            </div>

                            <h3 className="text-base sm:text-lg font-headline-sm font-bold text-white group-hover:text-primary-fixed transition-colors">
                              {quiz.title}
                            </h3>

                            <div className="flex items-center gap-4 text-xs font-label-code text-on-surface-variant pt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-primary">
                                  quiz
                                </span>
                                <span>{quiz.questionsCount} Questions</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-tertiary">
                                  calendar_month
                                </span>
                                <span>{quiz.date}</span>
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-outline-variant/20 font-headline-sm text-xs">
                            <Link
                              href={`/quiz/review/${quiz.id}`}
                              className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-outline-variant/30 text-on-surface hover:text-white flex items-center gap-1 transition-all"
                              title="View Leaderboard & Review"
                            >
                              <span className="material-symbols-outlined text-sm text-tertiary">
                                leaderboard
                              </span>
                              <span>Review</span>
                            </Link>

                            <Link
                              href={`/editor?quizId=${quiz.id}`}
                              className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-outline-variant/30 text-on-surface hover:text-white flex items-center gap-1 transition-all"
                            >
                              <span className="material-symbols-outlined text-sm text-primary">
                                edit
                              </span>
                              <span>Edit</span>
                            </Link>

                            <Link
                              href={`/deploy?quizId=${quiz.id}`}
                              className="px-3 py-1.5 rounded-xl bg-primary-container hover:bg-primary-container/90 border border-white/10 text-white flex items-center gap-1 shadow-sm transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">
                                rocket_launch
                              </span>
                              <span>Deploy</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ParallaxReveal>
            )}

            {/* TAB 3: QUIZ ATTEMPTED */}
            {currentTab === "quiz-attempted" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="space-y-4">
                  {/* Summary Banner */}
                  <div className="rounded-2xl p-5 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-headline-lg font-bold text-white">
                        Performance &amp; Attempt History
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Historical telemetry, accuracy scores, and solutions breakdown for past quizzes
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-label-code">
                      <div className="bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/30 text-center">
                        <span className="text-[10px] text-on-surface-variant block">TOTAL ATTEMPTS</span>
                        <span className="text-primary font-bold font-stat-counter text-sm">
                          {attemptedQuizzes.length}
                        </span>
                      </div>
                      <div className="bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/30 text-center">
                        <span className="text-[10px] text-on-surface-variant block">WIN RATE</span>
                        <span className="text-emerald-400 font-bold font-stat-counter text-sm">
                          {winRate}
                        </span>
                      </div>
                      <div className="bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/30 text-center">
                        <span className="text-[10px] text-on-surface-variant block">TOTAL EXP</span>
                        <span className="text-amber-accent font-bold font-stat-counter text-sm">
                          +{totalExp.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attempts Loading State */}
                  {attemptsLoading && (
                    <div className="rounded-2xl p-12 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-xl shadow-lg flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-10 h-10 border-2 border-tertiary/30 border-t-tertiary rounded-full animate-spin" />
                      <p className="font-headline-sm text-sm font-semibold text-white">
                        Loading Cadet Telemetry...
                      </p>
                      <p className="font-label-code text-xs text-on-surface-variant">
                        Synchronizing participation history and scores from backend
                      </p>
                    </div>
                  )}

                  {/* Attempts Error State */}
                  {!attemptsLoading && attemptsError && (
                    <div className="rounded-2xl p-6 bg-red-500/15 border border-red-500/40 backdrop-blur-xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-red-400 text-2xl shrink-0 mt-0.5">
                          error
                        </span>
                        <div>
                          <h4 className="font-headline-sm font-bold text-red-200 text-sm">
                            Failed to Load Attempts
                          </h4>
                          <p className="font-body-md text-xs text-red-300/90 mt-0.5">
                            {attemptsError}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={loadAttemptedQuizzes}
                        className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 font-headline-sm text-xs font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        <span>Retry Sync</span>
                      </button>
                    </div>
                  )}

                  {/* Attempts Empty State */}
                  {!attemptsLoading && !attemptsError && attemptedQuizzes.length === 0 && (
                    <div className="rounded-2xl p-12 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-xl shadow-lg flex flex-col items-center justify-center text-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-surface-container-high/80 border border-outline-variant/40 flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-3xl text-tertiary">
                          fact_check
                        </span>
                      </div>
                      <div className="max-w-md space-y-1">
                        <h3 className="font-headline-md text-base font-bold text-white">
                          No Quiz Attempts Recorded
                        </h3>
                        <p className="font-body-md text-xs text-on-surface-variant">
                          You haven&apos;t participated in any arena sessions yet. Join an active room with a game PIN to compete and earn EXP.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href="/join"
                          className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-base">pin</span>
                          <span>Join Live Arena</span>
                        </Link>
                        <Link
                          href="/create"
                          className="px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-bright text-white border border-outline-variant/40 font-headline-sm text-xs font-semibold flex items-center gap-2 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                          <span>Create Quiz</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Attempts Cards */}
                  {!attemptsLoading && !attemptsError && attemptedQuizzes.length > 0 && (
                    <div className="space-y-3">
                      {attemptedQuizzes.map((attempt, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl p-5 bg-surface-container-low/75 border border-outline-variant/30 hover:border-tertiary/40 backdrop-blur-xl shadow-lg transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-label-code text-[11px] px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-bold">
                                {attempt.sessionCode}
                              </span>
                              <span className="text-[10px] font-label-code px-2 py-0.5 rounded bg-tertiary/15 text-tertiary font-bold uppercase border border-tertiary/25">
                                {attempt.status}
                              </span>
                              <span className="text-xs font-label-code text-on-surface-variant">
                                {attempt.date}
                              </span>
                            </div>

                            <h3 className="text-base sm:text-lg font-headline-sm font-bold text-white">
                              {attempt.title}
                            </h3>

                            <div className="flex items-center gap-4 text-xs font-label-code text-on-surface-variant pt-1 flex-wrap">
                              <span className="text-emerald-400 font-bold">
                                Score: {attempt.scorePct} ({attempt.correctAnswers})
                              </span>
                              <span>•</span>
                              <span className="text-amber-accent font-semibold">
                                +{attempt.xpEarned} XP
                              </span>
                              <span>•</span>
                              <span>{attempt.rank}</span>
                              <span>•</span>
                              <span>Duration: {attempt.timeSpent}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-outline-variant/20">
                            {attempt.quizId && (
                              <>
                                <Link
                                  href={`/quiz/review/${attempt.quizId}`}
                                  className="px-3.5 py-1.5 rounded-xl bg-surface-container/60 hover:bg-surface-bright border border-outline-variant/40 text-on-surface hover:text-white font-headline-sm text-xs flex items-center gap-1.5 transition-all"
                                >
                                  <span className="material-symbols-outlined text-sm text-tertiary">
                                    leaderboard
                                  </span>
                                  <span>Leaderboard</span>
                                </Link>

                                <Link
                                  href={`/quiz?quizId=${attempt.quizId}`}
                                  className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-bright border border-outline-variant/40 text-on-surface hover:text-white font-headline-sm text-xs flex items-center gap-1.5 transition-all"
                                >
                                  <span className="material-symbols-outlined text-sm text-primary">
                                    replay
                                  </span>
                                  <span>Retry</span>
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ParallaxReveal>
            )}

            {/* TAB 4: FAQS */}
            {currentTab === "faqs" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="space-y-4">
                  {/* FAQs Header & Search */}
                  <div className="rounded-2xl p-6 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-2xl shadow-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-headline-lg font-bold text-white">
                          Frequently Asked Questions
                        </h2>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Instant answers regarding scoring, Live Arena orchestration, and AI document ingestion
                        </p>
                      </div>
                      <Link
                        href="/create"
                        className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        <span>Launch Studio</span>
                      </Link>
                    </div>

                    {/* Search & Category Pills */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-sm">
                          search
                        </span>
                        <input
                          type="text"
                          value={faqSearch}
                          onChange={(e) => setFaqSearch(e.target.value)}
                          placeholder="Search guides, scoring mechanics, anti-cheat..."
                          className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-headline-sm text-xs">
                        {["All", "Creating Quizzes", "Hosting & Arena", "Scoring & Anti-Cheat"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setFaqCategory(cat)}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                              faqCategory === cat
                                ? "bg-surface-container-high text-white border border-primary/40"
                                : "text-on-surface-variant hover:text-white bg-surface-container/40"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Items */}
                  <div className="space-y-2.5">
                    {filteredFaqs.map((faq, index) => {
                      const isOpen = openFaqIndex === index;
                      return (
                        <div
                          key={index}
                          className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/75 overflow-hidden transition-all shadow-md"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                            className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-code text-[10px] font-bold shrink-0">
                                {faq.category}
                              </span>
                              <span className="font-headline-sm font-semibold text-xs sm:text-sm text-white">
                                {faq.q}
                              </span>
                            </div>
                            <span
                              className={`material-symbols-outlined text-outline text-lg transition-transform duration-300 ${
                                isOpen ? "rotate-180 text-primary" : ""
                              }`}
                            >
                              expand_more
                            </span>
                          </button>
                          {isOpen && (
                            <div className="px-4 sm:px-5 pb-5 pt-1 text-xs font-body-md text-on-surface-variant leading-relaxed border-t border-outline-variant/10">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ParallaxReveal>
            )}

            {/* TAB 5: CONTACT SUPPORT */}
            {currentTab === "contact-support" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="rounded-2xl p-6 sm:p-8 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-2xl shadow-2xl space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-headline-lg font-bold text-white">
                        Contact Support &amp; Incident Dispatch
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Submit a priority ticket directly to our engineers with immediate database logging and email confirmation
                      </p>
                    </div>
                  </div>

                  {ticketSubmittedId ? (
                    <div className="p-8 rounded-2xl bg-surface-container/60 border border-primary/40 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-primary-container/30 border border-primary/50 text-primary flex items-center justify-center mx-auto text-3xl">
                        <span className="material-symbols-outlined text-3xl">mark_email_read</span>
                      </div>
                      <h3 className="text-xl font-headline-lg font-bold text-white">
                        Ticket Successfully Dispatched!
                      </h3>
                      <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                        Your inquiry has been assigned reference ticket ID{" "}
                        <strong className="text-primary font-label-code">
                          {ticketSubmittedId}
                        </strong>
                        . An engineer has been notified and a confirmation email was dispatched to{" "}
                        <span className="text-white">{email}</span>.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketSubmittedId(null);
                          setTicketSubject("");
                          setTicketMessage("");
                        }}
                        className="px-5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-headline-sm text-white transition-colors cursor-pointer"
                      >
                        Submit Another Inquiry
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Category */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                            Inquiry Category
                          </label>
                          <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary cursor-pointer"
                          >
                            <option>Technical &amp; Live Arena</option>
                            <option>Document Ingestion &amp; PDF OCR</option>
                            <option>Account, SSO &amp; Academic License</option>
                            <option>Feature Request / Custom Integration</option>
                          </select>
                        </div>

                        {/* Urgency */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                            Priority Urgency
                          </label>
                          <select
                            value={ticketUrgency}
                            onChange={(e) => setTicketUrgency(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary cursor-pointer"
                          >
                            <option>Normal (Standard SLA &lt; 2h)</option>
                            <option>High (Academic Class Upcoming)</option>
                            <option>Critical (Live Exam Room In Progress)</option>
                          </select>
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Subject Statement
                        </label>
                        <input
                          type="text"
                          required
                          value={ticketSubject}
                          onChange={(e) => setTicketSubject(e.target.value)}
                          placeholder="e.g. Question generation inquiry or arena connection issue"
                          className="w-full px-4 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      {/* Message */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-white uppercase tracking-wider font-headline-sm">
                          Detailed Description
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={ticketMessage}
                          onChange={(e) => setTicketMessage(e.target.value)}
                          placeholder="Provide details of the behavior encountered, room PIN or quiz ID if applicable..."
                          className="w-full p-3.5 rounded-xl bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary transition-colors resize-none"
                        />
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-xs font-label-code text-on-surface-variant">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-tertiary">
                              verified_user
                            </span>
                            <span>Encrypted Diagnostic Stream</span>
                          </span>
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingTicket}
                          className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {isSubmittingTicket ? (
                            <>
                              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-base">send</span>
                              <span>Dispatch Priority Ticket</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Direct Contact Alternatives */}
                  <div className="pt-4 border-t border-outline-variant/20 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/30 flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-primary text-xl">forum</span>
                      <div>
                        <span className="block font-semibold text-white">Community Guild</span>
                        <span className="text-[11px] text-on-surface-variant font-label-code">
                          Active educators &amp; pilots
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/30 flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-tertiary text-xl">mail</span>
                      <div>
                        <span className="block font-semibold text-white">Direct Email</span>
                        <span className="text-[11px] text-on-surface-variant font-label-code">
                          support@quizzcraft.app
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant/30 flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-emerald-400 text-xl">
                        hub
                      </span>
                      <div>
                        <span className="block font-semibold text-white">Cluster Telemetry</span>
                        <span className="text-[11px] text-emerald-400 font-label-code">
                          Operational 100%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </ParallaxReveal>
            )}

            {/* TAB 6: NOTIFICATIONS */}
            {currentTab === "notifications" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="rounded-2xl p-6 sm:p-8 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-2xl shadow-2xl space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-headline-lg font-bold text-white">
                        Notification Preferences
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Configure dispatch channels for real-time arena invites and student milestone telemetry
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-center justify-between">
                      <div>
                        <span className="block font-semibold text-white text-sm">
                          Live Arena Host Invitations
                        </span>
                        <span className="text-on-surface-variant">
                          Receive instant push notifications when a synchronous quiz room commences
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.liveArenaInvites}
                        onChange={(e) => handleToggleSetting("liveArenaInvites", e.target.checked)}
                        className="rounded border-outline-variant/60 bg-surface-container text-primary w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-center justify-between">
                      <div>
                        <span className="block font-semibold text-white text-sm">
                          Leaderboard Surge Alerts
                        </span>
                        <span className="text-on-surface-variant">
                          Notify when a cohort cadet exceeds your high score in any published room
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.leaderboardSurgeAlerts}
                        onChange={(e) => handleToggleSetting("leaderboardSurgeAlerts", e.target.checked)}
                        className="rounded border-outline-variant/60 bg-surface-container text-primary w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-center justify-between">
                      <div>
                        <span className="block font-semibold text-white text-sm">
                          Weekly Pedagogical Digest
                        </span>
                        <span className="text-on-surface-variant">
                          Summary of student retention curves, difficult questions, and quiz completions
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.weeklyDigest}
                        onChange={(e) => handleToggleSetting("weeklyDigest", e.target.checked)}
                        className="rounded border-outline-variant/60 bg-surface-container text-primary w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </ParallaxReveal>
            )}

            {/* TAB 7: SETTINGS */}
            {currentTab === "settings" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="rounded-2xl p-6 sm:p-8 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-2xl shadow-2xl space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-headline-lg font-bold text-white">
                        Platform Preferences &amp; Accessibility
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Customize visual fidelity, cosmic flight animation, and exam anti-cheat parameters (Stored in DB)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-center justify-between">
                      <div>
                        <span className="block font-semibold text-white text-sm">
                          Cosmic Starfield &amp; Parallax Motion
                        </span>
                        <span className="text-on-surface-variant">
                          Toggle deep-space starfield motion and dynamic parallax flight
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.starfieldMotion}
                        onChange={(e) => handleToggleSetting("starfieldMotion", e.target.checked)}
                        className="rounded border-outline-variant/60 bg-surface-container text-primary w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-center justify-between">
                      <div>
                        <span className="block font-semibold text-white text-sm">
                          High Contrast Accessibility
                        </span>
                        <span className="text-on-surface-variant">
                          Enhance outlines, darken cards, and maximize readability
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.highContrast}
                        onChange={(e) => handleToggleSetting("highContrast", e.target.checked)}
                        className="rounded border-outline-variant/60 bg-surface-container text-primary w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-center justify-between">
                      <div>
                        <span className="block font-semibold text-white text-sm">
                          Kiosk Fullscreen Auto-Lock
                        </span>
                        <span className="text-on-surface-variant">
                          Enforce browser kiosk mode automatically upon joining any competitive exam
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.kioskAutoLock}
                        onChange={(e) => handleToggleSetting("kioskAutoLock", e.target.checked)}
                        className="rounded border-outline-variant/60 bg-surface-container text-primary w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="block font-semibold text-white text-sm">
                          Account Security &amp; Credentials
                        </span>
                        <span className="text-on-surface-variant">
                          Initiate a cryptographically verified password reset with email OTP confirmation
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab("security");
                          setResetStep("init");
                          setResetError(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-primary-container/20 hover:bg-primary-container/30 border border-primary/40 text-primary hover:text-white font-headline-sm text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">lock_reset</span>
                        <span>Reset Password</span>
                      </button>
                    </div>
                  </div>
                </div>
              </ParallaxReveal>
            )}

            {/* TAB 8: SECURITY & PASSWORD RESET */}
            {currentTab === "security" && (
              <ParallaxReveal direction="up" distance={25} duration={700}>
                <div className="rounded-2xl p-6 sm:p-8 bg-surface-container-low/75 border border-outline-variant/30 backdrop-blur-2xl shadow-2xl space-y-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-outline-variant/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-2xl">
                          shield_person
                        </span>
                        <h2 className="text-xl sm:text-2xl font-headline-lg font-bold text-white">
                          Account Security &amp; Password Reset
                        </h2>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Protect your account credentials with 2FA email verification and robust Argon2/Bcrypt encryption
                      </p>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/40 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-label-code text-[11px] text-on-surface">
                        {user?.email || "Account Active"}
                      </span>
                    </div>
                  </div>

                  {/* Step Progress Indicators */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 pb-2">
                    <div
                      className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                        resetStep === "init"
                          ? "bg-primary-container/20 border-primary text-white"
                          : resetStep === "otp" || resetStep === "new-password" || resetStep === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-surface-container/40 border-outline-variant/20 text-on-surface-variant"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          resetStep === "init"
                            ? "bg-primary text-surface-container-lowest"
                            : resetStep === "otp" || resetStep === "new-password" || resetStep === "success"
                            ? "bg-emerald-400 text-surface-container-lowest"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {resetStep === "otp" || resetStep === "new-password" || resetStep === "success" ? (
                          <span className="material-symbols-outlined text-sm">check</span>
                        ) : (
                          "1"
                        )}
                      </div>
                      <div className="hidden sm:block min-w-0">
                        <span className="block font-semibold text-xs truncate">Email Confirm</span>
                        <span className="text-[10px] text-outline font-label-code">Request OTP</span>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                        resetStep === "otp"
                          ? "bg-primary-container/20 border-primary text-white"
                          : resetStep === "new-password" || resetStep === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-surface-container/40 border-outline-variant/20 text-on-surface-variant"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          resetStep === "otp"
                            ? "bg-primary text-surface-container-lowest"
                            : resetStep === "new-password" || resetStep === "success"
                            ? "bg-emerald-400 text-surface-container-lowest"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {resetStep === "new-password" || resetStep === "success" ? (
                          <span className="material-symbols-outlined text-sm">check</span>
                        ) : (
                          "2"
                        )}
                      </div>
                      <div className="hidden sm:block min-w-0">
                        <span className="block font-semibold text-xs truncate">6-Digit Code</span>
                        <span className="text-[10px] text-outline font-label-code">Verify OTP</span>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                        resetStep === "new-password"
                          ? "bg-primary-container/20 border-primary text-white"
                          : resetStep === "success"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-surface-container/40 border-outline-variant/20 text-on-surface-variant"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          resetStep === "new-password"
                            ? "bg-primary text-surface-container-lowest"
                            : resetStep === "success"
                            ? "bg-emerald-400 text-surface-container-lowest"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {resetStep === "success" ? (
                          <span className="material-symbols-outlined text-sm">check</span>
                        ) : (
                          "3"
                        )}
                      </div>
                      <div className="hidden sm:block min-w-0">
                        <span className="block font-semibold text-xs truncate">New Password</span>
                        <span className="text-[10px] text-outline font-label-code">Secure Update</span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Message Alerts */}
                  {resetError && (
                    <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-3 animate-fadeIn">
                      <span className="material-symbols-outlined text-red-400 text-xl shrink-0">
                        error
                      </span>
                      <p className="flex-1">{resetError}</p>
                      <button
                        type="button"
                        onClick={() => setResetError(null)}
                        className="text-red-400 hover:text-red-200"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  )}

                  {resetSuccessMessage && (
                    <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-3 animate-fadeIn">
                      <span className="material-symbols-outlined text-emerald-400 text-xl shrink-0">
                        check_circle
                      </span>
                      <p className="flex-1">{resetSuccessMessage}</p>
                    </div>
                  )}

                  {/* STEP 1: INITIAL REQUEST */}
                  {resetStep === "init" && (
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/30 flex items-start gap-3.5">
                        <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">
                          lock_reset
                        </span>
                        <div className="space-y-1 text-xs">
                          <h4 className="font-semibold text-white text-sm">
                            Reset Password Protocol
                          </h4>
                          <p className="text-on-surface-variant leading-relaxed">
                            For security purposes, when you initiate a password reset, QuizzCraft dispatches a short-lived 6-digit cryptographic verification code to your registered email address. Once verified, you will be authorized to set a new password.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-white font-headline-sm">
                          Select Account Email for OTP Delivery
                        </label>
                        {linkedEmails.length > 1 ? (
                          <select
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:outline-none text-white text-xs font-label-code"
                          >
                            {linkedEmails.map((em) => (
                              <option key={em} value={em} className="bg-surface-container-high text-white">
                                {em} {em === user?.email ? "(Primary Account Email)" : "(Linked Email)"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/40">
                            <span className="material-symbols-outlined text-tertiary text-lg">
                              mail
                            </span>
                            <span className="text-white text-xs font-label-code font-semibold">
                              {resetEmail || user?.email || "No email detected"}
                            </span>
                            <span className="ml-auto text-[10px] font-label-code px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                              Verified Destination
                            </span>
                          </div>
                        )}
                        <p className="text-[11px] text-on-surface-variant font-label-code">
                          The one-time passcode will be delivered to this verified mailbox.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setResetStep("otp")}
                          className="text-xs text-primary hover:text-white font-headline-sm transition-colors cursor-pointer"
                        >
                          Already received an OTP code? Enter it now &rarr;
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendResetOtp()}
                          disabled={resetLoading || !(resetEmail || user?.email)}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                        >
                          {resetLoading ? (
                            <>
                              <span className="material-symbols-outlined text-base animate-spin">
                                progress_activity
                              </span>
                              <span>Dispatching OTP...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-base">send</span>
                              <span>Send Reset Verification Code</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: VERIFY OTP */}
                  {resetStep === "otp" && (
                    <form onSubmit={handleVerifyResetOtp} className="space-y-6">
                      <div className="text-center max-w-md mx-auto space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-primary-container/20 border border-primary/30 flex items-center justify-center text-primary mx-auto">
                          <span className="material-symbols-outlined text-2xl">mark_email_read</span>
                        </div>
                        <h3 className="text-lg font-headline-sm font-bold text-white">
                          Verify 6-Digit Passcode
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          We dispatched a cryptographic 6-digit code to{" "}
                          <span className="text-white font-semibold font-label-code">
                            {resetEmail || user?.email}
                          </span>
                          . Enter it below to unlock your password update.
                        </p>
                      </div>

                      {/* 6-Digit Input Grid */}
                      <div className="flex justify-center items-center gap-2 sm:gap-3">
                        {resetOtp.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => {
                              resetOtpInputsRef.current[idx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleResetOtpChange(idx, e.target.value)}
                            onKeyDown={(e) => handleResetOtpKeyDown(idx, e)}
                            onPaste={handleResetOtpPaste}
                            className="w-11 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold font-label-code rounded-xl bg-surface-container border border-outline-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 text-white transition-all outline-none"
                          />
                        ))}
                      </div>

                      {/* Resend Cooldown */}
                      <div className="text-center text-xs">
                        {resetCooldown > 0 ? (
                          <p className="text-on-surface-variant font-label-code">
                            Resend code in{" "}
                            <span className="text-primary font-bold">{resetCooldown}s</span>
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendResetOtp}
                            disabled={resetLoading}
                            className="text-primary hover:text-white font-semibold underline underline-offset-4 cursor-pointer transition-colors"
                          >
                            Didn&apos;t receive the email? Resend code
                          </button>
                        )}
                      </div>

                      <div className="pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setResetStep("init")}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-headline-sm transition-colors cursor-pointer"
                        >
                          &larr; Change Email
                        </button>

                        <button
                          type="submit"
                          disabled={resetLoading || resetOtp.join("").length < 6}
                          className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                        >
                          {resetLoading ? (
                            <>
                              <span className="material-symbols-outlined text-base animate-spin">
                                progress_activity
                              </span>
                              <span>Verifying Code...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-base">verified</span>
                              <span>Verify &amp; Continue</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 3: NEW PASSWORD */}
                  {resetStep === "new-password" && (
                    <form onSubmit={handleCompletePasswordReset} className="space-y-6">
                      <div className="space-y-1">
                        <h3 className="text-lg font-headline-sm font-bold text-white">
                          Configure New Password
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          Enter your new credentials below. Ensure it meets our strict cryptographic password standards.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-white font-headline-sm">
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              type={resetShowPassword ? "text" : "password"}
                              value={resetNewPassword}
                              onChange={(e) => setResetNewPassword(e.target.value)}
                              placeholder="Minimum 8 characters"
                              required
                              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:outline-none text-white text-xs font-body-md"
                            />
                            <button
                              type="button"
                              onClick={() => setResetShowPassword(!resetShowPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-white"
                            >
                              <span className="material-symbols-outlined text-base">
                                {resetShowPassword ? "visibility_off" : "visibility"}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-white font-headline-sm">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <input
                              type={resetShowPassword ? "text" : "password"}
                              value={resetConfirmPassword}
                              onChange={(e) => setResetConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                              required
                              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary focus:outline-none text-white text-xs font-body-md"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Password Requirements Real-Time Checklist */}
                      <div className="p-4 rounded-xl bg-surface-container/40 border border-outline-variant/30 space-y-2.5">
                        <span className="block font-semibold text-white text-xs">
                          Password Requirements
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-label-code">
                          <div className={`flex items-center gap-2 ${resetNewPassword.length >= 8 ? "text-emerald-400" : "text-on-surface-variant"}`}>
                            <span className="material-symbols-outlined text-sm">
                              {resetNewPassword.length >= 8 ? "check_circle" : "radio_button_unchecked"}
                            </span>
                            <span>At least 8 characters</span>
                          </div>

                          <div className={`flex items-center gap-2 ${/[A-Z]/.test(resetNewPassword) ? "text-emerald-400" : "text-on-surface-variant"}`}>
                            <span className="material-symbols-outlined text-sm">
                              {/[A-Z]/.test(resetNewPassword) ? "check_circle" : "radio_button_unchecked"}
                            </span>
                            <span>At least 1 uppercase letter</span>
                          </div>

                          <div className={`flex items-center gap-2 ${/[a-z]/.test(resetNewPassword) ? "text-emerald-400" : "text-on-surface-variant"}`}>
                            <span className="material-symbols-outlined text-sm">
                              {/[a-z]/.test(resetNewPassword) ? "check_circle" : "radio_button_unchecked"}
                            </span>
                            <span>At least 1 lowercase letter</span>
                          </div>

                          <div className={`flex items-center gap-2 ${/[0-9]/.test(resetNewPassword) ? "text-emerald-400" : "text-on-surface-variant"}`}>
                            <span className="material-symbols-outlined text-sm">
                              {/[0-9]/.test(resetNewPassword) ? "check_circle" : "radio_button_unchecked"}
                            </span>
                            <span>At least 1 number</span>
                          </div>

                          <div className={`flex items-center gap-2 ${/[^A-Za-z0-9]/.test(resetNewPassword) ? "text-emerald-400" : "text-on-surface-variant"}`}>
                            <span className="material-symbols-outlined text-sm">
                              {/[^A-Za-z0-9]/.test(resetNewPassword) ? "check_circle" : "radio_button_unchecked"}
                            </span>
                            <span>At least 1 special character</span>
                          </div>

                          <div className={`flex items-center gap-2 ${resetNewPassword && resetNewPassword === resetConfirmPassword ? "text-emerald-400" : "text-on-surface-variant"}`}>
                            <span className="material-symbols-outlined text-sm">
                              {resetNewPassword && resetNewPassword === resetConfirmPassword ? "check_circle" : "radio_button_unchecked"}
                            </span>
                            <span>Passwords match</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={handleResetWorkflowRestart}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-headline-sm transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={
                            resetLoading ||
                            resetNewPassword.length < 8 ||
                            resetNewPassword !== resetConfirmPassword ||
                            !/[A-Z]/.test(resetNewPassword) ||
                            !/[a-z]/.test(resetNewPassword) ||
                            !/[0-9]/.test(resetNewPassword) ||
                            !/[^A-Za-z0-9]/.test(resetNewPassword)
                          }
                          className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 disabled:opacity-40 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/20 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                        >
                          {resetLoading ? (
                            <>
                              <span className="material-symbols-outlined text-base animate-spin">
                                progress_activity
                              </span>
                              <span>Updating Password...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-base">save</span>
                              <span>Save New Password</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STEP 4: SUCCESS */}
                  {resetStep === "success" && (
                    <div className="text-center py-8 space-y-4 max-w-md mx-auto animate-fadeIn">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                        <span className="material-symbols-outlined text-3xl">verified_user</span>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-xl font-headline-sm font-bold text-white">
                          Password Successfully Updated!
                        </h3>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Your account password has been updated in the database. Your current session remains active, and your new credentials will be required on your next login.
                        </p>
                      </div>

                      <div className="pt-4 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            handleResetWorkflowRestart();
                            setCurrentTab("profile");
                          }}
                          className="px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/25 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-base">account_circle</span>
                          <span>Return to Profile</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </ParallaxReveal>
            )}
          </section>
        </div>
      </main>

      {/* Reusable Platform Footer */}
      <AuthFooter />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">
              progress_activity
            </span>
          </div>
        }
      >
        <ProfileContent />
      </Suspense>
    </ProtectedRoute>
  );
}
