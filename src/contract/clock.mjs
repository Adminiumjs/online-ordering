// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Preloaded into the contract's Adminium (`node --import`): the server's clock
 * starts at `CONTRACT_NOW` (epoch ms) and runs on from there.
 *
 * The contract adds the sample at the moment the sample's own figures are
 * written for — 11:40 on Tuesday 28 July 2026 at the kitchen — so every
 * figure it asserts is the literal one, on every engine. Only JavaScript's clock
 * moves; the server reads its "now" from it. The contract may set it again
 * while the server runs (`Server.setClock`).
 */
import { readFileSync } from "node:fs";

const target = Number(process.env.CONTRACT_NOW);
if (Number.isFinite(target)) {
  const RealDate = Date;
  let offset = target - RealDate.now();
  // The contract sets the clock again (a SIGUSR2, the new "now" in CONTRACT_CLOCK_FILE): to 11:40 just before the sample goes in.
  const file = process.env.CONTRACT_CLOCK_FILE;
  if (file) {
    process.on("SIGUSR2", () => {
      const next = Number(readFileSync(file, "utf8"));
      if (Number.isFinite(next)) offset = next - RealDate.now();
    });
  }
  class ContractDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ContractDate;
}
