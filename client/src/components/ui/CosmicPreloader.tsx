"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// In-memory session flag: runs full preloader on initial website load or hard refresh,
// while keeping internal client-side SPA route navigations instant.
let hasPreloadedThisSession = false;

const CRITICAL_IMAGES = [
  "/images/logo-icon.png",
  "/stitch/screen-6-cosmic-portal-3d.png",
];

export default function CosmicPreloader() {
  const router = useRouter();

  const [isVisible, setIsVisible] = useState(() => !hasPreloadedThisSession);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(15);
  const [statusMessage, setStatusMessage] = useState("Initializing Cosmic Starfield...");

  useEffect(() => {
    if (hasPreloadedThisSession) {
      setIsVisible(false);
      return;
    }

    // Lock body scroll during initial preloading sequence
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let isMounted = true;

    // Phase 1: Prefetch critical heavy Next.js route bundles
    try {
      router.prefetch("/");
      router.prefetch("/quizzes");
      router.prefetch("/create");
      router.prefetch("/join");
    } catch {
      // Ignored if prefetch is unavailable
    }

    // Phase 2: Preload critical fonts, heavy imagery & GPU layout settlement
    const preloadAssets = async () => {
      // Step A: Preload critical images into browser cache
      const imagePromises = CRITICAL_IMAGES.map((src) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = img.onerror = () => resolve();
        });
      });

      // Step B: Wait for web fonts & icon glyphs (prevents icon text flash)
      const fontsPromise =
        typeof document !== "undefined" && document.fonts
          ? document.fonts.ready.catch(() => {})
          : Promise.resolve();

      // Step C: Double rAF to ensure GPU composite layer and Canvas ready
      const rafPromise = new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      await Promise.all([...imagePromises, fontsPromise, rafPromise]);
    };

    const assetLoadingPromise = preloadAssets();

    // Phase 3: Smooth progress bar interpolation
    const startTime = Date.now();
    const minLoadDuration = 700; // ms minimum for smooth visual transition
    const maxTimeout = 2200; // safety ceiling to never trap user

    const interval = setInterval(() => {
      if (!isMounted) return;

      const elapsed = Date.now() - startTime;
      const timeProgress = Math.min(90, Math.floor((elapsed / minLoadDuration) * 90));

      setProgress((prev) => {
        const next = Math.max(prev, timeProgress);
        if (next < 35) {
          setStatusMessage("Initializing Cosmic Starfield...");
        } else if (next < 65) {
          setStatusMessage("Preloading Spatial Fonts & Assets...");
        } else if (next < 90) {
          setStatusMessage("Warming Interactive Engine...");
        }
        return next;
      });
    }, 30);

    // Phase 4: Resolution & fade-out trigger
    const completeSequence = async () => {
      // Wait for both assets and minimum duration to pass
      await Promise.race([
        Promise.all([
          assetLoadingPromise,
          new Promise((res) => setTimeout(res, minLoadDuration)),
        ]),
        new Promise((res) => setTimeout(res, maxTimeout)),
      ]);

      if (!isMounted) return;

      clearInterval(interval);
      setProgress(100);
      setStatusMessage("Launch Ready");

      // Brief settle at 100% before smooth fade-out
      setTimeout(() => {
        if (!isMounted) return;
        setIsFadingOut(true);

        // Remove from DOM once fade transition finishes
        setTimeout(() => {
          if (!isMounted) return;
          hasPreloadedThisSession = true;
          setIsVisible(false);
          document.body.style.overflow = originalOverflow;
        }, 650);
      }, 150);
    };

    completeSequence();

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.body.style.overflow = originalOverflow;
    };
  }, [router]);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Loading QuizzCraft"
      aria-live="polite"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#05070f] select-none transition-all duration-700 ease-out ${
        isFadingOut
          ? "opacity-0 pointer-events-none scale-[1.03] blur-[2px]"
          : "opacity-100 scale-100"
      }`}
    >
      {/* Subtle Ambient Cosmic Aura */}
      <div className="absolute w-[450px] h-[450px] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
      <div className="absolute w-[350px] h-[350px] rounded-full bg-tertiary/10 blur-[120px] pointer-events-none" />

      {/* Center Console Container */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm w-full">
        {/* Logo with starlight rim highlight */}
        <div className="relative mb-4">
          <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md animate-pulse" />
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-white/20 bg-surface-container-high/90 shadow-2xl flex items-center justify-center">
            <img
              src="/images/logo-icon.png"
              alt="QuizzCraft Logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Brand Title */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-headline-sm text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            QuizzCraft<span className="text-tertiary">.app</span>
          </span>
        </div>

        <p className="font-label-code text-[11px] text-on-surface-variant uppercase tracking-widest mb-6">
          Next-Gen Quiz Platform
        </p>

        {/* Precision Progress Bar */}
        <div className="w-56 sm:w-64 h-1.5 bg-white/10 rounded-full overflow-hidden relative shadow-inner">
          <div
            className="h-full bg-primary rounded-full transition-all duration-200 ease-out shadow-[0_0_12px_rgba(139,92,246,0.7)] relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full blur-[1px] opacity-90" />
          </div>
        </div>

        {/* Status Message & Percentage */}
        <div className="w-56 sm:w-64 flex justify-between items-center mt-3 font-label-code text-[11px] text-on-surface-variant">
          <span className="truncate max-w-[180px] text-left">{statusMessage}</span>
          <span className="text-primary font-bold ml-2">{Math.round(progress)}%</span>
        </div>
      </div>
    </aside>
  );
}
