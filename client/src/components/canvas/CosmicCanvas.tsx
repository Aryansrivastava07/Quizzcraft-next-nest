"use client";

import { useEffect, useRef, useState } from "react";

interface Star3D {
  x: number;
  y: number;
  z: number;
  pz: number; // Previous z position for drawing true 3D velocity streaks
  baseSize: number;
  colorRgb: string;
  maxAlpha: number;
}

export default function CosmicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  // Subtle background mount transition
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(timer);
  }, []);

  // Smooth scroll parallax listener for React state (used by DOM ambient layers)
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // 3D Perspective Frustum Parameters
    const MAX_DEPTH = 1800;
    const FOV = 320;
    const STAR_COUNT = Math.floor(Math.min(480, Math.max(220, (width * height) / 3600)));

    const stars: Star3D[] = [];

    // Soft, subdued cosmic starlight palette (tasteful, non-blinding)
    const starColorPalettes = [
      "223, 226, 241", // Soft starlight white
      "125, 211, 252", // Soft nebula cyan
      "195, 192, 255", // Twilight lavender
      "245, 215, 120", // Muted celestial gold
    ];

    const resetStar = (star: Star3D, initial = false) => {
      // Broad conical spread across the 3D viewing frustum
      const spread = width * 1.5;
      star.x = (Math.random() - 0.5) * spread;
      star.y = (Math.random() - 0.5) * spread * (height / width);
      star.z = initial ? Math.random() * MAX_DEPTH + 1 : MAX_DEPTH;
      star.pz = star.z;
      star.baseSize = Math.random() * 1.4 + 0.8;
      star.colorRgb =
        starColorPalettes[Math.floor(Math.random() * starColorPalettes.length)];
      // Subdued max alpha so it's elegant and not overly vibrant
      star.maxAlpha = Math.random() * 0.28 + 0.38;
    };

    const initStars = () => {
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        const star: Star3D = {
          x: 0,
          y: 0,
          z: 0,
          pz: 0,
          baseSize: 1,
          colorRgb: "223, 226, 241",
          maxAlpha: 0.5,
        };
        resetStar(star, true);
        stars.push(star);
      }
    };

    initStars();

    let targetScrollY = window.scrollY;
    let currentScrollY = window.scrollY;
    let scrollVelocity = 0;
    let prevScrollY = window.scrollY;

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };

    const handleScrollPos = () => {
      targetScrollY = window.scrollY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
      setMouseOffset({
        x: (e.clientX - width / 2) / (width / 2),
        y: (e.clientY - height / 2) / (height / 2),
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScrollPos, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Base continuous forward warp speed into deep space (calibrated to be smooth & majestic, not too fast)
    const BASE_SPEED = 1.35;

    const renderCosmos = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth scroll lerp and signed scroll delta calculation
      const scrollDiff = targetScrollY - currentScrollY;
      currentScrollY += scrollDiff * 0.085;
      const scrollDelta = currentScrollY - prevScrollY;
      prevScrollY = currentScrollY;

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Cosmic vanishing point (slightly elevated to accentuate forward descent)
      const centerX = width * 0.5 + (mouseX - width * 0.5) * 0.06;
      const centerY = height * 0.44 + (mouseY - height * 0.5) * 0.06;

      // Directional velocity along Z-axis (respects starfieldMotion setting):
      const motionEnabled =
        typeof document !== "undefined"
          ? document.documentElement.getAttribute("data-starfield-motion") !== "false"
          : true;

      const effectiveBaseSpeed = motionEnabled ? BASE_SPEED : 0;
      const scrollThrust = motionEnabled ? scrollDelta * 0.48 : 0;
      const zVelocity = motionEnabled
        ? Math.max(-7.5, Math.min(9.0, effectiveBaseSpeed + scrollThrust))
        : 0;

      // Mixed vertical and horizontal directional camera trajectory (yaw & pitch)
      // Follows scroll position naturally so scroll down & up are perfect opposites
      const driftX = motionEnabled
        ? currentScrollY * 0.065 + (mouseX - width * 0.5) * 0.1
        : 0;
      const driftY = motionEnabled
        ? currentScrollY * 0.11 + (mouseY - height * 0.5) * 0.1
        : 0;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Capture previous depth before position step
        s.pz = s.z;

        // Move star along Z-axis (forward when zVelocity > 0, reverse when zVelocity < 0)
        s.z -= zVelocity;

        // Star recycling:
        // When moving forward: if star flies past the camera (z <= 12)
        if (s.z <= 12) {
          resetStar(s, false);
          continue;
        }

        // When moving backward: if star recedes past MAX_DEPTH
        if (s.z >= MAX_DEPTH) {
          s.z = Math.random() * 80 + 30;
          s.pz = s.z;
          const spread = width * 1.5;
          s.x = (Math.random() - 0.5) * spread;
          s.y = (Math.random() - 0.5) * spread * (height / width);
          continue;
        }

        // Current 3D perspective projection
        const k = FOV / s.z;
        const px = centerX + (s.x - driftX) * k;
        const py = centerY + (s.y - driftY) * k;

        // Check screen boundaries (when moving forward, stars flying offscreen are recycled)
        if (zVelocity > 0 && (px < -60 || px > width + 60 || py < -60 || py > height + 60)) {
          resetStar(s, false);
          continue;
        }

        // Previous 3D perspective projection for depth warp velocity streaks
        const pk = FOV / s.pz;
        const prevPx = centerX + (s.x - driftX) * pk;
        const prevPy = centerY + (s.y - driftY) * pk;

        // Depth-based alpha: stars fade in as they approach, staying subdued
        const depthRatio = 1 - s.z / MAX_DEPTH;
        const alpha = Math.max(0.06, Math.min(s.maxAlpha, depthRatio * s.maxAlpha));

        // Projected radius increases realistically as star gets closer
        const radius = Math.max(0.4, Math.min(2.8, s.baseSize * k * 0.55));

        // Motion displacement on screen
        const motionDist = Math.hypot(px - prevPx, py - prevPy);

        ctx.save();

        if (motionDist > 1.0) {
          // Draw warp streak trail (points outward when scrolling down, inwards when scrolling up)
          ctx.strokeStyle = `rgba(${s.colorRgb}, ${alpha * 0.7})`;
          ctx.lineWidth = Math.max(0.55, Math.min(1.8, radius * 0.8));
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(prevPx, prevPy);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          // Point render when moving at gentle cruise
          ctx.fillStyle = `rgba(${s.colorRgb}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(renderCosmos);
    };

    renderCosmos();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScrollPos);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-500 ease-out ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Real-Time 3D Starfield Warp Canvas (Deep-Space Traversal) */}
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-screen h-screen pointer-events-none"
      />

      {/* Subdued Ambient Celestial Tint Layers with Multi-Axis Parallax */}
      <div
        className="fixed top-[-10%] left-1/4 w-[850px] h-[850px] rounded-full bg-gradient-to-br from-primary-container/8 via-primary/2 to-transparent blur-[180px] pointer-events-none nebula-violet -z-10 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${mouseOffset.x * 15 - scrollY * 0.05}px, ${scrollY * 0.07}px, 0)`,
        }}
      />
      <div
        className="fixed top-[32%] right-[-10%] w-[750px] h-[750px] rounded-full bg-gradient-to-bl from-tertiary-container/8 via-tertiary/2 to-transparent blur-[190px] pointer-events-none nebula-cyan -z-10 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${-mouseOffset.x * 20 + scrollY * 0.06}px, ${-scrollY * 0.05}px, 0)`,
        }}
      />
      <div
        className="fixed bottom-[-10%] left-[-5%] w-[800px] h-[700px] rounded-full bg-gradient-to-tr from-secondary-container/8 via-primary-container/2 to-transparent blur-[180px] pointer-events-none nebula-violet -z-10 transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${mouseOffset.x * 10 - scrollY * 0.04}px, ${scrollY * 0.04}px, 0)`,
        }}
      />

      {/* Distant Mystical Ringed Planet with Dual Parallax */}
      <div
        className="fixed top-28 right-8 lg:right-28 w-60 h-60 pointer-events-none opacity-15 lg:opacity-20 -z-10 hidden sm:block planet-static transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${mouseOffset.x * 16 - scrollY * 0.035}px, ${mouseOffset.y * 12 - scrollY * 0.05}px, 0) rotate(-12deg)`,
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-[#0a1128] via-[#141a33] to-[#4338ca]/30 border border-primary/15 shadow-none" />
          <div className="absolute w-56 h-14 rounded-[100%] border border-tertiary/20 transform -rotate-12 pointer-events-none" />
          <div className="absolute w-64 h-16 rounded-[100%] border border-primary/15 transform -rotate-12 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
