/**
 * The demo dock.
 *
 * A fixed panel holding everything that makes this a demo rather than a
 * product: the persona segment, the pinned clock and the one control that
 * moves it, the theme toggle, the locale picker and a reset. It is labelled
 * "Demo controls" so nobody mistakes it for a feature of the restaurant.
 *
 * House layout rule 1 is enforced here, and it matters more in this app than
 * in any other: the cart drawer's Checkout button occupies the same bottom
 * inline-end corner as the dock. Whenever an overlay owns that corner the dock
 * moves to the opposite one. `--shifted` swaps `inset-inline-end` for
 * `inset-inline-start`, which mirrors correctly in RTL without a second rule.
 */

import { ChevronDown, Clock, Moon, RotateCcw, Settings2, Sun } from "lucide-react";

import { LOCALES, LOCALE_TAGS, useI18n, type LocaleTag } from "../i18n/index.tsx";
import type { Persona } from "../data/types.ts";
import { clock } from "../lib/format.ts";
import { useStore } from "../state/store.ts";
import { Segmented } from "./Primitives.tsx";

export default function DemoDock() {
  const { t, locale, setLocale } = useI18n();
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const open = useStore((s) => s.dockOpen);
  const setOpen = useStore((s) => s.setDockOpen);
  const reset = useStore((s) => s.reset);
  const shifted = useStore((s) => s.overlayOpen);
  const now = useStore((s) => s.now);
  const tick = useStore((s) => s.tick);

  if (!open) {
    return (
      <button
        type="button"
        className={`jk-dock__mini jk-btn${shifted ? " jk-dock--shifted" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={t("chrome.dock.expand")}
      >
        <Settings2 size={15} aria-hidden="true" />
        {t("chrome.dock.title")}
      </button>
    );
  }

  return (
    <aside
      className={`jk-dock${shifted ? " jk-dock--shifted" : ""}`}
      aria-label={t("chrome.dock.title")}
    >
      <div className="jk-dock__head">
        <Settings2 size={13} aria-hidden="true" />
        {t("chrome.dock.title")}
        <button
          type="button"
          className="jk-dock__collapse"
          onClick={() => setOpen(false)}
          aria-label={t("chrome.dock.collapse")}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>

      <Segmented<Persona>
        full
        ariaLabel={t("chrome.dock.persona")}
        value={persona}
        onChange={setPersona}
        options={[
          { value: "diner", label: t("chrome.dock.diner") },
          { value: "kitchen", label: t("chrome.dock.kitchen") },
        ]}
      />

      <div className="jk-dock__row">
        <span className="jk-dock__label">{t("chrome.dock.clock")}</span>
        <span className="jk-dock__clock jk-mono" title={t("chrome.dock.clock.title")}>
          {clock(now)}
        </span>
        {/* The one control in the whole app that moves time. */}
        <button
          type="button"
          className="jk-dock__tick jk-btn"
          onClick={tick}
          title={t("chrome.dock.tick.title")}
        >
          <Clock size={13} aria-hidden="true" />
          {/* "+10 min" is a signed duration: isolate it or bidi renders "min 10+". */}
          <span className="jk-mono">{t("chrome.dock.tick")}</span>
        </button>
      </div>

      <div className="jk-dock__row">
        <span className="jk-dock__label">{t("chrome.dock.language")}</span>
        <select
          className="jk-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as LocaleTag)}
          aria-label={t("chrome.dock.language")}
        >
          {LOCALE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {LOCALES[tag].native}
            </option>
          ))}
        </select>
      </div>

      <div className="jk-dock__row">
        <span className="jk-dock__label">{t("chrome.dock.theme")}</span>
        <button
          type="button"
          className="jk-iconbtn jk-btn"
          onClick={toggleTheme}
          aria-label={t(theme === "dark" ? "chrome.dock.theme.light" : "chrome.dock.theme.dark")}
          title={t(theme === "dark" ? "chrome.dock.theme.light" : "chrome.dock.theme.dark")}
        >
          {theme === "dark" ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="jk-iconbtn jk-btn"
          onClick={reset}
          aria-label={t("chrome.dock.reset")}
          title={t("chrome.dock.reset")}
          style={{ marginInlineStart: "auto" }}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
