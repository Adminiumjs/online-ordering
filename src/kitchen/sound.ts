/**
 * The kitchen's chime. A browser plays sound only after a tap, and stops
 * when the tab sleeps: the screen keeps itself awake while the board is open,
 * watches whether the sound can play, and asks for a tap whenever it cannot.
 * The switch is this device's own choice.
 */
import { create } from "zustand";

const STORAGE = "online-ordering-kitchen-sound";

interface SoundState {
  /** The cook wants sound on this device. */
  on: boolean;
  /** The browser lets it play right now. */
  running: boolean;
}

function storedOn(): boolean {
  try {
    return localStorage.getItem(STORAGE) !== "off";
  } catch {
    return true;
  }
}

export const useSound = create<SoundState>(() => ({ on: storedOn(), running: false }));

let context: AudioContext | null = null;

function watch(ctx: AudioContext): void {
  ctx.onstatechange = () => useSound.setState({ running: ctx.state === "running" });
}

/** A tap: start (or wake) the sound. */
export function armSound(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return;
    if (context === null) {
      context = new Ctor();
      watch(context);
    }
    if (context.state !== "running") void context.resume().then(() => useSound.setState({ running: context?.state === "running" }));
    else useSound.setState({ running: true });
  } catch {
    // No sound on this device: the pulse and the words still say it.
  }
}

export function setSoundOn(on: boolean): void {
  useSound.setState({ on });
  try {
    localStorage.setItem(STORAGE, on ? "on" : "off");
  } catch {
    // Not remembered, still applied.
  }
  if (on) armSound();
}

/** Two short notes, when the sound is on and may play. */
export function chime(): boolean {
  const { on, running } = useSound.getState();
  if (!on || !running || context === null) return false;
  try {
    const t0 = context.currentTime;
    [880, 1175].forEach((frequency, i) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      const t = t0 + i * 0.16;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain);
      gain.connect(context!.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
    return true;
  } catch {
    return false;
  }
}

/** Keeps the screen awake while the board is open; answers the release. */
export function keepAwake(): () => void {
  let lock: { release(): Promise<void> } | null = null;
  let live = true;
  const take = async () => {
    try {
      const nav = navigator as unknown as { wakeLock?: { request(kind: "screen"): Promise<{ release(): Promise<void> }> } };
      if (nav.wakeLock !== undefined && document.visibilityState === "visible") lock = await nav.wakeLock.request("screen");
    } catch {
      // The browser said no (battery saver, no permission): the board still works.
    }
  };
  const again = () => {
    if (live && document.visibilityState === "visible") void take();
  };
  void take();
  document.addEventListener("visibilitychange", again);
  return () => {
    live = false;
    document.removeEventListener("visibilitychange", again);
    void lock?.release().catch(() => undefined);
  };
}
