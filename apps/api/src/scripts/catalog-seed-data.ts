import type { PrismaClient } from '@waffarly/database';

const SEED_ACTOR = 'waffarly-catalog-seed';

type CatalogSeedClient = Pick<
  PrismaClient,
  | 'mediaAsset'
  | 'category'
  | 'product'
  | 'modifierGroup'
  | 'modifierOption'
  | 'productModifierGroupAssignment'
  | 'productModifierGroupAssignmentOption'
  | 'productVariant'
>;

type SeedImage = {
  key: string;
  color: [number, number, number];
};

type SeedCategory = {
  name: string;
  description: string;
  image: string;
  parent?: string;
  availability: 'available' | 'unavailable';
};

type SeedOption = {
  name: string;
  priceAdjustment: string;
  defaultSelected?: boolean;
};

type SeedModifierGroup = {
  name: string;
  description?: string;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  options: SeedOption[];
};

type SeedVariant = {
  name: string;
  sku: string;
  barcode: string;
  price: string;
  stockQuantity: number | null;
  availability?: 'available' | 'unavailable';
};

type SeedProduct = {
  name: string;
  description: string;
  basePrice: string;
  image: string;
  categories: string[];
  availability?: 'available' | 'unavailable';
  modifiers?: SeedModifierGroup[];
  variants?: SeedVariant[];
};

export const catalogSeedImages: SeedImage[] = [
  { key: 'classic-beef-burger', color: [198, 91, 50] },
  { key: 'crispy-chicken-burger', color: [213, 133, 45] },
  { key: 'smash-burger', color: [115, 73, 48] },
  { key: 'chicken-tenders', color: [225, 168, 62] },
  { key: 'loaded-fries', color: [228, 174, 50] },
  { key: 'onion-rings', color: [196, 126, 47] },
  { key: 'cola', color: [97, 72, 61] },
  { key: 'lemon-mint', color: [72, 153, 121] },
  { key: 'lava-cake', color: [104, 57, 44] },
  { key: 'kids-meal', color: [75, 128, 176] },
  { key: 'breakfast', color: [160, 106, 69] },
];

const categories: SeedCategory[] = [
  {
    name: 'Meals',
    description: 'Freshly prepared meals for every appetite.',
    image: 'classic-beef-burger',
    availability: 'available',
  },
  {
    name: 'Burgers',
    description: 'Char-grilled burgers, made to order.',
    image: 'classic-beef-burger',
    parent: 'Meals',
    availability: 'available',
  },
  {
    name: 'Chicken',
    description: 'Crispy chicken burgers and tenders.',
    image: 'chicken-tenders',
    parent: 'Meals',
    availability: 'available',
  },
  {
    name: 'Sides',
    description: 'The right extras for every meal.',
    image: 'loaded-fries',
    availability: 'available',
  },
  {
    name: 'Drinks',
    description: 'Cold drinks and house refreshers.',
    image: 'lemon-mint',
    availability: 'available',
  },
  {
    name: 'Desserts',
    description: 'A sweet finish, prepared daily.',
    image: 'lava-cake',
    availability: 'available',
  },
  {
    name: 'Kids Meals',
    description: 'Smaller portions for little appetites.',
    image: 'kids-meal',
    availability: 'available',
  },
  {
    name: 'Breakfast Specials',
    description: 'Limited morning menu. Not currently available.',
    image: 'breakfast',
    availability: 'unavailable',
  },
];

const products: SeedProduct[] = [
  {
    name: 'Classic Beef Burger',
    description: 'Juicy grilled beef patty, cheddar, lettuce, tomato, pickles and house sauce.',
    basePrice: '165.00',
    image: 'classic-beef-burger',
    categories: ['Burgers'],
    modifiers: [
      {
        name: 'Burger Size',
        selectionMode: 'single',
        minSelections: 1,
        maxSelections: 1,
        options: [
          { name: 'Single patty', priceAdjustment: '0.00', defaultSelected: true },
          { name: 'Double patty', priceAdjustment: '55.00' },
        ],
      },
      {
        name: 'Extras',
        description: 'Choose up to three extras.',
        selectionMode: 'multiple',
        minSelections: 0,
        maxSelections: 3,
        options: [
          { name: 'Extra cheddar', priceAdjustment: '20.00' },
          { name: 'Beef bacon', priceAdjustment: '28.00' },
          { name: 'Jalapeños', priceAdjustment: '12.00' },
        ],
      },
      {
        name: 'Sauces',
        selectionMode: 'multiple',
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'House sauce', priceAdjustment: '0.00', defaultSelected: true },
          { name: 'Spicy mayo', priceAdjustment: '0.00' },
          { name: 'BBQ sauce', priceAdjustment: '0.00' },
        ],
      },
    ],
    variants: [
      {
        name: 'Regular bun',
        sku: 'WFK-CBB-REG',
        barcode: '6224000001001',
        price: '165.00',
        stockQuantity: 36,
      },
      {
        name: 'Brioche bun',
        sku: 'WFK-CBB-BRI',
        barcode: '6224000001002',
        price: '175.00',
        stockQuantity: 14,
      },
      {
        name: 'Lettuce wrap',
        sku: 'WFK-CBB-LTW',
        barcode: '6224000001003',
        price: '165.00',
        stockQuantity: 0,
      },
    ],
  },
  {
    name: 'Crispy Chicken Burger',
    description: 'Buttermilk-fried chicken breast with slaw, pickles and creamy mayo.',
    basePrice: '145.00',
    image: 'crispy-chicken-burger',
    categories: ['Chicken', 'Burgers'],
    modifiers: [
      {
        name: 'Heat Level',
        selectionMode: 'single',
        minSelections: 1,
        maxSelections: 1,
        options: [
          { name: 'Classic', priceAdjustment: '0.00', defaultSelected: true },
          { name: 'Hot', priceAdjustment: '0.00' },
          { name: 'Extra hot', priceAdjustment: '0.00' },
        ],
      },
      {
        name: 'Add-ons',
        selectionMode: 'multiple',
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Cheddar slice', priceAdjustment: '20.00' },
          { name: 'Extra coleslaw', priceAdjustment: '15.00' },
        ],
      },
    ],
    variants: [
      {
        name: 'Original',
        sku: 'WFK-CCB-ORG',
        barcode: '6224000001011',
        price: '145.00',
        stockQuantity: 18,
      },
      {
        name: 'Spicy',
        sku: 'WFK-CCB-SPY',
        barcode: '6224000001012',
        price: '145.00',
        stockQuantity: 7,
      },
      {
        name: 'Gluten-free bun',
        sku: 'WFK-CCB-GFB',
        barcode: '6224000001013',
        price: '165.00',
        stockQuantity: 2,
      },
    ],
  },
  {
    name: 'Smash Burger',
    description: 'Two smashed beef patties, caramelised onions, American cheese and pickles.',
    basePrice: '185.00',
    image: 'smash-burger',
    categories: ['Burgers'],
    modifiers: [
      {
        name: 'Sauce',
        selectionMode: 'single',
        minSelections: 0,
        maxSelections: 1,
        options: [
          { name: 'Signature sauce', priceAdjustment: '0.00', defaultSelected: true },
          { name: 'Mustard and pickles', priceAdjustment: '0.00' },
        ],
      },
    ],
    variants: [
      {
        name: 'Standard',
        sku: 'WFK-SMB-STD',
        barcode: '6224000001021',
        price: '185.00',
        stockQuantity: null,
      },
    ],
  },
  {
    name: 'Chicken Tenders',
    description: 'Crispy chicken tenders served with your choice of dip.',
    basePrice: '110.00',
    image: 'chicken-tenders',
    categories: ['Chicken'],
    modifiers: [
      {
        name: 'Dip',
        selectionMode: 'single',
        minSelections: 1,
        maxSelections: 1,
        options: [
          { name: 'Ranch', priceAdjustment: '0.00', defaultSelected: true },
          { name: 'Honey mustard', priceAdjustment: '0.00' },
          { name: 'Buffalo', priceAdjustment: '0.00' },
        ],
      },
    ],
    variants: [
      {
        name: '3 pieces',
        sku: 'WFK-CT-3',
        barcode: '6224000001031',
        price: '110.00',
        stockQuantity: 20,
      },
      {
        name: '5 pieces',
        sku: 'WFK-CT-5',
        barcode: '6224000001032',
        price: '155.00',
        stockQuantity: 3,
      },
      {
        name: '8 pieces',
        sku: 'WFK-CT-8',
        barcode: '6224000001033',
        price: '235.00',
        stockQuantity: 0,
      },
    ],
  },
  {
    name: 'Loaded Fries',
    description: 'Crispy fries with cheddar sauce, beef bacon, jalapeños and spring onions.',
    basePrice: '95.00',
    image: 'loaded-fries',
    categories: ['Sides'],
    modifiers: [
      {
        name: 'Finish',
        selectionMode: 'multiple',
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Extra cheddar sauce', priceAdjustment: '18.00' },
          { name: 'Jalapeños', priceAdjustment: '10.00' },
          { name: 'No beef bacon', priceAdjustment: '0.00' },
        ],
      },
    ],
  },
  {
    name: 'Onion Rings',
    description: 'Golden beer-battered onion rings with smoky BBQ dip.',
    basePrice: '70.00',
    image: 'onion-rings',
    categories: ['Sides'],
  },
  {
    name: 'Cola',
    description: 'Ice-cold cola, served chilled.',
    basePrice: '35.00',
    image: 'cola',
    categories: ['Drinks'],
    variants: [
      {
        name: 'Can',
        sku: 'WFK-COLA-CAN',
        barcode: '6224000001041',
        price: '35.00',
        stockQuantity: 48,
      },
      {
        name: 'Zero sugar can',
        sku: 'WFK-COLA-ZERO',
        barcode: '6224000001042',
        price: '35.00',
        stockQuantity: 0,
      },
      {
        name: '1 litre bottle',
        sku: 'WFK-COLA-1L',
        barcode: '6224000001043',
        price: '55.00',
        stockQuantity: 11,
        availability: 'unavailable',
      },
    ],
  },
  {
    name: 'Lemon Mint Cooler',
    description: 'Fresh lemon, mint and soda over crushed ice.',
    basePrice: '65.00',
    image: 'lemon-mint',
    categories: ['Drinks'],
  },
  {
    name: 'Chocolate Lava Cake',
    description: 'Warm chocolate cake with a molten centre and vanilla ice cream.',
    basePrice: '105.00',
    image: 'lava-cake',
    categories: ['Desserts'],
    variants: [
      {
        name: 'Single serving',
        sku: 'WFK-LAVA-ONE',
        barcode: '6224000001051',
        price: '105.00',
        stockQuantity: 2,
      },
    ],
  },
  {
    name: 'Little Burger Meal',
    description: 'Kids beef slider with fries, apple juice and a small surprise.',
    basePrice: '120.00',
    image: 'kids-meal',
    categories: ['Kids Meals'],
    variants: [
      {
        name: 'Beef slider',
        sku: 'WFK-KID-BEF',
        barcode: '6224000001061',
        price: '120.00',
        stockQuantity: 9,
      },
      {
        name: 'Chicken slider',
        sku: 'WFK-KID-CHK',
        barcode: '6224000001062',
        price: '120.00',
        stockQuantity: 0,
      },
    ],
  },
  {
    name: 'Truffle Breakfast Burger',
    description: 'A limited breakfast burger with egg, turkey bacon and truffle mayo.',
    basePrice: '195.00',
    image: 'breakfast',
    categories: ['Breakfast Specials'],
    availability: 'unavailable',
    variants: [
      {
        name: 'Standard',
        sku: 'WFK-BRK-STD',
        barcode: '6224000001071',
        price: '195.00',
        stockQuantity: 6,
      },
    ],
  },
];

const arabicCopy: Record<string, string> = {
  Meals: 'الوجبات',
  Burgers: 'البرجر',
  Chicken: 'الدجاج',
  Sides: 'المقبلات',
  Drinks: 'المشروبات',
  Desserts: 'الحلويات',
  'Kids Meals': 'وجبات الأطفال',
  'Breakfast Specials': 'عروض الإفطار',
  'Freshly prepared meals for every appetite.': 'وجبات طازجة تُحضّر لكل الأذواق.',
  'Char-grilled burgers, made to order.': 'برجر مشوي على اللهب ويُحضّر حسب الطلب.',
  'Crispy chicken burgers and tenders.': 'برجر دجاج مقرمش وتندرز طازجة.',
  'The right extras for every meal.': 'إضافات مثالية لكل وجبة.',
  'Cold drinks and house refreshers.': 'مشروبات باردة ومنعشات المطعم.',
  'A sweet finish, prepared daily.': 'ختام حلو يُحضّر يومياً.',
  'Smaller portions for little appetites.': 'حصص أصغر للشهية الصغيرة.',
  'Limited morning menu. Not currently available.': 'قائمة صباحية محدودة وغير متاحة حالياً.',
  'Classic Beef Burger': 'برجر لحم كلاسيك',
  'Crispy Chicken Burger': 'برجر دجاج كرسبي',
  'Smash Burger': 'سماش برجر',
  'Chicken Tenders': 'تشيكن تندرز',
  'Loaded Fries': 'بطاطس محمّلة',
  'Onion Rings': 'حلقات بصل مقرمشة',
  Cola: 'كولا',
  'Lemon Mint Cooler': 'ليمون بالنعناع',
  'Chocolate Lava Cake': 'كيك لافا بالشوكولاتة',
  'Little Burger Meal': 'وجبة برجر صغيرة',
  'Truffle Breakfast Burger': 'برجر إفطار بالكمأة',
  'Juicy grilled beef patty, cheddar, lettuce, tomato, pickles and house sauce.':
    'قطعة لحم مشوية غنية بالعصارة مع شيدر وخس وطماطم ومخلل وصلصة المطعم.',
  'Buttermilk-fried chicken breast with slaw, pickles and creamy mayo.':
    'صدر دجاج مقلي باللبن مع كول سلو ومخلل ومايونيز كريمي.',
  'Two smashed beef patties, caramelised onions, American cheese and pickles.':
    'قطعتا لحم سماش مع بصل مكرمل وجبن أمريكي ومخلل.',
  'Crispy chicken tenders served with your choice of dip.':
    'قطع دجاج مقرمشة تُقدّم مع صلصة من اختيارك.',
  'Crispy fries with cheddar sauce, beef bacon, jalapeños and spring onions.':
    'بطاطس مقرمشة مع صلصة شيدر وبيكون لحم وهالبينو وبصل أخضر.',
  'Golden beer-battered onion rings with smoky BBQ dip.':
    'حلقات بصل ذهبية مقرمشة مع صلصة باربكيو مدخنة.',
  'Ice-cold cola, served chilled.': 'كولا مثلجة تُقدّم باردة.',
  'Fresh lemon, mint and soda over crushed ice.': 'ليمون طازج ونعناع وصودا فوق ثلج مجروش.',
  'Warm chocolate cake with a molten centre and vanilla ice cream.':
    'كيك شوكولاتة دافئ بقلب سائل مع آيس كريم فانيليا.',
  'Kids beef slider with fries, apple juice and a small surprise.':
    'سلايدر لحم للأطفال مع بطاطس وعصير تفاح ومفاجأة صغيرة.',
  'A limited breakfast burger with egg, turkey bacon and truffle mayo.':
    'برجر إفطار محدود مع بيض وبيكون ديك رومي ومايونيز بالكمأة.',
  'Burger Size': 'حجم البرجر',
  'Single patty': 'قطعة لحم واحدة',
  'Double patty': 'قطعتا لحم',
  Extras: 'إضافات',
  'Choose up to three extras.': 'اختر حتى ثلاث إضافات.',
  'Extra cheddar': 'شيدر إضافي',
  'Beef bacon': 'بيكون لحم',
  Jalapeños: 'هالبينو',
  Sauces: 'الصلصات',
  'House sauce': 'صلصة المطعم',
  'Spicy mayo': 'مايونيز حار',
  'BBQ sauce': 'صلصة باربكيو',
  'Heat Level': 'مستوى الحِدّة',
  Classic: 'عادي',
  Hot: 'حار',
  'Extra hot': 'حار جداً',
  'Add-ons': 'إضافات',
  'Cheddar slice': 'شريحة شيدر',
  'Extra coleslaw': 'كول سلو إضافي',
  Sauce: 'الصلصة',
  'Signature sauce': 'الصلصة المميزة',
  'Mustard and pickles': 'خردل ومخلل',
  Dip: 'صوص جانبي',
  Ranch: 'رانش',
  'Honey mustard': 'خردل بالعسل',
  Buffalo: 'بافلو',
  Finish: 'إضافات نهائية',
  'Extra cheddar sauce': 'صلصة شيدر إضافية',
  'No beef bacon': 'بدون بيكون لحم',
  'Regular bun': 'خبز عادي',
  'Brioche bun': 'خبز بريوش',
  'Lettuce wrap': 'لفائف خس',
  Original: 'أصلي',
  Spicy: 'حار',
  'Gluten-free bun': 'خبز خالٍ من الغلوتين',
  Standard: 'قياسي',
  '3 pieces': '٣ قطع',
  '5 pieces': '٥ قطع',
  '8 pieces': '٨ قطع',
  Can: 'علبة',
  'Zero sugar can': 'علبة بدون سكر',
  '1 litre bottle': 'زجاجة ١ لتر',
  'Single serving': 'حصة فردية',
  'Beef slider': 'سلايدر لحم',
  'Chicken slider': 'سلايدر دجاج',
};

function inArabic(value: string): string {
  return arabicCopy[value] ?? value;
}

export type CatalogSeedResult = {
  created: {
    media: number;
    categories: number;
    products: number;
  };
  totals: {
    media: number;
    categories: number;
    products: number;
    variants: number;
  };
};

export function catalogSeedStorageKey(imageKey: string): string {
  return `seed/restaurant/${imageKey}.png`;
}

export async function seedRestaurantCatalog(
  prisma: CatalogSeedClient,
  merchantId: string,
  publicApiBaseUrl: string,
): Promise<CatalogSeedResult> {
  const baseUrl = publicApiBaseUrl.replace(/\/$/, '');
  let createdMedia = 0;
  let createdCategories = 0;
  let createdProducts = 0;
  const mediaByKey = new Map<string, { id: string }>();

  for (const image of catalogSeedImages) {
    const storageKey = catalogSeedStorageKey(image.key);
    let media = await prisma.mediaAsset.findFirst({
      where: { merchantId, storageKey },
      select: { id: true },
    });
    if (!media) {
      media = await prisma.mediaAsset.create({
        data: {
          merchantId,
          storageKey,
          publicUrl: `${baseUrl}/media/${storageKey}`,
          mimeType: 'image/png',
          sizeBytes: 1,
          createdBy: SEED_ACTOR,
        },
        select: { id: true },
      });
      createdMedia += 1;
    }
    mediaByKey.set(image.key, media);
  }

  const categoryByName = new Map<string, { id: string }>();
  for (const category of categories) {
    const categoryName = inArabic(category.name);
    const categoryDescription = inArabic(category.description);
    const image = mediaByKey.get(category.image);
    if (!image) throw new Error(`Missing seed image "${category.image}".`);
    let record = await prisma.category.findFirst({
      where: { merchantId, name: { in: [category.name, categoryName] }, createdBy: SEED_ACTOR },
      select: { id: true, name: true },
    });
    if (!record) {
      const parent = category.parent ? categoryByName.get(inArabic(category.parent)) : undefined;
      if (category.parent && !parent)
        throw new Error(`Missing parent category "${category.parent}".`);
      record = await prisma.category.create({
        data: {
          merchantId,
          name: categoryName,
          description: categoryDescription,
          imageAssetId: image.id,
          parentId: parent?.id ?? null,
          availability: category.availability,
          createdBy: SEED_ACTOR,
          updatedBy: SEED_ACTOR,
        },
        select: { id: true, name: true },
      });
      createdCategories += 1;
    } else if (record.name === category.name) {
      await prisma.category.update({
        where: { id: record.id },
        data: {
          name: categoryName,
          description: categoryDescription,
          imageAssetId: image.id,
          availability: category.availability,
          updatedBy: SEED_ACTOR,
        },
      });
    }
    if (!record) throw new Error(`Could not resolve seed category "${category.name}".`);
    categoryByName.set(categoryName, record);
  }

  for (const product of products) {
    const productName = inArabic(product.name);
    const productDescription = inArabic(product.description);
    const existing = await prisma.product.findFirst({
      where: { merchantId, name: { in: [product.name, productName] }, createdBy: SEED_ACTOR },
      select: {
        id: true,
        name: true,
        modifierGroups: {
          select: {
            id: true,
            selectionMode: true,
            minSelections: true,
            maxSelections: true,
            position: true,
            modifierGroup: {
              select: {
                id: true,
                name: true,
                options: { select: { id: true, name: true, position: true } },
              },
            },
            options: {
              select: {
                optionId: true,
                priceAdjustment: true,
                defaultSelected: true,
              },
            },
          },
        },
        variants: { select: { id: true, name: true } },
      },
    });
    if (existing) {
      if (existing.name === product.name) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: productName,
            description: productDescription,
            basePrice: product.basePrice,
            availability: product.availability ?? 'available',
            updatedBy: SEED_ACTOR,
          },
        });
      }
      for (const group of product.modifiers ?? []) {
        const persistedAssignment = existing.modifierGroups.find(
          (item) => item.modifierGroup.name === group.name,
        );
        const persistedGroup = persistedAssignment?.modifierGroup;
        if (persistedGroup) {
          await prisma.modifierGroup.update({
            where: { id: persistedGroup.id },
            data: {
              name: inArabic(group.name),
              ...(group.description ? { description: inArabic(group.description) } : {}),
            },
          });
          await prisma.productModifierGroupAssignment.update({
            where: { id: persistedAssignment!.id },
            data: {
              selectionMode: group.selectionMode,
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
            },
          });
          for (const option of group.options) {
            const persistedOption = persistedGroup.options.find(
              (item) => item.name === option.name,
            );
            if (persistedOption) {
              await prisma.modifierOption.update({
                where: { id: persistedOption.id },
                data: { name: inArabic(option.name) },
              });
              await prisma.productModifierGroupAssignmentOption.update({
                where: {
                  assignmentId_optionId: {
                    assignmentId: persistedAssignment!.id,
                    optionId: persistedOption.id,
                  },
                },
                data: {
                  priceAdjustment: option.priceAdjustment,
                  defaultSelected: option.defaultSelected ?? false,
                },
              });
            }
          }
        }
      }
      for (const variant of product.variants ?? []) {
        const persistedVariant = existing.variants.find((item) => item.name === variant.name);
        if (persistedVariant) {
          await prisma.productVariant.update({
            where: { id: persistedVariant.id },
            data: { name: inArabic(variant.name) },
          });
        }
      }
      continue;
    }
    const image = mediaByKey.get(product.image);
    if (!image) throw new Error(`Missing seed image "${product.image}".`);
    const categoryIds = product.categories.map((name) => {
      const category = categoryByName.get(inArabic(name));
      if (!category) throw new Error(`Missing seed category "${name}".`);
      return category.id;
    });
    const createdProduct = await prisma.product.create({
      data: {
        merchantId,
        name: productName,
        description: productDescription,
        basePrice: product.basePrice,
        availability: product.availability ?? 'available',
        createdBy: SEED_ACTOR,
        updatedBy: SEED_ACTOR,
        images: {
          create: {
            isPrimary: true,
            position: 0,
            mediaAsset: { connect: { id_merchantId: { id: image.id, merchantId } } },
          },
        },
        categoryLinks: {
          create: categoryIds.map((categoryId) => ({
            category: { connect: { id_merchantId: { id: categoryId, merchantId } } },
          })),
        },
        ...(product.variants
          ? {
              variants: {
                create: product.variants.map((variant, position) => ({
                  name: inArabic(variant.name),
                  sku: variant.sku,
                  barcode: variant.barcode,
                  price: variant.price,
                  stockQuantity: variant.stockQuantity,
                  availability: variant.availability ?? 'available',
                  position,
                })),
              },
            }
          : {}),
      },
      select: { id: true },
    });
    for (const [groupPosition, group] of (product.modifiers ?? []).entries()) {
      const modifierGroup = await prisma.modifierGroup.create({
        data: {
          merchantId,
          name: inArabic(group.name),
          ...(group.description ? { description: inArabic(group.description) } : {}),
          options: {
            create: group.options.map((option, position) => ({
              name: inArabic(option.name),
              position,
            })),
          },
        },
        include: { options: { orderBy: { position: 'asc' } } },
      });
      const assignment = await prisma.productModifierGroupAssignment.create({
        data: {
          merchantId,
          productId: createdProduct.id,
          modifierGroupId: modifierGroup.id,
          selectionMode: group.selectionMode,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          position: groupPosition,
        },
        select: { id: true },
      });
      await prisma.productModifierGroupAssignmentOption.createMany({
        data: modifierGroup.options.map((option, position) => {
          const seedOption = group.options[position];
          if (!seedOption) throw new Error(`Missing seed option for ${group.name}.`);
          return {
            assignmentId: assignment.id,
            modifierGroupId: modifierGroup.id,
            optionId: option.id,
            merchantId,
            priceAdjustment: seedOption.priceAdjustment,
            defaultSelected: seedOption.defaultSelected ?? false,
          };
        }),
      });
    }
    createdProducts += 1;
  }

  const [media, category, product] = await Promise.all([
    prisma.mediaAsset.count({ where: { merchantId, createdBy: SEED_ACTOR } }),
    prisma.category.count({ where: { merchantId, createdBy: SEED_ACTOR } }),
    prisma.product.count({ where: { merchantId, createdBy: SEED_ACTOR } }),
  ]);
  const variantCount = await prisma.product.findMany({
    where: { merchantId, createdBy: SEED_ACTOR },
    select: { variants: { select: { id: true } } },
  });

  return {
    created: { media: createdMedia, categories: createdCategories, products: createdProducts },
    totals: {
      media,
      categories: category,
      products: product,
      variants: variantCount.reduce((sum, item) => sum + item.variants.length, 0),
    },
  };
}
