import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return ["", "/play", "/how-to-play", "/leaderboard", "/about", "/privacy", "/terms"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "/leaderboard" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
