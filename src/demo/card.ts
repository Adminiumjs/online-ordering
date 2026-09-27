/**
 * What the website's demo card offers for this app — its screens, the
 * shortcuts that make things happen, the two people, the clock and the two
 * add-ons — and their words in the card's eight languages. `vite.config.ts`
 * writes `demo.json` from it in the demo build; the bridge answers to its ids.
 *
 * DEMO ONLY — no app bundle imports it: the card's words are the card's.
 */
import type { DemoEmitOptions } from "../../demo-emit.ts";

type Locale = "en-US" | "de-DE" | "fr-FR" | "da-DK" | "cs-CZ" | "ar-EG" | "zh-CN" | "zh-TW";
const LOCALES: Locale[] = ["en-US", "de-DE", "fr-FR", "da-DK", "cs-CZ", "ar-EG", "zh-CN", "zh-TW"];

/** Each label in the eight languages, in the order of `LOCALES`. */
const WORDS: Record<string, [string, string, string, string, string, string, string, string]> = {
  "screen.home": ["Home", "Startseite", "Accueil", "Forside", "Úvod", "الرئيسية", "首页", "首頁"],
  "screen.menu": ["Menu", "Speisekarte", "La carte", "Menukort", "Jídelní lístek", "القائمة", "菜单", "菜單"],
  "screen.cart": ["Cart", "Warenkorb", "Panier", "Kurv", "Košík", "السلة", "购物车", "購物車"],
  "screen.checkout": ["Checkout", "Zur Kasse", "Validation", "Til kassen", "Pokladna", "إتمام الطلب", "结账", "結帳"],
  "screen.track": ["Track an order", "Bestellung verfolgen", "Suivre une commande", "Følg en bestilling", "Sledovat objednávku", "تتبّع طلبًا", "跟踪订单", "追蹤訂單"],
  "screen.find": ["Find my order", "Meine Bestellung finden", "Retrouver ma commande", "Find min bestilling", "Najít objednávku", "ابحث عن طلبي", "查找我的订单", "查詢我的訂單"],
  "screen.history": ["Order again", "Nochmal bestellen", "Commander à nouveau", "Bestil igen", "Objednat znovu", "اطلب مرة أخرى", "再来一单", "再點一次"],
  "screen.large": ["Large orders", "Großbestellungen", "Grandes commandes", "Store bestillinger", "Velké objednávky", "الطلبات الكبيرة", "团体订餐", "團體訂餐"],
  "screen.404": ["Page not found", "Seite nicht gefunden", "Page introuvable", "Siden findes ikke", "Stránka nenalezena", "الصفحة غير موجودة", "页面不存在", "找不到頁面"],
  "screen.queue": ["Queue", "Warteschlange", "File d'attente", "Kø", "Fronta", "قائمة الانتظار", "队列", "佇列"],
  "screen.slots": ["Pickup slots", "Abholzeiten", "Créneaux", "Afhentningstider", "Časy vyzvednutí", "مواعيد الاستلام", "取餐时段", "取餐時段"],
  "screen.shelf": ["Shelf", "Abholregal", "Étagère", "Hylde", "Výdejní police", "الرف", "取餐架", "取餐架"],
  "screen.today": ["Today's menu", "Heutige Karte", "Carte du jour", "Dagens menu", "Dnešní nabídka", "قائمة اليوم", "今日菜单", "今日菜單"],
  "screen.hours": ["Hours", "Öffnungszeiten", "Horaires", "Åbningstider", "Otevírací doba", "ساعات العمل", "营业时间", "營業時間"],
  "screen.ticket": ["Order ticket", "Bestellbon", "Ticket de commande", "Bestillingsbon", "Lístek objednávky", "تذكرة الطلب", "订单小票", "訂單小票"],
  "screen.handoff": ["Hand-off", "Übergabe", "Remise", "Udlevering", "Předání", "التسليم", "交付", "交付"],
  "screen.phone": ["Phone order", "Telefonbestellung", "Commande par téléphone", "Telefonbestilling", "Telefonická objednávka", "طلب هاتفي", "电话订单", "電話訂單"],

  "do.after-closing": ["After closing", "Nach Ladenschluss", "Après la fermeture", "Efter lukketid", "Po zavírací době", "بعد الإغلاق", "打烊之后", "打烊之後"],
  "do.orders-off": ["Online orders off", "Online-Bestellungen aus", "Commandes en ligne coupées", "Onlinebestillinger slået fra", "Online objednávky vypnuty", "إيقاف الطلبات عبر الإنترنت", "关闭在线点餐", "關閉線上點餐"],
  "do.sell-out": ["Wild mushroom sells out", "Wild mushroom ist ausverkauft", "Wild mushroom est épuisée", "Wild mushroom bliver udsolgt", "Wild mushroom se vyprodá", "نفاد Wild mushroom", "Wild mushroom 售罄", "Wild mushroom 售完"],
  "do.fill-kwame": ["Fill in Kwame's details", "Kwames Angaben eintragen", "Remplir pour Kwame", "Udfyld Kwames oplysninger", "Vyplnit Kwameho údaje", "املأ بيانات Kwame", "填入 Kwame 的信息", "填入 Kwame 的資料"],
  "do.slot-fills": ["The time fills first", "Die Zeit wird zuerst voll", "Le créneau se remplit d'abord", "Tidspunktet bliver fyldt først", "Čas se nejdřív zaplní", "يمتلئ الموعد أولًا", "时段先被订满", "時段先被訂滿"],
  "do.price-changes": ["A price changes", "Ein Preis ändert sich", "Un prix change", "En pris ændres", "Změní se cena", "يتغيّر سعر", "价格有变", "價格有變"],
  "do.kitchen-moves": ["The kitchen moves it on", "Die Küche macht weiter", "La cuisine avance", "Køkkenet går videre", "Kuchyně ji posune dál", "المطبخ ينقله للخطوة التالية", "厨房推进订单", "廚房推進訂單"],
  "do.open-link": ["Open the emailed link", "Link aus der E-Mail öffnen", "Ouvrir le lien reçu", "Åbn linket fra mailen", "Otevřít odkaz z e-mailu", "افتح الرابط المرسل بالبريد", "打开邮件中的链接", "開啟郵件中的連結"],
  "do.sample-enquiry": ["Fill a sample enquiry", "Beispielanfrage ausfüllen", "Remplir une demande type", "Udfyld en prøveforespørgsel", "Vyplnit ukázkovou poptávku", "املأ استفسارًا نموذجيًا", "填写示例询价", "填寫範例詢價"],
  "do.new-order": ["A new order arrives", "Eine neue Bestellung kommt", "Une nouvelle commande arrive", "En ny bestilling kommer ind", "Přijde nová objednávka", "يصل طلب جديد", "来了新订单", "來了新訂單"],
  "do.other-screen": ["Another screen marks it ready", "Ein anderer Bildschirm meldet fertig", "Un autre écran la marque prête", "En anden skærm melder den klar", "Jiná obrazovka ji označí jako hotovou", "شاشة أخرى تعلّمه جاهزًا", "另一台屏幕标记为已完成", "另一台螢幕標記為完成"],
  "do.lunch-rush": ["A lunch rush", "Mittagsansturm", "Le coup de feu du midi", "Frokostrush", "Polední nával", "زحمة الغداء", "午餐高峰", "午餐尖峰"],
  "do.holiday": ["A public holiday", "Ein Feiertag", "Un jour férié", "En helligdag", "Státní svátek", "عطلة رسمية", "公共假日", "國定假日"],
  "do.overorder": ["A closure over an order", "Ruhetag über einer Bestellung", "Une fermeture sur une commande", "En lukkedag med en bestilling", "Zavřeno v den objednávky", "إغلاق في يوم فيه طلب", "关门日撞上订单", "休息日撞上訂單"],

  "persona.diner": ["Diner", "Gast", "Client", "Gæst", "Host", "الزبون", "顾客", "顧客"],
  "persona.kitchen": ["Kitchen", "Küche", "Cuisine", "Køkken", "Kuchyně", "المطبخ", "厨房", "廚房"],
  "clock.10m": ["+10 min", "+10 Min.", "+10 min", "+10 min.", "+10 min", "+١٠ دقائق", "+10 分钟", "+10 分鐘"],
  "clock.reset": ["Back to 11:40", "Zurück zu 11:40", "Retour à 11 h 40", "Tilbage til 11.40", "Zpět na 11:40", "العودة إلى ١١:٤٠", "回到 11:40", "回到 11:40"],
  "addon.invoices": ["Invoices & Receipts", "Rechnungen & Belege", "Factures et reçus", "Fakturaer og kvitteringer", "Faktury a účtenky", "الفواتير والإيصالات", "发票与收据", "發票與收據"],
  "addon.holiday-calendars": ["Holiday Calendars", "Feiertagskalender", "Calendriers des jours fériés", "Helligdagskalendere", "Kalendáře svátků", "تقويمات العطلات", "节假日日历", "節假日曆"],

  // What a shortcut says on the page when nothing else does.
  "toast.slot-fills": ["Next time you place it, {time} fills first", "Beim nächsten Absenden ist {time} zuerst voll", "Au prochain envoi, {time} sera complet", "Næste gang du bestiller, er {time} fyldt først", "Při dalším odeslání se {time} nejdřív zaplní", "في المرة القادمة يمتلئ الموعد {time} أولًا", "下次下单时，{time} 会先被订满", "下次下單時，{time} 會先被訂滿"],
  "toast.price-changes": ["Next time you place it, a price changes", "Beim nächsten Absenden ändert sich ein Preis", "Au prochain envoi, un prix change", "Næste gang du bestiller, ændres en pris", "Při dalším odeslání se změní cena", "في المرة القادمة يتغيّر سعر", "下次下单时，有价格变动", "下次下單時，有價格變動"],
  "toast.nothing-cooking": ["Nothing in the kitchen to mark ready", "In der Küche ist nichts fertig zu melden", "Rien en cuisine à marquer prêt", "Intet i køkkenet at melde klar", "V kuchyni není nic k označení", "لا شيء في المطبخ لتعليمه جاهزًا", "厨房里没有可标记完成的订单", "廚房裡沒有可標記完成的訂單"],
  "toast.no-order": ["Place an order first", "Zuerst eine Bestellung absenden", "Passez d'abord une commande", "Afgiv først en bestilling", "Nejdřív odešlete objednávku", "اطلب أولًا", "请先下单", "請先下單"],
};

export const CARD_MESSAGES: Record<Locale, Record<string, string>> = Object.fromEntries(
  LOCALES.map((locale, i) => [locale, Object.fromEntries(Object.entries(WORDS).map(([key, words]) => [key, words[i]!]))]),
) as Record<Locale, Record<string, string>>;

/** A card string in the page's language. */
export function cardWord(locale: string, key: string, params: Record<string, string> = {}): string {
  const raw = CARD_MESSAGES[(LOCALES as string[]).includes(locale) ? (locale as Locale) : "en-US"][key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m);
}

type Screen = DemoEmitOptions["screens"][number];
const diner = (id: string, view: string, icon: string, shortcuts?: [string, string][]): Screen => ({
  id,
  view,
  icon,
  side: "customer",
  persona: "diner",
  labelKey: `screen.${id}`,
  ...(shortcuts === undefined ? {} : { shortcuts: shortcuts.map(([sid, sicon]) => ({ id: sid, icon: sicon, labelKey: `do.${sid}` })) }),
});
const kitchen = (id: string, view: string, icon: string, shortcuts?: [string, string][]): Screen => ({ ...diner(id, view, icon, shortcuts), side: "staff", persona: "kitchen" });

/** The card's declaration; `messages` is added where it is emitted. */
export const DEMO_CARD: Omit<DemoEmitOptions, "messages"> = {
  appKey: "ordering",
  dir: "online-ordering",
  frames: ["desktop", "tablet", "phone"],
  personas: [
    { id: "diner", icon: "user-round", labelKey: "persona.diner" },
    { id: "kitchen", icon: "chef-hat", labelKey: "persona.kitchen" },
  ],
  screens: [
    diner("home", "home", "house", [
      ["after-closing", "moon"],
      ["orders-off", "power-off"],
    ]),
    diner("menu", "menu", "utensils", [["sell-out", "flame"]]),
    diner("cart", "cart", "shopping-bag"),
    diner("checkout", "checkout", "clipboard-check", [
      ["fill-kwame", "wand-sparkles"],
      ["slot-fills", "timer-off"],
      ["price-changes", "tag"],
    ]),
    diner("track", "track", "radar", [["kitchen-moves", "chef-hat"]]),
    diner("find", "find", "mail-search"),
    diner("history", "orders", "rotate-ccw", [["open-link", "mail-open"]]),
    diner("large", "large", "users", [["sample-enquiry", "wand-sparkles"]]),
    diner("404", "notfound", "triangle-alert"),
    kitchen("queue", "kitchen:queue", "layout-list", [
      ["new-order", "bell-ring"],
      ["other-screen", "monitor-smartphone"],
    ]),
    kitchen("slots", "kitchen:slots", "timer", [["lunch-rush", "flame"]]),
    kitchen("shelf", "kitchen:shelf", "hand-platter"),
    kitchen("today", "kitchen:menu", "list-checks"),
    kitchen("hours", "kitchen:hours", "clock", [
      ["holiday", "calendar-heart"],
      ["overorder", "calendar-x"],
    ]),
    kitchen("ticket", "kitchen:ticket", "receipt-text"),
    kitchen("handoff", "kitchen:handoff", "scan-line"),
    kitchen("phone", "kitchen:phone", "phone"),
  ],
  clock: { advance: [{ id: "10m", labelKey: "clock.10m" }], reset: { labelKey: "clock.reset" } },
  addOns: [
    { key: "invoices", labelKey: "addon.invoices" },
    { key: "holiday-calendars", labelKey: "addon.holiday-calendars" },
  ],
};
