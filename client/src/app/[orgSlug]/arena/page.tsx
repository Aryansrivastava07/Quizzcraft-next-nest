"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import OrgWorkspaceGuard from "@/components/org/OrgWorkspaceGuard";
import { orgService } from "@/lib/api/org-service";
import { Quiz, Organization } from "@/lib/api/types";

export default function OrgSlugArenaPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || "";

  return (
    <OrgWorkspaceGuard orgSlug={orgSlug}>
      {({ organization }) => (
        <OrgArenaContent organization={organization} orgSlug={orgSlug} />
      )}
    </OrgWorkspaceGuard>
  );
}

function OrgArenaContent({
  organization,
  orgSlug,
}: {
  organization: Organization;
  orgSlug: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [liveQuizzes, setLiveQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLiveQuizzes();
  }, [orgSlug]);

  const loadLiveQuizzes = async () => {
    setIsLoading(true);
    try {
      const res = await orgService.getOrgQuizzesBySlug(orgSlug);
      if (res?.data?.quizzes) {
        setLiveQuizzes(res.data.quizzes.filter((q) => q.status === "LIVE"));
      }
    } catch (e) {
      // Silent error
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    router.push(`/quiz?pin=${encodeURIComponent(pin.trim())}`);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16 flex flex-col items-center">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-sm">swords</span>
            {organization.name} Synchronized Arena
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Institutional Live Exam Arena
          </h1>
          <p className="text-on-surface-variant text-xs sm:text-sm mt-2">
            Enter your assessment PIN or jump into an active multiplayer room hosted by your cohort instructor.
          </p>
        </div>

        {/* PIN Entry Card */}
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#0b0e1b]/90 border border-white/10 backdrop-blur-xl shadow-2xl mb-12">
          <form onSubmit={handleJoinByPin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-on-surface-variant block text-center mb-2">
                Enter 6-Digit Live Examination PIN
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="000 000"
                className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-center font-mono tracking-widest text-2xl text-white font-bold outline-none focus:border-amber-400 transition-colors placeholder:text-outline"
              />
            </div>

            <button
              type="submit"
              disabled={!pin.trim()}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-amber-500/20"
            >
              Enter Live Arena
            </button>
          </form>
        </div>

        {/* Active Live Rooms in this Org */}
        <div className="w-full">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            Currently Active Institutional Rooms ({liveQuizzes.length})
          </h2>

          {isLoading ? (
            <div className="py-12 flex justify-center">
              <span className="material-symbols-outlined text-3xl text-primary animate-spin">
                progress_activity
              </span>
            </div>
          ) : liveQuizzes.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0b0e1b]/60 border border-white/10 text-center text-xs text-on-surface-variant">
              No live examination rooms are active in {organization.name} right now. Scheduled exams will appear here automatically when launched by instructors.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {liveQuizzes.map((quiz) => (
                <div
                  key={quiz.quizId}
                  className="p-5 rounded-2xl bg-[#0b0e1b]/80 border border-white/10 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                      ● LIVE NOW
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{quiz.title}</h3>
                    <p className="text-xs font-mono text-outline mt-0.5">PIN: {quiz.pin}</p>
                  </div>

                  <Link
                    href={`/quiz?quizId=${encodeURIComponent(quiz.quizId)}`}
                    className="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-md shadow-primary-container/25 border border-white/10 transition-all shrink-0 active:scale-95 cursor-pointer"
                  >
                    Join Room
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
