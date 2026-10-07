import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuizzCraft.app • Interactive 3D Quiz Platform",
  description: "Turn Notes and PDFs into Interactive 3D Gamified Quizzes in Seconds.",
  icons: {
    icon: "/images/logo-icon.png",
    shortcut: "/images/logo-icon.png",
    apple: "/images/logo-icon.png",
  },
};

import { AuthProvider } from "@/lib/auth/auth-context";
import CosmicPreloader from "@/components/ui/CosmicPreloader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <link rel="icon" href="/images/logo-icon.png" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,700;1,400&family=Outfit:wght@300;400;500;600;700&family=Sora:wght@400;600;700;800&family=Noto+Serif+JP:wght@400;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-background min-h-screen relative overflow-x-hidden selection:bg-primary selection:text-on-primary font-body-md text-base antialiased">
        <CosmicPreloader />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
