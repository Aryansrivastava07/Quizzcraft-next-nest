"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicVoidCanvas from "@/components/canvas/CosmicVoidCanvas";
import { useAuth } from "@/lib/auth/auth-context";
import { authService } from "@/lib/api/auth-service";
import { formatApiError } from "@/lib/api/client";

type AuthMode = "signin" | "signup" | "verify-otp";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/profile";
  const urlMode = searchParams.get("mode");
  const urlEmail = searchParams.get("email");

  const { login, register, verifyRegisterOTP } = useAuth();

  const [mode, setMode] = useState<AuthMode>(
    urlMode === "verify" ? "verify-otp" : "signin"
  );
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(urlEmail || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [institution, setInstitution] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<{
    status: "idle" | "checking" | "available" | "taken" | "invalid";
    message: string;
  }>({ status: "idle", message: "" });

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Validation criteria
  const passwordCriteria = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const cleanPhone = phoneNumber.replace(/[^0-9+]/g, "");
  const isPhoneValid = !phoneNumber.trim() || /^\+?[0-9]{7,15}$/.test(cleanPhone);

  // Debounced real-time username availability check (matches Profile)
  useEffect(() => {
    if (mode !== "signup") return;
    if (!username.trim()) {
      setUsernameCheck({ status: "idle", message: "" });
      return;
    }
    const clean = username.toLowerCase().trim();
    if (!/^[a-z0-9]{3,30}$/.test(clean)) {
      setUsernameCheck({
        status: "invalid",
        message: "Must be 3-30 lowercase alphanumeric characters with no symbols",
      });
      return;
    }

    setUsernameCheck({ status: "checking", message: "Checking availability..." });
    const timer = setTimeout(async () => {
      try {
        const res = await authService.checkUsername(clean);
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
  }, [username, mode]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-focus first OTP input when switching to verify-otp mode
  useEffect(() => {
    if (mode === "verify-otp") {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [mode]);

  // Auto-dismiss toasts after 6 seconds
  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => setAuthError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [authError]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (mode === "signin") {
        if (!email.trim() || !password) {
          setAuthError("Please provide your email address and password.");
          setIsLoading(false);
          return;
        }
        await login({ email: email.trim(), password });
        router.push(redirectUrl);
      } else if (mode === "signup") {
        const cleanUser = username.toLowerCase().trim();
        if (!cleanUser) {
          setAuthError("Username is required.");
          setIsLoading(false);
          return;
        }
        if (!/^[a-z0-9]{3,30}$/.test(cleanUser)) {
          setAuthError("Username must be 3-30 lowercase letters or numbers with no symbols.");
          setIsLoading(false);
          return;
        }
        if (usernameCheck.status === "checking") {
          setAuthError("Please wait for username availability check to complete.");
          setIsLoading(false);
          return;
        }
        if (usernameCheck.status !== "available") {
          setAuthError(usernameCheck.message || "Please choose a valid and available username.");
          setIsLoading(false);
          return;
        }
        if (!isEmailValid) {
          setAuthError("Please provide a valid email address.");
          setIsLoading(false);
          return;
        }
        if (!isPasswordValid) {
          setAuthError("Password does not meet security criteria (min 8 chars, uppercase, lowercase, number, symbol).");
          setIsLoading(false);
          return;
        }
        if (phoneNumber.trim() && !isPhoneValid) {
          setAuthError("Please enter a valid phone number (7-15 digits).");
          setIsLoading(false);
          return;
        }

        const result = await register({
          username: cleanUser,
          fullName: fullName.trim() || undefined,
          email: email.trim(),
          password,
          phoneNumber: cleanPhone || undefined,
          institution: institution.trim() || undefined,
        });

        // Switch immediately to 2FA / OTP Verification step!
        setMode("verify-otp");
        setResendCooldown(60);
        setOtp(["", "", "", "", "", ""]);
        setSuccessMessage(
          result.message || "Account created! A 6-digit verification code has been dispatched to your email."
        );
      } else if (mode === "verify-otp") {
        const fullOtp = otp.join("");
        if (fullOtp.length < 6) {
          setAuthError("Please enter the complete 6-digit verification code.");
          setIsLoading(false);
          return;
        }

        await verifyRegisterOTP({
          email: email.trim(),
          OTP: fullOtp,
        });

        setSuccessMessage("Identity verified successfully! Launching your studio...");
        setTimeout(() => {
          router.push(redirectUrl);
        }, 600);
      }
    } catch (err: any) {
      setAuthError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Input handlers
  const handleOtpChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, "");
    if (!cleanVal) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    if (cleanVal.length === 1) {
      const newOtp = [...otp];
      newOtp[index] = cleanVal;
      setOtp(newOtp);
      if (index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    } else if (cleanVal.length > 1) {
      // Pasted multiple digits
      const pastedDigits = cleanVal.slice(0, 6).split("");
      const newOtp = [...otp];
      pastedDigits.forEach((digit, idx) => {
        if (index + idx < 6) {
          newOtp[index + idx] = digit;
        }
      });
      setOtp(newOtp);
      const nextFocus = Math.min(index + pastedDigits.length, 5);
      otpInputsRef.current[nextFocus]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pasted) return;

    const digits = pasted.split("");
    const newOtp = [...otp];
    digits.forEach((d, i) => {
      if (i < 6) newOtp[i] = d;
    });
    setOtp(newOtp);
    const targetIdx = Math.min(digits.length, 5);
    otpInputsRef.current[targetIdx]?.focus();
  };

  // Resend 2FA OTP
  const handleResendRegisterOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      await authService.resendRegisterOTP({ email: email.trim() });
      setSuccessMessage("A fresh 6-digit verification code has been dispatched to your email.");
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      otpInputsRef.current[0]?.focus();
    } catch (err: any) {
      setAuthError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md min-h-screen md:h-screen w-full relative flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Stitch Cosmic Void Canvas with Interactive Cursor Physics */}
      <CosmicVoidCanvas />

      {/* Cinematic Full-Screen Heavy Radial Vignette & Edge Shadow */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_10%,rgba(0,0,0,0.55)_50%,rgba(0,0,0,0.95)_100%)]" />
      <div className="pointer-events-none fixed inset-0 z-10 shadow-[inset_0_0_180px_rgba(0,0,0,0.95)]" />

      {/* LEFT COLUMN: Visual Hero Art (ChatGPT asset) - Covers 100% height on desktop/tablet */}
      <div className="hidden md:flex md:w-5/12 lg:w-1/2 relative h-full flex-col justify-start p-8 lg:p-12 overflow-hidden border-r border-white/10 bg-surface-container-lowest shrink-0 select-none z-20">
        {/* Authentic 3D Cosmic artwork */}
        <img
          src="/images/auth-hero.png"
          alt="QuizzCraft Cosmic Engine"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none transform scale-[1.02]"
        />

        {/* Deep Multi-Layered Cinematic Vignette System for Left Artwork */}
        {/* 1. Heavy radial vignette darkening outer periphery */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_15%,rgba(0,0,0,0.5)_50%,rgba(5,7,13,0.95)_100%)] pointer-events-none" />
        {/* 2. Top-down heavy shadow for header clarity */}
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#05070d] via-[#05070d]/80 to-transparent pointer-events-none" />
        {/* 3. Bottom-up heavy shadow */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#05070d] via-[#05070d]/90 to-transparent pointer-events-none" />
        {/* 4. Left outer rim deep vignette */}
        <div className="absolute inset-y-0 left-0 w-44 bg-gradient-to-r from-[#05070d] via-[#05070d]/80 to-transparent pointer-events-none" />
        {/* 5. Right column seam deep vignette transition */}
        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-[#05070d] via-[#05070d]/85 to-transparent pointer-events-none" />

        {/* Clean Standard Brand Logo at top-left */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-outline-variant/40 flex items-center justify-center relative shadow-lg shadow-primary-container/10 group-hover:border-primary transition-all duration-300 group-hover:scale-105 bg-surface-container-high shrink-0">
              <img
                src="/images/logo-icon.png"
                alt="QuizzCraft Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-headline-sm text-base text-primary font-extrabold tracking-tight">
              QuizzCraft<span className="text-tertiary">.app</span>
            </span>
          </Link>
        </div>
      </div>

      {/* RIGHT COLUMN: Authentication Studio Surface */}
      <div className="w-full md:w-7/12 lg:w-1/2 h-full flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative z-20 overflow-y-auto">
        {/* Subtle ambient glow orb behind the card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar */}
        <div className="flex items-center justify-between w-full shrink-0">
          {/* Mobile-only brand logo */}
          <div className="md:hidden">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/20 flex items-center justify-center bg-surface-container-high shrink-0">
                <img
                  src="/images/logo-icon.png"
                  alt="QuizzCraft Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-headline-sm text-base text-primary font-bold">
                QuizzCraft<span className="text-tertiary">.app</span>
              </span>
            </Link>
          </div>

          {/* Navigation action */}
          <div className="ml-auto">
            {mode === "verify-otp" ? (
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span>Back to Sign Up</span>
              </button>
            ) : (
              <Link
                href="/"
                className="text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5"
              >
                <span>Back to Home</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            )}
          </div>
        </div>

        {/* Center Card Stage: Polished frosted glass card */}
        <div className="w-full max-w-[460px] mx-auto my-auto rounded-3xl bg-[#090d16]/80 backdrop-blur-2xl border border-white/[0.09] p-6 sm:p-8 shadow-2xl shadow-black/80 relative">
          {/* Top starlight rim highlight */}
          <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

          {/* Mode Switcher */}
          {mode !== "verify-otp" ? (
            <div className="flex items-center mb-5">
              <div className="inline-flex p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setAuthError(null);
                  }}
                  className={`px-4 py-1.5 rounded-full font-headline-sm text-xs font-semibold transition-all cursor-pointer ${
                    mode === "signin"
                      ? "bg-primary text-on-primary shadow-md shadow-primary/25"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setAuthError(null);
                  }}
                  className={`px-4 py-1.5 rounded-full font-headline-sm text-xs font-semibold transition-all cursor-pointer ${
                    mode === "signup"
                      ? "bg-primary text-on-primary shadow-md shadow-primary/25"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  Create Account
                </button>
              </div>
            </div>
          ) : (
            /* 2FA Step Badge */
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-[11px] font-label-code font-semibold uppercase tracking-wider bg-primary-container/20 text-primary border border-primary/30 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">shield</span>
                2-Factor Authentication
              </span>
              <span className="text-xs text-on-surface-variant">Step 2 of 2</span>
            </div>
          )}

          {/* Heading */}
          <h1 className="font-headline-lg text-2xl font-bold text-white tracking-tight">
            {mode === "signin" && "Welcome to QuizzCraft"}
            {mode === "signup" && "Create Your Account"}
            {mode === "verify-otp" && "Verify Your Identity"}
          </h1>
          <p className="font-body-sm text-xs text-on-surface-variant/80 mt-1.5 leading-relaxed">
            {mode === "signin" && "Enter your credentials to access your quiz studio."}
            {mode === "signup" && "Start turning documents and notes into interactive 3D quizzes."}
            {mode === "verify-otp" && (
              <>
                We sent a 6-digit security code to{" "}
                <span className="text-primary font-semibold">{email}</span>. Enter it to activate your account.
              </>
            )}
          </p>

          {/* Main Form Area */}
          {mode !== "verify-otp" ? (
            <div className="mt-4">
              {/* Google Button */}
              <button
                type="button"
                onClick={() => {
                  setAuthError("OAuth sign-in (Google) is missing in the backend. Please authenticate with your email & password.");
                }}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all text-on-surface text-xs font-medium active:scale-[0.98] cursor-pointer shadow-sm group"
              >
                <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                  <path
                    d="M12 5c1.54 0 2.93.56 4.02 1.48l3.01-3.01C17.21 1.76 14.77 1 12 1 7.42 1 3.55 3.63 1.64 7.45l3.69 2.87C6.22 7.37 8.87 5 12 5z"
                    fill="#EA4335"
                  />
                  <path
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.48-1.12 2.73-2.39 3.58l3.68 2.86c2.15-1.99 3.43-4.91 3.43-8.68z"
                    fill="#4285F4"
                  />
                  <path
                    d="M5.33 14.68A6.98 6.98 0 0 1 4.98 12c0-.94.13-1.85.35-2.68L1.64 6.45A11.96 11.96 0 0 0 .5 12c0 1.92.46 3.73 1.14 5.35l3.69-2.67z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.68-2.86c-1.07.72-2.45 1.16-4.25 1.16-3.13 0-5.78-2.37-6.67-5.32L1.64 15.68C3.55 19.5 7.42 22.13 12 22.13z"
                    fill="#34A853"
                  />
                </svg>
                <span className="font-medium text-xs">Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center my-3.5">
                <div className="flex-grow border-t border-white/[0.08]" />
                <span className="flex-shrink-0 mx-3 px-3 py-0.5 text-[10px] font-label-code text-on-surface-variant/70 uppercase tracking-wider rounded-full bg-white/[0.03] border border-white/[0.08] whitespace-nowrap shadow-sm">
                  or continue with email
                </span>
                <div className="flex-grow border-t border-white/[0.08]" />
              </div>

              {/* Authentication Form */}
              <form onSubmit={handleSubmit}>
                {mode === "signup" ? (
                  /* 2-Column Grid for Signup: exactly 3 rows, matching visual weight of signin */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    {/* 1. Username */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-medium text-on-surface-variant/90">
                          Username <span className="text-primary">*</span>
                        </label>
                        {usernameCheck.message && (
                          <span
                            className={`text-[10px] font-label-code ${
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
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          alternate_email
                        </span>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) =>
                            setUsername(
                              e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                            )
                          }
                          placeholder="cadet_alex"
                          className={`w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all ${
                            usernameCheck.status === "taken" || usernameCheck.status === "invalid"
                              ? "border-red-500/50 focus:border-red-500"
                              : usernameCheck.status === "available"
                              ? "border-emerald-500/50 focus:border-emerald-500"
                              : "border-white/10 hover:border-white/20 focus:border-primary/80"
                          }`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
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
                    </div>

                    {/* 2. Full Name */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-on-surface-variant/90">
                        Full Name <span className="text-outline text-[10px] font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          badge
                        </span>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Prof. Alex Vance"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary/80 text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* 3. Email */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-on-surface-variant/90">
                        Work or Student Email <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          mail
                        </span>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="alexander@university.edu"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary/80 text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* 4. Phone Number */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-on-surface-variant/90">
                        Phone Number <span className="text-outline text-[10px] font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          call
                        </span>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+1 555-0199"
                          className={`w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all ${
                            phoneNumber.trim() && !isPhoneValid
                              ? "border-red-500/50 focus:border-red-500"
                              : "border-white/10 hover:border-white/20 focus:border-primary/80"
                          }`}
                        />
                      </div>
                    </div>

                    {/* 5. Password */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-on-surface-variant/90">
                        Password <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          lock
                        </span>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary/80 text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-outline/80 hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 6. Institution */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-on-surface-variant/90">
                        Institution <span className="text-outline text-[10px] font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          school
                        </span>
                        <input
                          type="text"
                          value={institution}
                          onChange={(e) => setInstitution(e.target.value)}
                          placeholder="MIT / Stanford / Org"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary/80 text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Signin Mode: Clean 2 fields */
                  <div className="space-y-3">
                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-on-surface-variant/90">
                        Email Address <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          mail
                        </span>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="alexander@university.edu"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary/80 text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-on-surface-variant/90">
                          Password <span className="text-primary">*</span>
                        </label>
                        <Link
                          href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                          className="text-[11px] font-label-code text-primary hover:text-primary-fixed transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline/70 text-[18px] pointer-events-none">
                          lock
                        </span>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary/80 text-on-surface placeholder:text-outline/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-outline/80 hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button: Directly below the fields, NO awkward gap! */}
                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={
                      isLoading ||
                      (mode === "signup" &&
                        (!username ||
                          usernameCheck.status !== "available" ||
                          !isEmailValid ||
                          !password.trim() ||
                          (phoneNumber.trim() !== "" && !isPhoneValid)))
                    }
                    className="w-full py-2.5 px-6 rounded-xl bg-gradient-to-r from-primary-container to-secondary-container hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-headline-sm text-xs font-semibold shadow-lg shadow-primary-container/25 border border-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <span className="material-symbols-outlined text-base animate-spin">
                          progress_activity
                        </span>
                        <span>
                          {mode === "signin"
                            ? "Signing in to Studio..."
                            : "Creating Studio Account..."}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {mode === "signin"
                            ? "Sign In to Studio"
                            : "Create Studio Account"}
                        </span>
                        <span className="material-symbols-outlined text-base">
                          bolt
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* 2FA / OTP Verification Screen */
            <form onSubmit={handleSubmit} className="mt-4 space-y-5">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-3">
                  6-Digit Verification Code
                </label>
                <div
                  className="flex justify-between gap-2 sm:gap-3"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 sm:w-12 sm:h-12 text-center font-headline-lg text-lg font-bold rounded-xl bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 hover:border-white/20 focus:border-primary text-on-surface focus:outline-none shadow-sm transition-all"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <button
                  type="submit"
                  disabled={isLoading || otp.join("").length < 6}
                  className="w-full py-2.5 px-6 rounded-xl bg-gradient-to-r from-primary-container to-secondary-container hover:brightness-110 text-white font-headline-sm text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">
                        progress_activity
                      </span>
                      <span>Verifying 2FA Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Complete Registration</span>
                      <span className="material-symbols-outlined text-base">
                        verified
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs font-medium pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setOtp(["", "", "", "", "", ""]);
                    }}
                    className="text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                  >
                    Edit Email / Details
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={handleResendRegisterOtp}
                    className={`transition-colors font-medium ${
                      resendCooldown > 0
                        ? "text-outline cursor-not-allowed"
                        : "text-primary hover:text-primary-fixed cursor-pointer"
                    }`}
                  >
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend Code"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Bar: Clean copyright and terms */}
        <div className="w-full max-w-[460px] mx-auto pt-3 flex items-center justify-between text-[11px] text-on-surface-variant/70 border-t border-white/[0.06] shrink-0">
          <span>© 2026 QuizzCraft.app</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Floating Error Toast */}
      {authError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-bounce">
          <div className="p-4 rounded-2xl bg-[#0b0e1b]/95 border border-red-500/50 text-red-200 shadow-2xl backdrop-blur-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-red-400 text-lg shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1 pr-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white text-xs uppercase tracking-wider font-headline-sm">
                  Authentication Error
                </p>
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="text-on-surface-variant hover:text-white transition-colors p-0.5 rounded-lg cursor-pointer"
                  aria-label="Dismiss error toast"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <p className="mt-1 text-xs text-red-200/90 leading-relaxed break-words font-body-sm">
                {authError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-bounce">
          <div className="p-4 rounded-2xl bg-[#0b0e1b]/95 border border-emerald-500/50 text-emerald-200 shadow-2xl backdrop-blur-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-400 text-lg shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="flex-1 pr-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white text-xs uppercase tracking-wider font-headline-sm">
                  Notification
                </p>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="text-on-surface-variant hover:text-white transition-colors p-0.5 rounded-lg cursor-pointer"
                  aria-label="Dismiss success toast"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <p className="mt-1 text-xs text-emerald-200/90 leading-relaxed break-words font-body-sm">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthPage() {
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
      <AuthContent />
    </Suspense>
  );
}
