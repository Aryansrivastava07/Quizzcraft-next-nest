"use client";

interface ScrollProgressBarProps {
  progress: number;
}

export default function ScrollProgressBar({ progress }: ScrollProgressBarProps) {
  return (
    <div
      className="fixed top-0 left-0 h-[3px] bg-primary z-[60] transition-all duration-150"
      style={{ width: `${progress}%` }}
    />
  );
}
