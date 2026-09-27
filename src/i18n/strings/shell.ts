/**
 * Area bundle: **shell** — the diner's header, navigation, footer and toast,
 * the kitchen's frame, and what both sides share (the language picker, the
 * startup states).
 *
 * `en-US` is the source of truth. A string wrapped in `en()` is not yet
 * translated; the other seven languages fall back to English for it until
 * they carry their own.
 */
import { en } from "../untranslated.ts";

const EN = {
  "shell.brand": "Online Ordering",
  "shell.kitchen": "Kitchen",
  "shell.skip": en("Skip to content"),
  "shell.nav.label": en("Main"),
  "shell.nav.home": "Home",
  "shell.nav.menu": "Menu",
  "shell.nav.hours": en("Hours"),
  "shell.nav.findUs": en("Find us"),
  "shell.nav.orders": "Order again",
  "shell.nav.track": "Track an order",
  "shell.nav.large": "Large orders",
  "shell.nav.open": en("Open navigation"),
  "shell.nav.close": en("Close navigation"),
  "shell.nav.dialog": en("Navigation"),
  "shell.theme": en("Toggle light and dark"),
  "shell.cart": en("Cart"),
  "shell.cart.aria": en("Cart, {count} item|Cart, {count} items"),
  "shell.cart.mobile": en("Your order · {count}"),
  "shell.cart.mobileEmpty": en("Your order"),
  "shell.home": en("{name} home"),

  "shell.pill.paused": en("Online orders paused"),
  "shell.pill.open": en("Open now · until {time}"),
  "shell.pill.later": en("Opens at {time}"),
  "shell.pill.closedToday": en("Closed today"),
  "shell.pill.backTomorrow": en("Closed · back tomorrow at {time}"),
  "shell.pill.backOn": en("Closed · back {day} at {time}"),
  "shell.pill.closed": en("Closed"),

  "shell.off.online": en("We're not taking online orders right now. Call us on {phone}."),
  "shell.off.onlineNoPhone": en("We're not taking online orders right now."),
  "shell.off.today": en("The kitchen has paused online orders for today. Pre-order for tomorrow, or call us on {phone}."),
  "shell.off.todayNoPhone": en("The kitchen has paused online orders for today. Pre-order for tomorrow."),

  "shell.footer.order": en("Order"),
  "shell.footer.menu": en("The menu"),
  "shell.footer.cart": "Your order",
  "shell.footer.copyright": en("© {year} {name}"),
  "shell.footer.pickupOnly": en("Pickup only"),
  "shell.language": en("Language"),

  "shell.toast.undo": en("Undo"),
  "shell.loading": en("Loading…"),
  "shell.retry": en("Try again"),
  "shell.close": en("Close"),
};

export const shell = {
  "en-US": EN,
  "de-DE": {
    "shell.brand": "Online-Bestellung",
    "shell.kitchen": "Küche",
    "shell.nav.home": "Start",
    "shell.nav.menu": "Speisekarte",
    "shell.footer.cart": "Deine Bestellung",
    "shell.nav.track": "Bestellung verfolgen",
    "shell.nav.orders": "Nochmal bestellen",
    "shell.nav.large": "Großbestellungen",
  },
  "fr-FR": {
    "shell.brand": "Commande en ligne",
    "shell.kitchen": "Cuisine",
    "shell.nav.home": "Accueil",
    "shell.nav.menu": "La carte",
    "shell.footer.cart": "Votre commande",
    "shell.nav.track": "Suivre une commande",
    "shell.nav.orders": "Commander à nouveau",
    "shell.nav.large": "Grandes commandes",
  },
  "da-DK": {
    "shell.brand": "Onlinebestilling",
    "shell.kitchen": "Køkken",
    "shell.nav.home": "Forside",
    "shell.nav.menu": "Menukort",
    "shell.footer.cart": "Din bestilling",
    "shell.nav.track": "Følg en bestilling",
    "shell.nav.orders": "Bestil igen",
    "shell.nav.large": "Store bestillinger",
  },
  "cs-CZ": {
    "shell.brand": "Online objednávky",
    "shell.kitchen": "Kuchyně",
    "shell.nav.home": "Úvod",
    "shell.nav.menu": "Jídelní lístek",
    "shell.footer.cart": "Vaše objednávka",
    "shell.nav.track": "Sledovat objednávku",
    "shell.nav.orders": "Objednat znovu",
    "shell.nav.large": "Velké objednávky",
  },
  "ar-EG": {
    "shell.brand": "الطلب عبر الإنترنت",
    "shell.kitchen": "المطبخ",
    "shell.nav.home": "الرئيسية",
    "shell.nav.menu": "القائمة",
    "shell.footer.cart": "طلبك",
    "shell.nav.track": "تتبّع طلبًا",
    "shell.nav.orders": "اطلب مرة أخرى",
    "shell.nav.large": "الطلبات الكبيرة",
  },
  "zh-CN": {
    "shell.brand": "在线点餐",
    "shell.kitchen": "厨房",
    "shell.nav.home": "首页",
    "shell.nav.menu": "菜单",
    "shell.footer.cart": "您的订单",
    "shell.nav.track": "跟踪订单",
    "shell.nav.orders": "再来一单",
    "shell.nav.large": "团体订餐",
  },
  "zh-TW": {
    "shell.brand": "線上點餐",
    "shell.kitchen": "廚房",
    "shell.nav.home": "首頁",
    "shell.nav.menu": "菜單",
    "shell.footer.cart": "您的訂單",
    "shell.nav.track": "追蹤訂單",
    "shell.nav.orders": "再點一次",
    "shell.nav.large": "團體訂餐",
  },
};
