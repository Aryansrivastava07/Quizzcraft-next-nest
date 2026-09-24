import React from "react";
import Link from "next/link";

export interface FooterLink {
  label: string;
  href: string;
}

export interface AuthFooterProps {
  className?: string;
  linksClassName?: string;
  copyrightText?: string;
  links?: FooterLink[];
}

export const DEFAULT_AUTH_FOOTER_LINKS: FooterLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

export default function AuthFooter({
  className = "",
  linksClassName = "",
  copyrightText = "© 2026 QuizzCraft.app",
  links = DEFAULT_AUTH_FOOTER_LINKS,
}: AuthFooterProps) {
  return (
    <footer
      className={`relative z-20 w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant font-body-sm text-xs border-t border-outline-variant/20 ${className}`}
    >
      <p>{copyrightText}</p>
      <div className={`flex items-center gap-6 font-label-code text-xs ${linksClassName}`}>
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="hover:text-primary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
