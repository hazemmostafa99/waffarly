/** Checks whether a merchant branch or warehouse may still be changed. */
import { ConflictException, NotFoundException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

export async function assertMutableBranch(
  client: PrismaService | Prisma.TransactionClient,
  merchantId: string,
  id: string,
): Promise<never> {
  const branch = await client.branch.findFirst({
    where: { id, merchantId },
    select: { id: true },
  });
  if (!branch) throw new NotFoundException('Branch was not found.');
  throw new ConflictException('Branch changed or is archived. Reload it before trying again.');
}

export async function assertMutableWarehouse(
  client: PrismaService | Prisma.TransactionClient,
  merchantId: string,
  branchId: string,
  id: string,
): Promise<never> {
  const warehouse = await client.warehouse.findFirst({
    where: { id, merchantId, branchId },
    select: { id: true },
  });
  if (!warehouse) throw new NotFoundException('Warehouse was not found.');
  throw new ConflictException('Warehouse changed or is archived. Reload it before trying again.');
}
