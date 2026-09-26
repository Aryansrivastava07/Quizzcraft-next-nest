"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicVoidCanvas from "@/components/canvas/CosmicVoidCanvas";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import AuthFooter from "@/components/layout/AuthFooter";
import { authService } from "@/lib/api/auth-service";
import { formatApiError } from "@/lib/api/client";

type Step = "request" | "verify" | "reset" | "success";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-focus first OTP input when reaching verify step
  useEffect(() => {
    if (step === "verify") {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Auto-dismiss errors/status messages
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Handle Step 1: Send reset OTP
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.sendPasswordResetMail({ email: email.trim() });
      setStatusMessage("Verification code dispatched to your email address.");
      setStep("verify");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(formatApiError(err));
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

    // Single digit or paste
    if (cleanVal.length === 1) {
      const newOtp = [...otp];
      newOtp[index] = cleanVal;
      setOtp(newOtp);
      if (index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    } else if (cleanVal.length > 1) {
      // Pasted multi-digit code
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

  // Handle Step 2: Verify reset OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.verifyPasswordResetOTP({ email: email.trim(), OTP: fullOtp });
      setStatusMessage("Code verified! You may now set your new password.");
      setStep("reset");
    } catch (err: any) {
      setErrorMessage(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Resend reset OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.resendPasswordResetOTP({ email: email.trim() });
      setStatusMessage("A fresh verification code has been dispatched.");
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      otpInputsRef.current[0]?.focus();
    } catch (err: any) {
      setErrorMessage(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 3: Set new password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.resetPassword({
        email: email.trim(),
        password: newPassword,
      });
      setStep("success");
    } catch (err: any) {
      setErrorMessage(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body-md text-body-md min-h-screen cosmic-void relative flex flex-col justify-between overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
      <CosmicVoidCanvas />

      {/* Header */}
      <header className="relative z-20 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant/40 flex items-center justify-center relative overflow-hidden shadow-lg shadow-primary-container/10 group-hover:border-primary transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary-container/30 to-tertiary/20" />
            <span className="material-symbols-outlined text-primary relative z-10 text-xl">
              bolt
            </span>
          </div>
          <span className="font-headline-sm text-base text-primary font-extrabold tracking-tight">
            QuizzCraft<span className="text-tertiary">.app</span>
          </span>
        </Link>

        <Link
          href="/auth"
          className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Back to Sign In</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <ParallaxReveal direction="up" distance={25} duration={750} className="w-full max-w-[560px]">
          <div className="w-full rounded-3xl luminous-card backdrop-blur-2xl border border-outline-variant/30 overflow-hidden relative shadow-2xl p-8 sm:p-10">
            {/* Ambient edge flare */}
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-tertiary/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              {/* Step 1: Request Reset */}
              {step === "request" && (
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary-container/20 border border-primary/40 flex items-center justify-center mb-6 text-primary">
                    <span className="material-symbols-outlined text-2xl">lock_reset</span>
                  </div>

                  <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
                    Reset Your Password
                  </h1>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed">
                    Enter the email address registered with your account. We will send you a 6-digit recovery code.
                  </p>

                  <form onSubmit={handleRequestReset} className="mt-6 space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-on-surface-variant">
                        Email Address
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                          mail
                        </span>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="alexander@university.edu"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-lowest/90 border border-outline-variant/50 text-on-surface placeholder:text-outline text-xs focus:outline-none focus:border-primary focus:bg-surface-container-low transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-6 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">
                            progress_activity
                          </span>
                          <span>Dispatching Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Recovery Code</span>
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Step 2: Verify Recovery OTP */}
              {step === "verify" && (
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary-container/20 border border-primary/40 flex items-center justify-center mb-6 text-primary">
                    <span className="material-symbols-outlined text-2xl">verified_user</span>
                  </div>

                  <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
                    Enter Recovery Code
                  </h1>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed">
                    We sent a 6-digit code to <span className="text-primary font-semibold">{email}</span>. Enter it below to verify your identity.
                  </p>

                  <form onSubmit={handleVerifyOtp} className="mt-6 space-y-6">
                    <div className="flex justify-between gap-2 sm:gap-3" onPaste={handleOtpPaste}>
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
                          className="w-11 h-12 sm:w-14 sm:h-14 text-center font-headline-lg text-lg font-bold rounded-xl bg-surface-container-lowest/90 border border-outline-variant/60 focus:border-primary focus:bg-surface-container-low text-on-surface focus:outline-none transition-colors"
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || otp.join("").length < 6}
                      className="w-full py-3 px-6 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">
                            progress_activity
                          </span>
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify Recovery Code</span>
                          <span className="material-symbols-outlined text-base">check</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs font-medium pt-2 border-t border-outline-variant/20">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("request");
                          setOtp(["", "", "", "", "", ""]);
                        }}
                        className="text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        Change Email
                      </button>

                      <button
                        type="button"
                        disabled={resendCooldown > 0 || isLoading}
                        onClick={handleResendOtp}
                        className={`transition-colors font-medium ${
                          resendCooldown > 0
                            ? "text-outline cursor-not-allowed"
                            : "text-primary hover:text-primary-fixed cursor-pointer"
                        }`}
                      >
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Code"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 3: Set New Password */}
              {step === "reset" && (
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6 text-emerald-400">
                    <span className="material-symbols-outlined text-2xl">password</span>
                  </div>

                  <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
                    Set New Password
                  </h1>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed">
                    Create a strong password for <span className="text-primary font-semibold">{email}</span>. Minimum 8 characters.
                  </p>

                  <form onSubmit={handleSetNewPassword} className="mt-6 space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-on-surface-variant">
                        New Password
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                          lock
                        </span>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-lowest/90 border border-outline-variant/50 text-on-surface placeholder:text-outline text-xs focus:outline-none focus:border-primary focus:bg-surface-container-low transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-on-surface-variant">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                          lock_clock
                        </span>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-lowest/90 border border-outline-variant/50 text-on-surface placeholder:text-outline text-xs focus:outline-none focus:border-primary focus:bg-surface-container-low transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-6 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">
                            progress_activity
                          </span>
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <span>Save Password & Return to Login</span>
                          <span className="material-symbols-outlined text-base">check_circle</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Step 4: Success confirmation */}
              {step === "success" && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-6 text-emerald-400">
                    <span className="material-symbols-outlined text-3xl">check</span>
                  </div>

                  <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">
                    Password Reset Complete
                  </h1>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed max-w-sm mx-auto">
                    Your password has been securely updated. You can now log into your QuizzCraft account with your new credentials.
                  </p>

                  <button
                    type="button"
                    onClick={() => router.push("/auth")}
                    className="w-full mt-6 py-3 px-6 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Sign In</span>
                    <span className="material-symbols-outlined text-base">login</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </ParallaxReveal>
      </main>

      <AuthFooter />

      {/* Floating Error Toast */}
      {errorMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-bounce">
          <div className="p-4 rounded-2xl bg-[#0b0e1b]/95 border border-red-500/50 text-red-200 shadow-2xl backdrop-blur-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-red-400 text-lg shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1 pr-1 min-w-0">
              <p className="font-semibold text-white text-xs uppercase tracking-wider">
                Error
              </p>
              <p className="mt-1 text-xs text-red-200/90 leading-relaxed break-words">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Toast */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] animate-bounce">
          <div className="p-4 rounded-2xl bg-[#0b0e1b]/95 border border-emerald-500/50 text-emerald-200 shadow-2xl backdrop-blur-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-400 text-lg shrink-0 mt-0.5">
              check_circle
            </span>
            <div className="flex-1 pr-1 min-w-0">
              <p className="font-semibold text-white text-xs uppercase tracking-wider">
                Notification
              </p>
              <p className="mt-1 text-xs text-emerald-200/90 leading-relaxed break-words">
                {statusMessage}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordContent />
    </Suspense>
  );
}
