import React from "react";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#05070f]/75 backdrop-blur-md select-none pointer-events-none transition-opacity duration-300">
      <div className="relative flex flex-col items-center text-center">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/20 bg-surface-container-high shadow-lg flex items-center justify-center animate-pulse">
          <img
            src="/images/logo-icon.png"
            alt="QuizzCraft"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex items-center gap-2 mt-3 font-label-code text-xs text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-ping" />
          <span>Entering Arena...</span>
        </div>
      </div>
    </div>
  );
}
