/**
 * A translated line with pieces inside it — a bold day, a phone link, a time
 * in the monospace face. The line is translated whole ("You're pre-ordering
 * for {day}. Pickup from {time}."), so each language keeps its own order, and
 * the pieces drop into their placeholders.
 */
import { Fragment, type ReactNode } from "react";

export function Rich({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    const name = match[1] ?? "";
    if (!(name in parts)) continue;
    out.push(text.slice(last, match.index));
    out.push(<Fragment key={`${name}-${String(match.index)}`}>{parts[name]}</Fragment>);
    last = (match.index ?? 0) + match[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}
