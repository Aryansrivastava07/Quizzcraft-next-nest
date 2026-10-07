"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import QuizReviewPage from "./[quizId]/page";

function QuizReviewSearchParamWrapper() {
  const searchParams = useSearchParams();
  const quizId = searchParams.get("quizId") || "";

  if (!quizId) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-white">
        <div className="text-center p-8">
          <p className="text-sm text-on-surface-variant mb-4">No quiz ID specified for review.</p>
          <a href="/quizzes" className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/20 border border-white/10 transition-all">
            Explore Public Quizzes
          </a>
        </div>
      </div>
    );
  }

  // Create a resolved promise that matches the PageProps params expected by QuizReviewPage
  const paramsPromise = Promise.resolve({ quizId });

  return <QuizReviewPage params={paramsPromise} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <QuizReviewSearchParamWrapper />
    </Suspense>
  );
}
