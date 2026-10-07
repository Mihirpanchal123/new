import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const body = Nunito({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Fredoka({ subsets: ["latin"], variable: "--font-display-face", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Word Duel — Think alike. Guess faster.",
    template: "%s · Word Duel",
  },
  description:
    "A fast, social word game for two. Build a chain of 5 connected words, then race to crack your opponent's chain one letter at a time.",
  applicationName: "Word Duel",
  keywords: ["word game", "multiplayer", "party game", "word chain", "guessing game"],
  openGraph: {
    type: "website",
    siteName: "Word Duel",
    title: "Word Duel — Think alike. Guess faster.",
    description: "Build a chain of 5 connected words. Crack your friend's chain before they crack yours.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Word Duel — Think alike. Guess faster.",
    description: "Build a chain of 5 connected words. Crack your friend's chain before they crack yours.",
  },
  appleWebApp: { capable: true, title: "Word Duel", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Keyboard resizes the layout so the sticky guess bar stays visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c16" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
