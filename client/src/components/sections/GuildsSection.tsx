import React from "react";
import Link from "next/link";
import GlassCard from "../ui/GlassCard";
import ParallaxReveal from "../ui/ParallaxReveal";

interface PersonaItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  href: string;
}

const personas: PersonaItem[] = [
  {
    icon: "school",
    iconBg: "bg-primary-container/20 border-primary/30 text-primary",
    iconColor: "text-primary",
    badge: "ACADEMIA & SCHOOLS",
    badgeColor: "text-primary",
    title: "For Educators",
    description:
      "Transform lesson slides and readings into interactive weekly review games. Zero grading friction and instant student participation.",
    href: "/create",
  },
  {
    icon: "podcasts",
    iconBg: "bg-tertiary-container/20 border-tertiary/30 text-tertiary",
    iconColor: "text-tertiary",
    badge: "CREATORS & COACHES",
    badgeColor: "text-tertiary",
    title: "For Content Creators",
    description:
      "Turn tutorials, newsletters, and course materials into interactive trivia for your audience to boost course completion rates.",
    href: "/create",
  },
  {
    icon: "corporate_fare",
    iconBg: "bg-secondary-container/20 border-secondary/30 text-secondary",
    iconColor: "text-secondary",
    badge: "ENTERPRISE & ACADEMIA",
    badgeColor: "text-secondary",
    title: "For Institutions & Orgs",
    description:
      "Deploy private student cohorts, enforce anti-cheat proctoring, manage partner roles, and track real-time automated gradebooks.",
    href: "/institutions",
  },
];

export default function GuildsSection() {
  return (
    <section
      className="py-20 px-gutter-mobile md:px-gutter-desktop max-w-max-width-canvas mx-auto relative z-10"
      id="ch-04"
    >
      <ParallaxReveal direction="up" distance={30} duration={750}>
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl text-white font-headline-xl font-bold">
            Tailored For Any Classroom or Team
          </h2>
          <p className="text-body-md text-on-surface-variant max-w-xl mt-2 text-sm sm:text-base">
            Whether you teach students, coach cohorts, or train colleagues, QuizzCraft fits your workflow.
          </p>
        </div>
      </ParallaxReveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {personas.map((item, idx) => (
          <ParallaxReveal
            key={item.title}
            direction="up"
            distance={40}
            depth={-140}
            pitch={9}
            delay={idx * 130}
            duration={850}
            parallaxSpeed={0.015}
            ambientFloat={true}
            floatDelay={idx * 0.45}
            className="h-full"
          >
            <GlassCard
              hoverEffect
              className="rounded-2xl p-6 sm:p-7 border-outline-variant/30 flex flex-col justify-between group h-full transition-all duration-300 hover:border-primary/40"
            >
              <div className="space-y-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform ${item.iconBg}`}
                >
                  <span className="material-symbols-outlined text-2xl">
                    {item.icon}
                  </span>
                </div>
                <div>
                  <span className={`font-label-code text-xs font-semibold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <h3 className="font-headline-lg text-white text-lg sm:text-xl font-bold mt-1">
                    {item.title}
                  </h3>
                </div>
                <p className="text-body-md text-on-surface-variant text-xs sm:text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-outline-variant/20">
                <Link
                  href={item.href}
                  className={`text-xs flex items-center gap-1 font-semibold group-hover:translate-x-1.5 transition-transform ${item.badgeColor}`}
                >
                  <span>{item.href === "/institutions" ? "Explore Benefits" : "Get Started"}</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </GlassCard>
          </ParallaxReveal>
        ))}
      </div>

      {/* Dedicated Institutional Benefits Card */}
      <ParallaxReveal direction="up" distance={30} delay={300} duration={800} className="mt-8">
        <div className="rounded-3xl bg-gradient-to-r from-primary/10 via-[#0b0e1b]/90 to-primary-container/20 border border-primary/30 p-6 sm:p-8 backdrop-blur-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 shadow-lg">
              <span className="material-symbols-outlined text-2xl">corporate_fare</span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <span>Institutional Suite</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Looking for Private Cohorts &amp; Exam Proctoring for Your Organization?
              </h3>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
                Empower your faculty or training staff with dedicated slug portals, anti-cheat live testing, automated gradebooks, and collaborative student discussion rooms.
              </p>
            </div>
          </div>

          <Link
            href="/institutions"
            className="shrink-0 px-5 py-3 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold shadow-lg shadow-primary/25 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-white/10"
          >
            <span>Explore Organization Benefits</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </ParallaxReveal>
    </section>
  );
}
