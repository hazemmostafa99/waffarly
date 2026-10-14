import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotEnv } from 'dotenv';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import {
  catalogSeedImages,
  catalogSeedStorageKey,
  seedRestaurantCatalog,
} from './catalog-seed-data.js';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
loadDotEnv({ path: resolve(packageDirectory, '../../../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the catalog.');

const requestedSlug = readOption('--merchant-slug') ?? process.env.CATALOG_SEED_MERCHANT_SLUG;
const mediaRoot = resolve(process.cwd(), process.env.MEDIA_STORAGE_DIRECTORY ?? './uploads/catalog');
const publicApiBaseUrl = process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });

try {
  const merchant = await resolveMerchant(requestedSlug);
  await writeSeedImages(mediaRoot);
  const result = await client.$transaction((transaction) =>
    seedRestaurantCatalog(transaction, merchant.id, publicApiBaseUrl),
  );
  console.log(
    `Catalog seed complete for "${merchant.name}" (/${merchant.storefrontSlug}). Created ${result.created.categories} categories, ${result.created.products} products and ${result.created.media} media assets. Persistent totals: ${result.totals.categories} categories, ${result.totals.products} products, ${result.totals.variants} variants.`,
  );
} finally {
  await client.$disconnect();
}

async function resolveMerchant(slug: string | undefined) {
  if (slug) {
    const merchant = await client.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true, name: true, storefrontSlug: true },
    });
    if (!merchant) throw new Error(`No merchant was found with storefront slug "${slug}".`);
    return merchant;
  }
  const merchants = await client.merchant.findMany({
    orderBy: { createdAt: 'asc' },
    take: 2,
    select: { id: true, name: true, storefrontSlug: true },
  });
  if (merchants.length === 0) {
    throw new Error('No merchant exists yet. Create a merchant first, then run this seed with --merchant-slug <slug>.');
  }
  if (merchants.length > 1) {
    throw new Error(
      `More than one merchant exists. Re-run with --merchant-slug <slug> to choose a store; available examples: ${merchants.map((merchant) => merchant.storefrontSlug).join(', ')}.`,
    );
  }
  return merchants[0]!;
}

async function writeSeedImages(storageRoot: string): Promise<void> {
  for (const [index, image] of catalogSeedImages.entries()) {
    const filePath = resolve(storageRoot, ...catalogSeedStorageKey(image.key).split('/'));
    await mkdir(dirname(filePath), { recursive: true });
    try {
      await writeFile(filePath, createMenuImage(image.color, index), { flag: 'wx' });
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    }
  }
}

function readOption(option: string): string | undefined {
  const index = process.argv.indexOf(option);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value?.trim() || undefined;
}

function createMenuImage(base: [number, number, number], seed: number): Buffer {
  const width = 480;
  const height = 320;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  const accent: [number, number, number] = [
    Math.min(255, base[0] + 30),
    Math.min(255, base[1] + 30),
    Math.min(255, base[2] + 30),
  ];
  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = 255;
  };
  for (let y = 0; y < height; y += 1) {
    pixels[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const shade = Math.floor((y / height) * 16);
      setPixel(x, y, [Math.max(0, base[0] - shade), Math.max(0, base[1] - shade), Math.max(0, base[2] - shade)]);
    }
  }
  fillRect(0, 236, width, 84, [55, 74, 59]);
  fillEllipse(240, 188, 148, 66, [242, 238, 225]);
  fillEllipse(240, 179, 109, 38, accent);
  fillRoundedRect(148, 159, 184, 36, 12, [244, 193, 78]);
  fillRoundedRect(161, 190, 158, 17, 5, [54, 91, 52]);
  fillRoundedRect(151, 207, 178, 19, 6, [128, 65, 39]);
  fillEllipse(185 + (seed % 4) * 28, 146, 23, 9, [250, 223, 111]);
  fillEllipse(275 - (seed % 3) * 25, 144, 20, 8, [244, 225, 112]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', Buffer.from([0, 0, 1, 224, 0, 0, 1, 64, 8, 6, 0, 0, 0])),
    pngChunk('IDAT', deflateSync(pixels, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  function fillRect(x: number, y: number, rectWidth: number, rectHeight: number, color: [number, number, number]) {
    for (let row = y; row < y + rectHeight; row += 1) {
      for (let column = x; column < x + rectWidth; column += 1) setPixel(column, row, color);
    }
  }

  function fillEllipse(centerX: number, centerY: number, radiusX: number, radiusY: number, color: [number, number, number]) {
    for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
      for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
        if (((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 <= 1) setPixel(x, y, color);
      }
    }
  }

  function fillRoundedRect(x: number, y: number, rectWidth: number, rectHeight: number, radius: number, color: [number, number, number]) {
    for (let row = y; row < y + rectHeight; row += 1) {
      for (let column = x; column < x + rectWidth; column += 1) {
        const edgeX = Math.max(x + radius - column, column - (x + rectWidth - radius - 1), 0);
        const edgeY = Math.max(y + radius - row, row - (y + rectHeight - radius - 1), 0);
        if (edgeX ** 2 + edgeY ** 2 <= radius ** 2) setPixel(column, row, color);
      }
    }
  }
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
