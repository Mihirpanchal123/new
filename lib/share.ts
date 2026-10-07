export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** Native share sheet where available (mostly mobile), clipboard otherwise. */
export async function shareOrCopy(data: { title?: string; text: string; url?: string }): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && isTouchDevice()) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
      // fall through to clipboard
    }
  }
  const text = data.url ? `${data.text}\n${data.url}` : data.text;
  return (await copyText(text)) ? "copied" : "failed";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts / older browsers.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

export function roomShareText(code: string) {
  return `Join my Word Duel game 🎮\nCode: ${code}`;
}

export function resultShareText(opts: { won: boolean | null; myScore: number; theirScore: number; opponent: string }) {
  const score = `${opts.myScore}–${opts.theirScore}`;
  if (opts.won === null) return `🤝 ${opts.opponent} and I tied in Word Duel!\n\nScore: ${score}\n\nThink you can break the tie?`;
  if (opts.won) return `🔥 I beat ${opts.opponent} in Word Duel!\n\nScore: ${score}\n\nCan you beat me?`;
  return `⚔️ ${opts.opponent} edged me out in Word Duel.\n\nScore: ${score}\n\nThink you can do better?`;
}
