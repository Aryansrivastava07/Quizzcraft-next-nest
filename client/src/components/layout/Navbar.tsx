"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { notificationService } from "@/lib/api/notification-service";
import { orgService } from "@/lib/api/org-service";
import { NotificationItem } from "@/lib/api/types";

interface NavbarProps {
  activeChapter?: string;
}

interface NavLinkItem {
  href: string;
  label: string;
  icon: string;
  isActive: boolean;
  hasLiveBadge?: boolean;
}

const PUBLIC_ROOT_SEGMENTS = new Set([
  "",
  "api",
  "arena",
  "auth",
  "create",
  "create-quiz",
  "deploy",
  "editor",
  "explore",
  "forgot-password",
  "groups",
  "institutions",
  "join",
  "not-found",
  "org",
  "profile",
  "quiz",
  "quizzes",
  "results",
  "super-admin",
]);

export default function Navbar({ activeChapter }: NavbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const pathname = usePathname();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Poll notifications when logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    const fetchNotifications = async () => {
      try {
        const res = await notificationService.getNotifications();
        if (res?.data) {
          setNotifications(res.data.notifications || []);
          setUnreadCount(res.data.unreadCount || 0);
        }
      } catch (e) {
        // Silent poll error
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
      if (
        notifMenuRef.current &&
        !notifMenuRef.current.contains(e.target as Node)
      ) {
        setNotifMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      try {
        await notificationService.markAsRead(notif.notificationId);
        setNotifications((prev) =>
          prev.map((n) => (n.notificationId === notif.notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        console.error(e);
      }
    }
    setNotifMenuOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  // Check active workspace context from route pathname
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const firstSegment = pathSegments[0] || "";
  const isOrgWorkspacePath = Boolean(firstSegment && !PUBLIC_ROOT_SEGMENTS.has(firstSegment));
  const currentPathOrgSlug = isOrgWorkspacePath ? firstSegment : null;
  const effectiveOrgSlug = currentPathOrgSlug || user?.orgSlug || "";
  const isInOrgWorkspace = isOrgWorkspacePath;
  const orgSlug = user?.orgSlug;

  const [orgDetails, setOrgDetails] = useState<{ name: string; logoUrl?: string } | null>(null);

  useEffect(() => {
    if (!isInOrgWorkspace || !effectiveOrgSlug) {
      setOrgDetails(null);
      return;
    }

    if (user?.orgSlug === effectiveOrgSlug && user?.institution) {
      setOrgDetails({ name: user.institution });
    }

    let isMounted = true;
    orgService
      .getOrgBySlug(effectiveOrgSlug)
      .then((res) => {
        if (isMounted && res?.data?.organization) {
          setOrgDetails({
            name: res.data.organization.name,
            logoUrl: res.data.organization.logoUrl,
          });
        }
      })
      .catch(() => {
        // Fallback gracefully to institution or slug
      });

    return () => {
      isMounted = false;
    };
  }, [isInOrgWorkspace, effectiveOrgSlug, user?.orgSlug, user?.institution]);

  const displayOrgName =
    orgDetails?.name ||
    (user?.orgSlug === effectiveOrgSlug ? user?.institution : null) ||
    (effectiveOrgSlug
      ? effectiveOrgSlug.charAt(0).toUpperCase() + effectiveOrgSlug.slice(1)
      : "Organization");

  const orgLinks: NavLinkItem[] = effectiveOrgSlug
    ? [
        {
          href: `/${effectiveOrgSlug}`,
          label: "Workspace",
          icon: "apartment",
          isActive: pathname === `/${effectiveOrgSlug}`,
        },
        {
          href: `/${effectiveOrgSlug}/quizzes`,
          label: "Org Quizzes",
          icon: "quiz",
          isActive: pathname?.startsWith(`/${effectiveOrgSlug}/quizzes`) ?? false,
        },
        {
          href: `/${effectiveOrgSlug}/groups`,
          label: "Cohorts",
          icon: "hub",
          isActive: pathname?.startsWith(`/${effectiveOrgSlug}/groups`) ?? false,
        },
        {
          href: `/${effectiveOrgSlug}/arena`,
          label: "Live Arena",
          icon: "swords",
          isActive: pathname?.startsWith(`/${effectiveOrgSlug}/arena`) ?? false,
        },
        {
          href: `/${effectiveOrgSlug}/create`,
          label: "Create Quiz",
          icon: "add_circle",
          isActive: pathname?.startsWith(`/${effectiveOrgSlug}/create`) ?? false,
        },
        ...(user?.role === "ORG_ADMIN" || user?.role === "SUPER_ADMIN" || user?.isSuperAdmin
          ? [
              {
                href: `/${effectiveOrgSlug}/dashboard`,
                label: "Admin Console",
                icon: "admin_panel_settings",
                isActive: pathname?.startsWith(`/${effectiveOrgSlug}/dashboard`) ?? false,
              },
            ]
          : []),
      ]
    : [];

  const publicLinks: NavLinkItem[] = [
    {
      href: "/#how-it-works",
      label: "How It Works",
      icon: "lightbulb",
      isActive: activeChapter === "how-it-works",
    },
    {
      href: "/quizzes",
      label: "Explore Arenas",
      icon: "explore",
      isActive:
        pathname === "/quizzes" ||
        pathname === "/explore" ||
        pathname?.startsWith("/quiz/review"),
    },
    {
      href: "/groups",
      label: "Cohorts",
      icon: "hub",
      isActive: pathname === "/groups" || (Boolean(pathname?.startsWith("/groups/")) && !isInOrgWorkspace),
    },
    {
      href: "/create",
      label: "Create Quiz",
      icon: "add_circle",
      isActive:
        pathname === "/create" ||
        pathname === "/create-quiz" ||
        pathname === "/editor" ||
        pathname === "/deploy",
    },
    {
      href: "/join",
      label: "Live Arena",
      icon: "swords",
      isActive: pathname === "/join",
    },
  ];

  const currentNavLinks = isInOrgWorkspace ? orgLinks : publicLinks;

  const getRoleBadge = () => {
    if (user?.role === "SUPER_ADMIN" || user?.isSuperAdmin) {
      return (
        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[10px] font-label-code border border-amber-500/20 font-bold">
          SUPER ADMIN
        </span>
      );
    }
    if (user?.role === "ORG_ADMIN") {
      return (
        <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-label-code border border-primary/20 font-bold">
          ORG ADMIN
        </span>
      );
    }
    if (user?.role === "ORG_PARTNER") {
      return (
        <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-label-code border border-cyan-500/20 font-bold">
          ORG PARTNER
        </span>
      );
    }
    if (user?.role === "ORG_STD" || user?.role === "ORG_USER") {
      return (
        <span className="px-1.5 py-0.2 rounded bg-white/10 text-on-surface-variant text-[10px] font-label-code border border-white/20">
          LEARNER
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-label-code border border-primary/20">
        {user?.verified ? "Verified Member" : "Active Member"}
      </span>
    );
  };

  return (
    <>
      {/* Top Viewport Scroll Blur: Blurs content scrolling through the gap above the floating pill navbar */}
      <div className="top-nav-blur-veil" aria-hidden="true" />

      <header className="fixed top-3 sm:top-5 left-0 right-0 mx-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-2.5rem)] max-w-max-width-canvas z-50 transition-all duration-300">
        <nav className="navbar-frosted-glass rounded-full px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between relative">
          {/* Left: Company / Org Logo */}
          <div className="flex items-center">
            {isInOrgWorkspace && effectiveOrgSlug ? (
              <Link
                href={`/${effectiveOrgSlug}`}
                className="flex items-center gap-2 sm:gap-2.5 group"
                title={`${displayOrgName} Workspace`}
              >
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-primary/40 flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 group-hover:border-primary transition-all duration-300 bg-primary/10 text-primary shrink-0">
                  {orgDetails?.logoUrl ? (
                    <img
                      src={orgDetails.logoUrl}
                      alt={displayOrgName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[19px] text-primary">apartment</span>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-headline-sm font-headline-sm tracking-tight text-white font-extrabold text-sm sm:text-base leading-none group-hover:text-primary transition-colors max-w-[120px] sm:max-w-[200px] truncate">
                      {displayOrgName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-label-code font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 shrink-0">
                      ORG
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-on-surface-variant/80 leading-tight">
                    /{effectiveOrgSlug}
                  </span>
                </div>
              </Link>
            ) : (
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/15 flex items-center justify-center shadow-md shadow-primary-container/20 group-hover:scale-105 group-hover:border-primary/50 transition-all duration-300 bg-surface-container-high shrink-0">
                  <img
                    src="/images/logo-icon.png"
                    alt="QuizzCraft Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-headline-sm font-headline-sm tracking-tight text-white font-extrabold text-base sm:text-lg">
                  QuizzCraft<span className="text-tertiary">.app</span>
                </span>
              </Link>
            )}
          </div>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-1 font-headline-sm text-xs">
            {currentNavLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  link.isActive
                    ? "bg-primary-container/20 text-white font-semibold border border-primary/40 shadow-sm"
                    : "text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-tertiary/90">
                  {link.icon}
                </span>
                <span>{link.label}</span>
                {link.hasLiveBadge && (
                  <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-tertiary/10 border border-tertiary/30 text-[10px] font-label-code text-tertiary font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                    LIVE
                  </span>
                )}
              </Link>
            ))}

            {/* Prominent Org Workspace Tab when in Public Workspace */}
            {user?.orgSlug && !isInOrgWorkspace && (
              <Link
                href={`/${user.orgSlug}`}
                className="ml-1.5 px-3.5 py-1.5 rounded-full bg-primary/20 hover:bg-primary/30 text-white font-bold border border-primary/50 shadow-md shadow-primary/20 hover:scale-[1.03] transition-all flex items-center gap-1.5 text-xs"
                title={`Enter ${user?.institution || user.orgSlug.toUpperCase()} Workspace`}
              >
                <span className="material-symbols-outlined text-[15px] text-primary">apartment</span>
                <span>{user?.institution ? `${user.institution} Workspace` : `${user.orgSlug.toUpperCase()} Workspace`}</span>
                <span className="material-symbols-outlined text-[13px] text-primary">arrow_forward</span>
              </Link>
            )}

            {/* Public Workspace Tab when in Org Workspace */}
            {isInOrgWorkspace && (
              <Link
                href="/"
                className="ml-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/90 hover:text-white font-medium border border-white/20 shadow-sm hover:scale-[1.03] transition-all flex items-center gap-1.5 text-xs"
                title="Switch to Public Workspace"
              >
                <span className="material-symbols-outlined text-[15px] text-primary">public</span>
                <span>Public Workspace</span>
              </Link>
            )}
          </div>

          {/* Right: Notifications & Profile Tab */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <div className="relative" ref={notifMenuRef}>
                  <button
                    type="button"
                    onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 flex items-center justify-center text-on-surface-variant hover:text-white transition-all cursor-pointer relative"
                    aria-label="Notifications"
                  >
                    <span className="material-symbols-outlined text-lg">notifications</span>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary-container text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Popover */}
                  {notifMenuOpen && (
                    <div className="!absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl dropdown-frosted-glass p-3 animate-fadeIn z-50 text-xs shadow-2xl">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-tertiary">
                            notifications_active
                          </span>
                          Alerts &amp; Updates
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-primary hover:text-primary-fixed cursor-pointer transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-1.5">
                        {notifications.length === 0 ? (
                          <div className="py-8 text-center text-on-surface-variant text-xs">
                            No notifications at this time.
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.notificationId}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-start gap-2.5 ${
                                notif.read
                                  ? "bg-white/[0.02] hover:bg-white/[0.05] opacity-75"
                                  : "bg-primary/10 hover:bg-primary/15 border border-primary/20"
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-sm mt-0.5 shrink-0 ${
                                  notif.type === "QUIZ_ASSIGNED"
                                    ? "text-primary"
                                    : notif.type === "DISCUSSION_REPLY"
                                    ? "text-tertiary"
                                    : "text-amber-400"
                                }`}
                              >
                                {notif.type === "QUIZ_ASSIGNED"
                                  ? "assignment"
                                  : notif.type === "DISCUSSION_REPLY"
                                  ? "forum"
                                  : "info"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white truncate text-xs">
                                  {notif.title}
                                </p>
                                <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                                  {notif.message}
                                </p>
                                <span className="text-[9px] text-outline mt-1 block">
                                  {new Date(notif.createdAt).toLocaleDateString()} &bull;{" "}
                                  {new Date(notif.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {!notif.read && (
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Circular Profile Tab */}
                <div className="relative flex items-center" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-primary/40 hover:ring-primary overflow-visible transition-all cursor-pointer focus:outline-none focus:ring-primary flex items-center justify-center bg-surface-container-high"
                    aria-label="User Profile Menu"
                  >
                    {user?.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={user?.username || "Pilot"}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-[11px] font-bold text-white font-headline-sm">
                        {(user?.username || user?.email || "P").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-surface-container-lowest shadow-sm" />
                  </button>

                  {/* Profile Dropdown Popover */}
                  {profileMenuOpen && (
                    <div className="!absolute right-0 top-full mt-2 w-64 rounded-2xl dropdown-frosted-glass p-3 animate-fadeIn z-50 text-xs shadow-2xl">
                      {/* User Header */}
                      <div className="flex items-center gap-3 p-2 pb-3 border-b border-white/10">
                        <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-primary/40 shrink-0 flex items-center justify-center bg-primary-container/30">
                          {user?.profilePicture ? (
                            <img
                              src={user.profilePicture}
                              alt={user?.username || "Pilot"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-white font-headline-sm">
                              {(user?.username || user?.email || "P").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-white truncate text-sm">
                            {user?.username || "Authenticated User"}
                          </p>
                          <p className="text-[11px] text-on-surface-variant font-label-code truncate">
                            {user?.email || "user@quizzcraft.app"}
                          </p>
                          <div className="mt-1">{getRoleBadge()}</div>
                        </div>
                      </div>

                      {/* Nav Links */}
                      <div className="py-2 px-2 text-xs flex flex-col gap-0.5">
                        {/* Current Workspace Indicator */}
                        <div className="px-3 py-1.5 mb-1 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-[11px] text-on-surface-variant">
                          <span className="flex items-center gap-1.5 font-medium text-white/90">
                            <span className="material-symbols-outlined text-[15px] text-primary">
                              {isInOrgWorkspace ? "apartment" : "public"}
                            </span>
                            <span>
                              {isInOrgWorkspace
                                ? (user?.institution || `${effectiveOrgSlug.toUpperCase()} Org`)
                                : "Public Workspace"}
                            </span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-white/10 text-tertiary font-semibold">
                            {isInOrgWorkspace ? "ORG" : "PUBLIC"}
                          </span>
                        </div>

                        {/* Super Admin Dashboard Link */}
                        {(user?.role === "SUPER_ADMIN" || user?.isSuperAdmin) && (
                          <Link
                            href="/super-admin"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-amber-400 hover:text-white hover:bg-amber-500/10 transition-colors font-semibold"
                          >
                            <span className="material-symbols-outlined text-base">
                              shield_person
                            </span>
                            <span>Super Admin Console</span>
                          </Link>
                        )}

                        {/* Org Dashboard Link */}
                        {effectiveOrgSlug && (user?.role === "ORG_ADMIN" || user?.role === "SUPER_ADMIN" || user?.isSuperAdmin) && (
                          <Link
                            href={`/${effectiveOrgSlug}/dashboard`}
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-primary hover:text-white hover:bg-primary/10 transition-colors font-semibold"
                          >
                            <span className="material-symbols-outlined text-base">domain</span>
                            <span>Org Admin Console</span>
                          </Link>
                        )}

                        {/* Workspace Switcher */}
                        {isInOrgWorkspace ? (
                          <Link
                            href="/"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-secondary hover:text-white hover:bg-secondary/10 transition-colors font-medium"
                          >
                            <span className="material-symbols-outlined text-base">public</span>
                            <span>Switch to Public Workspace</span>
                          </Link>
                        ) : (
                          user?.orgSlug && (
                            <Link
                              href={`/${user.orgSlug}`}
                              onClick={() => setProfileMenuOpen(false)}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-secondary hover:text-white hover:bg-secondary/10 transition-colors font-medium"
                            >
                              <span className="material-symbols-outlined text-base">apartment</span>
                              <span>{user?.institution ? `${user.institution} Workspace` : "Org Workspace"}</span>
                            </Link>
                          )
                        )}

                        {/* Cohorts & Groups */}
                        <Link
                          href={isInOrgWorkspace && effectiveOrgSlug ? `/${effectiveOrgSlug}/groups` : "/groups"}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-tertiary hover:text-white hover:bg-tertiary/10 transition-colors font-medium"
                        >
                          <span className="material-symbols-outlined text-base">hub</span>
                          <span>{isInOrgWorkspace ? "Org Cohorts & Groups" : "Cohorts & Groups"}</span>
                        </Link>

                        {/* Org Quizzes (when in Org Workspace) */}
                        {isInOrgWorkspace && effectiveOrgSlug && (
                          <Link
                            href={`/${effectiveOrgSlug}/quizzes`}
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base text-tertiary">
                              quiz
                            </span>
                            <span>Org Quizzes</span>
                          </Link>
                        )}

                        {/* Live Arena */}
                        <Link
                          href={isInOrgWorkspace && effectiveOrgSlug ? `/${effectiveOrgSlug}/arena` : "/join"}
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base text-amber-accent">
                            swords
                          </span>
                          <span>Live Arena</span>
                        </Link>

                        {/* Profile & Settings */}
                        <Link
                          href="/profile"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base text-tertiary">
                            account_circle
                          </span>
                          <span>Profile &amp; Settings</span>
                        </Link>

                        {/* My Quizzes */}
                        <Link
                          href="/profile?tab=my-quizzes"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-on-surface hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base text-tertiary">
                            folder_shared
                          </span>
                          <span>My Quizzes</span>
                        </Link>
                      </div>

                      {/* Sign Out Action */}
                      <div className="pt-2 border-t border-white/10 flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            setProfileMenuOpen(false);
                            await logout();
                            router.push("/auth");
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-xs font-semibold cursor-pointer"
                        >
                          <span>Sign Out</span>
                          <span className="material-symbols-outlined text-sm">logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Login / Signup Tab */
              <div className="flex items-center gap-2">
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary-container text-white text-xs font-semibold hover:bg-primary-container/90 border border-white/15 shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">login</span>
                  <span>Log In / Sign Up</span>
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-full border border-outline-variant/60 text-on-surface-variant hover:text-white transition-colors ml-1"
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-xl">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 p-3 rounded-2xl glass-kage border border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col gap-1.5 animate-fadeIn">
            {/* Prominent Org Workspace Banner on Mobile */}
            {user?.orgSlug && !isInOrgWorkspace && (
              <Link
                href={`/${user.orgSlug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-white font-bold text-sm transition-all mb-1 shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">apartment</span>
                  <span>Enter {user?.institution || user.orgSlug.toUpperCase()} Workspace</span>
                </div>
                <span className="material-symbols-outlined text-sm text-primary">&rarr;</span>
              </Link>
            )}

            {/* Public Workspace Banner on Mobile */}
            {isInOrgWorkspace && (
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm transition-all mb-1 shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-primary">public</span>
                  <span>Switch to Public Workspace</span>
                </div>
                <span className="material-symbols-outlined text-sm text-on-surface-variant">&rarr;</span>
              </Link>
            )}

            {currentNavLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-headline-sm transition-colors ${
                  link.isActive
                    ? "bg-primary-container/20 text-white font-semibold border border-primary/30"
                    : "text-on-surface hover:text-white hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-base text-tertiary">
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </div>
                {link.hasLiveBadge && (
                  <span className="px-2 py-0.5 rounded-full bg-tertiary/10 border border-tertiary/30 text-[10px] font-label-code text-tertiary font-bold">
                    ● LIVE
                  </span>
                )}
              </Link>
            ))}

            <div className="pt-2 mt-1 border-t border-white/10 flex flex-col gap-1">
              {/* Workspace Indicator Badge */}
              <div className="px-3 py-1.5 mb-1 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs text-on-surface-variant">
                <span className="flex items-center gap-1.5 font-medium text-white/90">
                  <span className="material-symbols-outlined text-sm text-primary">
                    {isInOrgWorkspace ? "apartment" : "public"}
                  </span>
                  <span>
                    {isInOrgWorkspace
                      ? (user?.institution || `${effectiveOrgSlug.toUpperCase()} Org`)
                      : "Public Workspace"}
                  </span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-white/10 text-tertiary font-semibold">
                  {isInOrgWorkspace ? "ORG" : "PUBLIC"}
                </span>
              </div>

              {(user?.role === "SUPER_ADMIN" || user?.isSuperAdmin) && (
                <Link
                  href="/super-admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-amber-400 hover:text-white hover:bg-amber-500/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">shield_person</span>
                  <span>Super Admin Console</span>
                </Link>
              )}

              {effectiveOrgSlug && (user?.role === "ORG_ADMIN" || user?.role === "SUPER_ADMIN" || user?.isSuperAdmin) && (
                <Link
                  href={`/${effectiveOrgSlug}/dashboard`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-primary hover:text-white hover:bg-primary/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">domain</span>
                  <span>Org Admin Console</span>
                </Link>
              )}

              {isInOrgWorkspace ? (
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-secondary hover:text-white hover:bg-secondary/10 transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-base">public</span>
                  <span>Switch to Public Workspace</span>
                </Link>
              ) : (
                user?.orgSlug && (
                  <Link
                    href={`/${user.orgSlug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-secondary hover:text-white hover:bg-secondary/10 transition-colors font-medium"
                  >
                    <span className="material-symbols-outlined text-base">apartment</span>
                    <span>{user?.institution ? `${user.institution} Workspace` : "Org Workspace"}</span>
                  </Link>
                )
              )}

              <Link
                href={isInOrgWorkspace && effectiveOrgSlug ? `/${effectiveOrgSlug}/groups` : "/groups"}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-tertiary hover:text-white hover:bg-white/10 transition-colors font-medium"
              >
                <span className="material-symbols-outlined text-base text-tertiary">hub</span>
                <span>{isInOrgWorkspace ? "Org Cohorts & Groups" : "Cohorts & Groups"}</span>
              </Link>

              {isInOrgWorkspace && effectiveOrgSlug ? (
                <Link
                  href={`/${effectiveOrgSlug}/arena`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-on-surface hover:text-white hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-amber-accent">swords</span>
                  <span>Live Arena</span>
                </Link>
              ) : (
                <Link
                  href="/join"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-on-surface hover:text-white hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-amber-accent">swords</span>
                  <span>Live Arena</span>
                </Link>
              )}

              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-on-surface hover:text-white hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-base text-primary">
                  account_circle
                </span>
                <span>Profile / Account</span>
              </Link>

              <Link
                href="/profile?tab=my-quizzes"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-headline-sm text-on-surface hover:text-white hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-base text-tertiary">
                  folder_shared
                </span>
                <span>My Quizzes</span>
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
