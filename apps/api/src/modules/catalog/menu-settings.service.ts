import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
const item = z.object({ id: z.uuid(), revision: z.number().int().positive(), displayOrder: z.number().int().nonnegative() });
export const menuSettingsSchema = z.object({
  categories: z.array(item.strict()).max(100),
  products: z.array(item.extend({ availability: z.enum(['available','unavailable']), menuSectionId: z.uuid().nullable() }).strict()).max(100),
}).strict().refine((body) => new Set(body.categories.map((entry) => entry.id)).size === body.categories.length && new Set(body.products.map((entry) => entry.id)).size === body.products.length, 'Duplicate menu entries.');
@Injectable()
export class MenuSettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async save(merchantId: string, actor: string, input: z.infer<typeof menuSettingsSchema>) {
    await this.prisma.$transaction(async (db) => {
      if (!await db.merchant.findFirst({ where: { id: merchantId, activity: 'restaurant' }, select: { id: true } })) throw new BadRequestException('This operation requires a restaurant.');
      for (const entry of [...input.categories].sort((a,b) => a.id.localeCompare(b.id))) {
        const result = await db.category.updateMany({ where: { id: entry.id, merchantId, revision: entry.revision, archivedAt: null }, data: { displayOrder: entry.displayOrder, updatedBy: actor, revision: { increment: 1 } } });
        if (result.count !== 1) throw new ConflictException('A category changed. Reload the menu.');
      }
      for (const entry of [...input.products].sort((a,b) => a.id.localeCompare(b.id))) {
        if (entry.menuSectionId) {
          const link = await db.productCategory.findFirst({ where: { merchantId, productId: entry.id, categoryId: entry.menuSectionId, category: { archivedAt: null } }, select: { categoryId: true } });
          if (!link) throw new BadRequestException('The menu section must be an active category already assigned to this product.');
        }
        const result = await db.product.updateMany({ where: { id: entry.id, merchantId, revision: entry.revision, archivedAt: null }, data: { displayOrder: entry.displayOrder, availability: entry.availability, menuSectionId: entry.menuSectionId, updatedBy: actor, revision: { increment: 1 } } });
        if (result.count !== 1) throw new ConflictException('A product changed. Reload the menu.');
      }
    });
    return { saved: true };
  }
}
