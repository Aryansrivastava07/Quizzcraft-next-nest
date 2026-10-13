"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";

function QuizAdminRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizIdParam = searchParams.get("quizId");

  useEffect(() => {
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

    if (targetQuizId) {
      router.replace(`/quiz/review/${encodeURIComponent(targetQuizId)}`);
    } else {
      router.replace("/quizzes");
    }
  }, [quizIdParam, router]);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-white relative">
      <CosmicCanvas />
      <div className="relative z-10 text-center space-y-3 p-6 max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-surface-container border border-white/10 flex items-center justify-center mx-auto animate-spin text-tertiary">
          <span className="material-symbols-outlined text-2xl">sync</span>
        </div>
        <h2 className="text-base font-bold font-headline-sm">
          Redirecting to Arena Review & Telemetry...
        </h2>
        <p className="text-xs text-on-surface-variant font-mono">
          Unified command center & leaderboard
        </p>
      </div>
    </div>
  );
}

export default function QuizAdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <QuizAdminRedirectContent />
    </Suspense>
  );
}
