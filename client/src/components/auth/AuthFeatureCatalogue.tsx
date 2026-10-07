"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface FeatureSlide {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  tags: string[];
}

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    id: "ai-generator",
    badge: "Multimodal AI Engine",
    badgeColor: "text-primary bg-primary/10 border-primary/30",
    title: "Turn Notes & Lectures into Interactive Quizzes",
    description:
      "Drop lecture PDFs, syllabus slides, or YouTube links. Multimodal AI extracts key formulas and concepts into balanced quizzes in seconds.",
    tags: ["PDF & Slides", "Video & Audio", "Under 60s Generation"],
  },
  {
    id: "live-arena",
    badge: "Real-Time Arenas",
    badgeColor: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    title: "Host Multiplayer Battles & Live Classrooms",
    description:
      "Connect cadets instantly via 6-digit game PINs. Compete live with real-time blitz countdowns, live sync, and streak multipliers.",
    tags: ["Instant Game PIN", "Blitz Timers", "Multiplayer Sync"],
  },
  {
    id: "cohorts",
    badge: "Institutional Cohorts",
    badgeColor: "text-tertiary bg-tertiary/10 border-tertiary/30",
    title: "Study Groups, Discussion Rooms & Gradebooks",
    description:
      "Manage private cohorts with expiring invite codes, thread-linked question discussions, and instructor gradebooks with 1-click CSV export.",
    tags: ["Cohort Codes", "Discussion Rooms", "Gradebook CSV"],
  },
  {
    id: "mastery",
    badge: "Adaptive Analytics",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    title: "Deep Mastery Radar & Global Podiums",
    description:
      "Track concept mastery across speed and retention. Celebrate top performers on live 3D podiums with detailed XP telemetry.",
    tags: ["Concept Radar", "Podium Steps", "XP Telemetry"],
  },
];

// 1. AI Multimodal Document Ingestion & Synthesis Illustration
function AIGeneratorIllustration() {
  return (
    <svg
      viewBox="0 0 360 170"
      className="w-full h-full max-h-[160px]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="docGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0b0f19" />
        </linearGradient>
        <linearGradient id="aiGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#090d16" />
        </linearGradient>
      </defs>

      {/* Subtle background flow paths */}
      <path
        d="M100 85 H150 M210 85 H260"
        stroke="#334155"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* Left Source Document Card */}
      <g transform="translate(25, 28)">
        <rect
          width="76"
          height="104"
          rx="10"
          fill="url(#docGrad)"
          stroke="#475569"
          strokeWidth="1.2"
        />
        {/* Folded corner */}
        <path d="M62 0 H76 L76 14 Z" fill="#64748b" opacity="0.6" />
        {/* PDF Badge */}
        <rect
          x="10"
          y="10"
          width="26"
          height="12"
          rx="3"
          fill="#8b5cf6"
          fillOpacity="0.25"
          stroke="#8b5cf6"
          strokeWidth="0.8"
        />
        <text
          x="15"
          y="19"
          fill="#c4b5fd"
          fontSize="7"
          fontWeight="bold"
          fontFamily="monospace"
        >
          PDF
        </text>
        {/* Document Skeleton Lines */}
        <rect x="10" y="30" width="54" height="4" rx="2" fill="#64748b" />
        <rect x="10" y="39" width="44" height="4" rx="2" fill="#334155" />
        <rect x="10" y="48" width="50" height="4" rx="2" fill="#334155" />
        <rect x="10" y="57" width="34" height="4" rx="2" fill="#334155" />
        {/* Video / Formula icon */}
        <rect
          x="10"
          y="70"
          width="56"
          height="18"
          rx="4"
          fill="#1e1b4b"
          stroke="#8b5cf6"
          strokeWidth="0.6"
        />
        <circle cx="20" cy="79" r="4" fill="#a855f7" />
        <polygon points="19,77 23,79 19,81" fill="#ffffff" />
        <rect x="29" y="77" width="30" height="4" rx="1.5" fill="#c4b5fd" />
      </g>

      {/* Center AI Neural Core */}
      <g transform="translate(180, 85)">
        <circle r="30" fill="#0f172a" stroke="url(#aiGlow)" strokeWidth="1.5" />
        <circle r="22" fill="#1e1b4b" stroke="#8b5cf6" strokeWidth="0.8" />
        {/* Sparkle icon */}
        <path
          d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z"
          fill="url(#aiGlow)"
        />
        <circle cx="-16" cy="-15" r="2" fill="#06b6d4" />
        <circle cx="15" cy="15" r="2" fill="#8b5cf6" />
        <circle cx="16" cy="-14" r="1.5" fill="#c084fc" />
      </g>

      {/* Right Output Quiz Question Card */}
      <g transform="translate(260, 28)">
        <rect
          width="76"
          height="104"
          rx="10"
          fill="url(#cardGrad)"
          stroke="#06b6d4"
          strokeWidth="1.2"
          strokeOpacity="0.8"
        />
        {/* Header tag */}
        <rect
          x="8"
          y="9"
          width="22"
          height="10"
          rx="3"
          fill="#06b6d4"
          fillOpacity="0.2"
        />
        <text
          x="12"
          y="16.5"
          fill="#67e8f9"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          Q 01
        </text>
        <circle cx="66" cy="14" r="3" fill="#10b981" />
        {/* Question prompt lines */}
        <rect x="8" y="25" width="60" height="4" rx="2" fill="#94a3b8" />
        <rect x="8" y="32" width="46" height="4" rx="2" fill="#64748b" />
        {/* Choice A */}
        <rect
          x="8"
          y="42"
          width="60"
          height="14"
          rx="3"
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="0.8"
        />
        <circle cx="14" cy="49" r="2.5" fill="#475569" />
        <rect x="20" y="47.5" width="36" height="3" rx="1.5" fill="#64748b" />
        {/* Choice B (Correct) */}
        <rect
          x="8"
          y="60"
          width="60"
          height="15"
          rx="3"
          fill="#064e3b"
          fillOpacity="0.4"
          stroke="#10b981"
          strokeWidth="1"
        />
        <circle cx="14" cy="67.5" r="2.5" fill="#10b981" />
        <rect x="20" y="66" width="38" height="3" rx="1.5" fill="#a7f3d0" />
        {/* Ready Badge */}
        <rect
          x="8"
          y="82"
          width="60"
          height="12"
          rx="3"
          fill="#1e1b4b"
          stroke="#8b5cf6"
          strokeWidth="0.6"
        />
        <text
          x="15"
          y="90.5"
          fill="#c4b5fd"
          fontSize="5.5"
          fontWeight="bold"
          fontFamily="monospace"
        >
          ✓ 15 QUESTIONS READY
        </text>
      </g>
    </svg>
  );
}

// 2. Real-Time Multiplayer Live Arena Illustration
function LiveArenaIllustration() {
  return (
    <svg
      viewBox="0 0 360 170"
      className="w-full h-full max-h-[160px]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Concentric radar rings */}
      <circle
        cx="180"
        cy="85"
        r="75"
        stroke="#334155"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.4"
      />
      <circle
        cx="180"
        cy="85"
        r="50"
        stroke="#475569"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.6"
      />

      {/* Main Game Console Center Card */}
      <g transform="translate(125, 42)">
        <rect
          width="110"
          height="82"
          rx="12"
          fill="#0f172a"
          stroke="#8b5cf6"
          strokeWidth="1.2"
        />
        {/* Top live beacon */}
        <circle cx="16" cy="16" r="3.5" fill="#ef4444" />
        <text
          x="24"
          y="19"
          fill="#fca5a5"
          fontSize="7"
          fontWeight="bold"
          fontFamily="monospace"
        >
          LIVE ARENA
        </text>
        <rect
          x="72"
          y="10"
          width="28"
          height="12"
          rx="3"
          fill="#3b0764"
          stroke="#a855f7"
          strokeWidth="0.8"
        />
        <text
          x="76"
          y="18.5"
          fill="#e9d5ff"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          42 IN
        </text>

        {/* Room PIN Box */}
        <rect
          x="10"
          y="28"
          width="90"
          height="24"
          rx="6"
          fill="#1e1b4b"
          stroke="#6366f1"
          strokeWidth="0.8"
        />
        <text
          x="16"
          y="37"
          fill="#94a3b8"
          fontSize="5.5"
          fontFamily="monospace"
        >
          GAME PIN
        </text>
        <text
          x="16"
          y="47"
          fill="#38bdf8"
          fontSize="10"
          fontWeight="bold"
          fontFamily="monospace"
          letterSpacing="1"
        >
          QC-884-219
        </text>

        {/* Progress timer bar */}
        <rect x="10" y="60" width="90" height="5" rx="2.5" fill="#1e293b" />
        <rect x="10" y="60" width="62" height="5" rx="2.5" fill="#f59e0b" />
        <text
          x="10"
          y="73"
          fill="#94a3b8"
          fontSize="5"
          fontFamily="monospace"
        >
          ROUND 04 / 15
        </text>
      </g>

      {/* Satellite Cadet 1 (Top Left) */}
      <g transform="translate(30, 28)">
        <rect
          width="70"
          height="32"
          rx="8"
          fill="#1e293b"
          stroke="#06b6d4"
          strokeWidth="1"
        />
        <circle cx="16" cy="16" r="8" fill="#0891b2" />
        <text x="12" y="19" fill="#ffffff" fontSize="7" fontWeight="bold">
          AL
        </text>
        <text x="28" y="14" fill="#ffffff" fontSize="7" fontWeight="bold">
          Alex V.
        </text>
        <text
          x="28"
          y="23"
          fill="#34d399"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          +850 XP
        </text>
      </g>

      {/* Satellite Streak (Bottom Left) */}
      <g transform="translate(25, 110)">
        <rect
          width="75"
          height="32"
          rx="8"
          fill="#451a03"
          fillOpacity="0.8"
          stroke="#f59e0b"
          strokeWidth="1"
        />
        <text x="10" y="17" fill="#fef08a" fontSize="7.5" fontWeight="bold">
          🔥 4x STREAK
        </text>
        <text x="10" y="25" fill="#fed7aa" fontSize="6" fontFamily="monospace">
          Blitz Speed
        </text>
      </g>

      {/* Satellite Timer (Top Right) */}
      <g transform="translate(260, 26)">
        <rect
          width="74"
          height="34"
          rx="8"
          fill="#1e293b"
          stroke="#f59e0b"
          strokeWidth="1"
        />
        <circle
          cx="17"
          cy="17"
          r="8"
          fill="#78350f"
          stroke="#f59e0b"
          strokeWidth="1"
        />
        <text
          x="12"
          y="20"
          fill="#fef08a"
          fontSize="7"
          fontWeight="bold"
          fontFamily="monospace"
        >
          12s
        </text>
        <text x="29" y="14" fill="#f1f5f9" fontSize="6.5" fontWeight="bold">
          Blitz Timer
        </text>
        <text x="29" y="24" fill="#94a3b8" fontSize="5.5" fontFamily="monospace">
          Auto Next
        </text>
      </g>

      {/* Satellite Cadet 2 (Bottom Right) */}
      <g transform="translate(258, 110)">
        <rect
          width="76"
          height="32"
          rx="8"
          fill="#1e293b"
          stroke="#8b5cf6"
          strokeWidth="1"
        />
        <circle cx="16" cy="16" r="8" fill="#6d28d9" />
        <text x="12" y="19" fill="#ffffff" fontSize="7" fontWeight="bold">
          SV
        </text>
        <text x="28" y="14" fill="#ffffff" fontSize="7" fontWeight="bold">
          Cadet_09
        </text>
        <text
          x="28"
          y="23"
          fill="#38bdf8"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          1st Place
        </text>
      </g>
    </svg>
  );
}

// 3. Cohort Groups, Discussion Rooms & Gradebook Illustration
function CohortsIllustration() {
  return (
    <svg
      viewBox="0 0 360 170"
      className="w-full h-full max-h-[160px]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Branch lines */}
      <path
        d="M100 85 Q135 85 155 60 M100 85 Q135 85 155 115"
        stroke="#334155"
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />
      <path
        d="M245 60 Q265 85 285 85 M245 115 Q265 85 285 85"
        stroke="#334155"
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />

      {/* Cohort Identity Card (Left) */}
      <g transform="translate(20, 38)">
        <rect
          width="82"
          height="88"
          rx="10"
          fill="#0f172a"
          stroke="#8b5cf6"
          strokeWidth="1.2"
        />
        <rect
          x="8"
          y="10"
          width="24"
          height="12"
          rx="3"
          fill="#3b0764"
          stroke="#c084fc"
          strokeWidth="0.8"
        />
        <text
          x="11"
          y="18"
          fill="#e9d5ff"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          COHORT
        </text>
        <circle cx="70" cy="16" r="3" fill="#10b981" />

        <text x="8" y="38" fill="#ffffff" fontSize="8.5" fontWeight="bold">
          Quantum A
        </text>
        <text x="8" y="49" fill="#94a3b8" fontSize="6.5" fontFamily="monospace">
          QC-9B41
        </text>

        <rect
          x="8"
          y="60"
          width="66"
          height="16"
          rx="4"
          fill="#1e1b4b"
          stroke="#8b5cf6"
          strokeWidth="0.6"
        />
        <text
          x="12"
          y="71"
          fill="#c4b5fd"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          👥 38 Learners
        </text>
      </g>

      {/* Discussion Card (Top Right) */}
      <g transform="translate(135, 22)">
        <rect
          width="118"
          height="48"
          rx="8"
          fill="#0f172a"
          stroke="#06b6d4"
          strokeWidth="1"
        />
        <circle cx="15" cy="16" r="6" fill="#0e7490" />
        <text x="12" y="18.5" fill="#ffffff" fontSize="6" fontWeight="bold">
          P
        </text>
        <text x="25" y="14" fill="#ffffff" fontSize="6.5" fontWeight="bold">
          Partner Notice
        </text>
        <text x="25" y="22" fill="#06b6d4" fontSize="5.5" fontFamily="monospace">
          Pinned Thread
        </text>
        <text x="8" y="36" fill="#e2e8f0" fontSize="6">
          "Review Superposition for Exam 2"
        </text>
      </g>

      {/* Gradebook Matrix Card (Bottom Right) */}
      <g transform="translate(135, 88)">
        <rect
          width="118"
          height="62"
          rx="8"
          fill="#0f172a"
          stroke="#10b981"
          strokeWidth="1"
        />
        <text
          x="8"
          y="15"
          fill="#10b981"
          fontSize="6.5"
          fontWeight="bold"
          fontFamily="monospace"
        >
          GRADEBOOK MATRIX
        </text>
        <rect x="86" y="8" width="24" height="9" rx="2.5" fill="#064e3b" />
        <text
          x="89"
          y="14.5"
          fill="#6ee7b7"
          fontSize="5"
          fontWeight="bold"
          fontFamily="monospace"
        >
          CSV
        </text>

        {/* Progress bar row 1 */}
        <rect x="8" y="24" width="20" height="4" rx="1.5" fill="#64748b" />
        <rect x="34" y="24" width="60" height="4" rx="1.5" fill="#1e293b" />
        <rect x="34" y="24" width="56" height="4" rx="1.5" fill="#10b981" />
        <text x="98" y="28" fill="#6ee7b7" fontSize="5.5" fontFamily="monospace">
          96%
        </text>

        {/* Progress bar row 2 */}
        <rect x="8" y="35" width="20" height="4" rx="1.5" fill="#64748b" />
        <rect x="34" y="35" width="60" height="4" rx="1.5" fill="#1e293b" />
        <rect x="34" y="35" width="48" height="4" rx="1.5" fill="#06b6d4" />
        <text x="98" y="39" fill="#67e8f9" fontSize="5.5" fontFamily="monospace">
          88%
        </text>

        {/* Progress bar row 3 */}
        <rect x="8" y="46" width="20" height="4" rx="1.5" fill="#64748b" />
        <rect x="34" y="46" width="60" height="4" rx="1.5" fill="#1e293b" />
        <rect x="34" y="46" width="52" height="4" rx="1.5" fill="#8b5cf6" />
        <text x="98" y="50" fill="#c4b5fd" fontSize="5.5" fontFamily="monospace">
          92%
        </text>
      </g>

      {/* Floating Status Badge (Right) */}
      <g transform="translate(275, 58)">
        <rect
          width="65"
          height="48"
          rx="8"
          fill="#1e1b4b"
          stroke="#a855f7"
          strokeWidth="1"
        />
        <circle cx="32" cy="18" r="8" fill="#6b21a8" />
        <path
          d="M29 18 L31 20 L36 15"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="10"
          y="35"
          fill="#e9d5ff"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          100% GRADED
        </text>
      </g>
    </svg>
  );
}

// 4. Adaptive Mastery Radar & Global Podium Illustration
function MasteryRadarIllustration() {
  return (
    <svg
      viewBox="0 0 360 170"
      className="w-full h-full max-h-[160px]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="podiumGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="goldPodium" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
      </defs>

      {/* Radar Chart (Left) */}
      <g transform="translate(70, 85)" opacity="0.9">
        <polygon
          points="0,-42 40,-13 24,34 -24,34 -40,-13"
          fill="#0f172a"
          stroke="#334155"
          strokeWidth="1"
        />
        <polygon
          points="0,-28 26,-8 16,22 -16,22 -26,-8"
          fill="#1e293b"
          stroke="#475569"
          strokeWidth="0.8"
        />
        <polygon
          points="0,-36 32,-4 12,26 -18,18 -34,-9"
          fill="#06b6d4"
          fillOpacity="0.25"
          stroke="#06b6d4"
          strokeWidth="1.5"
        />
        {/* Axes */}
        <line x1="0" y1="0" x2="0" y2="-42" stroke="#334155" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="40" y2="-13" stroke="#334155" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="24" y2="34" stroke="#334155" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="-24" y2="34" stroke="#334155" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="-40" y2="-13" stroke="#334155" strokeWidth="0.8" />
        {/* Radar Labels */}
        <text
          x="-10"
          y="-45"
          fill="#94a3b8"
          fontSize="5.5"
          fontFamily="monospace"
        >
          SPEED
        </text>
        <text
          x="32"
          y="-16"
          fill="#94a3b8"
          fontSize="5.5"
          fontFamily="monospace"
        >
          ACCURACY
        </text>
        <text
          x="16"
          y="42"
          fill="#94a3b8"
          fontSize="5.5"
          fontFamily="monospace"
        >
          MASTERY
        </text>
      </g>

      {/* Podium Steps (Right) */}
      <g transform="translate(215, 38)">
        {/* Crown on #1 */}
        <path
          d="M42 22 L45 30 L50 24 L55 30 L58 22 L50 34 Z"
          fill="#fbbf24"
          stroke="#d97706"
          strokeWidth="1"
        />
        <circle cx="50" cy="18" r="2.5" fill="#ffffff" />

        {/* Step 2 (Left) */}
        <rect
          x="2"
          y="62"
          width="30"
          height="62"
          rx="5"
          fill="url(#podiumGrad)"
          stroke="#64748b"
          strokeWidth="1"
        />
        <text
          x="12"
          y="82"
          fill="#cbd5e1"
          fontSize="13"
          fontWeight="bold"
          fontFamily="monospace"
        >
          2
        </text>
        <text
          x="5"
          y="95"
          fill="#94a3b8"
          fontSize="5.5"
          fontFamily="monospace"
        >
          92% ACC
        </text>

        {/* Step 1 (Center) */}
        <rect
          x="34"
          y="44"
          width="32"
          height="80"
          rx="5"
          fill="url(#goldPodium)"
          stroke="#f59e0b"
          strokeWidth="1.5"
        />
        <text
          x="45"
          y="66"
          fill="#fef08a"
          fontSize="15"
          fontWeight="bold"
          fontFamily="monospace"
        >
          1
        </text>
        <text
          x="38"
          y="80"
          fill="#fbbf24"
          fontSize="6"
          fontWeight="bold"
          fontFamily="monospace"
        >
          2,450 XP
        </text>

        {/* Step 3 (Right) */}
        <rect
          x="68"
          y="76"
          width="30"
          height="48"
          rx="5"
          fill="url(#podiumGrad)"
          stroke="#78350f"
          strokeWidth="1"
        />
        <text
          x="78"
          y="95"
          fill="#fed7aa"
          fontSize="13"
          fontWeight="bold"
          fontFamily="monospace"
        >
          3
        </text>
        <text
          x="72"
          y="107"
          fill="#94a3b8"
          fontSize="5.5"
          fontFamily="monospace"
        >
          88% ACC
        </text>
      </g>
    </svg>
  );
}

export default function AuthFeatureCatalogue() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const SLIDE_DURATION = 5500; // 5.5 seconds per slide

  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % FEATURE_SLIDES.length);
    }, SLIDE_DURATION);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, activeIndex]);

  const currentSlide = FEATURE_SLIDES[activeIndex];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % FEATURE_SLIDES.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + FEATURE_SLIDES.length) % FEATURE_SLIDES.length);
  };

  const renderIllustration = () => {
    switch (currentSlide.id) {
      case "ai-generator":
        return <AIGeneratorIllustration />;
      case "live-arena":
        return <LiveArenaIllustration />;
      case "cohorts":
        return <CohortsIllustration />;
      case "mastery":
        return <MasteryRadarIllustration />;
      default:
        return <AIGeneratorIllustration />;
    }
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full max-w-[460px] mx-auto my-auto flex flex-col justify-between select-none"
    >
      {/* Top Header: Brand Logo & Slide Counter */}
      <div className="flex items-center justify-between pb-3">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/15 flex items-center justify-center shadow-md bg-surface-container-high shrink-0 group-hover:border-primary transition-all">
            <img
              src="/images/logo-icon.png"
              alt="QuizzCraft Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-headline-sm text-base text-white font-extrabold tracking-tight">
            QuizzCraft<span className="text-tertiary">.app</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-label-code text-on-surface-variant">
          <span className="text-white font-bold">{activeIndex + 1}</span>
          <span>/</span>
          <span>{FEATURE_SLIDES.length}</span>
        </div>
      </div>

      {/* Main Feature Showcase Container */}
      <div className="my-auto py-2">
        {/* Badge & Title */}
        <div className="mb-3">
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-label-code font-bold uppercase tracking-wider border mb-1.5 ${currentSlide.badgeColor}`}
          >
            {currentSlide.badge}
          </span>
          <h2 className="text-lg font-headline-sm font-bold text-white tracking-tight leading-snug">
            {currentSlide.title}
          </h2>
          <p className="text-xs text-on-surface-variant font-body-sm leading-relaxed mt-1 line-clamp-2">
            {currentSlide.description}
          </p>
        </div>

        {/* Compact Vector Illustration Frame */}
        <div className="relative rounded-2xl border border-white/10 bg-[#090d16]/80 backdrop-blur-xl shadow-xl overflow-hidden p-3.5 flex items-center justify-center min-h-[170px]">
          {/* Subtle Starlight Accent Highlight */}
          <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

          {renderIllustration()}
        </div>

        {/* Feature Tags Ribbon */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {currentSlide.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-[10px] font-medium text-on-surface-variant"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom Segmented Navigation Tabs */}
      <div className="pt-3 border-t border-white/10">
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          {FEATURE_SLIDES.map((slide, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative py-1.5 px-2 rounded-xl text-left transition-all cursor-pointer border ${
                  isActive
                    ? "bg-white/[0.08] border-primary/50 text-white shadow-sm"
                    : "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 text-on-surface-variant hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-code text-[9px] font-bold block">
                    0{idx + 1}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-semibold block truncate mt-0.5">
                  {idx === 0
                    ? "Generator"
                    : idx === 1
                    ? "Live Arena"
                    : idx === 2
                    ? "Cohorts"
                    : "Mastery"}
                </span>

                {/* Progress bar fill */}
                {isActive && !isPaused && (
                  <div className="absolute left-0 bottom-0 right-0 h-[2px] bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-100 ease-linear"
                      style={{
                        animation: `progressFill ${SLIDE_DURATION}ms linear forwards`,
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Carousel controls */}
        <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1 font-label-code">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px]">Catalogue Auto-Advancing</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-on-surface-variant hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Previous Slide"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-on-surface-variant hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Next Slide"
            >
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progressFill {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
