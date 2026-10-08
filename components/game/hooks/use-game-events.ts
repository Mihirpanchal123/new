"use client";

import { useEffect, useRef } from "react";
import { gameEvents } from "@/lib/realtime/events";
import type { GameEvent } from "@/types/realtime";

/** Subscribe to transient game events. The handler can change freely between renders. */
export function useGameEvents(handler: (event: GameEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => gameEvents.on((env) => ref.current(env.event)), []);
}
