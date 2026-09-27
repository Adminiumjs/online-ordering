/**
 * The demo's Adminium, whole: one kitchen in memory, its engine, the order
 * page's door and the kitchen's, and the clock the demo card moves.
 *
 * DEMO BUILD ONLY — nothing in a real build imports it.
 */
import { DemoDiner, NO_LATENCY, type Latency } from "./diner.ts";
import { Engine } from "./engine.ts";
import { DemoKitchen } from "./kitchen.ts";
import { DEMO_START, World } from "./world.ts";

export class DemoAdminium {
  readonly world: World;
  readonly engine: Engine;
  readonly diner: DemoDiner;
  readonly kitchen: DemoKitchen;
  private clockListeners = new Set<(now: number) => void>();

  constructor(opts: { now?: number; latency?: Latency } = {}) {
    this.world = new World(opts.now ?? DEMO_START);
    this.engine = new Engine(this.world);
    this.diner = new DemoDiner(this.engine, opts.latency ?? NO_LATENCY);
    this.kitchen = new DemoKitchen(this.engine);
  }

  get now(): number {
    return this.world.now;
  }

  /** Moves the clock to `at` (never back), and makes the moves and sends the emails that came due. */
  advanceTo(at: number): void {
    if (at < this.world.now) return;
    this.world.now = at;
    this.engine.runTimed();
    for (const listener of this.clockListeners) listener(at);
  }

  /** The card's "+10 min". */
  advance(minutes: number): void {
    this.advanceTo(this.world.now + minutes * 60_000);
  }

  onClock(listener: (now: number) => void): () => void {
    this.clockListeners.add(listener);
    return () => this.clockListeners.delete(listener);
  }
}
