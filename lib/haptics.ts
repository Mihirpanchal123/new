/** Sparing vibration feedback. No-ops where unsupported (e.g. iOS Safari) or disabled. */
let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

function vibrate(pattern: number | number[]) {
  if (!enabled || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export const haptics = {
  tap: () => vibrate(8),
  correct: () => vibrate(25),
  wrong: () => vibrate([18, 40, 18]),
  hint: () => vibrate(12),
  warning: () => vibrate([10, 60, 10]),
  victory: () => vibrate([30, 50, 30, 50, 80]),
};
