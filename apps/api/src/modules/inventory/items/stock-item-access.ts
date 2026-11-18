/** Checks that the stock item belongs to this merchant and may still be edited. */
import { ConflictException, NotFoundException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

export async function assertMutableItem(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  id: string,
): Promise<never> {
  const item = await transaction.stockItem.findFirst({
    where: { id, merchantId },
    select: { id: true },
  });
  if (!item) throw new NotFoundException('Stock item was not found.');
  throw new ConflictException(
    'Stock item changed or has an incompatible status. Reload it before trying again.',
  );
}
