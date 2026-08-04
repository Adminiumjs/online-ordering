/**
 * Area bundle: **chrome**.
 *
 * Owns the app shell (`app/App.tsx`), both shells and every shared component
 * under `components/`, the zustand store's own copy (toasts), and the counted
 * nouns `lib/format.ts` composes.
 *
 * `en-US` is the source of truth: every key it carries becomes part of
 * `MessageKey`, and `messages/index.ts` makes a missing translation a COMPILE
 * error rather than a silent fallback.
 *
 * Plural keys carry `|`-separated variants in the locale's own CLDR order:
 *   en/de/fr/da  one|other
 *   cs           one|few|other
 *   zh-CN/zh-TW  other        (a single variant — no `|`)
 *   ar-EG        zero|one|two|few|many|other
 *
 * VOCABULARY. This is a PICKUP-ONLY product. The words "delivery", "meal
 * plan", "combo tier", "pricing" and "upgrade" appear in no locale — say build
 * your order, combo sizes, pickup.
 */
import type { LocaleTag } from "../locales.ts";

const EN = {
  /* --- brand + shell --- */
  "chrome.brand": "Juniper Kitchen",
  "chrome.brand.home": "Juniper Kitchen home",
  "chrome.skipToContent": "Skip to content",
  "chrome.menu.open": "Open the menu",
  "chrome.menu.close": "Close the menu",

  /* --- navigation --- */
  "chrome.nav.label": "Main",
  "chrome.nav.menu": "Menu",
  "chrome.nav.hours": "Hours",
  "chrome.nav.findUs": "Find us",
  "chrome.nav.track": "Track",
  "chrome.nav.cart": "Your order",

  /* --- open state + counts --- */
  "chrome.open": "Open",
  "chrome.closed": "Closed",
  "chrome.cart.open": "Open your order — {count} item|Open your order — {count} items",
  "chrome.itemCount": "{count} item|{count} items",
  "chrome.minutes": "{count} min|{count} min",
  "chrome.plusAmount": "+{amount}",
  "chrome.range": "{from} – {to}",

  /* --- demo dock --- */
  "chrome.dock.title": "Demo controls",
  "chrome.dock.persona": "Persona",
  "chrome.dock.diner": "Diner",
  "chrome.dock.kitchen": "Kitchen",
  "chrome.dock.clock": "Clock",
  "chrome.dock.clock.title": "Pinned demo clock",
  "chrome.dock.tick": "+10 min",
  "chrome.dock.tick.title": "Advance the pinned demo clock — every order moves on one step",
  "chrome.dock.theme": "Theme",
  "chrome.dock.theme.light": "Switch to the light theme",
  "chrome.dock.theme.dark": "Switch to the dark theme",
  "chrome.dock.language": "Language",
  "chrome.dock.reset": "Reset the demo",
  "chrome.dock.collapse": "Hide the demo controls",
  "chrome.dock.expand": "Show the demo controls",

  /* --- footer --- */
  "chrome.footer.copy": "© 2026 Juniper Kitchen. A demo ordering site shipped with Adminium.",
  "chrome.footer.chip": "adminium.dev/demo/online-ordering",
  "chrome.footer.blurb":
    "Fast-casual bowls and pizza on Alder Street. Build your order ahead and pick it up hot at the counter.",
  "chrome.footer.kitchen": "Kitchen",
  "chrome.footer.theMenu": "The menu",
  "chrome.footer.today": "Today",
  "chrome.footer.pickupOnly": "Pickup only — say your number at the counter.",
  "chrome.footer.giftCards": "Gift cards",
  "chrome.footer.giftCards.title": "Demo: this link 404s",

  /* --- actions --- */
  "chrome.action.close": "Close",

  /* --- toasts --- */
  "chrome.toast.dismiss": "Dismiss",
  "chrome.toast.added": "Added — {item}",
  "chrome.toast.updated": "Updated — {item}",
  "chrome.toast.removed": "Removed — {item}",
  "chrome.toast.placed": "Order in — {count} item on the way|Order in — {count} items on the way",
  "chrome.toast.ticked":
    "Clock moved on — {count} order stepped forward|Clock moved on — {count} orders stepped forward",
  "chrome.toast.moved": "#{num} — {status}",
  "chrome.toast.reset": "Service reset to 11:40.",
} as const satisfies Record<string, string>;

/*
 * The seven translations below carry every English key in the same order, so a
 * diff across locales lines up. Do not add keys here — add them to `EN` above,
 * which is what `MessageKey` is derived from.
 */
export const chrome = {
  "en-US": EN,

  "de-DE": {
    "chrome.brand": "Juniper Kitchen",
    "chrome.brand.home": "Juniper Kitchen – Startseite",
    "chrome.skipToContent": "Zum Inhalt springen",
    "chrome.menu.open": "Navigation öffnen",
    "chrome.menu.close": "Navigation schließen",

    "chrome.nav.label": "Hauptnavigation",
    "chrome.nav.menu": "Speisekarte",
    "chrome.nav.hours": "Öffnungszeiten",
    "chrome.nav.findUs": "Anfahrt",
    "chrome.nav.track": "Verfolgen",
    "chrome.nav.cart": "Deine Bestellung",

    "chrome.open": "Geöffnet",
    "chrome.closed": "Geschlossen",
    "chrome.cart.open":
      "Deine Bestellung öffnen — {count} Artikel|Deine Bestellung öffnen — {count} Artikel",
    "chrome.itemCount": "{count} Artikel|{count} Artikel",
    "chrome.minutes": "{count} Min.|{count} Min.",
    "chrome.plusAmount": "+{amount}",
    "chrome.range": "{from} – {to}",

    "chrome.dock.title": "Demo-Steuerung",
    "chrome.dock.persona": "Rolle",
    "chrome.dock.diner": "Gast",
    "chrome.dock.kitchen": "Küche",
    "chrome.dock.clock": "Uhr",
    "chrome.dock.clock.title": "Fixierte Demo-Uhr",
    "chrome.dock.tick": "+10 Min.",
    "chrome.dock.tick.title":
      "Die fixierte Demo-Uhr weiterstellen — jede Bestellung rückt einen Schritt vor",
    "chrome.dock.theme": "Design",
    "chrome.dock.theme.light": "Zum hellen Design wechseln",
    "chrome.dock.theme.dark": "Zum dunklen Design wechseln",
    "chrome.dock.language": "Sprache",
    "chrome.dock.reset": "Demo zurücksetzen",
    "chrome.dock.collapse": "Demo-Steuerung ausblenden",
    "chrome.dock.expand": "Demo-Steuerung einblenden",

    "chrome.footer.copy":
      "© 2026 Juniper Kitchen. Eine Demo-Bestellseite aus dem Adminium-Paket.",
    "chrome.footer.chip": "adminium.dev/demo/online-ordering",
    "chrome.footer.blurb":
      "Bowls und Pizza im Fast-Casual-Stil in der Alder Street. Stell deine Bestellung vorab zusammen und hol sie heiß an der Theke ab.",
    "chrome.footer.kitchen": "Küche",
    "chrome.footer.theMenu": "Die Speisekarte",
    "chrome.footer.today": "Heute",
    "chrome.footer.pickupOnly": "Nur zur Abholung — nenn deine Nummer an der Theke.",
    "chrome.footer.giftCards": "Geschenkkarten",
    "chrome.footer.giftCards.title": "Demo: dieser Link führt ins Leere (404)",

    "chrome.action.close": "Schließen",

    "chrome.toast.dismiss": "Ausblenden",
    "chrome.toast.added": "Hinzugefügt — {item}",
    "chrome.toast.updated": "Aktualisiert — {item}",
    "chrome.toast.removed": "Entfernt — {item}",
    "chrome.toast.placed":
      "Bestellung ist drin — {count} Artikel kommt|Bestellung ist drin — {count} Artikel kommen",
    "chrome.toast.ticked":
      "Uhr weitergestellt — {count} Bestellung ist einen Schritt weiter|Uhr weitergestellt — {count} Bestellungen sind einen Schritt weiter",
    "chrome.toast.moved": "#{num} — {status}",
    "chrome.toast.reset": "Service auf 11:40 zurückgesetzt.",
  },

  "fr-FR": {
    "chrome.brand": "Juniper Kitchen",
    "chrome.brand.home": "Juniper Kitchen – accueil",
    "chrome.skipToContent": "Aller au contenu",
    "chrome.menu.open": "Ouvrir la navigation",
    "chrome.menu.close": "Fermer la navigation",

    "chrome.nav.label": "Navigation principale",
    "chrome.nav.menu": "La carte",
    "chrome.nav.hours": "Horaires",
    "chrome.nav.findUs": "Nous trouver",
    "chrome.nav.track": "Suivi",
    "chrome.nav.cart": "Votre commande",

    "chrome.open": "Ouvert",
    "chrome.closed": "Fermé",
    "chrome.cart.open":
      "Ouvrir votre commande — {count} article|Ouvrir votre commande — {count} articles",
    "chrome.itemCount": "{count} article|{count} articles",
    "chrome.minutes": "{count} min|{count} min",
    "chrome.plusAmount": "+{amount}",
    "chrome.range": "{from} – {to}",

    "chrome.dock.title": "Commandes de la démo",
    "chrome.dock.persona": "Rôle",
    "chrome.dock.diner": "Client",
    "chrome.dock.kitchen": "Cuisine",
    "chrome.dock.clock": "Horloge",
    "chrome.dock.clock.title": "Horloge de démo figée",
    "chrome.dock.tick": "+10 min",
    "chrome.dock.tick.title":
      "Avancer l’horloge de démo figée — chaque commande passe à l’étape suivante",
    "chrome.dock.theme": "Thème",
    "chrome.dock.theme.light": "Passer au thème clair",
    "chrome.dock.theme.dark": "Passer au thème sombre",
    "chrome.dock.language": "Langue",
    "chrome.dock.reset": "Réinitialiser la démo",
    "chrome.dock.collapse": "Masquer les commandes de la démo",
    "chrome.dock.expand": "Afficher les commandes de la démo",

    "chrome.footer.copy":
      "© 2026 Juniper Kitchen. Un site de commande de démonstration fourni avec Adminium.",
    "chrome.footer.chip": "adminium.dev/demo/online-ordering",
    "chrome.footer.blurb":
      "Des bowls et des pizzas façon fast-casual, sur Alder Street. Composez votre commande à l’avance et récupérez-la bien chaude au comptoir.",
    "chrome.footer.kitchen": "Cuisine",
    "chrome.footer.theMenu": "La carte",
    "chrome.footer.today": "Aujourd’hui",
    "chrome.footer.pickupOnly": "Retrait uniquement — donnez votre numéro au comptoir.",
    "chrome.footer.giftCards": "Cartes cadeaux",
    "chrome.footer.giftCards.title": "Démo : ce lien renvoie une 404",

    "chrome.action.close": "Fermer",

    "chrome.toast.dismiss": "Masquer",
    "chrome.toast.added": "Ajouté — {item}",
    "chrome.toast.updated": "Modifié — {item}",
    "chrome.toast.removed": "Retiré — {item}",
    "chrome.toast.placed":
      "Commande envoyée — {count} article en préparation|Commande envoyée — {count} articles en préparation",
    "chrome.toast.ticked":
      "Horloge avancée — {count} commande a progressé|Horloge avancée — {count} commandes ont progressé",
    "chrome.toast.moved": "#{num} — {status}",
    "chrome.toast.reset": "Service réinitialisé à 11 h 40.",
  },

  "cs-CZ": {
    "chrome.brand": "Juniper Kitchen",
    "chrome.brand.home": "Juniper Kitchen – domů",
    "chrome.skipToContent": "Přejít na obsah",
    "chrome.menu.open": "Otevřít navigaci",
    "chrome.menu.close": "Zavřít navigaci",

    "chrome.nav.label": "Hlavní navigace",
    "chrome.nav.menu": "Jídelní lístek",
    "chrome.nav.hours": "Otevírací doba",
    "chrome.nav.findUs": "Kde nás najdete",
    "chrome.nav.track": "Sledování",
    "chrome.nav.cart": "Vaše objednávka",

    "chrome.open": "Otevřeno",
    "chrome.closed": "Zavřeno",
    "chrome.cart.open":
      "Otevřít objednávku — {count} položka|Otevřít objednávku — {count} položky|Otevřít objednávku — {count} položek",
    "chrome.itemCount": "{count} položka|{count} položky|{count} položek",
    "chrome.minutes": "{count} min|{count} min|{count} min",
    "chrome.plusAmount": "+{amount}",
    "chrome.range": "{from} – {to}",

    "chrome.dock.title": "Ovládání ukázky",
    "chrome.dock.persona": "Role",
    "chrome.dock.diner": "Host",
    "chrome.dock.kitchen": "Kuchyně",
    "chrome.dock.clock": "Hodiny",
    "chrome.dock.clock.title": "Pevně nastavené hodiny ukázky",
    "chrome.dock.tick": "+10 min",
    "chrome.dock.tick.title":
      "Posunout hodiny ukázky — každá objednávka postoupí o jeden krok",
    "chrome.dock.theme": "Vzhled",
    "chrome.dock.theme.light": "Přepnout na světlý vzhled",
    "chrome.dock.theme.dark": "Přepnout na tmavý vzhled",
    "chrome.dock.language": "Jazyk",
    "chrome.dock.reset": "Resetovat ukázku",
    "chrome.dock.collapse": "Skrýt ovládání ukázky",
    "chrome.dock.expand": "Zobrazit ovládání ukázky",

    "chrome.footer.copy":
      "© 2026 Juniper Kitchen. Ukázkový web pro objednávky, který je součástí Adminia.",
    "chrome.footer.chip": "adminium.dev/demo/online-ordering",
    "chrome.footer.blurb":
      "Bowly a pizza ve stylu fast casual v ulici Alder Street. Sestavte si objednávku dopředu a vyzvedněte si ji horkou u pultu.",
    "chrome.footer.kitchen": "Kuchyně",
    "chrome.footer.theMenu": "Jídelní lístek",
    "chrome.footer.today": "Dnes",
    "chrome.footer.pickupOnly": "Pouze osobní odběr — u pultu řekněte své číslo.",
    "chrome.footer.giftCards": "Dárkové poukazy",
    "chrome.footer.giftCards.title": "Ukázka: tento odkaz vede na 404",

    "chrome.action.close": "Zavřít",

    "chrome.toast.dismiss": "Zavřít",
    "chrome.toast.added": "Přidáno — {item}",
    "chrome.toast.updated": "Upraveno — {item}",
    "chrome.toast.removed": "Odebráno — {item}",
    "chrome.toast.placed":
      "Objednávka přijata — {count} položka se připravuje|Objednávka přijata — {count} položky se připravují|Objednávka přijata — {count} položek se připravuje",
    "chrome.toast.ticked":
      "Hodiny se posunuly — {count} objednávka postoupila|Hodiny se posunuly — {count} objednávky postoupily|Hodiny se posunuly — {count} objednávek postoupilo",
    "chrome.toast.moved": "#{num} — {status}",
    "chrome.toast.reset": "Provoz vrácen na 11:40.",
  },

  "da-DK": {
    "chrome.brand": "Juniper Kitchen",
    "chrome.brand.home": "Juniper Kitchen – forside",
    "chrome.skipToContent": "Gå til indhold",
    "chrome.menu.open": "Åbn navigationen",
    "chrome.menu.close": "Luk navigationen",

    "chrome.nav.label": "Hovednavigation",
    "chrome.nav.menu": "Menukort",
    "chrome.nav.hours": "Åbningstider",
    "chrome.nav.findUs": "Find os",
    "chrome.nav.track": "Følg",
    "chrome.nav.cart": "Din bestilling",

    "chrome.open": "Åbent",
    "chrome.closed": "Lukket",
    "chrome.cart.open":
      "Åbn din bestilling — {count} vare|Åbn din bestilling — {count} varer",
    "chrome.itemCount": "{count} vare|{count} varer",
    "chrome.minutes": "{count} min|{count} min",
    "chrome.plusAmount": "+{amount}",
    "chrome.range": "{from} – {to}",

    "chrome.dock.title": "Demo-kontroller",
    "chrome.dock.persona": "Rolle",
    "chrome.dock.diner": "Gæst",
    "chrome.dock.kitchen": "Køkken",
    "chrome.dock.clock": "Ur",
    "chrome.dock.clock.title": "Fastlåst demo-ur",
    "chrome.dock.tick": "+10 min",
    "chrome.dock.tick.title":
      "Ryk det fastlåste demo-ur frem — hver bestilling rykker et trin videre",
    "chrome.dock.theme": "Tema",
    "chrome.dock.theme.light": "Skift til lyst tema",
    "chrome.dock.theme.dark": "Skift til mørkt tema",
    "chrome.dock.language": "Sprog",
    "chrome.dock.reset": "Nulstil demoen",
    "chrome.dock.collapse": "Skjul demo-kontrollerne",
    "chrome.dock.expand": "Vis demo-kontrollerne",

    "chrome.footer.copy":
      "© 2026 Juniper Kitchen. Et demo-bestillingssite, der følger med Adminium.",
    "chrome.footer.chip": "adminium.dev/demo/online-ordering",
    "chrome.footer.blurb":
      "Fast casual-bowls og pizza på Alder Street. Sammensæt din bestilling på forhånd, og hent den varm ved disken.",
    "chrome.footer.kitchen": "Køkken",
    "chrome.footer.theMenu": "Menukortet",
    "chrome.footer.today": "I dag",
    "chrome.footer.pickupOnly": "Kun afhentning — sig dit nummer ved disken.",
    "chrome.footer.giftCards": "Gavekort",
    "chrome.footer.giftCards.title": "Demo: dette link giver 404",

    "chrome.action.close": "Luk",

    "chrome.toast.dismiss": "Luk",
    "chrome.toast.added": "Tilføjet — {item}",
    "chrome.toast.updated": "Opdateret — {item}",
    "chrome.toast.removed": "Fjernet — {item}",
    "chrome.toast.placed":
      "Bestillingen er inde — {count} vare på vej|Bestillingen er inde — {count} varer på vej",
    "chrome.toast.ticked":
      "Uret er rykket frem — {count} bestilling rykkede et trin|Uret er rykket frem — {count} bestillinger rykkede et trin",
    "chrome.toast.moved": "#{num} — {status}",
    "chrome.toast.reset": "Servicen er nulstillet til 11.40.",
  },

  "zh-CN": {
    "chrome.brand": "Juniper Kitchen",
    "chrome.brand.home": "Juniper Kitchen 首页",
    "chrome.skipToContent": "跳到主要内容",
    "chrome.menu.open": "打开导航",
    "chrome.menu.close": "关闭导航",

    "chrome.nav.label": "主导航",
    "chrome.nav.menu": "菜单",
    "chrome.nav.hours": "营业时间",
    "chrome.nav.findUs": "门店位置",
    "chrome.nav.track": "订单进度",
    "chrome.nav.cart": "我的订单",

    "chrome.open": "营业中",
    "chrome.closed": "已打烊",
    "chrome.cart.open": "打开我的订单 — {count} 件",
    "chrome.itemCount": "{count} 件",
    "chrome.minutes": "{count} 分钟",
    "chrome.plusAmount": "+{amount}",
    "chrome.range": "{from} – {to}",

    "chrome.dock.title": "演示控制",
    "chrome.dock.persona": "角色",
    "chrome.dock.diner": "顾客",
    "chrome.dock.kitchen": "后厨",
    "chrome.dock.clock": "时钟",
    "chrome.dock.clock.title": "固定的演示时钟",
    "chrome.dock.tick": "+10 分钟",
    "chrome.dock.tick.title": "推进固定的演示时钟 — 每笔订单向前走一步",
    "chrome.dock.theme": "主题",
    "chrome.dock.theme.light": "切换到浅色主题",
    "chrome.dock.theme.dark": "切换到深色主题",
    "chrome.dock.language": "语言",
    "chrome.dock.reset": "重置演示",
    "chrome.dock.collapse": "隐藏演示控制",
    "chrome.dock.expand": "显示演示控制",

    "chrome.footer.copy": "© 2026 Juniper Kitchen。随 Adminium 一同发布的演示点餐网站。",
    "chrome.footer.chip": "adminium.dev/demo/online-ordering",
    "chrome.footer.blurb":
      "Alder Street 上的快休闲谷物碗与披萨。提前搭配好你的订单，到柜台取走热腾腾的餐点。",
    "chrome.footer.kitchen": "后厨",
    "chrome.footer.theMenu": "菜单",
    "chrome.footer.today": "今天",
    "chrome.footer.pickupOnly": "仅限到店自取 — 在柜台报出你的取餐号。",
    "chrome.footer.giftCards": "礼品卡",
    "chrome.footer.giftCards.title": "演示：此链接会返回 404",

    "chrome.action.close": "关闭",

    "chrome.toast.dismiss": "关闭",
    "chrome.toast.added": "已加入 — {item}",
    "chrome.toast.updated": "已更新 — {item}",
    "chrome.toast.removed": "已移除 — {item}",
    "chrome.toast.placed": "订单已提交 — {count} 件正在制作",
    "chrome.toast.ticked": "时钟已前进 — {count} 笔订单向前走了一步",
    "chrome.toast.moved": "#{num} — {status}",
    "chrome.toast.reset": "服务已重置到 11:40。",
  },

  "zh-TW": {
    "chrome.brand": "Juniper Kitchen",
    "chrome.brand.home": "Juniper Kitchen 首頁",
    "chrome.skipToContent": "跳至主要內容",
    "chrome.menu.open": "開啟導覽",
    "chrome.menu.close": "關閉導覽",

    "chrome.nav.label": "主導覽",
    "chrome.nav.menu": "菜單",
    "chrome.nav.hours": "營業時間",
    "chrome.nav.findUs": "門市位置",
    "chrome.nav.track": "訂單進度",
    "chrome.nav.cart": "我的訂單",

    "chrome.open": "營業中",
    "chrome.closed": "休息中",
    "chrome.cart.open": "開啟我的訂單 — {count} 項",
    "chrome.itemCount": "{count} 項",
    "chrome.minutes": "{count} 分鐘",
    "chrome.plusAmount": "+{amount}",
    "chrome.range": "{from} – {to}",

    "chrome.dock.title": "示範控制項",
    "chrome.dock.persona": "角色",
    "chrome.dock.diner": "顧客",
    "chrome.dock.kitchen": "廚房",
    "chrome.dock.clock": "時鐘",
    "chrome.dock.clock.title": "固定的示範時鐘",
    "chrome.dock.tick": "+10 分鐘",
    "chrome.dock.tick.title": "推進固定的示範時鐘 — 每筆訂單往前一步",
    "chrome.dock.theme": "佈景主題",
    "chrome.dock.theme.light": "切換至淺色佈景主題",
    "chrome.dock.theme.dark": "切換至深色佈景主題",
    "chrome.dock.language": "語言",
    "chrome.dock.reset": "重設示範",
    "chrome.dock.collapse": "隱藏示範控制項",
    "chrome.dock.expand": "顯示示範控制項",

    "chrome.footer.copy": "© 2026 Juniper Kitchen。隨 Adminium 一同發布的示範線上點餐網站。",
    "chrome.footer.chip": "adminium.dev/demo/online-ordering",
    "chrome.footer.blurb":
      "Alder Street 上的快休閒穀物碗與披薩。提前搭配好你的訂單，到櫃檯取用熱騰騰的餐點。",
    "chrome.footer.kitchen": "廚房",
    "chrome.footer.theMenu": "菜單",
    "chrome.footer.today": "今天",
    "chrome.footer.pickupOnly": "僅限到店自取 — 在櫃檯報出你的取餐號碼。",
    "chrome.footer.giftCards": "禮品卡",
    "chrome.footer.giftCards.title": "示範：此連結會回傳 404",

    "chrome.action.close": "關閉",

    "chrome.toast.dismiss": "關閉",
    "chrome.toast.added": "已加入 — {item}",
    "chrome.toast.updated": "已更新 — {item}",
    "chrome.toast.removed": "已移除 — {item}",
    "chrome.toast.placed": "訂單已送出 — {count} 項正在製作",
    "chrome.toast.ticked": "時鐘已前進 — {count} 筆訂單往前走了一步",
    "chrome.toast.moved": "#{num} — {status}",
    "chrome.toast.reset": "服務已重設為 11:40。",
  },

  "ar-EG": {
    "chrome.brand": "Juniper Kitchen",
    "chrome.brand.home": "الصفحة الرئيسية لـ Juniper Kitchen",
    "chrome.skipToContent": "تخطَّ إلى المحتوى",
    "chrome.menu.open": "فتح قائمة التنقل",
    "chrome.menu.close": "إغلاق قائمة التنقل",

    "chrome.nav.label": "التنقل الرئيسي",
    "chrome.nav.menu": "قائمة الطعام",
    "chrome.nav.hours": "مواعيد العمل",
    "chrome.nav.findUs": "موقعنا",
    "chrome.nav.track": "تتبّع الطلب",
    "chrome.nav.cart": "طلبك",

    "chrome.open": "مفتوح",
    "chrome.closed": "مغلق",
    "chrome.cart.open":
      "افتح طلبك — لا أصناف|افتح طلبك — صنف واحد|افتح طلبك — صنفان|افتح طلبك — {count} أصناف|افتح طلبك — {count} صنفًا|افتح طلبك — {count} صنف",
    "chrome.itemCount": "لا أصناف|صنف واحد|صنفان|{count} أصناف|{count} صنفًا|{count} صنف",
    "chrome.minutes":
      "أقل من دقيقة|دقيقة واحدة|دقيقتان|{count} دقائق|{count} دقيقة|{count} دقيقة",
    "chrome.plusAmount": "+{amount}",
    "chrome.range": "{from} – {to}",

    "chrome.dock.title": "أدوات العرض التجريبي",
    "chrome.dock.persona": "الدور",
    "chrome.dock.diner": "زبون",
    "chrome.dock.kitchen": "المطبخ",
    "chrome.dock.clock": "الساعة",
    "chrome.dock.clock.title": "ساعة العرض التجريبي الثابتة",
    "chrome.dock.tick": "+10 دقائق",
    "chrome.dock.tick.title":
      "قدِّم ساعة العرض التجريبي — كل طلب يتقدّم خطوة واحدة",
    "chrome.dock.theme": "المظهر",
    "chrome.dock.theme.light": "التبديل إلى المظهر الفاتح",
    "chrome.dock.theme.dark": "التبديل إلى المظهر الداكن",
    "chrome.dock.language": "اللغة",
    "chrome.dock.reset": "إعادة ضبط العرض التجريبي",
    "chrome.dock.collapse": "إخفاء أدوات العرض التجريبي",
    "chrome.dock.expand": "إظهار أدوات العرض التجريبي",

    "chrome.footer.copy": "© 2026 Juniper Kitchen. موقع طلبات تجريبي يأتي مع Adminium.",
    "chrome.footer.chip": "adminium.dev/demo/online-ordering",
    "chrome.footer.blurb":
      "أطباق بول وبيتزا بأسلوب سريع وعصري في Alder Street. جهّز طلبك مسبقًا واستلمه ساخنًا من الكاونتر.",
    "chrome.footer.kitchen": "المطبخ",
    "chrome.footer.theMenu": "قائمة الطعام",
    "chrome.footer.today": "اليوم",
    "chrome.footer.pickupOnly": "الاستلام من المطعم فقط — قل رقمك عند الكاونتر.",
    "chrome.footer.giftCards": "بطاقات الهدايا",
    "chrome.footer.giftCards.title": "عرض تجريبي: هذا الرابط يعطي 404",

    "chrome.action.close": "إغلاق",

    "chrome.toast.dismiss": "إخفاء",
    "chrome.toast.added": "أُضيف — {item}",
    "chrome.toast.updated": "تم التحديث — {item}",
    "chrome.toast.removed": "أُزيل — {item}",
    "chrome.toast.placed":
      "الطلب وصل — لا أصناف في الطريق|الطلب وصل — صنف واحد في الطريق|الطلب وصل — صنفان في الطريق|الطلب وصل — {count} أصناف في الطريق|الطلب وصل — {count} صنفًا في الطريق|الطلب وصل — {count} صنف في الطريق",
    "chrome.toast.ticked":
      "تقدّمت الساعة — لا طلبات تقدّمت|تقدّمت الساعة — تقدّم طلب واحد|تقدّمت الساعة — تقدّم طلبان|تقدّمت الساعة — تقدّمت {count} طلبات|تقدّمت الساعة — تقدّم {count} طلبًا|تقدّمت الساعة — تقدّم {count} طلب",
    "chrome.toast.moved": "رقم {num} — {status}",
    "chrome.toast.reset": "أُعيد ضبط الخدمة إلى 11:40.",
  },
} satisfies Record<LocaleTag, Record<string, string>>;
