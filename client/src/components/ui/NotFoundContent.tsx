"use client";

import React from "react";
import Link from "next/link";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import AuthFooter from "@/components/layout/AuthFooter";

export default function NotFoundContent() {
  return (
    <div className="min-h-screen relative overflow-x-hidden antialiased flex flex-col justify-between bg-surface text-on-surface">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Top Navbar */}
      <Navbar />

      {/* Main 404 Stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 pt-32 pb-20">
        <ParallaxReveal direction="up" distance={25} duration={650} className="w-full max-w-xl text-center">
          <div className="p-8 sm:p-12 rounded-3xl glass-kage border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden flex flex-col items-center">
            {/* Ambient Nebula Flare */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-tertiary/15 rounded-full blur-3xl pointer-events-none" />

            {/* Glowing Anomaly Badge */}
            <div className="w-20 h-20 rounded-2xl bg-surface-container-high/80 border border-primary/30 flex items-center justify-center text-primary mb-6 shadow-lg shadow-primary-container/10 relative">
              <span className="material-symbols-outlined text-4xl animate-pulse">
                explore_off
              </span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-tertiary animate-ping" />
            </div>

            {/* Pill Header */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 text-xs font-label-code text-tertiary mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              <span>404 // ROUTE NOT FOUND</span>
            </div>

            {/* Primary Headline */}
            <h1 className="text-3xl sm:text-4xl font-headline-xl font-extrabold text-white tracking-tight mb-3">
              Page Not Found
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-sm font-body-md text-on-surface-variant max-w-md mx-auto mb-8 leading-relaxed">
              The page or orbital coordinate you requested does not exist in this sector. It may have been moved, renamed, or never existed.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">home</span>
                <span>Return to Home</span>
              </Link>

              <Link
                href="/join"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-surface-container hover:bg-surface-bright text-on-surface hover:text-white font-headline-sm text-xs font-semibold border border-outline-variant/40 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base text-tertiary">
                  sports_esports
                </span>
                <span>Join Live Quiz</span>
              </Link>
            </div>
          </div>
        </ParallaxReveal>
      </main>

      {/* Reusable Footer */}
      <AuthFooter copyrightText="© 2026 QuizzCraft.app • Route Navigation Guard" />
    </div>
  );
}
