import { access } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config as loadDotEnv } from 'dotenv';
import type { CatalogProductFields } from '@waffarly/contracts';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { AppConfiguration } from '../config/app-configuration.js';
import { hashPassword } from '../modules/auth/password.js';
import { PosEmployeeService } from '../modules/auth/pos-employee.service.js';
import { CategoryService } from '../modules/catalog/categories/category.service.js';
import { ProductPricingService } from '../modules/catalog/pricing/product-pricing.service.js';
import { ProductService } from '../modules/catalog/products/product.service.js';
import { InventoryLedgerService } from '../modules/inventory/inventory-ledger.service.js';
import { InventoryLocationsService } from '../modules/inventory/inventory-locations.service.js';
import { InventoryService } from '../modules/inventory/inventory.service.js';
import { StorefrontOrdersService } from '../modules/orders/storefront-orders.service.js';
import { PrismaService } from '../infrastructure/database/prisma.service.js';
import { LocalMediaStorage } from '../infrastructure/storage/local-media-storage.js';

loadDotEnv({ path: resolve(process.cwd(), '../../.env') });

const DEMO = {
  slug: 'waffarly-inventory-demo',
  merchantName: 'مطعم وفّرلي التجريبي',
  ownerUsername: 'inventory-demo',
  employeeUsername: 'cashier-demo',
  actor: 'local-inventory-demo-seed',
  sampleOrderCustomerName: 'طلب تجريبي للوصفة',
  sampleOrderCustomerPhone: '01012345678',
  branchName: 'فرع المعادي',
  warehouseName: 'مخزن المطبخ',
  productName: 'بيتزا المكونات الطازجة',
  password: process.env.INVENTORY_DEMO_PASSWORD ?? 'WaffarlyLocalDemo2026!',
} as const;

const ITEM_REQUEST_IDS = {
  flour: '90243271-1c02-4f10-a62e-e0b6f5af7d01',
  mozzarella: '90243271-1c02-4f10-a62e-e0b6f5af7d02',
  tomato: '90243271-1c02-4f10-a62e-e0b6f5af7d03',
  oil: '90243271-1c02-4f10-a62e-e0b6f5af7d04',
  mushroom: '90243271-1c02-4f10-a62e-e0b6f5af7d05',
} as const;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the local inventory demo.');
if (process.env.NODE_ENV === 'production') {
  throw new Error('The Arabic inventory demo seed is disabled when NODE_ENV=production.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('This demo seed only runs against a localhost PostgreSQL database.');
}
if (DEMO.password.length < 12)
  throw new Error('The demo password must contain at least 12 characters.');

const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
const persistence = client as unknown as PrismaService;
const ownerInventory = new InventoryService(persistence);
const locations = new InventoryLocationsService(persistence);
const ledger = new InventoryLedgerService(persistence);
const categories = new CategoryService(persistence);
const products = new ProductService(persistence);
const employees = new PosEmployeeService(persistence);
const appConfiguration = new AppConfiguration();
const mediaStorage = new LocalMediaStorage(appConfiguration);

try {
  const merchant = await ensureMerchant();
  const branch = await ensureBranch(merchant.id);
  const stockItems = await ensureStockItems(merchant.id);
  await ensureOpeningBalance(merchant.id, branch.defaultConsumptionWarehouseId!, stockItems);
  const image = await ensureDemoImage(merchant.id);
  const category = await ensureCategory(merchant.id, image.id);
  const product = await ensureRecipeProduct(merchant.id, image.id, category.id, stockItems);
  await ensurePosEmployee(merchant.id, branch.id);
  const sampleOrder = await ensureSampleRecipeOrder(merchant.id, product.id);

  console.log(`Arabic inventory demo is ready for ${merchant.name}.`);
  console.log(`Merchant dashboard: http://localhost:5174/login`);
  console.log(`POS: http://localhost:5175/login`);
  console.log(`Business code: ${DEMO.slug}`);
  console.log(`Owner username: ${DEMO.ownerUsername}`);
  console.log(`POS employee username: ${DEMO.employeeUsername}`);
  console.log(`Demo password: ${DEMO.password}`);
  console.log(`Seeded branch: ${branch.name}; default warehouse: ${DEMO.warehouseName}.`);
  console.log(`Seeded product: ${product.name}; variants each have a RECIPE target.`);
  console.log(`POS practice order: ${DEMO.sampleOrderCustomerName} (${sampleOrder.status}).`);
} finally {
  await client.$disconnect();
}

async function ensureMerchant() {
  const existing = await client.merchant.findUnique({ where: { storefrontSlug: DEMO.slug } });
  if (existing) {
    if (
      existing.name !== DEMO.merchantName ||
      existing.firstMonthActivatedBy !== DEMO.actor ||
      existing.activity !== 'restaurant'
    ) {
      throw new Error(`The reserved demo business code "${DEMO.slug}" belongs to other data.`);
    }
    const account = await client.ownerAccount.findUnique({
      where: { username: DEMO.ownerUsername },
    });
    if (account && account.merchantId !== existing.id) {
      throw new Error(
        `The demo owner username "${DEMO.ownerUsername}" belongs to another business.`,
      );
    }
    if (!account) {
      await client.ownerAccount.create({
        data: {
          merchantId: existing.id,
          username: DEMO.ownerUsername,
          passwordHash: await hashPassword(DEMO.password),
        },
      });
    }
    return existing;
  }

  const ownerUsernameTaken = await client.ownerAccount.findUnique({
    where: { username: DEMO.ownerUsername },
    select: { id: true },
  });
  if (ownerUsernameTaken)
    throw new Error(`The demo owner username "${DEMO.ownerUsername}" is already in use.`);

  const now = new Date();
  return client.merchant.create({
    data: {
      name: DEMO.merchantName,
      storefrontSlug: DEMO.slug,
      activity: 'restaurant',
      contactPhone: '01000000000',
      ownerName: 'صاحب المطعم التجريبي',
      ownerMobile: '01000000000',
      firstMonthActivatedAt: now,
      firstMonthActivatedBy: DEMO.actor,
      owner: {
        create: {
          username: DEMO.ownerUsername,
          passwordHash: await hashPassword(DEMO.password),
        },
      },
    },
  });
}

async function ensureBranch(merchantId: string) {
  const found = await client.branch.findFirst({
    where: { merchantId, name: DEMO.branchName },
    include: { warehouses: true },
  });
  if (found) {
    if (found.createdBy !== DEMO.actor)
      throw new Error('The sample branch name is already used by other data.');
    const defaultWarehouse = found.warehouses.find((warehouse) => warehouse.isDefaultConsumption);
    if (!defaultWarehouse)
      throw new Error('The sample branch has no default consumption warehouse.');
    return { id: found.id, name: found.name, defaultConsumptionWarehouseId: defaultWarehouse.id };
  }
  return locations.createBranch(merchantId, DEMO.actor, {
    name: DEMO.branchName,
    address: 'شارع ٩، المعادي، القاهرة',
    defaultWarehouseName: DEMO.warehouseName,
  });
}

async function ensureStockItems(merchantId: string) {
  const definitions = [
    {
      key: 'flour',
      requestId: ITEM_REQUEST_IDS.flour,
      name: 'دقيق مخابز',
      baseUnit: 'g' as const,
      units: [{ code: 'bag_5kg', name: 'شكارة ٥ كجم', baseQuantity: '5000' }],
    },
    {
      key: 'mozzarella',
      requestId: ITEM_REQUEST_IDS.mozzarella,
      name: 'جبنة موزاريلا',
      baseUnit: 'g' as const,
      units: [{ code: 'block_1kg', name: 'قالب ١ كجم', baseQuantity: '1000' }],
    },
    {
      key: 'tomato',
      requestId: ITEM_REQUEST_IDS.tomato,
      name: 'صلصة طماطم',
      baseUnit: 'ml' as const,
      units: [{ code: 'bottle_1l', name: 'زجاجة ١ لتر', baseQuantity: '1000' }],
    },
    {
      key: 'oil',
      requestId: ITEM_REQUEST_IDS.oil,
      name: 'زيت زيتون',
      baseUnit: 'ml' as const,
      units: [{ code: 'bottle_750ml', name: 'زجاجة ٧٥٠ مل', baseQuantity: '750' }],
    },
    {
      key: 'mushroom',
      requestId: ITEM_REQUEST_IDS.mushroom,
      name: 'مشروم طازج',
      baseUnit: 'g' as const,
      units: [{ code: 'tray_250g', name: 'صينية ٢٥٠ جم', baseQuantity: '250' }],
    },
  ] as const;

  const output: Record<(typeof definitions)[number]['key'], string> = {
    flour: '',
    mozzarella: '',
    tomato: '',
    oil: '',
    mushroom: '',
  };
  for (const item of definitions) {
    const existing = await client.stockItem.findFirst({
      where: { merchantId, name: item.name },
      select: { id: true, createdBy: true },
    });
    if (existing && existing.createdBy !== DEMO.actor) {
      throw new Error(`The sample stock item "${item.name}" is already used by other data.`);
    }
    const saved = existing
      ? await ownerInventory.get(merchantId, existing.id)
      : await ownerInventory.create(merchantId, DEMO.actor, {
          requestId: item.requestId,
          name: item.name,
          baseUnit: item.baseUnit,
          units: [...item.units],
        });
    output[item.key] = saved.id;
  }
  return output;
}

async function ensureOpeningBalance(
  merchantId: string,
  warehouseId: string,
  item: Awaited<ReturnType<typeof ensureStockItems>>,
) {
  await ledger.createOpening(merchantId, DEMO.actor, {
    requestId: '40a9388e-a0b0-4a93-9626-f3519a16f2b0',
    reason: 'رصيد افتتاحي لتجربة دورة المخزون والوصفات',
    lines: [
      {
        warehouseId,
        stockItemId: item.flour,
        condition: 'available',
        quantity: '20',
        unitCode: 'kg',
      },
      {
        warehouseId,
        stockItemId: item.mozzarella,
        condition: 'available',
        quantity: '8',
        unitCode: 'kg',
      },
      {
        warehouseId,
        stockItemId: item.tomato,
        condition: 'available',
        quantity: '5',
        unitCode: 'l',
      },
      {
        warehouseId,
        stockItemId: item.oil,
        condition: 'available',
        quantity: '4',
        unitCode: 'bottle_750ml',
      },
      {
        warehouseId,
        stockItemId: item.mushroom,
        condition: 'available',
        quantity: '10',
        unitCode: 'kg',
      },
    ],
  });
}

async function ensureDemoImage(merchantId: string) {
  const storageKey = `${merchantId}/demo/arabic-pizza.png`;
  const existing = await client.mediaAsset.findUnique({
    where: { merchantId_storageKey: { merchantId, storageKey } },
  });
  if (existing) {
    if (existing.createdBy !== DEMO.actor)
      throw new Error('The demo image path is already used by other data.');
    await ensureImageFile(storageKey);
    return existing;
  }

  const bytes = createPizzaImage();
  await ensureImageFile(storageKey, bytes);
  try {
    return await client.mediaAsset.create({
      data: {
        merchantId,
        storageKey,
        publicUrl: mediaStorage.publicUrl(storageKey),
        mimeType: 'image/png',
        sizeBytes: bytes.length,
        createdBy: DEMO.actor,
      },
    });
  } catch (error) {
    await mediaStorage.remove(storageKey).catch(() => undefined);
    throw error;
  }
}

async function ensureImageFile(storageKey: string, bytes?: Buffer) {
  const storagePath = resolve(appConfiguration.mediaStorageDirectory, ...storageKey.split('/'));
  try {
    await access(storagePath);
    return;
  } catch {
    if (!bytes)
      throw new Error('The demo image file is missing; rerun after restoring local uploads.');
  }
  await mediaStorage.write(storageKey, bytes!);
}

async function ensureCategory(merchantId: string, imageAssetId: string) {
  const found = await client.category.findFirst({ where: { merchantId, name: 'بيتزا ومخبوزات' } });
  if (found) {
    if (found.createdBy !== DEMO.actor)
      throw new Error('The demo category name is already used by other data.');
    return found;
  }
  return categories.create(merchantId, DEMO.actor, {
    name: 'بيتزا ومخبوزات',
    description: 'منتجات المخبوزات ووصفاتها التجريبية.',
    imageAssetId,
    availability: 'available',
  });
}

async function ensureRecipeProduct(
  merchantId: string,
  imageAssetId: string,
  categoryId: string,
  item: Awaited<ReturnType<typeof ensureStockItems>>,
) {
  const found = await client.product.findFirst({
    where: { merchantId, name: DEMO.productName },
    select: { id: true, name: true, createdBy: true },
  });
  if (found) {
    if (found.createdBy !== DEMO.actor)
      throw new Error('The demo product name is already used by other data.');
    return found;
  }

  const smallVariantId = randomUUID();
  const largeVariantId = randomUUID();
  const input: CatalogProductFields = {
    name: DEMO.productName,
    description: 'بيتزا تدريبية بوصفة مرتبطة بأصناف المخزون.',
    basePrice: '180.00',
    availability: 'available',
    imageAssetIds: [imageAssetId],
    primaryImageAssetId: imageAssetId,
    categoryIds: [categoryId],
    variants: [
      {
        id: smallVariantId,
        name: 'صغيرة',
        price: '180.00',
        availability: 'available',
        position: 0,
        attributes: [{ name: 'الحجم', value: 'صغيرة' }],
      },
      {
        id: largeVariantId,
        name: 'كبيرة',
        price: '260.00',
        availability: 'available',
        position: 1,
        attributes: [{ name: 'الحجم', value: 'كبيرة' }],
      },
    ],
    inventoryConfiguration: {
      mode: 'RECIPE',
      targets: [
        {
          variantId: smallVariantId,
          components: [
            { stockItemId: item.flour, unitCode: 'g', quantity: '150' },
            { stockItemId: item.mozzarella, unitCode: 'g', quantity: '80' },
            { stockItemId: item.tomato, unitCode: 'ml', quantity: '60' },
            { stockItemId: item.oil, unitCode: 'ml', quantity: '5' },
            { stockItemId: item.mushroom, unitCode: 'g', quantity: '20' },
          ],
        },
        {
          variantId: largeVariantId,
          components: [
            { stockItemId: item.flour, unitCode: 'g', quantity: '230' },
            { stockItemId: item.mozzarella, unitCode: 'g', quantity: '130' },
            { stockItemId: item.tomato, unitCode: 'ml', quantity: '90' },
            { stockItemId: item.oil, unitCode: 'ml', quantity: '8' },
            { stockItemId: item.mushroom, unitCode: 'g', quantity: '35' },
          ],
        },
      ],
    },
  };
  return products.create(merchantId, DEMO.actor, input);
}

async function ensurePosEmployee(merchantId: string, branchId: string) {
  const existing = await client.posEmployee.findUnique({
    where: { merchantId_username: { merchantId, username: DEMO.employeeUsername } },
    select: { id: true, createdBy: true },
  });
  if (existing) {
    if (existing.createdBy !== DEMO.actor)
      throw new Error('The demo employee username is already used by other data.');
    return existing;
  }
  return employees.create(merchantId, DEMO.actor, {
    username: DEMO.employeeUsername,
    displayName: 'كاشير التدريب',
    password: DEMO.password,
    branchIds: [branchId],
  });
}

async function ensureSampleRecipeOrder(merchantId: string, productId: string) {
  const existing = await client.storefrontOrder.findFirst({
    where: {
      merchantId,
      customerName: DEMO.sampleOrderCustomerName,
      customerPhone: DEMO.sampleOrderCustomerPhone,
    },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  const largeVariant = await client.productVariant.findFirst({
    where: { merchantId, productId, name: 'كبيرة', availability: 'available' },
    select: { id: true },
  });
  if (!largeVariant) throw new Error('The demo large pizza variant is missing or unavailable.');

  const orders = new StorefrontOrdersService(persistence, new ProductPricingService(persistence));
  return orders.create(DEMO.slug, {
    customerName: DEMO.sampleOrderCustomerName,
    customerPhone: DEMO.sampleOrderCustomerPhone,
    fulfillmentType: 'pickup',
    items: [{ productId, variantId: largeVariant.id, selections: [], quantity: 1 }],
  });
}

function createPizzaImage(): Buffer {
  const width = 360;
  const height = 240;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = 255;
  };
  const inside = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  for (let y = 0; y < height; y += 1) {
    pixels[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const color: [number, number, number] = y > 194 ? [43, 76, 61] : [247, 237, 216];
      if (inside(x, y, 180, 128, 138, 78)) {
        const radius = ((x - 180) / 118) ** 2 + ((y - 122) / 60) ** 2;
        color.splice(0, 3, ...(radius < 0.83 ? [227, 170, 63] : [244, 232, 199]));
      }
      if (inside(x, y, 180, 118, 104, 48)) color.splice(0, 3, 196, 76, 48);
      if (inside(x, y, 180, 114, 96, 41)) color.splice(0, 3, 239, 194, 83);
      const toppings = [
        [137, 103, 8],
        [176, 94, 7],
        [215, 111, 8],
        [156, 135, 7],
        [200, 136, 9],
        [232, 91, 6],
      ];
      if (toppings.some(([cx, cy, radius]) => (x - cx!) ** 2 + (y - cy!) ** 2 < radius! ** 2)) {
        color.splice(0, 3, 194, 69, 49);
      }
      setPixel(x, y, color);
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', Buffer.from([0, 0, 1, 104, 0, 0, 0, 240, 8, 6, 0, 0, 0])),
    pngChunk('IDAT', deflateSync(pixels, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function crc32(data: Buffer): number {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}
