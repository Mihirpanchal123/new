"use client";

import type { VoiceSignal } from "@/types/realtime";
import { getSocket } from "./client";

export type VoiceStatus =
  | "off" // not in voice
  | "requesting" // waiting for mic permission
  | "waiting" // in voice, opponent isn't
  | "connecting" // both in voice, establishing audio
  | "live";

export interface VoiceState {
  status: VoiceStatus;
  muted: boolean;
  peerInVoice: boolean;
  peerMuted: boolean;
}

export const INITIAL_VOICE_STATE: VoiceState = { status: "off", muted: false, peerInVoice: false, peerMuted: false };

function iceServers(): RTCIceServer[] {
  const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* fall through to the default */
    }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

export function voiceSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof RTCPeerConnection !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * One player's side of an opt-in, peer-to-peer voice call for a room.
 * Audio only flows once both players have joined. Signaling goes through the
 * game socket; negotiation uses the WebRTC "perfect negotiation" pattern, with
 * the player whose id sorts higher acting as the polite peer.
 */
export class VoiceSession {
  private state: VoiceState = { ...INITIAL_VOICE_STATE };
  private local: MediaStream | null = null;
  private pc: RTCPeerConnection | null = null;
  private audio: HTMLAudioElement | null = null;
  private peerId: string | null = null;
  private makingOffer = false;
  private ignoreOffer = false;
  /** Signals are handled strictly in order; negotiation steps are async. */
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly code: string,
    private readonly meId: string,
    private readonly onChange: (state: VoiceState) => void,
  ) {}

  private get joined() {
    return this.local !== null;
  }

  private set(patch: Partial<VoiceState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.onChange(this.state);
  }

  private send(signal: VoiceSignal) {
    const socket = getSocket();
    if (socket.connected) socket.emit("voice:signal", { code: this.code, signal });
  }

  /** Must be called from a user gesture so the remote audio is allowed to play. */
  async join(): Promise<void> {
    if (this.joined || this.state.status === "requesting") return;
    this.set({ status: "requesting" });
    // Created inside the gesture; Safari won't autoplay one created later.
    this.audio ??= Object.assign(new Audio(), { autoplay: true });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      this.set({ status: "off" });
      throw err;
    }
    if (this.disposed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.local = stream;
    this.applyMute();
    this.set({ status: this.state.peerInVoice ? "connecting" : "waiting" });
    this.send({ type: "join", reply: false, muted: this.state.muted });
    if (this.state.peerInVoice) this.createPeer();
  }

  leave() {
    if (!this.joined) return;
    this.send({ type: "leave" });
    this.closePeer();
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    this.set({ status: "off" });
  }

  setMuted(muted: boolean) {
    this.set({ muted });
    this.applyMute();
    if (this.joined) this.send({ type: "mute", muted });
  }

  /** The opponent dropped off the socket; their side of the call is gone. */
  peerGone() {
    this.closePeer();
    this.set({ peerInVoice: false, peerMuted: false, status: this.joined ? "waiting" : "off" });
  }

  /** Let the opponent know we're in voice (after they or we reconnect). */
  announce() {
    if (this.joined && !this.pc) this.send({ type: "join", reply: false, muted: this.state.muted });
  }

  handleSignal(from: string, signal: VoiceSignal) {
    this.queue = this.queue.then(() => this.process(from, signal)).catch(() => {});
  }

  dispose() {
    this.leave();
    this.disposed = true;
    if (this.audio) this.audio.srcObject = null;
  }

  private async process(from: string, signal: VoiceSignal) {
    if (this.disposed) return;
    this.peerId = from;
    switch (signal.type) {
      case "join":
        this.set({ peerInVoice: true, peerMuted: signal.muted });
        if (!this.joined) return;
        if (!signal.reply) {
          // The peer (re)joined with a fresh connection: start over, and tell them we're here.
          this.send({ type: "join", reply: true, muted: this.state.muted });
          this.closePeer();
        }
        if (!this.pc) this.createPeer();
        this.set({ status: "connecting" });
        return;
      case "leave":
        this.peerGone();
        return;
      case "mute":
        this.set({ peerMuted: signal.muted });
        return;
      case "description":
        return this.onDescription(signal.description);
      case "candidate":
        if (!this.pc) return;
        try {
          await this.pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!this.ignoreOffer) throw err;
        }
    }
  }

  private async onDescription(description: RTCSessionDescriptionInit) {
    if (!this.joined) return;
    if (!this.pc) this.createPeer();
    const pc = this.pc!;
    const polite = this.peerId !== null && this.meId > this.peerId;
    const collision = description.type === "offer" && (this.makingOffer || pc.signalingState !== "stable");
    this.ignoreOffer = !polite && collision;
    if (this.ignoreOffer) return;
    await pc.setRemoteDescription(description);
    if (description.type === "offer") {
      await pc.setLocalDescription();
      if (pc.localDescription) this.send({ type: "description", description: pc.localDescription.toJSON() });
    }
  }

  private createPeer() {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    this.pc = pc;
    this.makingOffer = false;
    this.ignoreOffer = false;
    for (const track of this.local?.getTracks() ?? []) pc.addTrack(track, this.local!);

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (this.pc === pc && pc.localDescription) {
          this.send({ type: "description", description: pc.localDescription.toJSON() });
        }
      } catch {
        /* superseded by a newer negotiation */
      } finally {
        this.makingOffer = false;
      }
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && this.pc === pc) this.send({ type: "candidate", candidate: candidate.toJSON() as RTCIceCandidateInit & { candidate: string } });
    };
    pc.ontrack = ({ track, streams }) => {
      if (this.pc !== pc || !this.audio) return;
      this.audio.srcObject = streams[0] ?? new MediaStream([track]);
      void this.audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === "connected") this.set({ status: "live" });
      else if (pc.connectionState === "disconnected") this.set({ status: "connecting" });
      else if (pc.connectionState === "failed") {
        this.set({ status: "connecting" });
        pc.restartIce();
      }
    };
  }

  private closePeer() {
    if (!this.pc) return;
    const pc = this.pc;
    this.pc = null;
    pc.onnegotiationneeded = pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
    pc.close();
    if (this.audio) this.audio.srcObject = null;
  }

  private applyMute() {
    for (const track of this.local?.getAudioTracks() ?? []) track.enabled = !this.state.muted;
  }
}
