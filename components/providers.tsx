"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { setHapticsEnabled } from "@/lib/haptics";
import { sound } from "@/lib/sound/sound-manager";
import { useUiStore } from "@/stores/ui-store";

/** Syncs persisted settings into the sound/haptics singletons and <html>. */
function SettingsBridge() {
  const { soundEnabled, musicEnabled, hapticsEnabled, motion } = useUiStore();

  useEffect(() => sound.setEffectsEnabled(soundEnabled), [soundEnabled]);
  useEffect(() => sound.setMusicEnabled(musicEnabled), [musicEnabled]);
  useEffect(() => setHapticsEnabled(hapticsEnabled), [hapticsEnabled]);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", motion === "reduce");
  }, [motion]);

  // Browsers only allow audio after a gesture.
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  return null;
}

function MotionBridge({ children }: { children: ReactNode }) {
  const motion = useUiStore((s) => s.motion);
  const reducedMotion = motion === "reduce" ? "always" : motion === "full" ? "never" : "user";
  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MotionBridge>
        <SettingsBridge />
        {children}
        <Toaster
          position="top-center"
          visibleToasts={3}
          duration={2600}
          toastOptions={{
            classNames: {
              toast:
                "!rounded-2xl !border !border-border !bg-surface !text-ink !shadow-pop !font-sans !text-[15px] !font-semibold",
              description: "!text-muted",
            },
          }}
        />
      </MotionBridge>
    </ThemeProvider>
  );
}
