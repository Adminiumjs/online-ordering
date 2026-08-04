/**
 * Area bundle: **data**.
 *
 * The seed's prose. `data/demo.ts` stores i18n KEYS rather than English —
 * an item is `data.item.grain`, and the words live here — so the whole menu
 * translates without a second copy of the fiction.
 *
 * What stays literal, and is therefore NOT in this file: brand names, people's
 * names on the kitchen board, street names, and the fictional filenames on the
 * food tiles (`grain-bowl.jpg`). A proper noun is the same word in every
 * language, and translating one would make the demo read as machine output.
 *
 * Inside the translations, the same rule applies one level down: the borrowed
 * Italian on a pizza menu (`Margherita`, `soppressata`, `taleggio`, `grana`,
 * `fior di latte`, `marinara`) is the dish's name in every one of these
 * languages and is transliterated, never re-invented.
 *
 * VOCABULARY. This is a PICKUP-ONLY product. The words "delivery", "meal
 * plan", "combo tier", "pricing" and "upgrade" appear in no locale — say build
 * your order, combo sizes, pickup.
 */
import type { LocaleTag } from "../locales.ts";

const EN = {
  /* --- categories --- */
  "data.cat.bowls": "Bowls",
  "data.cat.pizza": "Pizza",
  "data.cat.sides": "Sides",
  "data.cat.drinks": "Drinks",
  "data.cat.sweets": "Sweets",

  /* --- modifier groups --- */
  "data.mod.base": "Base",
  "data.mod.protein": "Protein",
  "data.mod.extras": "Extras",
  "data.mod.heat": "Heat level",
  "data.mod.size": "Size",
  "data.mod.crust": "Crust",
  "data.mod.tops": "Toppings",
  "data.mod.dip": "Dips",

  /* --- group rule hints --- */
  "data.hint.pickOne": "Pick one",
  "data.hint.upTo2": "Up to 2",
  "data.hint.upTo3": "Up to 3",
  "data.hint.upTo5": "Up to 5 · +$1.50 each",

  /*
   * Why a group is blocking the add button. One sentence per required group,
   * because "Choose a base." is a instruction and "Selection invalid" is not.
   */
  "data.need.base": "Choose a base.",
  "data.need.protein": "Choose a protein.",
  "data.need.heat": "Choose a heat level.",
  "data.need.size": "Choose a size.",
  "data.need.crust": "Choose a crust.",

  /* --- options --- */
  "data.opt.farro": "Farro",
  "data.opt.rice": "Brown rice",
  "data.opt.greens": "Baby greens",
  "data.opt.noProtein": "No protein",
  "data.opt.chicken": "Herb chicken",
  "data.opt.tofu": "Chili-lime tofu",
  "data.opt.pork": "Pulled pork",
  "data.opt.avocado": "Avocado",
  "data.opt.feta": "Whipped feta",
  "data.opt.pickledOnion": "Pickled onions",
  "data.opt.seeds": "Toasted seeds",
  "data.opt.tahini": "Extra tahini",
  "data.opt.mild": "Mild",
  "data.opt.medium": "Medium",
  "data.opt.hot": "Extra hot",
  "data.opt.s10": "10″ Personal",
  "data.opt.s13": "13″ Classic",
  "data.opt.s16": "16″ Family",
  "data.opt.handTossed": "Hand-tossed",
  "data.opt.thin": "Thin and crispy",
  "data.opt.gf": "Gluten-free",
  "data.opt.pepperoni": "Pepperoni",
  "data.opt.sausage": "Fennel sausage",
  "data.opt.mushroom": "Mushrooms",
  "data.opt.redOnion": "Red onion",
  "data.opt.olives": "Kalamata olives",
  "data.opt.peppers": "Roasted peppers",
  "data.opt.basil": "Fresh basil",
  "data.opt.hotHoney": "Hot honey",
  "data.opt.aioli": "Garlic aioli",
  "data.opt.ketchup": "Calabrian ketchup",

  /* --- items: full name, kitchen short name, one-line description --- */
  "data.item.grain": "Harvest Grain Bowl",
  "data.short.grain": "Grain bowl",
  "data.desc.grain": "Farro, roasted squash, kale and tahini-lemon.",

  "data.item.goddess": "Green Goddess Bowl",
  "data.short.goddess": "Goddess bowl",
  "data.desc.goddess": "Baby greens, cucumber, avocado ranch, herbs.",

  "data.item.sesame": "Sesame Noodle Bowl",
  "data.short.sesame": "Sesame noodles",
  "data.desc.sesame": "Cold noodles, chili crisp, scallion, sesame.",

  "data.item.citrus": "Chili Citrus Bowl",
  "data.short.citrus": "Citrus bowl",
  "data.desc.citrus": "Quinoa, charred corn, orange, chili oil.",

  "data.item.byo": "Build-Your-Own Pizza",
  "data.short.byo": "Custom pizza",
  "data.desc.byo": "Pick a size, a crust and up to five toppings.",

  "data.item.marg": "Margherita",
  "data.short.marg": "Margherita",
  "data.desc.marg": "Tomato, fior di latte, basil, olive oil.",

  "data.item.sopp": "Hot Soppressata",
  "data.short.sopp": "Soppressata",
  "data.desc.sopp": "Spicy soppressata, hot honey, mozzarella.",

  "data.item.mush": "Mushroom and Thyme",
  "data.short.mush": "Mushroom pie",
  "data.desc.mush": "Roasted mushrooms, thyme, taleggio, garlic cream.",

  "data.item.white": "White Pie",
  "data.short.white": "White pie",
  "data.desc.white": "Ricotta, mozzarella, lemon zest, no red sauce.",

  "data.item.knots": "Garlic Knots",
  "data.short.knots": "Garlic knots",
  "data.desc.knots": "Six knots, parmesan butter, warm marinara.",

  "data.item.brocc": "Charred Broccolini",
  "data.short.brocc": "Broccolini",
  "data.desc.brocc": "Lemon, chili flake, toasted almond.",

  "data.item.fries": "Rosemary Fries",
  "data.short.fries": "Fries",
  "data.desc.fries": "Crispy, salted, tossed with rosemary.",

  "data.item.caesar": "Little Gem Caesar",
  "data.short.caesar": "Caesar",
  "data.desc.caesar": "Little gems, sourdough crumble, grana.",

  "data.item.lemon": "House Lemonade",
  "data.short.lemon": "Lemonade",
  "data.desc.lemon": "Squeezed daily, not too sweet.",

  "data.item.tea": "Hibiscus Iced Tea",
  "data.short.tea": "Hibiscus tea",
  "data.desc.tea": "Brewed hibiscus, mint, lightly sweetened.",

  "data.item.spark": "Sparkling Water",
  "data.short.spark": "Sparkling",
  "data.desc.spark": "Chilled bottle, lemon on the side.",

  "data.item.cheese": "Basque Cheesecake",
  "data.short.cheese": "Cheesecake",
  "data.desc.cheese": "Burnt top, soft middle. The classic.",

  "data.item.cookie": "Chocolate Chunk Cookie",
  "data.short.cookie": "Cookie",
  "data.desc.cookie": "Baked all day, sea salt on top.",

  /* --- seeded customer note --- */
  "data.note.squares": "Cut in squares, please.",

  /* --- venue --- */
  "data.venue.note": "Counter pickup — say your order number at the window.",

  /* --- the posted week --- */
  "data.day.mon": "Monday",
  "data.day.tue": "Tuesday",
  "data.day.wed": "Wednesday",
  "data.day.thu": "Thursday",
  "data.day.fri": "Friday",
  "data.day.sat": "Saturday",
  "data.day.sun": "Sunday",
} as const satisfies Record<string, string>;

/** German. */
const DE: Record<keyof typeof EN, string> = {
  "data.cat.bowls": "Bowls",
  "data.cat.pizza": "Pizza",
  "data.cat.sides": "Beilagen",
  "data.cat.drinks": "Getränke",
  "data.cat.sweets": "Süßes",

  "data.mod.base": "Basis",
  "data.mod.protein": "Protein",
  "data.mod.extras": "Extras",
  "data.mod.heat": "Schärfe",
  "data.mod.size": "Größe",
  "data.mod.crust": "Teigboden",
  "data.mod.tops": "Beläge",
  "data.mod.dip": "Dips",

  "data.hint.pickOne": "Eins auswählen",
  "data.hint.upTo2": "Bis zu 2",
  "data.hint.upTo3": "Bis zu 3",
  "data.hint.upTo5": "Bis zu 5 · je +$1.50",

  "data.need.base": "Bitte eine Basis wählen.",
  "data.need.protein": "Bitte ein Protein wählen.",
  "data.need.heat": "Bitte die Schärfe wählen.",
  "data.need.size": "Bitte eine Größe wählen.",
  "data.need.crust": "Bitte einen Teigboden wählen.",

  "data.opt.farro": "Farro",
  "data.opt.rice": "Vollkornreis",
  "data.opt.greens": "Junge Blattsalate",
  "data.opt.noProtein": "Ohne Protein",
  "data.opt.chicken": "Kräuterhähnchen",
  "data.opt.tofu": "Chili-Limetten-Tofu",
  "data.opt.pork": "Pulled Pork",
  "data.opt.avocado": "Avocado",
  "data.opt.feta": "Feta-Creme",
  "data.opt.pickledOnion": "Eingelegte Zwiebeln",
  "data.opt.seeds": "Geröstete Kerne",
  "data.opt.tahini": "Extra Tahini",
  "data.opt.mild": "Mild",
  "data.opt.medium": "Mittel",
  "data.opt.hot": "Extra scharf",
  "data.opt.s10": "10″ Solo",
  "data.opt.s13": "13″ Klassisch",
  "data.opt.s16": "16″ Familie",
  "data.opt.handTossed": "Handgeformt",
  "data.opt.thin": "Dünn und knusprig",
  "data.opt.gf": "Glutenfrei",
  "data.opt.pepperoni": "Peperoni-Salami",
  "data.opt.sausage": "Fenchel-Salsiccia",
  "data.opt.mushroom": "Champignons",
  "data.opt.redOnion": "Rote Zwiebel",
  "data.opt.olives": "Kalamata-Oliven",
  "data.opt.peppers": "Geröstete Paprika",
  "data.opt.basil": "Frisches Basilikum",
  "data.opt.hotHoney": "Scharfer Honig",
  "data.opt.aioli": "Knoblauch-Aioli",
  "data.opt.ketchup": "Kalabrischer Ketchup",

  "data.item.grain": "Erntekorn-Bowl",
  "data.short.grain": "Getreide-Bowl",
  "data.desc.grain": "Farro, gerösteter Kürbis, Grünkohl und Tahini-Zitrone.",

  "data.item.goddess": "Grüne-Göttin-Bowl",
  "data.short.goddess": "Göttin-Bowl",
  "data.desc.goddess": "Junge Blattsalate, Gurke, Avocado-Ranch, Kräuter.",

  "data.item.sesame": "Sesam-Nudel-Bowl",
  "data.short.sesame": "Sesamnudeln",
  "data.desc.sesame": "Kalte Nudeln, Chili Crisp, Frühlingszwiebel, Sesam.",

  "data.item.citrus": "Chili-Zitrus-Bowl",
  "data.short.citrus": "Zitrus-Bowl",
  "data.desc.citrus": "Quinoa, gerösteter Mais, Orange, Chiliöl.",

  "data.item.byo": "Pizza nach Wahl",
  "data.short.byo": "Eigene Pizza",
  "data.desc.byo": "Größe, Teigboden und bis zu fünf Beläge wählen.",

  "data.item.marg": "Margherita",
  "data.short.marg": "Margherita",
  "data.desc.marg": "Tomate, Fior di Latte, Basilikum, Olivenöl.",

  "data.item.sopp": "Scharfe Soppressata",
  "data.short.sopp": "Soppressata",
  "data.desc.sopp": "Pikante Soppressata, scharfer Honig, Mozzarella.",

  "data.item.mush": "Champignon und Thymian",
  "data.short.mush": "Pilzpizza",
  "data.desc.mush": "Geröstete Pilze, Thymian, Taleggio, Knoblauchcreme.",

  "data.item.white": "Pizza Bianca",
  "data.short.white": "Pizza Bianca",
  "data.desc.white": "Ricotta, Mozzarella, Zitronenabrieb, ohne Tomatensauce.",

  "data.item.knots": "Knoblauchknoten",
  "data.short.knots": "Knoblauchknoten",
  "data.desc.knots": "Sechs Knoten, Parmesanbutter, warme Marinara.",

  "data.item.brocc": "Gegrillter Broccolini",
  "data.short.brocc": "Broccolini",
  "data.desc.brocc": "Zitrone, Chiliflocken, geröstete Mandeln.",

  "data.item.fries": "Rosmarin-Pommes",
  "data.short.fries": "Pommes",
  "data.desc.fries": "Knusprig, gesalzen, mit Rosmarin geschwenkt.",

  "data.item.caesar": "Caesar mit Little Gem",
  "data.short.caesar": "Caesar",
  "data.desc.caesar": "Little Gem, Sauerteig-Croûtons, Grana.",

  "data.item.lemon": "Hauslimonade",
  "data.short.lemon": "Limonade",
  "data.desc.lemon": "Täglich frisch gepresst, nicht zu süß.",

  "data.item.tea": "Hibiskus-Eistee",
  "data.short.tea": "Hibiskustee",
  "data.desc.tea": "Aufgebrühter Hibiskus, Minze, leicht gesüßt.",

  "data.item.spark": "Sprudelwasser",
  "data.short.spark": "Sprudel",
  "data.desc.spark": "Gekühlte Flasche, Zitrone dazu.",

  "data.item.cheese": "Baskischer Käsekuchen",
  "data.short.cheese": "Käsekuchen",
  "data.desc.cheese": "Dunkle Kruste, weiche Mitte. Der Klassiker.",

  "data.item.cookie": "Schoko-Cookie",
  "data.short.cookie": "Cookie",
  "data.desc.cookie": "Den ganzen Tag frisch gebacken, mit Meersalz.",

  "data.note.squares": "Bitte in Quadrate schneiden.",

  "data.venue.note": "Abholung am Tresen — Bestellnummer am Fenster nennen.",

  "data.day.mon": "Montag",
  "data.day.tue": "Dienstag",
  "data.day.wed": "Mittwoch",
  "data.day.thu": "Donnerstag",
  "data.day.fri": "Freitag",
  "data.day.sat": "Samstag",
  "data.day.sun": "Sonntag",
};

/** French. Typographic apostrophes throughout. */
const FR: Record<keyof typeof EN, string> = {
  "data.cat.bowls": "Bowls",
  "data.cat.pizza": "Pizzas",
  "data.cat.sides": "Accompagnements",
  "data.cat.drinks": "Boissons",
  "data.cat.sweets": "Desserts",

  "data.mod.base": "Base",
  "data.mod.protein": "Protéine",
  "data.mod.extras": "Suppléments",
  "data.mod.heat": "Niveau de piment",
  "data.mod.size": "Taille",
  "data.mod.crust": "Pâte",
  "data.mod.tops": "Garnitures",
  "data.mod.dip": "Sauces",

  "data.hint.pickOne": "Un seul choix",
  "data.hint.upTo2": "Jusqu’à 2",
  "data.hint.upTo3": "Jusqu’à 3",
  "data.hint.upTo5": "Jusqu’à 5 · +$1.50 l’unité",

  "data.need.base": "Choisissez une base.",
  "data.need.protein": "Choisissez une protéine.",
  "data.need.heat": "Choisissez le niveau de piment.",
  "data.need.size": "Choisissez une taille.",
  "data.need.crust": "Choisissez une pâte.",

  "data.opt.farro": "Farro",
  "data.opt.rice": "Riz complet",
  "data.opt.greens": "Jeunes pousses",
  "data.opt.noProtein": "Sans protéine",
  "data.opt.chicken": "Poulet aux herbes",
  "data.opt.tofu": "Tofu chili-citron vert",
  "data.opt.pork": "Porc effiloché",
  "data.opt.avocado": "Avocat",
  "data.opt.feta": "Féta fouettée",
  "data.opt.pickledOnion": "Oignons marinés",
  "data.opt.seeds": "Graines torréfiées",
  "data.opt.tahini": "Tahini en plus",
  "data.opt.mild": "Doux",
  "data.opt.medium": "Moyen",
  "data.opt.hot": "Très piquant",
  "data.opt.s10": "10″ Individuelle",
  "data.opt.s13": "13″ Classique",
  "data.opt.s16": "16″ Familiale",
  "data.opt.handTossed": "Étalée à la main",
  "data.opt.thin": "Fine et croustillante",
  "data.opt.gf": "Sans gluten",
  "data.opt.pepperoni": "Pepperoni",
  "data.opt.sausage": "Saucisse au fenouil",
  "data.opt.mushroom": "Champignons",
  "data.opt.redOnion": "Oignon rouge",
  "data.opt.olives": "Olives kalamata",
  "data.opt.peppers": "Poivrons grillés",
  "data.opt.basil": "Basilic frais",
  "data.opt.hotHoney": "Miel pimenté",
  "data.opt.aioli": "Aïoli à l’ail",
  "data.opt.ketchup": "Ketchup calabrais",

  "data.item.grain": "Bowl Moisson",
  "data.short.grain": "Bowl céréales",
  "data.desc.grain": "Farro, courge rôtie, chou kale et tahini-citron.",

  "data.item.goddess": "Bowl Déesse verte",
  "data.short.goddess": "Bowl déesse",
  "data.desc.goddess": "Jeunes pousses, concombre, ranch à l’avocat, herbes.",

  "data.item.sesame": "Bowl de nouilles au sésame",
  "data.short.sesame": "Nouilles sésame",
  "data.desc.sesame": "Nouilles froides, chili crisp, ciboule, sésame.",

  "data.item.citrus": "Bowl agrumes et piment",
  "data.short.citrus": "Bowl agrumes",
  "data.desc.citrus": "Quinoa, maïs grillé, orange, huile pimentée.",

  "data.item.byo": "Pizza à composer",
  "data.short.byo": "Pizza perso",
  "data.desc.byo": "Choisissez une taille, une pâte et jusqu’à cinq garnitures.",

  "data.item.marg": "Margherita",
  "data.short.marg": "Margherita",
  "data.desc.marg": "Tomate, fior di latte, basilic, huile d’olive.",

  "data.item.sopp": "Soppressata piquante",
  "data.short.sopp": "Soppressata",
  "data.desc.sopp": "Soppressata épicée, miel pimenté, mozzarella.",

  "data.item.mush": "Champignons et thym",
  "data.short.mush": "Pizza champignons",
  "data.desc.mush": "Champignons rôtis, thym, taleggio, crème d’ail.",

  "data.item.white": "Pizza blanche",
  "data.short.white": "Pizza blanche",
  "data.desc.white": "Ricotta, mozzarella, zeste de citron, sans sauce tomate.",

  "data.item.knots": "Nœuds à l’ail",
  "data.short.knots": "Nœuds à l’ail",
  "data.desc.knots": "Six nœuds, beurre au parmesan, marinara chaude.",

  "data.item.brocc": "Broccolini grillé",
  "data.short.brocc": "Broccolini",
  "data.desc.brocc": "Citron, piment en flocons, amandes torréfiées.",

  "data.item.fries": "Frites au romarin",
  "data.short.fries": "Frites",
  "data.desc.fries": "Croustillantes, salées, sautées au romarin.",

  "data.item.caesar": "César aux sucrines",
  "data.short.caesar": "César",
  "data.desc.caesar": "Sucrines, croûtons au levain, grana.",

  "data.item.lemon": "Limonade maison",
  "data.short.lemon": "Limonade",
  "data.desc.lemon": "Pressée chaque jour, pas trop sucrée.",

  "data.item.tea": "Thé glacé à l’hibiscus",
  "data.short.tea": "Thé hibiscus",
  "data.desc.tea": "Infusion d’hibiscus, menthe, légèrement sucrée.",

  "data.item.spark": "Eau pétillante",
  "data.short.spark": "Pétillante",
  "data.desc.spark": "Bouteille fraîche, citron à part.",

  "data.item.cheese": "Cheesecake basque",
  "data.short.cheese": "Cheesecake",
  "data.desc.cheese": "Dessus brûlé, cœur fondant. Le classique.",

  "data.item.cookie": "Cookie aux éclats de chocolat",
  "data.short.cookie": "Cookie",
  "data.desc.cookie": "Cuit toute la journée, fleur de sel dessus.",

  "data.note.squares": "À couper en carrés, s’il vous plaît.",

  "data.venue.note":
    "Retrait au comptoir — donnez votre numéro de commande au guichet.",

  "data.day.mon": "Lundi",
  "data.day.tue": "Mardi",
  "data.day.wed": "Mercredi",
  "data.day.thu": "Jeudi",
  "data.day.fri": "Vendredi",
  "data.day.sat": "Samedi",
  "data.day.sun": "Dimanche",
};

/** Czech. */
const CS: Record<keyof typeof EN, string> = {
  "data.cat.bowls": "Bowly",
  "data.cat.pizza": "Pizza",
  "data.cat.sides": "Přílohy",
  "data.cat.drinks": "Nápoje",
  "data.cat.sweets": "Dezerty",

  "data.mod.base": "Základ",
  "data.mod.protein": "Protein",
  "data.mod.extras": "Doplňky",
  "data.mod.heat": "Pálivost",
  "data.mod.size": "Velikost",
  "data.mod.crust": "Těsto",
  "data.mod.tops": "Ingredience",
  "data.mod.dip": "Dipy",

  "data.hint.pickOne": "Vyberte jednu možnost",
  "data.hint.upTo2": "Až 2",
  "data.hint.upTo3": "Až 3",
  "data.hint.upTo5": "Až 5 · +$1.50 za kus",

  "data.need.base": "Vyberte základ.",
  "data.need.protein": "Vyberte protein.",
  "data.need.heat": "Vyberte pálivost.",
  "data.need.size": "Vyberte velikost.",
  "data.need.crust": "Vyberte těsto.",

  "data.opt.farro": "Farro",
  "data.opt.rice": "Hnědá rýže",
  "data.opt.greens": "Mladé listové saláty",
  "data.opt.noProtein": "Bez proteinu",
  "data.opt.chicken": "Bylinkové kuře",
  "data.opt.tofu": "Tofu s chilli a limetkou",
  "data.opt.pork": "Trhané vepřové",
  "data.opt.avocado": "Avokádo",
  "data.opt.feta": "Šlehaná feta",
  "data.opt.pickledOnion": "Nakládaná cibule",
  "data.opt.seeds": "Opražená semínka",
  "data.opt.tahini": "Tahini navíc",
  "data.opt.mild": "Jemné",
  "data.opt.medium": "Střední",
  "data.opt.hot": "Extra pálivé",
  "data.opt.s10": "10″ Malá",
  "data.opt.s13": "13″ Klasická",
  "data.opt.s16": "16″ Rodinná",
  "data.opt.handTossed": "Ručně tažené",
  "data.opt.thin": "Tenké a křupavé",
  "data.opt.gf": "Bezlepkové",
  "data.opt.pepperoni": "Pepperoni",
  "data.opt.sausage": "Klobása s fenyklem",
  "data.opt.mushroom": "Žampiony",
  "data.opt.redOnion": "Červená cibule",
  "data.opt.olives": "Olivy kalamata",
  "data.opt.peppers": "Pečené papriky",
  "data.opt.basil": "Čerstvá bazalka",
  "data.opt.hotHoney": "Pálivý med",
  "data.opt.aioli": "Česneková aioli",
  "data.opt.ketchup": "Kalabrijský kečup",

  "data.item.grain": "Bowl Sklizeň",
  "data.short.grain": "Obilná bowl",
  "data.desc.grain": "Farro, pečená dýně, kadeřávek a tahini s citronem.",

  "data.item.goddess": "Bowl Zelená bohyně",
  "data.short.goddess": "Bowl bohyně",
  "data.desc.goddess": "Mladé listové saláty, okurka, avokádový dresink, bylinky.",

  "data.item.sesame": "Bowl se sezamovými nudlemi",
  "data.short.sesame": "Sezamové nudle",
  "data.desc.sesame": "Studené nudle, chilli crisp, jarní cibulka, sezam.",

  "data.item.citrus": "Bowl Chilli a citrusy",
  "data.short.citrus": "Citrusová bowl",
  "data.desc.citrus": "Quinoa, opečená kukuřice, pomeranč, chilli olej.",

  "data.item.byo": "Pizza podle sebe",
  "data.short.byo": "Vlastní pizza",
  "data.desc.byo": "Vyberte velikost, těsto a až pět ingrediencí.",

  "data.item.marg": "Margherita",
  "data.short.marg": "Margherita",
  "data.desc.marg": "Rajčata, fior di latte, bazalka, olivový olej.",

  "data.item.sopp": "Pálivá soppressata",
  "data.short.sopp": "Soppressata",
  "data.desc.sopp": "Pikantní soppressata, pálivý med, mozzarella.",

  "data.item.mush": "Houby a tymián",
  "data.short.mush": "Houbová pizza",
  "data.desc.mush": "Pečené houby, tymián, taleggio, česnekový krém.",

  "data.item.white": "Bílá pizza",
  "data.short.white": "Bílá pizza",
  "data.desc.white": "Ricotta, mozzarella, citronová kůra, bez rajčatové omáčky.",

  "data.item.knots": "Česnekové uzlíky",
  "data.short.knots": "Česnekové uzlíky",
  "data.desc.knots": "Šest uzlíků, parmezánové máslo, teplá marinara.",

  "data.item.brocc": "Opečený broccolini",
  "data.short.brocc": "Broccolini",
  "data.desc.brocc": "Citron, chilli vločky, opražené mandle.",

  "data.item.fries": "Hranolky s rozmarýnem",
  "data.short.fries": "Hranolky",
  "data.desc.fries": "Křupavé, solené, promíchané s rozmarýnem.",

  "data.item.caesar": "Caesar s Little Gem",
  "data.short.caesar": "Caesar",
  "data.desc.caesar": "Little Gem, kváskové krutony, grana.",

  "data.item.lemon": "Domácí limonáda",
  "data.short.lemon": "Limonáda",
  "data.desc.lemon": "Lisovaná každý den, ne moc sladká.",

  "data.item.tea": "Ledový ibiškový čaj",
  "data.short.tea": "Ibiškový čaj",
  "data.desc.tea": "Louhovaný ibišek, máta, lehce oslazený.",

  "data.item.spark": "Perlivá voda",
  "data.short.spark": "Perlivá",
  "data.desc.spark": "Vychlazená lahev, citron zvlášť.",

  "data.item.cheese": "Baskický cheesecake",
  "data.short.cheese": "Cheesecake",
  "data.desc.cheese": "Připálený vršek, měkký střed. Klasika.",

  "data.item.cookie": "Sušenka s kousky čokolády",
  "data.short.cookie": "Sušenka",
  "data.desc.cookie": "Pečeme celý den, navrch mořská sůl.",

  "data.note.squares": "Nakrájet na čtverce, prosím.",

  "data.venue.note": "Vyzvednutí na pultu — u okénka řekněte číslo objednávky.",

  "data.day.mon": "Pondělí",
  "data.day.tue": "Úterý",
  "data.day.wed": "Středa",
  "data.day.thu": "Čtvrtek",
  "data.day.fri": "Pátek",
  "data.day.sat": "Sobota",
  "data.day.sun": "Neděle",
};

/** Danish. */
const DA: Record<keyof typeof EN, string> = {
  "data.cat.bowls": "Bowls",
  "data.cat.pizza": "Pizza",
  "data.cat.sides": "Tilbehør",
  "data.cat.drinks": "Drikkevarer",
  "data.cat.sweets": "Søde sager",

  "data.mod.base": "Base",
  "data.mod.protein": "Protein",
  "data.mod.extras": "Ekstra",
  "data.mod.heat": "Styrke",
  "data.mod.size": "Størrelse",
  "data.mod.crust": "Bund",
  "data.mod.tops": "Fyld",
  "data.mod.dip": "Dip",

  "data.hint.pickOne": "Vælg én",
  "data.hint.upTo2": "Op til 2",
  "data.hint.upTo3": "Op til 3",
  "data.hint.upTo5": "Op til 5 · +$1.50 pr. stk.",

  "data.need.base": "Vælg en base.",
  "data.need.protein": "Vælg et protein.",
  "data.need.heat": "Vælg en styrke.",
  "data.need.size": "Vælg en størrelse.",
  "data.need.crust": "Vælg en bund.",

  "data.opt.farro": "Farro",
  "data.opt.rice": "Fuldkornsris",
  "data.opt.greens": "Spæde salatblade",
  "data.opt.noProtein": "Uden protein",
  "data.opt.chicken": "Urtekylling",
  "data.opt.tofu": "Chili-lime-tofu",
  "data.opt.pork": "Pulled pork",
  "data.opt.avocado": "Avocado",
  "data.opt.feta": "Pisket feta",
  "data.opt.pickledOnion": "Syltede løg",
  "data.opt.seeds": "Ristede kerner",
  "data.opt.tahini": "Ekstra tahini",
  "data.opt.mild": "Mild",
  "data.opt.medium": "Medium",
  "data.opt.hot": "Ekstra stærk",
  "data.opt.s10": "10″ Lille",
  "data.opt.s13": "13″ Klassisk",
  "data.opt.s16": "16″ Familie",
  "data.opt.handTossed": "Håndlavet",
  "data.opt.thin": "Tynd og sprød",
  "data.opt.gf": "Glutenfri",
  "data.opt.pepperoni": "Pepperoni",
  "data.opt.sausage": "Pølse med fennikel",
  "data.opt.mushroom": "Champignon",
  "data.opt.redOnion": "Rødløg",
  "data.opt.olives": "Kalamata-oliven",
  "data.opt.peppers": "Ristede peberfrugter",
  "data.opt.basil": "Frisk basilikum",
  "data.opt.hotHoney": "Stærk honning",
  "data.opt.aioli": "Hvidløgsaioli",
  "data.opt.ketchup": "Calabrisk ketchup",

  "data.item.grain": "Høstbowl med korn",
  "data.short.grain": "Kornbowl",
  "data.desc.grain": "Farro, ristet græskar, grønkål og tahini-citron.",

  "data.item.goddess": "Grøn gudinde-bowl",
  "data.short.goddess": "Gudinde-bowl",
  "data.desc.goddess": "Spæde salatblade, agurk, avocado-ranch, urter.",

  "data.item.sesame": "Sesamnudelbowl",
  "data.short.sesame": "Sesamnudler",
  "data.desc.sesame": "Kolde nudler, chili crisp, forårsløg, sesam.",

  "data.item.citrus": "Chili- og citrusbowl",
  "data.short.citrus": "Citrusbowl",
  "data.desc.citrus": "Quinoa, grillet majs, appelsin, chiliolie.",

  "data.item.byo": "Byg din egen pizza",
  "data.short.byo": "Egen pizza",
  "data.desc.byo": "Vælg størrelse, bund og op til fem slags fyld.",

  "data.item.marg": "Margherita",
  "data.short.marg": "Margherita",
  "data.desc.marg": "Tomat, fior di latte, basilikum, olivenolie.",

  "data.item.sopp": "Stærk soppressata",
  "data.short.sopp": "Soppressata",
  "data.desc.sopp": "Krydret soppressata, stærk honning, mozzarella.",

  "data.item.mush": "Champignon og timian",
  "data.short.mush": "Svampepizza",
  "data.desc.mush": "Ristede svampe, timian, taleggio, hvidløgscreme.",

  "data.item.white": "Hvid pizza",
  "data.short.white": "Hvid pizza",
  "data.desc.white": "Ricotta, mozzarella, citronskal, ingen tomatsauce.",

  "data.item.knots": "Hvidløgsknuder",
  "data.short.knots": "Hvidløgsknuder",
  "data.desc.knots": "Seks knuder, parmesansmør, lun marinara.",

  "data.item.brocc": "Grillet broccolini",
  "data.short.brocc": "Broccolini",
  "data.desc.brocc": "Citron, chiliflager, ristede mandler.",

  "data.item.fries": "Pommes frites med rosmarin",
  "data.short.fries": "Pommes frites",
  "data.desc.fries": "Sprøde, saltede, vendt i rosmarin.",

  "data.item.caesar": "Caesarsalat med little gem",
  "data.short.caesar": "Caesar",
  "data.desc.caesar": "Little gem, surdejscroutoner, grana.",

  "data.item.lemon": "Husets lemonade",
  "data.short.lemon": "Lemonade",
  "data.desc.lemon": "Presset hver dag, ikke for sød.",

  "data.item.tea": "Iste med hibiscus",
  "data.short.tea": "Hibiscuste",
  "data.desc.tea": "Brygget hibiscus, mynte, let sødet.",

  "data.item.spark": "Danskvand",
  "data.short.spark": "Danskvand",
  "data.desc.spark": "Kold flaske, citron ved siden af.",

  "data.item.cheese": "Baskisk cheesecake",
  "data.short.cheese": "Cheesecake",
  "data.desc.cheese": "Brændt top, blød midte. Klassikeren.",

  "data.item.cookie": "Cookie med chokoladestykker",
  "data.short.cookie": "Cookie",
  "data.desc.cookie": "Bages hele dagen, havsalt på toppen.",

  "data.note.squares": "Skåret i firkanter, tak.",

  "data.venue.note": "Afhentning ved disken — sig dit ordrenummer ved lugen.",

  "data.day.mon": "Mandag",
  "data.day.tue": "Tirsdag",
  "data.day.wed": "Onsdag",
  "data.day.thu": "Torsdag",
  "data.day.fri": "Fredag",
  "data.day.sat": "Lørdag",
  "data.day.sun": "Søndag",
};

/** Simplified Chinese. */
const ZH_CN: Record<keyof typeof EN, string> = {
  "data.cat.bowls": "轻食碗",
  "data.cat.pizza": "披萨",
  "data.cat.sides": "配菜",
  "data.cat.drinks": "饮品",
  "data.cat.sweets": "甜点",

  "data.mod.base": "底料",
  "data.mod.protein": "蛋白质",
  "data.mod.extras": "加料",
  "data.mod.heat": "辣度",
  "data.mod.size": "尺寸",
  "data.mod.crust": "饼底",
  "data.mod.tops": "配料",
  "data.mod.dip": "蘸酱",

  "data.hint.pickOne": "选择一项",
  "data.hint.upTo2": "最多 2 项",
  "data.hint.upTo3": "最多 3 项",
  "data.hint.upTo5": "最多 5 项 · 每项 +$1.50",

  "data.need.base": "请选择底料。",
  "data.need.protein": "请选择蛋白质。",
  "data.need.heat": "请选择辣度。",
  "data.need.size": "请选择尺寸。",
  "data.need.crust": "请选择饼底。",

  "data.opt.farro": "法罗麦",
  "data.opt.rice": "糙米",
  "data.opt.greens": "嫩叶菜",
  "data.opt.noProtein": "不加蛋白质",
  "data.opt.chicken": "香草鸡肉",
  "data.opt.tofu": "青柠辣味豆腐",
  "data.opt.pork": "手撕猪肉",
  "data.opt.avocado": "牛油果",
  "data.opt.feta": "打发菲达芝士",
  "data.opt.pickledOnion": "腌洋葱",
  "data.opt.seeds": "烘香籽仁",
  "data.opt.tahini": "加芝麻酱",
  "data.opt.mild": "微辣",
  "data.opt.medium": "中辣",
  "data.opt.hot": "特辣",
  "data.opt.s10": "10″ 单人",
  "data.opt.s13": "13″ 经典",
  "data.opt.s16": "16″ 家庭",
  "data.opt.handTossed": "手抛饼底",
  "data.opt.thin": "薄脆饼底",
  "data.opt.gf": "无麸质",
  "data.opt.pepperoni": "意式辣肠",
  "data.opt.sausage": "茴香香肠",
  "data.opt.mushroom": "蘑菇",
  "data.opt.redOnion": "红洋葱",
  "data.opt.olives": "卡拉马塔橄榄",
  "data.opt.peppers": "烤甜椒",
  "data.opt.basil": "新鲜罗勒",
  "data.opt.hotHoney": "辣蜂蜜",
  "data.opt.aioli": "蒜香蛋黄酱",
  "data.opt.ketchup": "卡拉布里亚番茄酱",

  "data.item.grain": "丰收谷物碗",
  "data.short.grain": "谷物碗",
  "data.desc.grain": "法罗麦、烤南瓜、羽衣甘蓝与芝麻柠檬酱。",

  "data.item.goddess": "绿女神碗",
  "data.short.goddess": "女神碗",
  "data.desc.goddess": "嫩叶菜、黄瓜、牛油果牧场酱、香草。",

  "data.item.sesame": "芝麻凉面碗",
  "data.short.sesame": "芝麻凉面",
  "data.desc.sesame": "凉面、辣脆酱、葱花、芝麻。",

  "data.item.citrus": "香橙辣味碗",
  "data.short.citrus": "香橙碗",
  "data.desc.citrus": "藜麦、炙烤玉米、香橙、辣油。",

  "data.item.byo": "自选披萨",
  "data.short.byo": "自选披萨",
  "data.desc.byo": "选尺寸、选饼底，再加最多五种配料。",

  "data.item.marg": "玛格丽特",
  "data.short.marg": "玛格丽特",
  "data.desc.marg": "番茄、鲜奶酪、罗勒、橄榄油。",

  "data.item.sopp": "香辣萨拉米",
  "data.short.sopp": "萨拉米",
  "data.desc.sopp": "香辣意式萨拉米、辣蜂蜜、马苏里拉。",

  "data.item.mush": "蘑菇百里香",
  "data.short.mush": "蘑菇披萨",
  "data.desc.mush": "烤蘑菇、百里香、塔雷吉欧芝士、蒜香奶油。",

  "data.item.white": "白酱披萨",
  "data.short.white": "白酱披萨",
  "data.desc.white": "里科塔、马苏里拉、柠檬皮，不加番茄酱。",

  "data.item.knots": "蒜香面结",
  "data.short.knots": "蒜香面结",
  "data.desc.knots": "六个面结、帕玛森黄油、温热番茄酱。",

  "data.item.brocc": "炙烤芥蓝花",
  "data.short.brocc": "芥蓝花",
  "data.desc.brocc": "柠檬、辣椒碎、烘香杏仁。",

  "data.item.fries": "迷迭香薯条",
  "data.short.fries": "薯条",
  "data.desc.fries": "酥脆、微咸，拌上迷迭香。",

  "data.item.caesar": "小宝石凯撒沙拉",
  "data.short.caesar": "凯撒沙拉",
  "data.desc.caesar": "小宝石生菜、酸种面包碎、格拉娜芝士。",

  "data.item.lemon": "招牌柠檬水",
  "data.short.lemon": "柠檬水",
  "data.desc.lemon": "每日现榨，不会太甜。",

  "data.item.tea": "洛神花冰茶",
  "data.short.tea": "洛神花茶",
  "data.desc.tea": "洛神花冲泡、薄荷、微甜。",

  "data.item.spark": "气泡水",
  "data.short.spark": "气泡水",
  "data.desc.spark": "冰镇瓶装，另附柠檬。",

  "data.item.cheese": "巴斯克芝士蛋糕",
  "data.short.cheese": "芝士蛋糕",
  "data.desc.cheese": "焦香表层、绵软内里。经典之作。",

  "data.item.cookie": "巧克力块曲奇",
  "data.short.cookie": "曲奇",
  "data.desc.cookie": "全天现烤，撒上海盐。",

  "data.note.squares": "请切成小方块。",

  "data.venue.note": "柜台自取 — 到取餐窗口报出订单号。",

  "data.day.mon": "星期一",
  "data.day.tue": "星期二",
  "data.day.wed": "星期三",
  "data.day.thu": "星期四",
  "data.day.fri": "星期五",
  "data.day.sat": "星期六",
  "data.day.sun": "星期日",
};

/** Traditional Chinese — translated independently, Taiwanese terminology. */
const ZH_TW: Record<keyof typeof EN, string> = {
  "data.cat.bowls": "輕食碗",
  "data.cat.pizza": "披薩",
  "data.cat.sides": "配菜",
  "data.cat.drinks": "飲料",
  "data.cat.sweets": "甜點",

  "data.mod.base": "主食底",
  "data.mod.protein": "蛋白質",
  "data.mod.extras": "加料",
  "data.mod.heat": "辣度",
  "data.mod.size": "尺寸",
  "data.mod.crust": "餅皮",
  "data.mod.tops": "配料",
  "data.mod.dip": "沾醬",

  "data.hint.pickOne": "選一項",
  "data.hint.upTo2": "最多 2 項",
  "data.hint.upTo3": "最多 3 項",
  "data.hint.upTo5": "最多 5 項 · 每項 +$1.50",

  "data.need.base": "請選擇主食底。",
  "data.need.protein": "請選擇蛋白質。",
  "data.need.heat": "請選擇辣度。",
  "data.need.size": "請選擇尺寸。",
  "data.need.crust": "請選擇餅皮。",

  "data.opt.farro": "法羅麥",
  "data.opt.rice": "糙米",
  "data.opt.greens": "嫩葉生菜",
  "data.opt.noProtein": "不加蛋白質",
  "data.opt.chicken": "香草雞肉",
  "data.opt.tofu": "辣味萊姆豆腐",
  "data.opt.pork": "手撕豬肉",
  "data.opt.avocado": "酪梨",
  "data.opt.feta": "打發費達起司",
  "data.opt.pickledOnion": "醃漬洋蔥",
  "data.opt.seeds": "烘香籽仁",
  "data.opt.tahini": "加中東芝麻醬",
  "data.opt.mild": "微辣",
  "data.opt.medium": "中辣",
  "data.opt.hot": "特辣",
  "data.opt.s10": "10″ 單人",
  "data.opt.s13": "13″ 經典",
  "data.opt.s16": "16″ 家庭",
  "data.opt.handTossed": "手拋餅皮",
  "data.opt.thin": "薄脆餅皮",
  "data.opt.gf": "無麩質",
  "data.opt.pepperoni": "義式辣腸",
  "data.opt.sausage": "茴香香腸",
  "data.opt.mushroom": "蘑菇",
  "data.opt.redOnion": "紫洋蔥",
  "data.opt.olives": "卡拉瑪塔橄欖",
  "data.opt.peppers": "烤甜椒",
  "data.opt.basil": "新鮮羅勒",
  "data.opt.hotHoney": "辣蜂蜜",
  "data.opt.aioli": "蒜香蛋黃醬",
  "data.opt.ketchup": "卡拉布里亞番茄醬",

  "data.item.grain": "豐收穀物碗",
  "data.short.grain": "穀物碗",
  "data.desc.grain": "法羅麥、烤南瓜、羽衣甘藍與芝麻檸檬醬。",

  "data.item.goddess": "綠女神碗",
  "data.short.goddess": "女神碗",
  "data.desc.goddess": "嫩葉生菜、小黃瓜、酪梨牧場醬、香草。",

  "data.item.sesame": "芝麻涼麵碗",
  "data.short.sesame": "芝麻涼麵",
  "data.desc.sesame": "涼麵、辣脆醬、蔥花、芝麻。",

  "data.item.citrus": "柑橘辣味碗",
  "data.short.citrus": "柑橘碗",
  "data.desc.citrus": "藜麥、炙烤玉米、柳橙、辣油。",

  "data.item.byo": "自選披薩",
  "data.short.byo": "自選披薩",
  "data.desc.byo": "選尺寸、選餅皮，再加最多五種配料。",

  "data.item.marg": "瑪格麗特",
  "data.short.marg": "瑪格麗特",
  "data.desc.marg": "番茄、新鮮莫札瑞拉、羅勒、橄欖油。",

  "data.item.sopp": "香辣薩拉米",
  "data.short.sopp": "薩拉米",
  "data.desc.sopp": "香辣義式薩拉米、辣蜂蜜、莫札瑞拉。",

  "data.item.mush": "蘑菇百里香",
  "data.short.mush": "蘑菇披薩",
  "data.desc.mush": "烤蘑菇、百里香、塔雷吉歐起司、蒜香奶醬。",

  "data.item.white": "白醬披薩",
  "data.short.white": "白醬披薩",
  "data.desc.white": "瑞可達、莫札瑞拉、檸檬皮，不加番茄醬。",

  "data.item.knots": "蒜香麵結",
  "data.short.knots": "蒜香麵結",
  "data.desc.knots": "六個麵結、帕瑪森奶油、溫熱番茄醬。",

  "data.item.brocc": "炙烤青花菜苗",
  "data.short.brocc": "青花菜苗",
  "data.desc.brocc": "檸檬、辣椒碎、烘香杏仁。",

  "data.item.fries": "迷迭香薯條",
  "data.short.fries": "薯條",
  "data.desc.fries": "酥脆、微鹹，拌上迷迭香。",

  "data.item.caesar": "小寶石凱撒沙拉",
  "data.short.caesar": "凱撒沙拉",
  "data.desc.caesar": "小寶石萵苣、酸種麵包丁、格拉娜起司。",

  "data.item.lemon": "招牌檸檬水",
  "data.short.lemon": "檸檬水",
  "data.desc.lemon": "每日現榨，不會太甜。",

  "data.item.tea": "洛神花冰茶",
  "data.short.tea": "洛神花茶",
  "data.desc.tea": "洛神花沖泡、薄荷、微甜。",

  "data.item.spark": "氣泡水",
  "data.short.spark": "氣泡水",
  "data.desc.spark": "冰鎮瓶裝，附上檸檬。",

  "data.item.cheese": "巴斯克起司蛋糕",
  "data.short.cheese": "起司蛋糕",
  "data.desc.cheese": "焦香表層、綿密內裡。經典之作。",

  "data.item.cookie": "巧克力塊餅乾",
  "data.short.cookie": "餅乾",
  "data.desc.cookie": "全天現烤，撒上海鹽。",

  "data.note.squares": "請切成方塊。",

  "data.venue.note": "櫃檯自取 — 到取餐窗口報訂單號碼。",

  "data.day.mon": "星期一",
  "data.day.tue": "星期二",
  "data.day.wed": "星期三",
  "data.day.thu": "星期四",
  "data.day.fri": "星期五",
  "data.day.sat": "星期六",
  "data.day.sun": "星期日",
};

/** Egyptian-leaning Modern Standard Arabic. */
const AR: Record<keyof typeof EN, string> = {
  "data.cat.bowls": "أطباق البول",
  "data.cat.pizza": "بيتزا",
  "data.cat.sides": "أطباق جانبية",
  "data.cat.drinks": "مشروبات",
  "data.cat.sweets": "حلويات",

  "data.mod.base": "الأساس",
  "data.mod.protein": "البروتين",
  "data.mod.extras": "إضافات",
  "data.mod.heat": "درجة الحرافة",
  "data.mod.size": "الحجم",
  "data.mod.crust": "العجينة",
  "data.mod.tops": "مكوّنات الوجه",
  "data.mod.dip": "صوصات",

  "data.hint.pickOne": "اختر واحدًا",
  "data.hint.upTo2": "حتى 2",
  "data.hint.upTo3": "حتى 3",
  "data.hint.upTo5": "حتى 5 · +$1.50 للإضافة",

  "data.need.base": "اختر الأساس.",
  "data.need.protein": "اختر البروتين.",
  "data.need.heat": "اختر درجة الحرافة.",
  "data.need.size": "اختر الحجم.",
  "data.need.crust": "اختر العجينة.",

  "data.opt.farro": "فارو",
  "data.opt.rice": "أرز بني",
  "data.opt.greens": "أوراق خضراء صغيرة",
  "data.opt.noProtein": "بدون بروتين",
  "data.opt.chicken": "دجاج بالأعشاب",
  "data.opt.tofu": "توفو بالشطة والليمون",
  "data.opt.pork": "لحم خنزير مفتّت",
  "data.opt.avocado": "أفوكادو",
  "data.opt.feta": "جبنة فيتا مخفوقة",
  "data.opt.pickledOnion": "بصل مخلل",
  "data.opt.seeds": "بذور محمّصة",
  "data.opt.tahini": "طحينة زيادة",
  "data.opt.mild": "خفيف",
  "data.opt.medium": "متوسط",
  "data.opt.hot": "حار جدًا",
  "data.opt.s10": "10″ فردي",
  "data.opt.s13": "13″ كلاسيك",
  "data.opt.s16": "16″ عائلي",
  "data.opt.handTossed": "عجينة يدوية",
  "data.opt.thin": "رفيعة ومقرمشة",
  "data.opt.gf": "خالية من الجلوتين",
  "data.opt.pepperoni": "بيبروني",
  "data.opt.sausage": "سجق بالشمر",
  "data.opt.mushroom": "مشروم",
  "data.opt.redOnion": "بصل أحمر",
  "data.opt.olives": "زيتون كالاماتا",
  "data.opt.peppers": "فلفل مشوي",
  "data.opt.basil": "ريحان طازج",
  "data.opt.hotHoney": "عسل حار",
  "data.opt.aioli": "أيولي بالثوم",
  "data.opt.ketchup": "كاتشب كالابري",

  "data.item.grain": "بول حبوب الحصاد",
  "data.short.grain": "بول الحبوب",
  "data.desc.grain": "فارو، قرع محمّص، كيل، وطحينة بالليمون.",

  "data.item.goddess": "بول الإلهة الخضراء",
  "data.short.goddess": "بول الإلهة",
  "data.desc.goddess": "أوراق خضراء صغيرة، خيار، صوص أفوكادو رانش، أعشاب.",

  "data.item.sesame": "بول نودلز السمسم",
  "data.short.sesame": "نودلز السمسم",
  "data.desc.sesame": "نودلز باردة، تشيلي كرسب، بصل أخضر، سمسم.",

  "data.item.citrus": "بول الحمضيات الحارة",
  "data.short.citrus": "بول الحمضيات",
  "data.desc.citrus": "كينوا، ذرة مشوية، برتقال، زيت شطة.",

  "data.item.byo": "بيتزا على مزاجك",
  "data.short.byo": "بيتزا خاصة",
  "data.desc.byo": "اختر الحجم والعجينة وحتى خمس إضافات.",

  "data.item.marg": "مارجريتا",
  "data.short.marg": "مارجريتا",
  "data.desc.marg": "طماطم، فيور دي لاتيه، ريحان، زيت زيتون.",

  "data.item.sopp": "سوبريساتا حارة",
  "data.short.sopp": "سوبريساتا",
  "data.desc.sopp": "سوبريساتا حارة، عسل حار، موتزاريلا.",

  "data.item.mush": "مشروم وزعتر",
  "data.short.mush": "بيتزا المشروم",
  "data.desc.mush": "مشروم محمّص، زعتر، تاليجيو، كريمة بالثوم.",

  "data.item.white": "بيتزا بيضاء",
  "data.short.white": "بيتزا بيضاء",
  "data.desc.white": "ريكوتا، موتزاريلا، بشر ليمون، بدون صلصة طماطم.",

  "data.item.knots": "عقد الثوم",
  "data.short.knots": "عقد الثوم",
  "data.desc.knots": "ستّ قطع، زبدة بارميزان، مارينارا دافئة.",

  "data.item.brocc": "بروكوليني مشوي",
  "data.short.brocc": "بروكوليني",
  "data.desc.brocc": "ليمون، رقائق شطة، لوز محمّص.",

  "data.item.fries": "بطاطس بالروزماري",
  "data.short.fries": "بطاطس",
  "data.desc.fries": "مقرمشة ومملّحة ومقلّبة بالروزماري.",

  "data.item.caesar": "سيزر بخس ليتل جيم",
  "data.short.caesar": "سيزر",
  "data.desc.caesar": "خس ليتل جيم، فتات خبز بالخميرة، جرانا.",

  "data.item.lemon": "ليموناضة البيت",
  "data.short.lemon": "ليموناضة",
  "data.desc.lemon": "تُعصر كل يوم، وحلاوتها خفيفة.",

  "data.item.tea": "كركديه مثلج",
  "data.short.tea": "كركديه",
  "data.desc.tea": "كركديه منقوع، نعناع، سكر خفيف.",

  "data.item.spark": "مياه غازية",
  "data.short.spark": "غازية",
  "data.desc.spark": "زجاجة مثلجة، وليمونة على الجنب.",

  "data.item.cheese": "تشيز كيك باسكي",
  "data.short.cheese": "تشيز كيك",
  "data.desc.cheese": "وش محروق وقلب طري. الكلاسيك.",

  "data.item.cookie": "كوكيز بقطع الشوكولاتة",
  "data.short.cookie": "كوكيز",
  "data.desc.cookie": "بنخبزه طول اليوم، وفوقه ملح بحري.",

  "data.note.squares": "من فضلك اقطعها مربعات.",

  "data.venue.note": "الاستلام من الكاونتر — قل رقم الطلب عند الشباك.",

  "data.day.mon": "الاثنين",
  "data.day.tue": "الثلاثاء",
  "data.day.wed": "الأربعاء",
  "data.day.thu": "الخميس",
  "data.day.fri": "الجمعة",
  "data.day.sat": "السبت",
  "data.day.sun": "الأحد",
};

export const data = {
  "en-US": EN,
  "de-DE": DE,
  "fr-FR": FR,
  "cs-CZ": CS,
  "da-DK": DA,
  "zh-CN": ZH_CN,
  "zh-TW": ZH_TW,
  "ar-EG": AR,
} satisfies Record<LocaleTag, Record<string, string>>;
