/**
 * Which Adminium the screens talk to, set once before the app mounts: the
 * demo's stand-in in the website's demo build, the real one everywhere else.
 * Screens reach the doors through here and never import either side.
 *
 * The clock is the Adminium's too: the demo's runs where its card moves it,
 * a real one is the kitchen's own time as the server says it.
 */
import { useSyncExternalStore } from "react";

import type { DinerPort, KitchenPort } from "./ports.ts";

export interface Clock {
  now(): number;
  subscribe(listener: () => void): () => void;
}

export interface Sources {
  diner: DinerPort;
  kitchen: KitchenPort;
  clock: Clock;
  /** The kitchen's zone and money, before the first read answers. */
  zone: string;
  currency: string;
}

let current: Sources | null = null;

export function setSources(next: Sources): void {
  current = next;
}

export function sources(): Sources {
  if (current === null) throw new Error("the app's Adminium is not set: setSources() runs before the app mounts");
  return current;
}

/** A clock that is the device's, ticking every 15 seconds for the screens that show it. */
export function deviceClock(): Clock {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let last = Date.now();
  return {
    now: () => last,
    subscribe(listener) {
      listeners.add(listener);
      if (timer === null) {
        timer = setInterval(() => {
          last = Date.now();
          for (const l of listeners) l();
        }, 15_000);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}

/** The kitchen's time now, re-rendering when it moves. */
export function useNow(): number {
  const clock = sources().clock;
  return useSyncExternalStore(clock.subscribe, clock.now);
}
