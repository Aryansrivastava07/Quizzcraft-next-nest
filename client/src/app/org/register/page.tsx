"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { orgService } from "@/lib/api/org-service";
import { useAuth } from "@/lib/auth/auth-context";
import { formatApiError } from "@/lib/api/client";

export default function OrgRegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [allowedDomain, setAllowedDomain] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-slug generator when org name changes if slug wasn't manually edited
  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!orgName.trim() || !slug.trim()) {
      setError("Please provide an organization name and slug.");
      return;
    }
    if (!adminUsername.trim() || !adminEmail.trim() || !adminPassword) {
      setError("Please fill in all primary administrator credentials.");
      return;
    }

    setIsLoading(true);
    try {
      await orgService.registerOrg({
        name: orgName.trim(),
        slug: slug.trim().toLowerCase(),
        allowedEmailDomain: allowedDomain.trim() || undefined,
        adminFullName: adminFullName.trim() || undefined,
        adminUsername: adminUsername.trim().toLowerCase(),
        adminEmail: adminEmail.trim(),
        adminPassword,
      });

      setSuccess("Organization provisioned successfully! Initializing workspace...");
      await refreshUser();
      setTimeout(() => {
        router.push(`/${slug.trim().toLowerCase()}/dashboard`);
      }, 1000);
    } catch (err: any) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col relative selection:bg-primary selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-24 pb-16 flex flex-col justify-center">
        {/* Header Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-sm">corporate_fare</span>
            Enterprise &amp; Institutional Workspace
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Register Your Organization
          </h1>
          <p className="text-on-surface-variant text-sm mt-2 max-w-xl mx-auto">
            Establish a private institutional tenant for your university, company, or academy.
            Manage cohorts, assign confidential quizzes, track partner gradebooks, and host live arenas.
          </p>
        </div>

        {/* Card Stage */}
        <div className="rounded-3xl bg-[#0b0e1b]/80 backdrop-blur-2xl border border-white/10 p-6 sm:p-10 shadow-2xl relative">
          {/* Rim light */}
          <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none" />

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-center gap-3">
              <span className="material-symbols-outlined text-red-400 text-base">error</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
              <span className="flex-1">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SECTION 1: ORGANIZATION DETAILS */}
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4 text-primary">
                <span className="material-symbols-outlined text-base">domain</span>
                1. Institutional Identity
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Organization Name <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                    placeholder="e.g. Stanford University CS Dept"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-white text-xs outline-none transition-all placeholder:text-outline/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Unique Workspace Slug <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xs font-mono">
                      org/
                    </span>
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) =>
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      placeholder="stanford-cs"
                      className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-white text-xs outline-none transition-all placeholder:text-outline/50 font-mono"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Allowed Email Domain <span className="text-outline text-[11px]">(Optional whitelist)</span>
                  </label>
                  <input
                    type="text"
                    value={allowedDomain}
                    onChange={(e) => setAllowedDomain(e.target.value)}
                    placeholder="e.g. stanford.edu (Leave blank to permit any invitee email)"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-white text-xs outline-none transition-all placeholder:text-outline/50"
                  />
                  <p className="text-[11px] text-on-surface-variant">
                    If set, self-registered members must use an email ending in this domain.
                  </p>
                </div>
              </div>
            </div>

            <hr className="border-white/10" />

            {/* SECTION 2: PRIMARY ORG_ADMIN ACCOUNT */}
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4 text-tertiary">
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                2. Primary Administrator Credentials
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Admin Full Name <span className="text-outline text-[11px]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="Dr. Gregory House"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-white text-xs outline-none transition-all placeholder:text-outline/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Admin Username <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) =>
                      setAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))
                    }
                    placeholder="admin_ghouse"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-white text-xs outline-none transition-all placeholder:text-outline/50 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Admin Institutional Email <span className="text-primary">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="ghouse@institution.edu"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-white text-xs outline-none transition-all placeholder:text-outline/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant">
                    Admin Password <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-primary text-white text-xs outline-none transition-all placeholder:text-outline/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms notice */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px] text-on-surface-variant flex items-center gap-2.5">
              <span className="material-symbols-outlined text-sm text-tertiary shrink-0">
                verified_user
              </span>
              <span>
                By registering, you will be designated as the <strong>ORG_ADMIN</strong> with authority
                to invite partners, configure cohorts, and assign quizzes.
              </span>
            </div>

            {/* Submit CTA */}
            <div className="pt-2 flex items-center justify-between">
              <Link
                href="/auth"
                className="text-xs text-on-surface-variant hover:text-white transition-colors"
              >
                Already have an account? Sign in
              </Link>

              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">
                      progress_activity
                    </span>
                    <span>Provisioning Organization...</span>
                  </>
                ) : (
                  <>
                    <span>Create Organization Workspace</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
