/**
 * Centralized audio. Every sound is synthesized with the Web Audio API — no
 * asset files, nothing to license, tiny bundle. Components never touch
 * AudioContext directly; they call `sound.playX()`.
 *
 * Browsers block audio until a user gesture, so `unlock()` is wired to the
 * first pointer/key event (see SoundProvider). Music never autoplays.
 */

type Wave = OscillatorType;

interface ToneOptions {
  freq: number;
  to?: number;
  type?: Wave;
  duration?: number;
  gain?: number;
  delay?: number;
  attack?: number;
}

const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5,
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private effectsOn = true;
  private musicOn = false;
  private music: { stop: () => void } | null = null;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.musicOn && !this.music) this.startMusic();
  }

  setEffectsEnabled(on: boolean) {
    this.effectsOn = on;
  }

  setMusicEnabled(on: boolean) {
    this.musicOn = on;
    if (on && this.ctx?.state === "running") this.startMusic();
    if (!on) this.stopMusic();
  }

  private tone({ freq, to, type = "sine", duration = 0.15, gain = 0.25, delay = 0, attack = 0.008 }: ToneOptions) {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== "running") return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private fx(fn: () => void) {
    if (this.effectsOn) fn();
  }

  playClick() {
    this.fx(() => this.tone({ freq: 620, to: 520, type: "triangle", duration: 0.06, gain: 0.12 }));
  }
  playCorrect() {
    this.fx(() => {
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) =>
        this.tone({ freq: f, type: "triangle", duration: 0.18, gain: 0.2, delay: i * 0.06 }),
      );
    });
  }
  playWrong() {
    this.fx(() => {
      this.tone({ freq: 220, to: 180, type: "square", duration: 0.12, gain: 0.07 });
      this.tone({ freq: 196, to: 150, type: "square", duration: 0.16, gain: 0.07, delay: 0.09 });
    });
  }
  playHint() {
    this.fx(() => {
      this.tone({ freq: NOTE.A5, type: "sine", duration: 0.12, gain: 0.15 });
      this.tone({ freq: NOTE.E5 * 2, type: "sine", duration: 0.2, gain: 0.1, delay: 0.07 });
    });
  }
  playCountdown() {
    this.fx(() => this.tone({ freq: NOTE.A4, type: "triangle", duration: 0.14, gain: 0.2 }));
  }
  playGo() {
    this.fx(() => {
      this.tone({ freq: NOTE.A5, type: "triangle", duration: 0.35, gain: 0.22 });
      this.tone({ freq: NOTE.E5, type: "sine", duration: 0.35, gain: 0.12 });
    });
  }
  playTick() {
    this.fx(() => this.tone({ freq: 1200, type: "square", duration: 0.03, gain: 0.04 }));
  }
  playTimerWarning() {
    this.fx(() => this.tone({ freq: NOTE.E5, to: NOTE.C5, type: "triangle", duration: 0.25, gain: 0.15 }));
  }
  playTurnStart() {
    this.fx(() => {
      this.tone({ freq: NOTE.G4, type: "sine", duration: 0.1, gain: 0.14 });
      this.tone({ freq: NOTE.D5, type: "sine", duration: 0.16, gain: 0.14, delay: 0.08 });
    });
  }
  playVictory() {
    this.fx(() => {
      const seq = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6];
      seq.forEach((f, i) => this.tone({ freq: f, type: "triangle", duration: i === seq.length - 1 ? 0.6 : 0.16, gain: 0.2, delay: i * 0.11 }));
    });
  }
  playDefeat() {
    this.fx(() => {
      [NOTE.G4, NOTE.E4, NOTE.C4].forEach((f, i) =>
        this.tone({ freq: f, type: "sine", duration: i === 2 ? 0.5 : 0.22, gain: 0.16, delay: i * 0.18 }),
      );
    });
  }
  playRematch() {
    this.fx(() => {
      this.tone({ freq: NOTE.D5, type: "triangle", duration: 0.12, gain: 0.16 });
      this.tone({ freq: NOTE.A5, type: "triangle", duration: 0.2, gain: 0.16, delay: 0.1 });
    });
  }
  playNotification() {
    this.fx(() => {
      this.tone({ freq: NOTE.E5, type: "sine", duration: 0.12, gain: 0.14 });
      this.tone({ freq: NOTE.B4 * 2, type: "sine", duration: 0.18, gain: 0.12, delay: 0.1 });
    });
  }
  playJoin() {
    this.fx(() => this.tone({ freq: NOTE.C5, to: NOTE.G5, type: "sine", duration: 0.2, gain: 0.15 }));
  }

  /** Gentle generative pad. Off by default; only starts after a gesture. */
  private startMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.music) return;
    const bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    bus.connect(filter).connect(this.master);

    const chords = [
      [NOTE.C4, NOTE.E4, NOTE.G4],
      [NOTE.A4 / 2, NOTE.C4, NOTE.E4],
      [NOTE.F4 / 2, NOTE.A4 / 2, NOTE.C4],
      [NOTE.G4 / 2, NOTE.B4 / 2, NOTE.D4],
    ];
    const voices = chords[0]!.map((f) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(bus);
      osc.start();
      return osc;
    });
    let i = 0;
    const timer = window.setInterval(() => {
      i = (i + 1) % chords.length;
      voices.forEach((osc, v) => osc.frequency.setTargetAtTime(chords[i]![v]!, ctx.currentTime, 0.6));
    }, 4000);

    this.music = {
      stop: () => {
        window.clearInterval(timer);
        bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
        voices.forEach((o) => o.stop(ctx.currentTime + 1.5));
      },
    };
  }

  private stopMusic() {
    this.music?.stop();
    this.music = null;
  }
}

export const sound = new SoundManager();
