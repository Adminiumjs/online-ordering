/**
 * 404.
 *
 * Reachable on purpose: the footer's "Gift cards" link points here, so a
 * reader poking at the demo finds an honest dead end rather than a link that
 * silently does nothing.
 */

import { House, Utensils } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import { useStore } from "../state/store.ts";
import { Button, Mono } from "../components/Primitives.tsx";

export default function NotFound() {
  const { t } = useI18n();
  const go = useStore((s) => s.go);

  return (
    <div className="jk-site jk-screen jk-nf">
      <Mono className="jk-nf__code">404</Mono>
      <h1 className="jk-nf__title">{t("notfound.title")}</h1>
      <p className="jk-nf__body">{t("notfound.body")}</p>
      <div className="jk-nf__actions">
        <Button tone="ghost" onClick={() => go("home")}>
          <House size={15} aria-hidden="true" />
          {t("notfound.home")}
        </Button>
        <Button onClick={() => go("menu")}>
          <Utensils size={15} aria-hidden="true" />
          {t("notfound.menu")}
        </Button>
      </div>
    </div>
  );
}
