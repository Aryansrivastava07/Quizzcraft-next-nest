"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/auth-context";
import { quizService } from "@/lib/api/quiz-service";
import { profileService } from "@/lib/api/profile-service";
import { Quiz } from "@/lib/api/types";

interface QuestionOption {
  key: string;
  text: string;
  num: string;
  isCorrect: boolean;
}

interface ActiveQuizQuestion {
  id: number;
  questionId: string;
  section: string;
  statement: string;
  level: "EASY" | "MEDIUM" | "HARD";
  xp: number;
  options: QuestionOption[];
  correctKey: string;
  correctText: string;
  explanation: string;
  visualCaption?: string;
  reference?: {
    type?: "IMAGE" | "VIDEO_FRAME" | "PDF_PAGE" | "WEB_SOURCE" | "VERIFIED_CDN";
    mediaUrl?: string;
    caption?: string;
    timestamp?: string;
    pageNumber?: number;
    sourceName?: string;
  };
}

function parseTimestampToSeconds(ts?: string): number {
  if (!ts) return 0;
  const parts = ts.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const numeric = parseFloat(ts);
  return isNaN(numeric) ? 0 : numeric;
}

function isCorrectOption(optText: string, optIdx: number, rawAnswer: any): boolean {
  if (rawAnswer === undefined || rawAnswer === null) return false;
  const ansStr = String(rawAnswer).trim();
  const key = ["A", "B", "C", "D", "E"][optIdx] || "";
  if (ansStr === String(optIdx)) return true;
  if (ansStr.toUpperCase() === key.toUpperCase()) return true;
  if (ansStr.toLowerCase() === optText.trim().toLowerCase()) return true;
  return false;
}

function ActiveQuizPlatformContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const quizIdParam = searchParams.get("quizId");
  const pinParam = searchParams.get("pin");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizPin, setQuizPin] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("Interactive Assessment");
  const [immediateResult, setImmediateResult] = useState(true);
  const [temporalLimit, setTemporalLimit] = useState(true);
  const [questime, setQuestime] = useState(60);
  const [questions, setQuestions] = useState<ActiveQuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Map of question id (1-based) to answer details
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, { key: string; text: string; isCorrect: boolean }>
  >({});
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isTimeExpired, setIsTimeExpired] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<number[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(() => Date.now());
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const [lastQuestionChangeTime, setLastQuestionChangeTime] = useState<number>(() => Date.now());

  // Anti-Cheat states
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(false);
  const [fullScreenLockEnabled, setFullScreenLockEnabled] = useState(false);
  const [tabSwitchesCount, setTabSwitchesCount] = useState(0);
  const [copyAttemptsCount, setCopyAttemptsCount] = useState(0);
  const [fullscreenExitsCount, setFullscreenExitsCount] = useState(0);
  const [antiCheatLogs, setAntiCheatLogs] = useState<
    Array<{ eventType: string; timestamp: string; details?: string }>
  >([]);
  const [antiCheatToast, setAntiCheatToast] = useState<string | null>(null);
  const [showFullScreenPrompt, setShowFullScreenPrompt] = useState(false);

  // Auto-submit guard ref
  const hasAutoSubmittedRef = useRef(false);

  // Anti-Cheat logger callback
  const logAntiCheatIncident = useCallback(
    async (eventType: "TAB_SWITCH" | "COPY_ATTEMPT" | "FULLSCREEN_EXIT", details: string) => {
      const timestamp = new Date().toISOString();
      const logEntry = { eventType, timestamp, details };

      setAntiCheatLogs((prev) => [...prev, logEntry]);

      if (eventType === "TAB_SWITCH") {
        setTabSwitchesCount((prev) => prev + 1);
        setAntiCheatToast("⚠️ Tab switch detected! This incident has been logged for your instructor.");
      } else if (eventType === "COPY_ATTEMPT") {
        setCopyAttemptsCount((prev) => prev + 1);
        setAntiCheatToast("⚠️ Copying text is blocked by quiz anti-cheat policy. Incident logged.");
      } else if (eventType === "FULLSCREEN_EXIT") {
        setFullscreenExitsCount((prev) => prev + 1);
        setAntiCheatToast("⚠️ Fullscreen mode exited! Incident logged for instructor review.");
      }

      setTimeout(() => setAntiCheatToast(null), 4500);

      if (sessionId) {
        try {
          await quizService.logAntiCheatEvent(sessionId, logEntry);
        } catch (e) {
          console.warn("Could not sync anti-cheat log in real-time:", e);
        }
      }
    },
    [sessionId]
  );

  // Load Quiz Data from Backend API
  useEffect(() => {
    let isMounted = true;

    async function loadQuizData() {
      setIsLoading(true);
      setError(null);

      try {
        let fetchedQuiz: Quiz | null = null;

        if (quizIdParam) {
          const res = await quizService.getQuiz(quizIdParam);
          if ((res?.data as any)?.isUndeployed) {
            setError(
              (res?.data as any)?.message ||
              "This quiz has not been deployed yet. Please wait for the host to launch it live before entering."
            );
            setIsLoading(false);
            return;
          }
          fetchedQuiz = res.data?.quiz;
        } else if (pinParam) {
          const cleanPin = pinParam.replace(/\D/g, "");
          const res = await quizService.getQuizByPin(cleanPin, user?.email);
          if ((res?.data as any)?.isUndeployed) {
            setError(
              (res?.data as any)?.message ||
              "This quiz has not been deployed yet. Please wait for the host to launch it live before entering."
            );
            setIsLoading(false);
            return;
          }
          fetchedQuiz = res.data?.quiz;
        } else {
          // If no specific quizId or pin is provided, redirect to the Live Battle Arena join screen.
          // Never drop the user directly into an unrequested active quiz session.
          router.replace("/join");
          return;
        }

        if (!isMounted) return;

        if (!fetchedQuiz) {
          setError(
            "No quiz target specified. Please select a quiz from your mission dashboard or enter a valid room PIN."
          );
          setIsLoading(false);
          return;
        }

        // Validate deployment status: non-owners cannot enter an undeployed or draft quiz
        const isPractice = searchParams.get("mode") === "practice" || searchParams.get("preview") === "true";
        const currentUserId = user?.userId || (user as any)?._id || (user as any)?.id;
        const isOwner = Boolean(
          user &&
          (
            (fetchedQuiz as any).ownerId === currentUserId ||
            (fetchedQuiz as any).userId === currentUserId ||
            (fetchedQuiz as any).ownerEmail === user.email
          )
        );
        const isDraft =
          (fetchedQuiz as any).status === "DRAFT" ||
          (!fetchedQuiz.isDeployed &&
            (fetchedQuiz as any).status !== "ANYTIME" &&
            (fetchedQuiz as any).status !== "LIVE");
        if (isDraft && !isPractice && !isOwner) {
          setError(
            "This quiz is currently a draft and has not been deployed yet. Please wait for the host to launch it before entering."
          );
          setIsLoading(false);
          return;
        }

        setQuizTitle(fetchedQuiz.title || "Interactive Assessment");
        setQuizId(fetchedQuiz.quizId);
        setQuizPin(fetchedQuiz.pin || pinParam || null);
        setImmediateResult(fetchedQuiz.immediateResult !== false);
        const hasTemporalLimit = fetchedQuiz.temporalLimit !== false;
        setTemporalLimit(hasTemporalLimit);
        const qTime = fetchedQuiz.questime || 60;
        setQuestime(qTime);
        const shouldShuffle = fetchedQuiz.dynamicShuffle !== false;

        // Anti-cheat settings from quiz definition
        const isAntiCheat = Boolean(fetchedQuiz.antiCheat);
        const isFullScreen = Boolean(fetchedQuiz.fullScreenLock || isAntiCheat);
        setAntiCheatEnabled(isAntiCheat);
        setFullScreenLockEnabled(isFullScreen);

        const backendQuestions = fetchedQuiz.questions || [];
        if (backendQuestions.length === 0) {
          setError("This quiz currently contains no verified questions.");
          setIsLoading(false);
          return;
        }

        const mapped: ActiveQuizQuestion[] = backendQuestions.map((q: any, idx: number) => {
          const rawLevel = (q.level || "MEDIUM").toUpperCase();
          const level: "EASY" | "MEDIUM" | "HARD" =
            rawLevel === "EASY" ? "EASY" : rawLevel === "HARD" ? "HARD" : "MEDIUM";
          const xp = level === "EASY" ? 100 : level === "HARD" ? 300 : 200;
          const explanation = q.explanation || "";

          const rawOptions = Array.isArray(q.options) ? q.options : [];
          let options: QuestionOption[] = rawOptions.map((opt: any, optIdx: number) => {
            const key = ["A", "B", "C", "D", "E"][optIdx] || String(optIdx + 1);
            const text = typeof opt === "string" ? opt : opt.text || "";
            const isCorrect = isCorrectOption(text, optIdx, q.answer);
            return {
              key,
              text,
              num: String(optIdx + 1),
              isCorrect,
            };
          });

          // Dynamic Shuffle: Randomize option ordering
          if (shouldShuffle && options.length > 1) {
            for (let i = options.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [options[i], options[j]] = [options[j], options[i]];
            }
            options.forEach((opt, oIdx) => {
              opt.key = ["A", "B", "C", "D", "E"][oIdx] || String(oIdx + 1);
              opt.num = String(oIdx + 1);
            });
          }

          const correctOpt = options.find((o) => o.isCorrect);

          const hasVisualMedia =
            Boolean(q.reference?.mediaUrl) &&
            (q.reference?.type === "IMAGE" || q.reference?.type === "VIDEO_FRAME");

          return {
            id: idx + 1,
            questionId: q.questionId || `q-${idx + 1}`,
            section: `MODULE ${(idx + 1).toString().padStart(2, "0")} // LEVEL: ${level}`,
            statement: q.question || "",
            level,
            xp,
            options,
            correctKey: correctOpt?.key || "A",
            correctText: correctOpt?.text || String(q.answer || ""),
            explanation,
            visualCaption: hasVisualMedia
              ? q.reference?.caption || `Exhibit ${(idx + 1).toString().padStart(2, "0")}`
              : undefined,
            reference: hasVisualMedia ? q.reference : undefined,
          };
        });

        setQuestions(mapped);
        setCurrentIdx(0);
        setSelectedAnswers({});
        setScore(0);
        setStreak(0);
        setTimeLeft(hasTemporalLimit ? mapped.length * qTime : 99999);
        setIsTimeExpired(false);
        hasAutoSubmittedRef.current = false;
        setQuizStartTime(Date.now());
        setLastQuestionChangeTime(Date.now());
        setQuestionTimes({});

        // Establish an attempt session in backend
        try {
          const attemptRes = await quizService.createAttempt(fetchedQuiz.quizId);
          const session = attemptRes.data?.session || attemptRes.data?.createSession;
          if (session?.sessionId) {
            setSessionId(session.sessionId);
          }
        } catch (attemptErr) {
          console.warn("Attempt session sync initialized in client mode:", attemptErr);
        }
      } catch (err: any) {
        console.error("Quiz loading error:", err);
        setError(err?.message || "Failed to load quiz telemetry.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadQuizData();

    return () => {
      isMounted = false;
    };
  }, [quizIdParam, pinParam]);

  // Live countdown timer: strictly stops at 0 and sets isTimeExpired
  useEffect(() => {
    if (!temporalLimit) return;
    if (timeLeft <= 0) {
      setIsTimeExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimeExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [temporalLimit, timeLeft]);

  // Anti-Cheat: Tab switch & blur monitoring
  useEffect(() => {
    if (!antiCheatEnabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logAntiCheatIncident("TAB_SWITCH", `Student switched tab at ${new Date().toLocaleTimeString()}`);
      }
    };

    const handleBlur = () => {
      logAntiCheatIncident("TAB_SWITCH", `Window lost focus at ${new Date().toLocaleTimeString()}`);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [antiCheatEnabled, logAntiCheatIncident]);

  // Anti-Cheat: Copy, cut, contextmenu, and inspection prevention
  useEffect(() => {
    if (!antiCheatEnabled) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logAntiCheatIncident("COPY_ATTEMPT", "Attempted to copy exam content to clipboard");
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      logAntiCheatIncident("COPY_ATTEMPT", "Attempted to cut exam text");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logAntiCheatIncident("COPY_ATTEMPT", "Right-click context menu blocked");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "c" || e.key === "C" || e.key === "u" || e.key === "U")) ||
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j"))
      ) {
        e.preventDefault();
        logAntiCheatIncident("COPY_ATTEMPT", `Blocked keyboard shortcut: ${e.ctrlKey ? "Ctrl+" : ""}${e.key}`);
      }
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [antiCheatEnabled, logAntiCheatIncident]);

  // Anti-Cheat: Full-screen mode change listener
  useEffect(() => {
    if (!fullScreenLockEnabled && !antiCheatEnabled) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logAntiCheatIncident("FULLSCREEN_EXIT", "Student exited fullscreen examination window");
        setShowFullScreenPrompt(true);
      } else {
        setShowFullScreenPrompt(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [fullScreenLockEnabled, antiCheatEnabled, logAntiCheatIncident]);

  const requestFullScreen = () => {
    if (typeof document !== "undefined") {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      }
      setShowFullScreenPrompt(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!temporalLimit) return "∞";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const currentQ = questions[currentIdx];
  const userSelection = currentQ ? selectedAnswers[currentQ.id] : undefined;

  const recordQuestionTime = () => {
    if (!currentQ) return;
    const now = Date.now();
    const elapsed = Math.max(1, Math.round((now - lastQuestionChangeTime) / 1000));
    setQuestionTimes((prev) => ({
      ...prev,
      [currentQ.questionId]: (prev[currentQ.questionId] || 0) + elapsed,
    }));
    setLastQuestionChangeTime(now);
  };

  // Reusable submit function for both normal completion and auto-submit on timer expiry
  const submitQuizAttempt = useCallback(
    async (isAutoSubmit = false) => {
      if (isSubmitting || hasAutoSubmittedRef.current) return;
      hasAutoSubmittedRef.current = true;
      setIsSubmitting(true);

      const totalTimeSpentSeconds = Math.max(1, Math.round((Date.now() - quizStartTime) / 1000));
      const finalQTime =
        (questionTimes[currentQ?.questionId || ""] || 0) +
        Math.max(1, Math.round((Date.now() - lastQuestionChangeTime) / 1000));

      let activeSessionId = sessionId;
      if (!activeSessionId && quizId) {
        try {
          const fallbackRes = await quizService.createAttempt(quizId);
          const fbSession = fallbackRes.data?.session || fallbackRes.data?.createSession;
          if (fbSession?.sessionId) {
            activeSessionId = fbSession.sessionId;
            setSessionId(fbSession.sessionId);
          }
        } catch (fbErr) {
          console.warn("Could not create fallback attempt session on submit:", fbErr);
        }
      }

      try {
        if (activeSessionId && currentQ) {
          const finalChoice = selectedAnswers[currentQ.id]?.text || "";
          await quizService.submitAttempt(activeSessionId, {
            questionId: currentQ.questionId,
            option: finalChoice,
            timeSpentSeconds: finalQTime,
            totalTimeSpentSeconds,
            tabSwitchesCount,
            copyAttemptsCount,
            fullscreenExitsCount,
            antiCheatLogs,
          });
        }
      } catch (err) {
        console.error("Submission error:", err);
      } finally {
        setIsSubmitting(false);
        if (typeof window !== "undefined" && activeSessionId) {
          try {
            localStorage.setItem(
              "qc_last_attempt",
              JSON.stringify({
                sessionId: activeSessionId,
                quizId: quizId || "",
                score,
                total: questions.length,
                totalTimeSpentSeconds,
              })
            );
          } catch (e) {
            console.warn("Could not cache last attempt:", e);
          }
        }
        router.push(
          `/results?quizId=${quizId || ""}&sessionId=${activeSessionId || ""}&score=${score}&total=${questions.length}${
            isAutoSubmit ? "&expired=true" : ""
          }`
        );
      }
    },
    [
      isSubmitting,
      quizStartTime,
      questionTimes,
      currentQ,
      lastQuestionChangeTime,
      sessionId,
      quizId,
      selectedAnswers,
      tabSwitchesCount,
      copyAttemptsCount,
      fullscreenExitsCount,
      antiCheatLogs,
      score,
      questions.length,
      router,
    ]
  );

  // Auto-submit effect when time expires
  useEffect(() => {
    if (isTimeExpired && !hasAutoSubmittedRef.current && !isSubmitting && questions.length > 0) {
      submitQuizAttempt(true);
    }
  }, [isTimeExpired, isSubmitting, questions.length, submitQuizAttempt]);

  const handleSelectAnswer = async (key: string, optionText: string, isCorrect: boolean) => {
    // If timer expired or currently submitting, completely prevent answering!
    if (!currentQ || isTimeExpired || (temporalLimit && timeLeft <= 0) || isSubmitting) {
      return;
    }

    // If immediateResult is enabled and user already answered, lock selection
    if (immediateResult && selectedAnswers[currentQ.id]) {
      return;
    }

    const wasAlreadyAnswered = Boolean(selectedAnswers[currentQ.id]);

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { key, text: optionText, isCorrect },
    }));

    if (immediateResult && !wasAlreadyAnswered) {
      if (isCorrect) {
        setStreak((prev) => prev + 1);
        setScore((prev) => prev + currentQ.xp);
      } else {
        setStreak(0);
      }
    }

    const currentSpent =
      (questionTimes[currentQ.questionId] || 0) +
      Math.max(1, Math.round((Date.now() - lastQuestionChangeTime) / 1000));

    // Telemetry update to backend
    if (sessionId) {
      try {
        await quizService.updateAnswer(sessionId, {
          questionId: currentQ.questionId,
          option: optionText,
          timeSpentSeconds: currentSpent,
        });
      } catch (err) {
        console.warn("Answer sync error:", err);
      }
    }
  };

  const handleToggleMark = () => {
    if (!currentQ) return;
    setMarkedQuestions((prev) =>
      prev.includes(currentQ.id)
        ? prev.filter((id) => id !== currentQ.id)
        : [...prev, currentQ.id]
    );
  };

  const handleNext = async () => {
    recordQuestionTime();
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      // Completed all questions — submit attempt
      await submitQuizAttempt(false);
    }
  };

  const handlePrev = () => {
    recordQuestionTime();
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen text-on-surface flex flex-col justify-between relative overflow-hidden">
        <CosmicCanvas />
        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary-container/20 border border-primary/40 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl animate-spin">
                progress_activity
              </span>
            </div>
            <h3 className="font-headline-lg text-lg font-bold mb-2">
              Synthesizing Mission Telemetry
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Loading verified question set and calibrating active session parameters...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || questions.length === 0 || !currentQ) {
    return (
      <div className="min-h-screen text-on-surface flex flex-col justify-between relative overflow-hidden">
        <CosmicCanvas />
        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-rose-500/30 bg-surface-container-lowest/90 backdrop-blur-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h3 className="font-headline-lg text-lg font-bold mb-2">Quiz Unavailable</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mb-6 leading-relaxed">
              {error || "Unable to retrieve question set for this quiz."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/profile"
                className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container border border-outline-variant/30 text-xs font-semibold transition-colors"
              >
                Mission Library
              </Link>
              <Link
                href="/create"
                className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold transition-colors"
              >
                Create New Quiz
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPct = (answeredCount / Math.max(1, questions.length)) * 100;
  const hasVisualMedia =
    Boolean(currentQ.reference?.mediaUrl) &&
    (currentQ.reference?.type === "IMAGE" || currentQ.reference?.type === "VIDEO_FRAME");

  return (
    <div className="min-h-screen text-on-surface font-body-md flex flex-col justify-between selection:bg-primary-container selection:text-on-primary relative overflow-x-hidden antialiased">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Floating Anti-Cheat Toast Warning */}
      {antiCheatToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-rose-500/90 text-white text-xs font-bold font-label-code shadow-2xl backdrop-blur-md border border-white/20 animate-bounce flex items-center gap-2">
          <span className="material-symbols-outlined text-base">warning</span>
          <span>{antiCheatToast}</span>
        </div>
      )}

      {/* Fullscreen Alert Prompt Modal */}
      {showFullScreenPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="max-w-md w-full bg-surface-container-lowest border border-amber-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-300">
              <span className="material-symbols-outlined text-3xl">fullscreen</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-headline-sm">
                Full-Screen Mode Required
              </h3>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                Anti-cheat security policy requires this assessment to be completed in full-screen mode. Please re-enter full-screen to continue.
              </p>
            </div>
            <button
              type="button"
              onClick={requestFullScreen}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs font-headline-sm transition-all cursor-pointer shadow-lg"
            >
              Enter Full-Screen Mode
            </button>
          </div>
        </div>
      )}

      {/* Top HUD Bar */}
      <header className="relative z-20 w-full pt-4 pb-2 px-4 sm:px-8 border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-xl">
        <div className="max-w-max-width-canvas mx-auto flex items-center justify-between gap-4">
          
          {/* Left: Brand Identity & Exam Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-on-surface hover:opacity-90 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">bolt</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-code text-xs text-primary font-bold tracking-wide">
                  QuizzCraft // ARENA
                </span>
                <span className="font-headline-sm text-xs text-on-surface font-semibold hidden sm:inline max-w-xs truncate">
                  {quizTitle}
                </span>
              </div>
            </Link>
          </div>

          {/* Right: Telemetry & Controls */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs font-label-code">
            
            {/* Anti-Cheat Shield Badge */}
            {antiCheatEnabled && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-300 font-bold">
                <span className="material-symbols-outlined text-xs">shield</span>
                <span className="hidden sm:inline">Proctored</span>
              </div>
            )}

            {/* Streak */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/30 text-primary-fixed border border-primary/30">
              <span className="material-symbols-outlined text-sm text-tertiary">electric_bolt</span>
              <span>{streak}x Streak (+{streak * 25} XP)</span>
            </div>

            {/* Room PIN Pill */}
            {quizPin && (
              <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high border border-primary/30 text-primary font-bold">
                <span className="material-symbols-outlined text-xs">pin</span>
                <span>PIN: {quizPin}</span>
              </div>
            )}

            {/* Score Pill */}
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/40 text-tertiary font-bold">
              <span className="material-symbols-outlined text-xs">stars</span>
              <span>{score} XP</span>
            </div>

            {/* Question Counter Pill */}
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/40">
              <span className="text-on-surface-variant">Question</span>
              <span className="text-primary font-bold text-sm">
                {(currentQ.id).toString().padStart(2, "0")}
              </span>
              <span className="text-on-surface-variant">/ {questions.length.toString().padStart(2, "0")}</span>
            </div>

            {/* Timer Pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${
              temporalLimit && timeLeft <= 30
                ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse font-bold"
                : "bg-surface-container-low border-primary-container/40 text-on-surface"
            }`}>
              <span className="material-symbols-outlined text-primary text-base">timer</span>
              <span className="text-primary font-bold tracking-wider text-sm font-mono">
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
        </div>

        {/* Precision Progress Bar */}
        <div className="max-w-max-width-canvas mx-auto w-full mt-3">
          <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden relative shadow-inner">
            <div
              className="h-full bg-primary rounded-full relative transition-all duration-500 ease-out shadow-[0_0_10px_rgba(139,92,246,0.4)]"
              style={{ width: `${Math.max(progressPct, 4)}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full blur-[1px] opacity-80" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-1 px-1 font-label-code text-[11px] text-on-surface-variant">
            <span>Session Progress</span>
            <span className="text-tertiary">
              {Math.round(progressPct)}% Complete ({answeredCount}/{questions.length})
            </span>
          </div>
        </div>
      </header>

      {/* Main Question Cockpit */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-8 py-6 max-w-max-width-canvas w-full mx-auto">
        <ParallaxReveal direction="up" distance={20} duration={650} className="w-full">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-2xl p-5 sm:p-8 shadow-2xl transition-all duration-300">
            
            {/* Time Expired Notice Banner */}
            {isTimeExpired && (
              <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs font-label-code flex items-center justify-between gap-3 animate-pulse mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400 text-base">alarm_off</span>
                  <span className="font-bold">
                    Assessment Time Has Expired! Options are locked. Telemetry is being finalized...
                  </span>
                </div>
                <span className="text-[11px] font-mono opacity-80">Lockdown Active</span>
              </div>
            )}

            {/* Card Meta & Mark Bookmark */}
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-label-code text-on-surface-variant">
                <span>
                  Question {currentQ.id} of {questions.length}
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant/40 text-primary-fixed font-bold">
                  {currentQ.level}
                </span>
                <span>•</span>
                <span className="text-tertiary">+{currentQ.xp} XP</span>
              </div>

              <button
                onClick={handleToggleMark}
                className={`flex items-center gap-1 text-xs font-label-code transition-colors cursor-pointer ${
                  markedQuestions.includes(currentQ.id)
                    ? "text-amber-accent font-bold"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {markedQuestions.includes(currentQ.id) ? "bookmark_added" : "bookmark"}
                </span>
                <span className="hidden sm:inline">
                  {markedQuestions.includes(currentQ.id) ? "Marked for Review" : "Mark for Review"}
                </span>
              </button>
            </div>

            {/* Question Statement */}
            <div className="mb-6">
              <h2 className="text-lg sm:text-2xl font-headline-lg text-on-surface font-semibold leading-relaxed tracking-tight">
                {currentQ.statement}
              </h2>
            </div>

            {/* Center Grid: If visual media exists, show 2-column. If not, show rich, centered full-width layout! */}
            <div
              className={
                hasVisualMedia
                  ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                  : "w-full max-w-4xl mx-auto flex flex-col gap-4"
              }
            >
              {/* Media Column (ONLY when image/video exists) */}
              {hasVisualMedia && (
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <div className="relative rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-low group shadow-lg">
                    <div className="aspect-video sm:aspect-square w-full relative overflow-hidden bg-surface-container-lowest flex items-center justify-center">
                      {currentQ.reference?.type === "VIDEO_FRAME" ? (
                        <div className="relative w-full h-full bg-black flex items-center justify-center">
                          <video
                            key={`${currentQ.reference.mediaUrl}-${currentQ.reference.timestamp}`}
                            className="w-full h-full object-contain"
                            src={`${currentQ.reference.mediaUrl}${
                              currentQ.reference.timestamp
                                ? `#t=${parseTimestampToSeconds(currentQ.reference.timestamp)}`
                                : ""
                            }`}
                            controls
                            playsInline
                            preload="metadata"
                          />
                          {currentQ.reference.timestamp && (
                            <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-white/20 font-label-code text-[10px] text-amber-300 flex items-center gap-1 pointer-events-none">
                              <span className="material-symbols-outlined text-xs">play_circle</span>
                              <span>Frame @ {currentQ.reference.timestamp}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <img
                          alt={currentQ.reference?.caption || "Question Reference Exhibit"}
                          className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500 opacity-95 hover:opacity-100"
                          src={currentQ.reference?.mediaUrl}
                        />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent pointer-events-none" />

                      {/* Telemetry chip */}
                      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded bg-surface-container-lowest/85 backdrop-blur-md border border-outline-variant/30 font-label-code text-[11px] text-tertiary flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                        <span>Level: {currentQ.level} ({currentQ.xp} XP)</span>
                      </div>
                    </div>

                    <div className="p-2.5 border-t border-outline-variant/20 bg-surface-container-low/70 flex items-center justify-between text-xs">
                      <p className="font-body-sm text-[11px] text-on-surface-variant italic truncate pr-2">
                        {currentQ.reference?.caption ||
                          currentQ.visualCaption ||
                          `Exhibit ${currentQ.id.toString().padStart(2, "0")}`}
                      </p>
                      <span className="font-label-code text-[10px] text-emerald-400 uppercase tracking-wider shrink-0">
                        Grounded
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* No-Media Rich Context Banner */}
              {!hasVisualMedia && (
                <div className="p-3 rounded-xl bg-surface-container/50 border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs font-label-code text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-tertiary">help</span>
                    <span>Choose the single most accurate option below:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {antiCheatEnabled && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px]">
                        🛡️ Proctored Exam
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        immediateResult
                          ? "bg-tertiary/20 text-tertiary border border-tertiary/40"
                          : "bg-surface-container-high text-on-surface-variant border border-outline-variant/40"
                      }`}
                    >
                      {immediateResult ? "Immediate Feedback" : "Standard Mode"}
                    </span>
                  </div>
                </div>
              )}

              {/* Options Column */}
              <div
                className={
                  hasVisualMedia
                    ? "lg:col-span-7 flex flex-col gap-3"
                    : "w-full flex flex-col gap-3"
                }
              >
                {currentQ.options.map((opt) => {
                  const isSelected = userSelection?.key === opt.key;

                  let optionStyle =
                    "border border-outline-variant/30 bg-surface-container-low/60 hover:bg-surface-container/70 hover:border-outline-variant/60";
                  let badgeStyle =
                    "bg-surface-container-high border border-outline-variant/40 text-on-surface-variant group-hover:text-primary group-hover:border-primary";
                  let indicatorIcon = null;

                  if (immediateResult && userSelection) {
                    if (opt.isCorrect) {
                      optionStyle =
                        "border-2 border-emerald-500/90 bg-emerald-950/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/40";
                      badgeStyle = "bg-emerald-500 text-white font-bold";
                      indicatorIcon = (
                        <span className="material-symbols-outlined text-xs font-bold text-emerald-400">
                          check
                        </span>
                      );
                    } else if (isSelected && !opt.isCorrect) {
                      optionStyle =
                        "border-2 border-rose-500/90 bg-rose-950/40 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.25)] ring-1 ring-rose-400/40";
                      badgeStyle = "bg-rose-500 text-white font-bold";
                      indicatorIcon = (
                        <span className="material-symbols-outlined text-xs font-bold text-rose-400">
                          close
                        </span>
                      );
                    } else {
                      optionStyle = "opacity-50 border border-outline-variant/20 bg-surface-container-low/30";
                    }
                  } else if (isSelected) {
                    optionStyle =
                      "border-2 border-primary-container bg-surface-container-high/90 shadow-[0_0_25px_-5px_rgba(160,120,255,0.45),0_0_10px_rgba(76,215,246,0.25)] ring-1 ring-tertiary/40";
                    badgeStyle = "bg-primary text-on-primary shadow-md";
                    indicatorIcon = (
                      <span className="material-symbols-outlined text-xs font-bold text-white">
                        check
                      </span>
                    );
                  }

                  const isDisabled =
                    isSubmitting ||
                    isTimeExpired ||
                    (temporalLimit && timeLeft <= 0) ||
                    (immediateResult && Boolean(userSelection));

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectAnswer(opt.key, opt.text, opt.isCorrect)}
                      className={`w-full text-left rounded-xl p-4 transition-all duration-200 group flex items-start gap-3 relative overflow-hidden active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed ${optionStyle}`}
                    >
                      {/* Key Letter Badge */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-lg font-headline-sm text-xs font-bold flex items-center justify-center transition-colors ${badgeStyle}`}
                      >
                        {opt.key}
                      </div>

                      {/* Statement */}
                      <div className="flex-1 pt-0.5">
                        <p
                          className={`text-xs sm:text-sm leading-relaxed ${
                            isSelected ? "text-on-surface font-medium" : "text-on-surface"
                          }`}
                        >
                          {opt.text}
                        </p>
                      </div>

                      {/* Indicator */}
                      <div className="flex-shrink-0 flex items-center gap-2 self-center">
                        <span className="font-label-code text-[11px] text-outline">
                          [{opt.num}]
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-primary-container text-white shadow-[0_0_8px_rgba(160,120,255,0.8)]"
                              : "border-2 border-outline-variant group-hover:border-outline"
                          }`}
                        >
                          {indicatorIcon}
                        </div>
                      </div>

                      {/* Side highlight stripe */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary" />
                      )}
                    </button>
                  );
                })}

                {/* Immediate Result Explanation Box */}
                {immediateResult && userSelection && (
                  <div
                    className={`rounded-xl p-4 border mt-2 transition-all duration-300 ${
                      userSelection.isCorrect
                        ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-100"
                        : "bg-surface-container-high/90 border-primary/30 text-on-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-outline-variant/20">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-tertiary">
                          {userSelection.isCorrect ? "verified" : "lightbulb"}
                        </span>
                        <span className="font-label-code text-xs font-bold uppercase tracking-wider text-tertiary">
                          Explanation
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-label-code px-2 py-0.5 rounded-full font-bold ${
                          userSelection.isCorrect
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        }`}
                      >
                        {userSelection.isCorrect
                          ? `+${currentQ.xp} XP AWARDED`
                          : "INCORRECT CALIBRATION"}
                      </span>
                    </div>
                    <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                      {currentQ.explanation || "No explanation recorded for this question."}
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </ParallaxReveal>
      </main>

      {/* ============================================================ */}
      {/* BOTTOM CONTROL BAR:                                          */}
      {/* LEFT: Flag Question + Question Array                         */}
      {/* RIGHT: Prev & Next Adjacent Buttons                          */}
      {/* ============================================================ */}
      <footer className="relative z-20 w-full pb-6 pt-2 px-4 sm:px-8">
        <div className="max-w-max-width-canvas mx-auto bg-surface-container-low/85 backdrop-blur-xl border border-outline-variant/30 rounded-2xl p-3 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
          
          {/* LEFT SIDE: Flag Question + Question Array Matrix */}
          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto justify-between md:justify-start">
            <button
              type="button"
              onClick={handleToggleMark}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-label-code transition-colors shrink-0 cursor-pointer ${
                markedQuestions.includes(currentQ.id)
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold"
                  : "bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {markedQuestions.includes(currentQ.id) ? "bookmark_added" : "flag"}
              </span>
              <span className="hidden sm:inline">
                {markedQuestions.includes(currentQ.id) ? "Flagged" : "Flag Question"}
              </span>
            </button>

            {/* Question Array Matrix */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 font-label-code text-xs max-w-xs sm:max-w-md">
              {questions.map((q, idx) => {
                const isDone = Boolean(selectedAnswers[q.id]);
                const isCurrent = idx === currentIdx;
                const isFlagged = markedQuestions.includes(q.id);
                const answer = selectedAnswers[q.id];

                let btnColor =
                  "bg-surface-container border border-outline-variant/30 text-outline hover:text-on-surface";

                if (isCurrent) {
                  btnColor =
                    "bg-primary text-on-primary shadow-md shadow-primary/30 ring-2 ring-tertiary scale-110";
                } else if (isDone) {
                  if (immediateResult) {
                    btnColor = answer?.isCorrect
                      ? "bg-emerald-950/60 border border-emerald-500/60 text-emerald-400"
                      : "bg-rose-950/60 border border-rose-500/60 text-rose-400";
                  } else {
                    btnColor = "bg-surface-container-high border border-tertiary/40 text-tertiary";
                  }
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-7 h-7 flex-shrink-0 rounded-lg font-bold flex items-center justify-center transition-all relative cursor-pointer ${btnColor}`}
                  >
                    {q.id}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDE: Previous & Next Buttons Adjacent to Each Other */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIdx === 0 || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 hover:border-outline text-on-surface font-headline-sm text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Previous</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm border border-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>
                {currentIdx === questions.length - 1
                  ? isSubmitting
                    ? "Submitting Telemetry..."
                    : "Submit & View Results"
                  : "Next Question"}
              </span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

        </div>
      </footer>
    </div>
  );
}

export default function ActiveQuizPlatformPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen relative flex items-center justify-center bg-surface text-on-surface">
            <div className="w-10 h-10 rounded-xl bg-primary-container/20 border border-primary/40 flex items-center justify-center text-primary animate-pulse">
              <span className="material-symbols-outlined text-2xl animate-spin">
                progress_activity
              </span>
            </div>
          </div>
        }
      >
        <ActiveQuizPlatformContent />
      </Suspense>
    </ProtectedRoute>
  );
}
