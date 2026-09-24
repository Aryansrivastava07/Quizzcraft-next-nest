"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import AuthFooter from "@/components/layout/AuthFooter";

interface RouteAuthConfig {
  badge: string;
  title: string;
  description: string;
  icon: string;
  actionText: string;
  secondaryAction?: {
    label: string;
    href: string;
    icon?: string;
  };
}

const ROUTE_AUTH_CONFIGS: Record<string, RouteAuthConfig> = {
  "/create": {
    badge: "CREATOR STUDIO",
    title: "Login to Create a Quiz",
    description:
      "You must be signed in to your QuizzCraft account to build AI-powered quizzes, upload study documents, and generate interactive challenges.",
    icon: "draw",
    actionText: "Sign In to Create Quiz",
  },
  "/create-quiz": {
    badge: "CREATOR STUDIO",
    title: "Login to Create a Quiz",
    description:
      "You must be signed in to your QuizzCraft account to build AI-powered quizzes, upload study documents, and generate interactive challenges.",
    icon: "draw",
    actionText: "Sign In to Create Quiz",
  },
  "/editor": {
    badge: "QUIZ EDITOR",
    title: "Login to Edit Quiz",
    description:
      "Authentication is required to customize questions, configure scoring parameters, and refine AI-generated quiz drafts.",
    icon: "tune",
    actionText: "Sign In to Edit Quiz",
  },
  "/deploy": {
    badge: "MISSION LAUNCH",
    title: "Login to Deploy Quiz",
    description:
      "Please sign in to schedule live challenges, activate anti-cheat protocols, and generate PIN access codes.",
    icon: "rocket_launch",
    actionText: "Sign In to Deploy Quiz",
  },
  "/profile": {
    badge: "PILOT PROFILE",
    title: "Login to View Profile",
    description:
      "Sign in to track your XP, review quiz history, check battle achievements, and manage your account settings.",
    icon: "account_circle",
    actionText: "Sign In to Access Profile",
  },
  "/quiz": {
    badge: "LIVE ARENA",
    title: "Login to Play Quiz",
    description:
      "Sign in with your account to participate in active challenges, earn XP, and log your achievements on the leaderboard. If you have an arena PIN, you can join directly.",
    icon: "sports_esports",
    actionText: "Sign In to Play Quiz",
    secondaryAction: {
      label: "Join with PIN",
      href: "/join",
      icon: "pin",
    },
  },
  "/results": {
    badge: "DEBRIEF & ANALYTICS",
    title: "Login to View Quiz Results",
    description:
      "Authentication is required to view your detailed performance breakdown, rank analytics, and orbital leaderboard standing.",
    icon: "military_tech",
    actionText: "Sign In to View Results",
  },
};

const DEFAULT_AUTH_CONFIG: RouteAuthConfig = {
  badge: "AUTHENTICATION REQUIRED",
  title: "Login Required",
  description:
    "You must be signed in with your QuizzCraft account to access this feature. Please sign in or create an account to proceed.",
  icon: "lock",
  actionText: "Sign In to Continue",
};

export default function AuthRequiredContent() {
  const pathname = usePathname() || "/";

  // Find matching config for current route
  let config = ROUTE_AUTH_CONFIGS[pathname];
  if (!config) {
    const matchedKey = Object.keys(ROUTE_AUTH_CONFIGS).find((route) =>
      pathname.startsWith(`${route}/`)
    );
    config = matchedKey ? ROUTE_AUTH_CONFIGS[matchedKey] : DEFAULT_AUTH_CONFIG;
  }

  const redirectUrl = `/auth?redirect=${encodeURIComponent(pathname)}`;

  return (
    <div className="min-h-screen relative overflow-x-hidden antialiased flex flex-col justify-between bg-surface text-on-surface">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Top Navbar */}
      <Navbar />

      {/* Main Authentication Requirement Stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 pt-32 pb-20">
        <ParallaxReveal
          direction="up"
          distance={25}
          duration={650}
          className="w-full max-w-xl text-center"
        >
          <div className="p-8 sm:p-12 rounded-3xl glass-kage border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden flex flex-col items-center">
            {/* Ambient Nebula Flare */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-tertiary/15 rounded-full blur-3xl pointer-events-none" />

            {/* Glowing Reason Icon Badge */}
            <div className="w-20 h-20 rounded-2xl bg-surface-container-high/80 border border-primary/30 flex items-center justify-center text-primary mb-6 shadow-lg shadow-primary-container/10 relative">
              <span className="material-symbols-outlined text-4xl animate-pulse">
                {config.icon}
              </span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
            </div>

            {/* Pill Header */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-label-code text-primary mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>{config.badge}</span>
            </div>

            {/* Primary Headline */}
            <h1 className="text-2xl sm:text-4xl font-headline-xl font-extrabold text-white tracking-tight mb-3">
              {config.title}
            </h1>

            {/* Clear Reason Description */}
            <p className="text-xs sm:text-sm font-body-md text-on-surface-variant max-w-md mx-auto mb-8 leading-relaxed">
              {config.description}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
              <Link
                href={redirectUrl}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>{config.actionText}</span>
              </Link>

              {config.secondaryAction && (
                <Link
                  href={config.secondaryAction.href}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-surface-container hover:bg-surface-bright text-on-surface hover:text-white font-headline-sm text-xs font-semibold border border-outline-variant/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base text-tertiary">
                    {config.secondaryAction.icon || "arrow_forward"}
                  </span>
                  <span>{config.secondaryAction.label}</span>
                </Link>
              )}

              <Link
                href="/"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-container-low/60 hover:bg-surface-container text-on-surface-variant hover:text-white font-label-code text-xs border border-outline-variant/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">home</span>
                <span>Return Home</span>
              </Link>
            </div>
          </div>
        </ParallaxReveal>
      </main>

      {/* Reusable Auth / Layout Footer */}
      <AuthFooter />
    </div>
  );
}
