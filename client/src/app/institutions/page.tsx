"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function InstitutionsBenefitsPage() {
  const benefits = [
    {
      icon: "document_scanner",
      iconBg: "bg-primary/10 border-primary/20 text-primary",
      badge: "CORE ENGINE",
      title: "AI-Powered PDF & Syllabus Ingestion",
      description:
        "Upload multi-page lecture notes, curriculum PDFs, research publications, or textbook chapters. Gemini extracts formulas, definitions, and core competencies to synthesize comprehensive question banks in seconds.",
      features: [
        "Multi-page PDF, doc, and slide ingestion",
        "LaTeX formula fidelity & diagram recognition",
        "Bloom's taxonomy difficulty tuning",
      ],
    },
    {
      icon: "shield_lock",
      iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      badge: "SECURITY & INTEGRITY",
      title: "Proctored Arenas & Anti-Cheat Guards",
      description:
        "Protect institutional assessment integrity with rigorous exam security controls. Prevent academic dishonesty while providing students an immersive, low-friction testing interface.",
      features: [
        "Fullscreen lock & tab-switch telemetry",
        "Dynamic question & choice randomization",
        "Strict temporal limits & auto-submission",
      ],
    },
    {
      icon: "hub",
      iconBg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
      badge: "COLLABORATION",
      title: "Cohort Management & Discussion Rooms",
      description:
        "Segment learners by semester, course section, or department into isolated cohorts. Every cohort features real-time discussion rooms linked to specific questions, enabling peer-to-peer discourse and partner solution pinning.",
      features: [
        "6-character join codes & approval gates",
        "Question-linked contextual discussion channels",
        "Partner/Admin message pinning & moderation",
      ],
    },
    {
      icon: "manage_accounts",
      iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      badge: "GOVERNANCE",
      title: "Three-Tier Institutional RBAC",
      description:
        "Assign granular authority to ensure clear division of responsibilities across educational institutions and enterprise teams.",
      features: [
        "ORG_ADMIN: Oversee seats, audit logs, and institutional policies",
        "ORG_PARTNER: Instructors create exams and manage student cohorts",
        "ORG_STD: Learners engage in assignments and private practice sandboxes",
      ],
    },
    {
      icon: "analytics",
      iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
      badge: "INSIGHTS",
      title: "Institutional Gradebook & Mastery Analytics",
      description:
        "Eliminate manual grading friction with instantaneous automated score calculation, pass rate benchmarking, and granular question diagnostics that reveal student conceptual gaps.",
      features: [
        "Cohort-wide gradebook matrix in real time",
        "Detailed question failure distributions",
        "Instant scorecards and exportable analytics",
      ],
    },
    {
      icon: "apartment",
      iconBg: "bg-pink-500/10 border-pink-500/20 text-pink-400",
      badge: "ISOLATION",
      title: "Dedicated Institutional Portal (/[orgSlug])",
      description:
        "Your organization operates in a fully isolated namespace. Content never leaks into public community discovery feeds, and registration can be restricted strictly to authorized corporate or university email domains.",
      features: [
        "Custom slug route (e.g. /mit-physics or /acme-corp)",
        "Allowed email domain filtering (@domain.edu)",
        "Complete data barrier separating internal exams from public feeds",
      ],
    },
  ];

  const comparisonRows = [
    {
      feature: "Assessment Generation from PDFs & Notes",
      publicTier: "Standard (General Prompts)",
      orgTier: "Deep Document Parsing & LaTeX Math",
    },
    {
      feature: "Workspace & URL Namespace",
      publicTier: "Shared Public Space",
      orgTier: "Dedicated Institutional Slug (/[orgSlug])",
    },
    {
      feature: "Class Cohorts & Discussion Rooms",
      publicTier: "Unavailable",
      orgTier: "Unlimited Cohorts with Question Chat",
    },
    {
      feature: "Exam Security & Anti-Cheat Controls",
      publicTier: "Basic Timer",
      orgTier: "Fullscreen Lock, Tab-Switch Telemetry & Shuffling",
    },
    {
      feature: "Gradebook Matrix & Diagnostics",
      publicTier: "Personal History Only",
      orgTier: "Full Institutional Cohort Gradebook",
    },
    {
      feature: "Role-Based Access Governance",
      publicTier: "Public User",
      orgTier: "Super Admin, Org Admin, Partner, Learner",
    },
    {
      feature: "Email Domain Whitelisting",
      publicTier: "Any Email",
      orgTier: "Strict Institutional Domain (@univ.edu)",
    },
  ];

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col relative selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 pb-20">
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <span className="material-symbols-outlined text-sm">domain</span>
            Enterprise &amp; Academic Institutional Suite
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            The AI Assessment &amp; Cohort Platform Built for{" "}
            <span className="text-primary drop-shadow-[0_0_25px_rgba(208,188,255,0.35)]">
              Modern Institutions
            </span>
          </h1>

          <p className="text-on-surface-variant text-sm sm:text-base mt-4 max-w-2xl mx-auto leading-relaxed">
            Equip your professors, training leads, and educators with automated PDF-to-exam generation,
            anti-cheat proctored arenas, student cohorts, and real-time gradebook intelligence in an isolated
            institutional workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link
              href="/org/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add_business</span>
              <span>Register Your Organization</span>
            </Link>
            <a
              href="#pillars"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Key Benefits</span>
              <span className="material-symbols-outlined text-sm">arrow_downward</span>
            </a>
          </div>
        </div>

        {/* 6 PILLARS GRID */}
        <div id="pillars" className="mb-20">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Institutional Capabilities
            </h2>
            <p className="text-on-surface-variant text-xs sm:text-sm mt-1.5">
              Everything required to operate high-stakes university courses and enterprise training programs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="p-6 sm:p-7 rounded-3xl bg-[#0b0e1b]/80 border border-white/10 backdrop-blur-xl flex flex-col justify-between hover:border-primary/40 transition-all group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-md group-hover:scale-105 transition-transform ${b.iconBg}`}
                    >
                      <span className="material-symbols-outlined text-2xl">{b.icon}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold tracking-widest text-outline uppercase px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5">
                      {b.badge}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-primary transition-colors">
                    {b.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                    {b.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                  {b.features.map((feat) => (
                    <div key={feat} className="flex items-start gap-2 text-xs text-on-surface">
                      <span className="material-symbols-outlined text-emerald-400 text-sm shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FEATURE COMPARISON TABLE */}
        <div className="mb-20">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Public vs. Institutional Tier
            </h2>
            <p className="text-on-surface-variant text-xs sm:text-sm mt-1.5">
              See why leading academic faculties and enterprise teams choose private institutional workspaces.
            </p>
          </div>

          <div className="rounded-3xl bg-[#0b0e1b]/80 border border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-white/[0.03] text-on-surface-variant border-b border-white/10 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-4 px-6">Capability</th>
                    <th className="py-4 px-6 text-on-surface-variant">Public Community Tier</th>
                    <th className="py-4 px-6 text-primary">Institutional Organization Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {comparisonRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.015] transition-colors">
                      <td className="py-4 px-6 font-semibold text-white">{row.feature}</td>
                      <td className="py-4 px-6 text-on-surface-variant font-mono text-xs">
                        {row.publicTier}
                      </td>
                      <td className="py-4 px-6 font-semibold text-emerald-400 font-mono text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-emerald-400">
                          verified
                        </span>
                        <span>{row.orgTier}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FINAL CALL TO ACTION */}
        <div className="rounded-3xl bg-gradient-to-br from-primary-container/30 via-[#0b0e1b] to-primary/10 border border-primary/30 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />

          <span className="material-symbols-outlined text-4xl text-primary mb-3">
            auto_awesome
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Provision Your Institutional Workspace Today
          </h2>
          <p className="text-on-surface-variant text-xs sm:text-sm max-w-lg mx-auto mt-2 leading-relaxed">
            Create your organization in seconds. Add educators, launch your first cohort, and generate
            proctored exams directly from your syllabus documents.
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/org/register"
              className="px-8 py-4 rounded-2xl bg-primary-container hover:bg-primary-container/90 text-white font-bold text-sm shadow-xl shadow-primary-container/30 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">business_center</span>
              <span>Register Your Organization Now</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
