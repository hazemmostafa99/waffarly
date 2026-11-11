import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { config } from '../apps/api/node_modules/dotenv/lib/main.js';
import { PrismaClient, createPostgresAdapter } from '../packages/database/src/index.js';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
if (!process.argv.includes('--apply-reference-demo')) throw new Error('Use --apply-reference-demo to import dedicated reference tenants.');
if (process.env.NODE_ENV === 'production') throw new Error('Reference seed is development/demo only.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const data = JSON.parse(await readFile(new URL('./data/marketplace-restaurants-v1.json', import.meta.url), 'utf8'));
const id = (key: string) => { const h = createHash('sha256').update('waffarly-reference-v1:'+key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
const actor = 'marketplace-reference-v1';
const client = new PrismaClient({ adapter: createPostgresAdapter(process.env.DATABASE_URL) });
try {
  const metadata = new Map<string, { mimeType: string; sizeBytes: number }>();
  const urls = new Set<string>();
  for (const restaurant of data.restaurants) { urls.add(restaurant.logo.src); urls.add(restaurant.cover.src); }
  for (const product of data.products) urls.add(product.image.src);
  await Promise.all([...urls].map(async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Reference image download failed; no placeholder used.');
    const mimeType = response.headers.get('content-type')?.split(';')[0];
    const sizeBytes = (await response.arrayBuffer()).byteLength;
    if (!mimeType || !['image/jpeg','image/png','image/webp'].includes(mimeType) || !sizeBytes) throw new Error('Unsupported reference image.');
    metadata.set(url, { mimeType, sizeBytes });
  }));
  await client.$transaction(async (db) => {
    for (const [index, restaurant] of data.restaurants.entries()) {
      const merchantId = id(`merchant:${index}`), slug = `reference-restaurant-${index+1}`;
      const existing = await db.merchant.findUnique({ where: { storefrontSlug: slug }, select: { id: true } });
      if (existing && existing.id !== merchantId) throw new Error(`Reference slug already belongs to another merchant: ${slug}`);
      await db.merchant.upsert({ where: { id: merchantId }, create: { id: merchantId, name: restaurant.name, storefrontSlug: slug, activity: 'restaurant', contactPhone: 'DEMO-NOT-CONTACTABLE', ownerName: 'Reference demo', ownerMobile: 'DEMO-NOT-CONTACTABLE' }, update: { name: restaurant.name } });
      const times = restaurant.time.match(/\d+/g).map(Number);
      const settings = { description: restaurant.meta, cuisines: restaurant.meta.split('•').map((value: string) => value.trim()), logoImage: restaurant.logo, coverImage: restaurant.cover,
        published: true, displayOrder: index, timezone: 'Africa/Cairo', alwaysOpen: index !== data.restaurants.length-1, ordersPaused: index === data.restaurants.length-1,
        pauseReason: index === data.restaurants.length-1 ? 'مغلق في العرض التجريبي' : null,
        deliveryEnabled: true, pickupEnabled: true, deliveryFee: '25.00', minimumDeliveryOrder: '100.00',
        deliveryTimeMinMinutes: times[0], deliveryTimeMaxMinutes: times[1], referenceData: { origin: 'local-mock', version: 1, ...restaurant }, updatedBy: actor };
      await db.restaurantProfile.upsert({ where: { merchantId }, create: { merchantId, ...settings }, update: { ...settings, revision: { increment: 1 } } });
      const media = async (image: {src:string;alt:string}) => {
        const assetId = id(`${index}:media:${image.src}`);
        await db.mediaAsset.upsert({ where: { id: assetId }, create: { id: assetId, merchantId, storageKey: `reference-v1/${index}/${assetId}`, publicUrl: image.src, ...metadata.get(image.src)!, createdBy: actor }, update: { publicUrl: image.src } });
        return assetId;
      };
      await media(restaurant.logo);
      await media(restaurant.cover);
      for (const [position, product] of data.products.filter((entry: {merchantName:string}) => entry.merchantName === restaurant.name).entries()) {
        const productId = id(product.id), categoryId = id(`${index}:category:${product.menuSection}`), mediaId = await media(product.image);
        await db.category.upsert({ where: { id: categoryId }, create: { id: categoryId, merchantId, name: product.menuSection, imageAssetId: mediaId, availability: 'available', displayOrder: product.menuSection === 'الوجبات' ? 0 : product.menuSection === 'أطباق جانبية' ? 1 : 2, createdBy: actor, updatedBy: actor }, update: {} });
        const fields = { name: product.name, description: product.description, basePrice: product.price.toFixed(2), availability: product.available ? 'available' : 'unavailable', menuSectionId: categoryId, displayOrder: position, updatedBy: actor };
        await db.product.upsert({ where: { id: productId }, create: { id: productId, merchantId, referenceKey: product.id, ...fields, createdBy: actor }, update: { ...fields, revision: { increment: 1 } } });
        await db.productCategory.upsert({ where: { productId_categoryId: { productId, categoryId } }, create: { productId, categoryId, merchantId }, update: {} });
        await db.productImage.upsert({ where: { productId_mediaAssetId: { productId, mediaAssetId: mediaId } }, create: { id: id(product.id+':image'), productId, mediaAssetId: mediaId, merchantId, isPrimary: true, position: 0 }, update: { isPrimary: true } });
        const drink = product.menuSection === 'مشروبات';
        for (const [vpos, variant] of [{ name: 'عادي', extra: 0 }, { name: 'كبير', extra: drink ? 15 : 40 }].entries()) {
          const fields = { name: variant.name, price: (product.price+variant.extra).toFixed(2), availability: 'available', position: vpos };
          await db.productVariant.upsert({ where: { id: id(product.id+':variant:'+vpos) }, create: { id: id(product.id+':variant:'+vpos), productId, merchantId, ...fields }, update: fields });
        }
        const groupId = id(`${index}:extras:${drink}`), assignmentId = id(product.id+':extras');
        await db.modifierGroup.upsert({ where: { id: groupId }, create: { id: groupId, merchantId, name: 'إضافات' }, update: {} });
        await db.productModifierGroupAssignment.upsert({ where: { id: assignmentId }, create: { id: assignmentId, productId, merchantId, modifierGroupId: groupId, selectionMode: 'multiple', minSelections: 0, maxSelections: 2, position: 0 }, update: {} });
        for (const [opos, option] of (drink ? [{name:'حليب إضافي',price:5},{name:'كراميل',price:10}] : [{name:'جبنة إضافية',price:20},{name:'صوص إضافي',price:10}]).entries()) {
          const optionId = id(`${index}:extras:${drink}:${opos}`);
          await db.modifierOption.upsert({ where: { id: optionId }, create: { id: optionId, groupId, merchantId, name: option.name, position: opos }, update: {} });
          await db.productModifierGroupAssignmentOption.upsert({ where: { assignmentId_optionId: { assignmentId, optionId } }, create: { assignmentId, optionId, modifierGroupId: groupId, merchantId, priceAdjustment: option.price.toFixed(2), defaultSelected: false }, update: { priceAdjustment: option.price.toFixed(2) } });
        }
      }
    }
  }, { timeout: 120000 });
  console.log('Imported reference demo: 12 restaurants, 41 products, 82 variants; original image URLs retained. No owner credentials or subscriptions created.');
} finally { await client.$disconnect(); }
