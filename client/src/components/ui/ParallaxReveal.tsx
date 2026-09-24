"use client";

import React, { useEffect, useRef, useState } from "react";

export interface ParallaxRevealProps {
  children: React.ReactNode;
  /** Direction of spatial emergence ("up" | "down" | "left" | "right" | "none") */
  direction?: "up" | "down" | "left" | "right" | "none";
  /** 2D translation distance in px (default: 36) */
  distance?: number;
  /** Delay before animation starts in ms (default: 0) */
  delay?: number;
  /** Duration of transition in ms (default: 850) */
  duration?: number;
  /** Continuous active scroll parallax speed multiplier (e.g. 0.015) */
  parallaxSpeed?: number;
  /** Additional CSS class names on outer perspective wrapper */
  className?: string;
  /** IntersectionObserver threshold from 0 to 1 (default: 0.08) */
  threshold?: number;
  /** Reveal style: "space" (3D cosmic emergence), "slide" (standard 2D), or "fade" */
  variant?: "space" | "slide" | "fade";
  /** Distance recessed in deep space along Z-axis in px (default: -130) */
  depth?: number;
  /** Forward pitch angle in degrees (default: 8.5) */
  pitch?: number;
  /** Initial scale in deep space before emergence (default: 0.90) */
  scale?: number;
  /** Atmospheric cosmic blur filter in px before emergence (default: 6) */
  blur?: number;
  /** 3D Perspective frustum depth in px (default: 1200) */
  perspective?: number;
  /** Whether to gently float in zero-g after settling (default: false) */
  ambientFloat?: boolean;
  /** Stagger delay in seconds before ambient float starts (default: 0) */
  floatDelay?: number;
}

export default function ParallaxReveal({
  children,
  direction = "up",
  distance = 36,
  delay = 0,
  duration = 850,
  parallaxSpeed = 0,
  className = "",
  threshold = 0.08,
  variant = "space",
  depth = -130,
  pitch = 8.5,
  scale = 0.90,
  blur = 6,
  perspective = 1200,
  ambientFloat = false,
  floatDelay = 0,
}: ParallaxRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [scrollYOffset, setScrollYOffset] = useState(0);
  const [scrollPitch, setScrollPitch] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Check for prefers-reduced-motion accessibility setting
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Viewport intersection observer & initial paint trigger
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const rect = el.getBoundingClientRect();

    // If already scrolled past above current viewport, show immediately without transition
    if (rect.bottom < 0) {
      setIsVisible(true);
      return;
    }

    // If inside initial viewport on mount (e.g. Hero section), schedule trigger so the initial
    // unrevealed frame is painted first, enabling a smooth cinematic entrance on load
    if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    }

    // For elements further down the page, trigger as they enter viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  // Once revealed, wait for transition to finish before allowing ambient zero-g float
  useEffect(() => {
    if (isVisible && ambientFloat) {
      const timer = setTimeout(() => {
        setIsSettled(true);
      }, delay + duration + 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, ambientFloat, delay, duration]);

  // Subtle continuous scroll parallax & micro-pitch
  useEffect(() => {
    if (!parallaxSpeed || prefersReducedMotion) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (elementRef.current) {
            const rect = elementRef.current.getBoundingClientRect();
            const viewportCenter = window.innerHeight / 2;
            const elementCenter = rect.top + rect.height / 2;
            const diff = (elementCenter - viewportCenter) * parallaxSpeed;
            setScrollYOffset(diff);

            // Subtle continuous micro-pitch along X-axis (±2.5deg max)
            const pitchDiff = ((elementCenter - viewportCenter) / window.innerHeight) * 2.8;
            setScrollPitch(Math.max(-2.5, Math.min(2.5, pitchDiff)));
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [parallaxSpeed, prefersReducedMotion]);

  // Initial transform state (in deep space)
  const getInitialTransform = () => {
    if (prefersReducedMotion) return "none";

    if (variant === "slide") {
      switch (direction) {
        case "up":
          return `translate3d(0, ${distance}px, 0)`;
        case "down":
          return `translate3d(0, -${distance}px, 0)`;
        case "left":
          return `translate3d(${distance}px, 0, 0)`;
        case "right":
          return `translate3d(-${distance}px, 0, 0)`;
        case "none":
        default:
          return "translate3d(0, 0, 0)";
      }
    }

    if (variant === "fade") {
      return "none";
    }

    // Space-depth emergence: recessed in Z-space, scaled down, pitched along horizon, with translation
    switch (direction) {
      case "up":
        return `translate3d(0, ${distance}px, ${depth}px) scale(${scale}) rotateX(${pitch}deg)`;
      case "down":
        return `translate3d(0, -${distance}px, ${depth}px) scale(${scale}) rotateX(-${pitch}deg)`;
      case "left":
        return `translate3d(${distance}px, 0, ${depth}px) scale(${scale}) rotateY(-${pitch}deg) rotateX(2.5deg)`;
      case "right":
        return `translate3d(-${distance}px, 0, ${depth}px) scale(${scale}) rotateY(${pitch}deg) rotateX(2.5deg)`;
      case "none":
      default:
        return `translate3d(0, 0, ${depth}px) scale(${scale}) rotateX(${pitch * 0.75}deg)`;
    }
  };

  // Revealed transform state (docked in viewport focus, responsive to scroll parallax)
  const getRevealedTransform = () => {
    if (prefersReducedMotion) return "none";

    if (variant === "space") {
      return `translate3d(0, ${scrollYOffset.toFixed(1)}px, 0px) scale(1) rotateX(${scrollPitch.toFixed(2)}deg)`;
    }

    return parallaxSpeed
      ? `translate3d(0, ${scrollYOffset.toFixed(1)}px, 0)`
      : "translate3d(0, 0, 0)";
  };

  return (
    <div
      ref={elementRef}
      className={`relative ${className}`}
      style={{
        perspective: prefersReducedMotion ? undefined : `${perspective}px`,
        perspectiveOrigin: "50% 50%",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Motion & Reveal Layer */}
      <div
        className="w-full h-full"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? getRevealedTransform() : getInitialTransform(),
          filter: prefersReducedMotion
            ? "none"
            : isVisible
            ? "blur(0px)"
            : `blur(${blur}px)`,
          transition: prefersReducedMotion
            ? "opacity 300ms ease"
            : `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, filter ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
          transformStyle: "preserve-3d",
          willChange: !isSettled ? "transform, opacity, filter" : "auto",
        }}
      >
        {/* Zero-G Ambient Float Layer (kicks in gracefully once settled) */}
        <div
          className={`w-full h-full ${
            isSettled && ambientFloat && !prefersReducedMotion ? "cosmic-card-float" : ""
          }`}
          style={{
            animationDelay: floatDelay ? `${floatDelay}s` : undefined,
            transformStyle: "preserve-3d",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
