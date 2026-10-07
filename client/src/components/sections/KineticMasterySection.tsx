import React from "react";
import GlassCard from "../ui/GlassCard";
import ParallaxReveal from "../ui/ParallaxReveal";

interface FeatureItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
}

const features: FeatureItem[] = [
  {
    icon: "picture_as_pdf",
    iconBg: "bg-primary-container/20 border-primary/30",
    iconColor: "text-primary",
    title: "AI Document & PDF Engine",
    description:
      "Upload complex textbook PDFs, lecture slides, research papers, and syllabi. Extracts formulas, definitions, and core concepts to generate bloom-calibrated questions in seconds.",
    badge: "Top Highlight",
    badgeColor: "text-primary",
  },
  {
    icon: "shield_lock",
    iconBg: "bg-emerald-500/15 border-emerald-500/30",
    iconColor: "text-emerald-400",
    title: "Anti-Cheat Monitoring",
    description:
      "Enforce fullscreen lockdown, detect tab-switching, randomize question/choice sequences, and lock strict timers to guarantee academic assessment integrity.",
    badge: "Proctored Exams",
    badgeColor: "text-emerald-400",
  },
  {
    icon: "hub",
    iconBg: "bg-tertiary-container/20 border-tertiary/30",
    iconColor: "text-tertiary",
    title: "Institutional Cohorts",
    description:
      "Organize learners into class cohorts with invite codes, question-linked discussion rooms, solution pinning, and automated gradebook matrices.",
    badge: "Org Workspaces",
    badgeColor: "text-tertiary",
  },
  {
    icon: "bolt",
    iconBg: "bg-amber-accent/15 border-amber-accent/30",
    iconColor: "text-amber-accent",
    title: "Synchronized Live Arena",
    description:
      "Host live synchronized exam rooms with quick PIN access. Real-time class leaderboards, answer distributions, and question-level diagnostics.",
    badge: "Instant Sync",
    badgeColor: "text-amber-accent",
  },
];

export default function KineticMasterySection() {
  return (
    <section
      className="py-20 px-gutter-mobile md:px-gutter-desktop max-w-max-width-canvas mx-auto relative z-10"
      id="ch-03"
    >
      <ParallaxReveal direction="up" distance={30} duration={750}>
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl text-white font-headline-xl font-bold">
            Built for High-Impact Learning
          </h2>
          <p className="text-body-md text-on-surface-variant max-w-xl mt-2 text-sm sm:text-base">
            Everything educators and learners need to turn documents into memorable study games.
          </p>
        </div>
      </ParallaxReveal>

      {/* 4-Feature Bento Grid with Staggered Parallax Space-Depth Emergence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {features.map((feat, idx) => (
          <ParallaxReveal
            key={feat.title}
            direction="up"
            distance={38}
            depth={-135}
            pitch={8.5}
            delay={idx * 110}
            duration={850}
            parallaxSpeed={0.014}
            ambientFloat={true}
            floatDelay={idx * 0.35}
            className="h-full"
          >
            <GlassCard
              hoverEffect
              className="p-6 rounded-2xl border-outline-variant/30 flex flex-col justify-between h-full transition-all duration-300 hover:border-tertiary/40"
            >
              <div>
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 border ${feat.iconBg} ${feat.iconColor}`}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {feat.icon}
                  </span>
                </div>
                <h3 className="text-headline-sm text-white text-base sm:text-lg font-semibold mb-2">
                  {feat.title}
                </h3>
                <p className="text-body-sm text-on-surface-variant text-xs sm:text-sm leading-relaxed">
                  {feat.description}
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-outline-variant/20">
                <span className={`font-label-code text-xs font-semibold ${feat.badgeColor}`}>
                  {feat.badge}
                </span>
              </div>
            </GlassCard>
          </ParallaxReveal>
        ))}
      </div>
    </section>
  );
}
