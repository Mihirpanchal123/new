import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return <SettingsPanel />;
}
