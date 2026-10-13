"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { quizService } from "@/lib/api/quiz-service";
import { formatApiError } from "@/lib/api/client";
import { Quiz } from "@/lib/api/types";

interface CopyQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: {
    quizId: string;
    title: string;
    accessMode?: string;
    orgId?: string;
  } | null;
  onSuccess?: (copiedQuiz: Quiz) => void;
}

type TargetWorkspace = "PUBLIC" | "ORGANIZATION" | "PRIVATE";

export default function CopyQuizModal({
  isOpen,
  onClose,
  quiz,
  onSuccess,
}: CopyQuizModalProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [targetWorkspace, setTargetWorkspace] = useState<TargetWorkspace>("PUBLIC");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedQuiz, setCopiedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    if (quiz) {
      setTitle(`Copy of ${quiz.title}`);
      setError(null);
      setCopiedQuiz(null);

      // Default smart workspace selection:
      // If quiz is currently in an org, default target to PUBLIC or PRIVATE to allow easily exporting!
      // If currently PUBLIC, default to user's org (if any) or PRIVATE.
      if (quiz.orgId) {
        setTargetWorkspace("PUBLIC");
      } else if (user?.orgId) {
        setTargetWorkspace("ORGANIZATION");
      } else {
        setTargetWorkspace("PRIVATE");
      }
    }
  }, [quiz, user]);

  if (!isOpen || !quiz) return null;

  const userHasOrg = Boolean(user?.orgId || user?.orgSlug);
  const orgDisplayName = user?.institution || (user?.orgSlug ? `/${user.orgSlug}` : "Organization");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for the copy.");
      return;
    }

    if (targetWorkspace === "ORGANIZATION" && !userHasOrg) {
      setError("You are not currently enrolled in an organization workspace.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await quizService.copyQuiz(quiz.quizId, {
        title: title.trim(),
        targetWorkspace,
        orgId: targetWorkspace === "ORGANIZATION" ? user?.orgId : undefined,
      });

      if (res?.data?.quiz) {
        setCopiedQuiz(res.data.quiz);
        if (onSuccess) {
          onSuccess(res.data.quiz);
        }
      } else {
        throw new Error("Backend did not return copied quiz data.");
      }
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl bg-[#0b0e1b] border border-white/10 p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-md">
              <span className="material-symbols-outlined text-xl">content_copy</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-headline-sm tracking-tight">
                Duplicate &amp; Copy Assessment
              </h3>
              <p className="text-xs text-on-surface-variant font-body-sm mt-0.5">
                Clone into Public, Institutional, or Private sandboxes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-on-surface-variant hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5">
            <span className="material-symbols-outlined text-red-400 text-base shrink-0 mt-0.5">
              error
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* Success View */}
        {copiedQuiz ? (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Quiz Copied Successfully!</h4>
              <p className="text-xs text-on-surface-variant mt-1">
                Your new copy <strong className="text-white">"{copiedQuiz.title}"</strong> is ready in the{" "}
                <strong className="text-primary">{targetWorkspace}</strong> workspace.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-mono text-outline inline-block">
              PIN: <strong className="text-white tracking-widest">{copiedQuiz.pin}</strong>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/editor?quizId=${encodeURIComponent(copiedQuiz.quizId)}`);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Open in Quiz Editor</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium border border-white/10 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Copy Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title Input */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                New Quiz Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Copy of Assessment..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Target Destination Cards */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-2">
                Select Destination Workspace
              </label>

              <div className="space-y-2">
                {/* 1. Public Workspace */}
                <div
                  onClick={() => setTargetWorkspace("PUBLIC")}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    targetWorkspace === "PUBLIC"
                      ? "bg-primary-container/15 border-primary/50 shadow-md shadow-primary-container/15"
                      : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    targetWorkspace === "PUBLIC" ? "bg-primary text-white" : "bg-white/10 text-on-surface-variant"
                  }`}>
                    <span className="material-symbols-outlined text-lg">public</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Public Arena Workspace</span>
                      {targetWorkspace === "PUBLIC" && (
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-[11px] mt-0.5 leading-relaxed">
                      Discoverable across all public Explore Arenas. Anyone can search and challenge it.
                    </p>
                  </div>
                </div>

                {/* 2. Organization Workspace */}
                <div
                  onClick={() => {
                    if (userHasOrg) {
                      setTargetWorkspace("ORGANIZATION");
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                    !userHasOrg
                      ? "opacity-50 cursor-not-allowed bg-white/[0.01] border-white/5"
                      : targetWorkspace === "ORGANIZATION"
                      ? "bg-primary-container/15 border-primary/50 shadow-md shadow-primary-container/15 cursor-pointer"
                      : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] cursor-pointer"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    targetWorkspace === "ORGANIZATION" ? "bg-primary text-white" : "bg-white/10 text-on-surface-variant"
                  }`}>
                    <span className="material-symbols-outlined text-lg">apartment</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        {userHasOrg ? `${orgDisplayName} Workspace` : "Organization Workspace"}
                      </span>
                      {targetWorkspace === "ORGANIZATION" && (
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-[11px] mt-0.5 leading-relaxed">
                      {userHasOrg
                        ? `Sandboxed strictly inside ${orgDisplayName}. Only members of your organization can access it.`
                        : "Join or register an organization workspace to copy quizzes here."}
                    </p>
                  </div>
                </div>

                {/* 3. Private / Personal Sandbox */}
                <div
                  onClick={() => setTargetWorkspace("PRIVATE")}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                    targetWorkspace === "PRIVATE"
                      ? "bg-primary-container/15 border-primary/50 shadow-md shadow-primary-container/15"
                      : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    targetWorkspace === "PRIVATE" ? "bg-primary text-white" : "bg-white/10 text-on-surface-variant"
                  }`}>
                    <span className="material-symbols-outlined text-lg">lock</span>
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Private Personal Sandbox</span>
                      {targetWorkspace === "PRIVATE" && (
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-[11px] mt-0.5 leading-relaxed">
                      Strictly personal draft. Completely private and hidden from public and cohort discovery.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md border border-white/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    <span>Creating Copy...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    <span>Create Copy in {targetWorkspace}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
