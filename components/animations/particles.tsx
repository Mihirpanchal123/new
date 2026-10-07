"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const COLORS = ["var(--brand)", "var(--success)", "var(--hint-bright)", "#ff6b57", "#3a9eff"];

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Small radial burst for a correct guess. Pointer-transparent. */
export function ParticleBurst({ seed, count = 14 }: { seed: number; count?: number }) {
  const reduce = useReducedMotion();
  const parts = useMemo(() => {
    const rand = seeded(seed + 7);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.5;
      const dist = 40 + rand() * 50;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.7,
        size: 4 + rand() * 5,
        color: COLORS[i % COLORS.length]!,
        round: rand() > 0.5,
      };
    });
  }, [seed, count]);
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ width: p.size, height: p.size, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4, rotate: p.round ? 0 : 180 }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/** Full-screen confetti rain for a victory. */
export function Confetti({ seed = 1, count = 60 }: { seed?: number; count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, (_, i) => ({
      left: rand() * 100,
      delay: rand() * 0.6,
      duration: 2.2 + rand() * 1.6,
      drift: (rand() - 0.5) * 160,
      spin: (rand() - 0.5) * 720,
      w: 6 + rand() * 6,
      h: 10 + rand() * 8,
      color: COLORS[i % COLORS.length]!,
    }));
  }, [seed, count]);
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute -top-6 rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.w, height: p.h, background: p.color }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", x: p.drift, rotate: p.spin, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
