"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-400">
        <span className="material-symbols-outlined text-3xl">warning</span>
      </div>
      <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
      <p className="text-on-surface-variant text-sm mt-2 max-w-md">
        An unexpected error occurred during execution.
      </p>
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-white/[0.04] text-white text-xs font-semibold hover:bg-white/[0.08] transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
