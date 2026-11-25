/**
 * Merchant-facing wording that changes with the business activity.
 *
 * Each activity that we support has its own natural wording. `other` is the
 * neutral wording used for businesses we have not tailored yet. Restaurant
 * wording matches the text the restaurant screens used before this file.
 */
import type { BusinessActivityKey } from './activities.js';

/** One phrase in both supported languages. */
export interface ActivityWords {
  en: string;
  ar: string;
}

export interface ActivityWording {
  product: {
    nameExample: ActivityWords;
    descriptionHint: ActivityWords;
    /** Shown under the base price when the product has sellable choices. */
    choicePriceHint: ActivityWords;
  };
  /** Sellable choices of one product, such as sizes, models, or packs. */
  choices: {
    /** Section and dialog title, e.g. "Sizes and colors". */
    title: ActivityWords;
    /** Title on the starting template card. */
    templateTitle: ActivityWords;
    templateHint: ActivityWords;
    /** Intro under the "Customer choices" heading. */
    optionsIntro: ActivityWords;
    composerHint: ActivityWords;
    /** One row of the editor, e.g. "Size or type" → "Size or type 2". */
    item: ActivityWords;
    newItem: ActivityWords;
    nameColumn: ActivityWords;
    nameRequired: ActivityWords;
    nameExample: ActivityWords;
    addItem: ActivityWords;
    /** Shown when every row was removed from the editor. */
    allRemoved: ActivityWords;
    /** Noun forms used to build short phrases; see `activityChoicePhrases`. */
    one: ActivityWords;
    many: ActivityWords;
    manyIndefinite: ActivityWords;
    another: ActivityWords;
    /** Word after a count, e.g. "3 sizes or types". */
    countNoun: ActivityWords;
    /** Rows a new editor starts with. Empty means one blank row. */
    starterNames: ActivityWords[];
    /** Attributes every new row starts with, e.g. Size and Color. */
    starterAttributes: ActivityWords[];
  };
  extras: {
    templateHint: ActivityWords;
    starterOptions: [ActivityWords, ActivityWords];
  };
  stock: {
    itemExample: ActivityWords;
    /** Sidebar and breadcrumb name of the stock items page. */
    itemsTitle: ActivityWords;
    /**
     * Replacements for inventory sentences that only make sense for restaurants.
     * Keys are the English sentences used in the dashboard's `inventory-copy.ts`.
     * Example: "Menu section" → { en: "Category", ar: "التصنيف" } for shops.
     */
    textOverrides: Readonly<Record<string, ActivityWords>>;
  };
}

const words = (en: string, ar: string): ActivityWords => ({ en, ar });

/** Shops have no recipes or menu; these replace the restaurant inventory sentences. */
const shopInventoryText: Readonly<Record<string, ActivityWords>> = {
  'Manage the items and units you use in purchases and recipes.': words(
    'Manage the items and units you use in purchases and sales.',
    'أدر الأصناف والوحدات المستخدمة في المشتريات والبيع.',
  ),
  'Start with an ingredient or product, and choose how you measure it.': words(
    'Start with a product you sell, and choose how you measure it.',
    'ابدأ بمنتج تبيعه، واختر وحدة قياسه.',
  ),
  'Set the ingredient and product units that recipes and stock movements will share.': words(
    'Set the product units that sales and stock movements will share.',
    'أضف وحدات المنتجات لتستخدمها المبيعات وحركات المخزون.',
  ),
  'One item can be shared by products and recipes. Pack conversion factors stay fixed after saving.':
    words(
      'One item can be shared by several products. Pack conversion factors stay fixed after saving.',
      'يمكن استخدام الصنف نفسه مع أكثر من منتج. يظل معامل تحويل العبوة ثابتاً بعد الحفظ.',
    ),
  'The default warehouse is used for future recipe consumption.': words(
    'The default warehouse is used when a sale takes stock.',
    'يُستخدم المخزن الافتراضي لخصم المخزون عند البيع.',
  ),
  'This policy applies to all branches and warehouses. Non-sellable stock is never used for sales or recipes.':
    words(
      'This policy applies to all branches and warehouses. Non-sellable stock is never used for sales.',
      'تسري هذه السياسة على جميع الفروع والمستودعات. لا يُستخدم المخزون غير القابل للبيع في المبيعات.',
    ),
  'This policy affects Available stock debits. Non-Sellable stock remains separate from sale and recipe consumption.':
    words(
      'This policy affects Available stock debits. Non-Sellable stock remains separate from sales.',
      'تؤثر هذه السياسة على خصم الرصيد المتاح فقط. ويظل المخزون غير الصالح للبيع منفصلًا عن البيع.',
    ),
  'Menu section': words('Category', 'التصنيف'),
  'Menu section profitability': words('Category profitability', 'ربحية التصنيفات'),
};

const shopItemsTitle = words('Stock items', 'أصناف المخزون');

/** Stock wording for a shop: its own item example plus the shared shop sentences. */
function shopStock(itemExample: ActivityWords): ActivityWording['stock'] {
  return {
    itemExample,
    itemsTitle: shopItemsTitle,
    // The stock items page has its own example field; shops show their item example there too.
    textOverrides: { ...shopInventoryText, 'e.g. Milk or flour': itemExample },
  };
}

const restaurant: ActivityWording = {
  product: {
    nameExample: words('e.g. Classic burger', 'مثال: برجر كلاسيك'),
    descriptionHint: words(
      'Describe the ingredients or what makes it special.',
      'اكتب وصفًا للمكونات أو ما يميز المنتج.',
    ),
    choicePriceHint: words(
      'Required for the catalog. Each size uses its own price when available.',
      'مطلوب للكتالوج. يظهر سعر كل حجم بدلًا منه عند اختيار الأحجام.',
    ),
  },
  choices: {
    title: words('Sizes and types', 'الأحجام والأنواع'),
    templateTitle: words('Sizes or types', 'أحجام أو أنواع'),
    templateHint: words(
      'Small, medium, large — each with its own price.',
      'صغير، وسط، كبير — لكل حجم سعره.',
    ),
    optionsIntro: words(
      'Start with one price. Add sizes or extras only when customers need them.',
      'ابدأ بسعر واحد. أضف أحجامًا أو إضافات فقط إذا احتاج العميل إليها.',
    ),
    composerHint: words(
      'Set a selling price for each size or type. Apply when you are ready.',
      'حدّد سعر بيع كل حجم أو نوع، ثم طبّق التغييرات عند الانتهاء.',
    ),
    item: words('Size or type', 'الحجم أو النوع'),
    newItem: words('New size or type', 'حجم أو نوع جديد'),
    nameColumn: words('Size or type name', 'اسم الحجم أو النوع'),
    nameRequired: words('Enter a size or type name.', 'اكتب اسم الحجم أو النوع.'),
    nameExample: words('e.g. Large', 'مثال: كبير'),
    addItem: words('Add size or type', 'إضافة حجم أو نوع'),
    allRemoved: words(
      'All sizes have been removed from this draft. Apply to sell at one product price, or add a new size below.',
      'تم حذف الأحجام من المسودة. طبّق لاستخدام سعر واحد للمنتج، أو أضف حجمًا جديدًا أدناه.',
    ),
    one: words('size', 'الحجم'),
    many: words('sizes', 'الأحجام'),
    manyIndefinite: words('sizes', 'أحجام'),
    another: words('another size', 'حجم آخر'),
    countNoun: words('sizes or types', 'أحجام أو أنواع'),
    starterNames: [words('Small', 'صغير'), words('Medium', 'وسط'), words('Large', 'كبير')],
    starterAttributes: [],
  },
  extras: {
    templateHint: words(
      'Extra cheese, sauce — free or for an extra charge.',
      'جبنة إضافية، صوص — مجانًا أو بسعر إضافي.',
    ),
    starterOptions: [words('Extra cheese', 'جبنة إضافية'), words('Extra sauce', 'صوص إضافي')],
  },
  stock: {
    itemExample: words('e.g. Burger patty', 'مثال: لحم برجر'),
    itemsTitle: words('Stock items & materials', 'الأصناف والخامات'),
    textOverrides: {},
  },
};

const clothing: ActivityWording = {
  product: {
    nameExample: words('e.g. Cotton T-shirt', 'مثال: تيشيرت قطن'),
    descriptionHint: words(
      'Describe the fabric, fit, and care details customers need.',
      'اذكر الخامة والمقاس المناسب وطريقة العناية بالمنتج.',
    ),
    choicePriceHint: words(
      'Required for the catalog. Each size and color choice can have its own price.',
      'مطلوب للكتالوج. يمكن تحديد سعر مستقل لكل مقاس ولون.',
    ),
  },
  choices: {
    title: words('Sizes and colors', 'المقاسات والألوان'),
    templateTitle: words('Sizes and colors', 'المقاسات والألوان'),
    templateHint: words(
      'Create one sellable choice for each size and color, with its own price.',
      'أنشئ اختيارًا مستقلًا لكل مقاس ولون، بسعره الخاص.',
    ),
    optionsIntro: words(
      'Add a size and color choice for each item you sell.',
      'أضف اختيار المقاس واللون لكل قطعة تبيعها.',
    ),
    composerHint: words(
      'Add one row per size and color. Fill the two attributes below, then apply.',
      'أضف صفًا لكل مقاس ولون. أكمل الخاصيتين بالأسفل، ثم طبّق.',
    ),
    item: words('Size and color', 'المقاس واللون'),
    newItem: words('New size and color', 'مقاس ولون جديد'),
    nameColumn: words('Size / color name', 'اسم المقاس واللون'),
    nameRequired: words('Enter a size and color name.', 'اكتب اسم المقاس واللون.'),
    nameExample: words('e.g. M / Black', 'مثال: M / أسود'),
    addItem: words('Add size and color', 'إضافة مقاس ولون'),
    allRemoved: words(
      'All sizes and colors have been removed from this draft. Apply to sell at one product price, or add a new size and color below.',
      'تم حذف المقاسات والألوان من المسودة. طبّق لاستخدام سعر واحد للمنتج، أو أضف مقاسًا ولونًا جديدًا أدناه.',
    ),
    one: words('size', 'المقاس'),
    many: words('sizes', 'المقاسات'),
    manyIndefinite: words('sizes', 'مقاسات'),
    another: words('another size', 'مقاس آخر'),
    countNoun: words('sizes and colors', 'مقاسات وألوان'),
    starterNames: [],
    starterAttributes: [words('Size', 'المقاس'), words('Color', 'اللون')],
  },
  extras: {
    templateHint: words(
      'Gift wrapping or name printing — free or for an extra charge.',
      'تغليف هدية أو طباعة اسم — مجانًا أو بسعر إضافي.',
    ),
    starterOptions: [words('Gift wrapping', 'تغليف هدية'), words('Name printing', 'طباعة اسم')],
  },
  stock: shopStock(words('e.g. Blue T-shirt, size M', 'مثال: تيشيرت أزرق مقاس M')),
};

const supermarket: ActivityWording = {
  product: {
    nameExample: words('e.g. Rice 1 kg', 'مثال: أرز ١ كجم'),
    descriptionHint: words(
      'Describe the pack size, contents, and storage details.',
      'اذكر حجم العبوة والمحتويات وطريقة التخزين.',
    ),
    choicePriceHint: words(
      'Required for the catalog. Each pack can have its own price.',
      'مطلوب للكتالوج. يمكن تحديد سعر مستقل لكل عبوة.',
    ),
  },
  choices: {
    title: words('Units and packs', 'الوحدات والعبوات'),
    templateTitle: words('Units and packs', 'الوحدات والعبوات'),
    templateHint: words(
      'Sell a piece or pack as separate choices, each with its own price and stock link.',
      'بع القطعة أو العبوة كاختيارات منفصلة، لكل منها سعر وربط بالمخزون.',
    ),
    optionsIntro: words(
      'Start with one price. Add packs only when you sell the item in more than one size.',
      'ابدأ بسعر واحد. أضف العبوات فقط إذا كنت تبيع الصنف بأكثر من حجم.',
    ),
    composerHint: words(
      'Add one row per piece or pack. Fill its pack size and price, then link stock in the next step.',
      'أضف صفًا لكل قطعة أو عبوة. اكتب حجمها وسعرها ثم اربطها بالمخزون في الخطوة التالية.',
    ),
    item: words('Pack', 'العبوة'),
    newItem: words('New pack', 'عبوة جديدة'),
    nameColumn: words('Piece or pack name', 'اسم القطعة أو العبوة'),
    nameRequired: words('Enter a pack name.', 'اكتب اسم العبوة.'),
    nameExample: words('e.g. 1 kg bag', 'مثال: كيس ١ كجم'),
    addItem: words('Add pack', 'إضافة عبوة'),
    allRemoved: words(
      'All packs have been removed from this draft. Apply to sell at one product price, or add a new pack below.',
      'تم حذف العبوات من المسودة. طبّق لاستخدام سعر واحد للمنتج، أو أضف عبوة جديدة أدناه.',
    ),
    one: words('pack', 'العبوة'),
    many: words('packs', 'العبوات'),
    manyIndefinite: words('packs', 'عبوات'),
    another: words('another pack', 'عبوة أخرى'),
    countNoun: words('packs', 'عبوات'),
    starterNames: [],
    starterAttributes: [words('Pack size', 'حجم العبوة')],
  },
  extras: {
    templateHint: words(
      'Add-ons like gift wrapping — free or for an extra charge.',
      'إضافات مثل تغليف الهدايا — مجانًا أو بسعر إضافي.',
    ),
    starterOptions: [words('Gift wrapping', 'تغليف هدية'), words('Extra bag', 'كيس إضافي')],
  },
  stock: shopStock(words('e.g. Rice 1 kg bag', 'مثال: كيس أرز ١ كجم')),
};

/** Home goods and electrical stores both sell models; these are their shared words. */
const modelChoiceWords = {
  item: words('Model', 'الموديل'),
  newItem: words('New model', 'موديل جديد'),
  nameColumn: words('Model name', 'اسم الموديل'),
  nameRequired: words('Enter a model name.', 'اكتب اسم الموديل.'),
  addItem: words('Add model', 'إضافة موديل'),
  allRemoved: words(
    'All models have been removed from this draft. Apply to sell at one product price, or add a new model below.',
    'تم حذف الموديلات من المسودة. طبّق لاستخدام سعر واحد للمنتج، أو أضف موديلًا جديدًا أدناه.',
  ),
  one: words('model', 'الموديل'),
  many: words('models', 'الموديلات'),
  manyIndefinite: words('models', 'موديلات'),
  another: words('another model', 'موديل آخر'),
  countNoun: words('models', 'موديلات'),
  starterNames: [],
};

const homeGoods: ActivityWording = {
  product: {
    nameExample: words('e.g. Stainless pot set', 'مثال: طقم حلل استانلس'),
    descriptionHint: words(
      'Describe the material, sizes, and what is included.',
      'اذكر الخامة والمقاسات ومحتويات المنتج.',
    ),
    choicePriceHint: words(
      'Required for the catalog. Each model can have its own price.',
      'مطلوب للكتالوج. يمكن تحديد سعر مستقل لكل موديل.',
    ),
  },
  choices: {
    ...modelChoiceWords,
    title: words('Models and colors', 'الموديلات والألوان'),
    templateTitle: words('Models and colors', 'الموديلات والألوان'),
    templateHint: words(
      'Create one sellable choice for each model or color, with its own price and stock.',
      'أنشئ اختيارًا مستقلًا لكل موديل أو لون بسعره ومخزونه.',
    ),
    optionsIntro: words(
      'Start with one price. Add models, colors, or extras only when you need them.',
      'ابدأ بسعر واحد. أضف الموديلات والألوان أو الإضافات عند الحاجة فقط.',
    ),
    composerHint: words(
      'Add one row per model or color. Fill its details and price, then apply.',
      'أضف صفًا لكل موديل أو لون. اكتب تفاصيله وسعره، ثم طبّق.',
    ),
    nameExample: words('e.g. 24 cm / Red', 'مثال: ٢٤ سم / أحمر'),
    starterAttributes: [words('Model', 'الموديل'), words('Color', 'اللون')],
  },
  extras: {
    templateHint: words(
      'Gift wrapping or name engraving — free or for an extra charge.',
      'تغليف هدية أو حفر اسم — مجانًا أو بسعر إضافي.',
    ),
    starterOptions: [words('Gift wrapping', 'تغليف هدية'), words('Name engraving', 'حفر اسم')],
  },
  stock: shopStock(words('e.g. Stainless pot 24 cm', 'مثال: حلة استانلس ٢٤ سم')),
};

const electrical: ActivityWording = {
  product: {
    nameExample: words('e.g. Washing machine 7 kg', 'مثال: غسالة ٧ كيلو'),
    descriptionHint: words(
      'Describe the model, specifications, and any warranty terms.',
      'اذكر الموديل والمواصفات وأي شروط للضمان.',
    ),
    choicePriceHint: words(
      'Required for the catalog. Each model can have its own price.',
      'مطلوب للكتالوج. يمكن تحديد سعر مستقل لكل موديل.',
    ),
  },
  choices: {
    ...modelChoiceWords,
    title: words('Models', 'الموديلات'),
    templateTitle: words('Models', 'الموديلات'),
    templateHint: words(
      'Create one sellable choice for each model, with its own price and stock.',
      'أنشئ اختيارًا مستقلًا لكل موديل بسعره ومخزونه.',
    ),
    optionsIntro: words(
      'Start with one price. Add models or services like installation only when you need them.',
      'ابدأ بسعر واحد. أضف الموديلات أو خدمات مثل التركيب عند الحاجة فقط.',
    ),
    composerHint: words(
      'Add one row per model. Fill its name, Model detail, and price, then apply.',
      'أضف صفًا لكل موديل. اكتب اسمه وتفاصيل الموديل وسعره، ثم طبّق.',
    ),
    nameExample: words('e.g. 7 kg / Silver', 'مثال: ٧ كيلو / فضي'),
    starterAttributes: [words('Model', 'الموديل')],
  },
  extras: {
    templateHint: words(
      'Installation or extended warranty — free or for an extra charge.',
      'تركيب أو ضمان ممتد — مجانًا أو بسعر إضافي.',
    ),
    starterOptions: [words('Installation', 'تركيب'), words('Extended warranty', 'ضمان ممتد')],
  },
  stock: shopStock(words('e.g. Washing machine 7 kg', 'مثال: غسالة ٧ كيلو')),
};

const other: ActivityWording = {
  product: {
    nameExample: words('e.g. Everyday item', 'مثال: منتج يومي'),
    descriptionHint: words(
      'Describe the details customers need before buying.',
      'اذكر التفاصيل التي يحتاجها العميل قبل الشراء.',
    ),
    choicePriceHint: words(
      'Required for the catalog. Each type can have its own price.',
      'مطلوب للكتالوج. يمكن تحديد سعر مستقل لكل نوع.',
    ),
  },
  choices: {
    title: words('Types', 'الأنواع'),
    templateTitle: words('Types', 'الأنواع'),
    templateHint: words(
      'Sell the product in more than one type, each with its own price.',
      'بع المنتج بأكثر من نوع، لكل نوع سعره.',
    ),
    optionsIntro: words(
      'Start with one price. Add types or extras only when customers need them.',
      'ابدأ بسعر واحد. أضف أنواعًا أو إضافات فقط إذا احتاج العميل إليها.',
    ),
    composerHint: words(
      'Set a selling price for each type. Apply when you are ready.',
      'حدّد سعر بيع كل نوع، ثم طبّق التغييرات عند الانتهاء.',
    ),
    item: words('Type', 'النوع'),
    newItem: words('New type', 'نوع جديد'),
    nameColumn: words('Type name', 'اسم النوع'),
    nameRequired: words('Enter a type name.', 'اكتب اسم النوع.'),
    nameExample: words('e.g. Standard', 'مثال: عادي'),
    addItem: words('Add type', 'إضافة نوع'),
    allRemoved: words(
      'All types have been removed from this draft. Apply to sell at one product price, or add a new type below.',
      'تم حذف الأنواع من المسودة. طبّق لاستخدام سعر واحد للمنتج، أو أضف نوعًا جديدًا أدناه.',
    ),
    one: words('type', 'النوع'),
    many: words('types', 'الأنواع'),
    manyIndefinite: words('types', 'أنواع'),
    another: words('another type', 'نوع آخر'),
    countNoun: words('types', 'أنواع'),
    starterNames: [],
    starterAttributes: [],
  },
  extras: {
    templateHint: words(
      'Add-ons like gift wrapping — free or for an extra charge.',
      'إضافات مثل تغليف الهدايا — مجانًا أو بسعر إضافي.',
    ),
    starterOptions: [words('Gift wrapping', 'تغليف هدية'), words('Extra service', 'خدمة إضافية')],
  },
  stock: shopStock(words('e.g. Box of 12 pieces', 'مثال: كرتونة ١٢ قطعة')),
};

export const BUSINESS_ACTIVITY_WORDING: Record<BusinessActivityKey, ActivityWording> = {
  restaurant,
  clothing,
  supermarket,
  home_goods: homeGoods,
  electrical,
  other,
};

/** Returns the wording for an activity; missing or unknown keys use the neutral `other` wording. */
export function resolveActivityWording(activity: string | null | undefined): ActivityWording {
  return BUSINESS_ACTIVITY_WORDING[activity as BusinessActivityKey] ?? other;
}

/** "sizes" → "Sizes", for English phrases that start with a noun. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Short phrases built from the choice nouns, so each activity only lists its nouns.
 * Example: restaurant `one` = size/الحجم → duplicate = "Duplicate size" / "تكرار الحجم".
 */
export function activityChoicePhrases(wording: ActivityWording) {
  const { one, many, manyIndefinite, another, countNoun } = wording.choices;
  return {
    duplicate: words(`Duplicate ${one.en}`, `تكرار ${one.ar}`),
    copyPrice: words(`Copy price to all ${many.en}`, `نسخ السعر لكل ${many.ar}`),
    priceCopied: words(`Price copied to all ${many.en}.`, `تم نسخ السعر إلى كل ${many.ar}.`),
    moveUp: words(`Move ${one.en} up`, `تحريك ${one.ar} لأعلى`),
    moveDown: words(`Move ${one.en} down`, `تحريك ${one.ar} لأسفل`),
    skuUsed: words(`This SKU is already used by ${another.en}.`, `رمز SKU مستخدم ل${another.ar}.`),
    barcodeUsed: words(
      `This barcode is already used by ${another.en}.`,
      `الباركود مستخدم ل${another.ar}.`,
    ),
    apply: words(`Apply ${many.en} and prices`, `تطبيق ${many.ar} والأسعار`),
    edit: words(`Edit ${many.en}`, `تعديل ${many.ar}`),
    add: words(`Add ${manyIndefinite.en}`, `إضافة ${manyIndefinite.ar}`),
    updated: words(`${capitalize(many.en)} and prices updated.`, `تم تحديث ${many.ar} والأسعار.`),
    prices: words(`${capitalize(one.en)} prices`, `أسعار ${many.ar}`),
    noneAdded: words(`No ${many.en} added`, `لم تتم إضافة ${manyIndefinite.ar}`),
    withCustomerChoices: words(
      `${capitalize(many.en)} and customer choices`,
      `${many.ar} وخيارات العميل`,
    ),
    single: words(`One product ${one.en}`, `منتج بدون ${manyIndefinite.ar}`),
    enterPrices: words('Enter variant prices', `أدخل أسعار ${many.ar}`),
    count: (count: number) => words(`${count} ${countNoun.en}`, `${count} ${countNoun.ar}`),
    shortCount: (count: number) =>
      words(`${count} ${manyIndefinite.en}`, `${count} ${manyIndefinite.ar}`),
  };
}

/** POS sentences that shops replace: a shop sells, it does not take kitchen orders. */
const shopPosText: Readonly<Record<string, ActivityWords>> = {
  Orders: words('Sales', 'المبيعات'),
  'Orders shown': words('Sales shown', 'المبيعات المعروضة'),
  'Order status': words('Sale status', 'حالة البيع'),
  'Order history': words('Sales history', 'سجل المبيعات'),
  'Order details': words('Sale details', 'تفاصيل البيع'),
  'Current order': words('Current sale', 'البيع الحالي'),
  'Confirm order': words('Confirm sale', 'تأكيد البيع'),
  'Order confirmed': words('Sale confirmed', 'تم تأكيد البيع'),
  'Order total': words('Sale total', 'إجمالي البيع'),
  'Order items': words('Sale items', 'أصناف البيع'),
  'Order number': words('Sale number', 'رقم البيع'),
  'Menu and order': words('Products and sale', 'المنتجات والبيع'),
  'Choose something from the menu.': words(
    'Choose an item from the list.',
    'اختر صنفًا من القائمة.',
  ),
  Order: words('Sale', 'بيع'),
  'Order source': words('Sale source', 'مصدر البيع'),
  'Order type': words('Sale type', 'نوع البيع'),
  'Order balance': words('Sale balance', 'حساب البيع'),
  'Confirmed order': words('Confirmed sale', 'بيع مؤكد'),
  'New order': words('New sale', 'بيع جديد'),
  'New order total': words('New sale total', 'إجمالي البيع الجديد'),
  'All orders': words('All sales', 'كل المبيعات'),
  'Saved orders': words('Saved sales', 'المبيعات المحفوظة'),
  'Search saved orders': words('Search saved sales', 'البحث في المبيعات المحفوظة'),
  'No matching saved orders.': words('No matching saved sales.', 'لا توجد مبيعات محفوظة مطابقة.'),
  'Load more orders': words('Load more sales', 'تحميل مبيعات أخرى'),
  'Close order tab': words('Close sale tab', 'إغلاق تبويب البيع'),
  'Search reference, customer or table...': words(
    'Search reference or customer...',
    'ابحث برقم البيع أو العميل...',
  ),
  'Drafts are saved on this device; confirmed orders are available for this branch.': words(
    'Drafts are saved on this device; confirmed sales are available for this branch.',
    'المسودات محفوظة على هذا الجهاز، والمبيعات المؤكدة متاحة لهذا الفرع.',
  ),
  'Add items to order': words('Add items to sale', 'إضافة أصناف للبيع'),
  'Add items to this order': words('Add items to this sale', 'إضافة أصناف إلى هذا البيع'),
  'Start another order': words('Start another sale', 'بدء بيع جديد'),
  'Start another order to add items.': words(
    'Start another sale to add items.',
    'ابدأ بيعًا جديدًا لإضافة أصناف.',
  ),
  'Saving order...': words('Saving sale...', 'جارٍ حفظ البيع...'),
  'Open a register shift before confirming': words(
    'Open a register shift before confirming',
    'افتح وردية للجهاز قبل تأكيد البيع',
  ),
  'Orders can be drafted offline but must be confirmed online.': words(
    'Sales can be drafted offline but must be confirmed online.',
    'يمكن حفظ المسودات دون اتصال، ويجب تأكيد البيع عند الاتصال.',
  ),
  'Refresh order status': words('Refresh sale status', 'تحديث حالة البيع'),
  'Refresh order details': words('Refresh sale details', 'تحديث تفاصيل البيع'),
  'Show order details': words('Show sale details', 'تفاصيل البيع'),
  'Loading order details...': words('Loading sale details...', 'جارٍ تحميل تفاصيل البيع...'),
  'Loading order details…': words('Loading sale details…', 'جارٍ تحميل تفاصيل البيع…'),
  'Loading orders…': words('Loading sales…', 'جارٍ تحميل المبيعات…'),
  'Could not load orders.': words('Could not load sales.', 'تعذّر تحميل المبيعات.'),
  'Search receipt or order number': words(
    'Search receipt or sale number',
    'ابحث برقم الإيصال أو البيع',
  ),
  'Order details are unavailable. Verify the order reference before collecting.': words(
    'Sale details are unavailable. Verify the sale reference before collecting.',
    'تفاصيل البيع غير متاحة. راجع رقم البيع قبل التحصيل.',
  ),
  'Cancel unpaid order': words('Cancel unpaid sale', 'إلغاء البيع غير المدفوع'),
  'Keep order': words('Keep sale', 'الاحتفاظ بالبيع'),
  'This cancels the whole unpaid order, restores eligible stock, and sends a stop notice to the kitchen.':
    words(
      'This cancels the whole unpaid sale and restores eligible stock.',
      'سيُلغي هذا الإجراء البيع غير المدفوع بالكامل، ويعيد المخزون القابل للاسترجاع.',
    ),
  'Orders with any payment, or orders already in preparation, cannot be cancelled here.': words(
    'Sales with any payment cannot be cancelled here.',
    'لا يمكن إلغاء البيع من هنا إذا سُجّل عليه أي دفع.',
  ),
};

/**
 * POS text replacements for an activity, keyed by the English POS text.
 * Merchants with the kitchen feature on (restaurants) keep the POS text unchanged.
 * Example for clothing: "Choose a size" → "Choose size and color" / "اختر المقاس واللون".
 */
export function activityPosTextOverrides(
  activity: string | null | undefined,
  kitchenEnabled: boolean,
): Readonly<Record<string, ActivityWords>> {
  if (kitchenEnabled) return {};
  const { item, one } = resolveActivityWording(activity).choices;
  return {
    ...shopPosText,
    'Choose a size': words(`Choose ${item.en.toLowerCase()}`, `اختر ${item.ar}`),
    'Choose the size and options for this order item.': words(
      `Choose the ${one.en} and options for this item.`,
      `اختر ${item.ar} والإضافات لهذا الصنف.`,
    ),
  };
}
