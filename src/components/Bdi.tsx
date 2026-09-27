/** A phone number, an order number or an email kept in its own direction inside Arabic text. */
import type { ReactNode } from "react";

export function Bdi({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}
