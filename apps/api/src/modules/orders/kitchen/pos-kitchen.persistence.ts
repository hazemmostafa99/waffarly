import type { Prisma } from '@waffarly/database';
import { ConflictException } from '@nestjs/common';

export const posKitchenTicketInclude = {
  include: {
    station: { select: { id: true, name: true } },
    cancellationAcknowledgedBy: { select: { id: true, displayName: true } },
  },
} satisfies Prisma.PosKitchenTicketDefaultArgs;

export async function createPosKitchenTicket(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    branchId: string;
    orderId: string;
    dispatchMode: 'automatic' | 'manual' | 'legacy';
    dispatchedByPosEmployeeId: string | null;
    dispatchedAt?: Date;
  },
) {
  const existing = await tx.posKitchenTicket.findUnique({
    where: { orderId_merchantId: { orderId: input.orderId, merchantId: input.merchantId } },
    select: { id: true },
  });
  if (existing) return existing;

  const station = await tx.posKitchenStation.upsert({
    where: {
      merchantId_branchId_code: {
        merchantId: input.merchantId,
        branchId: input.branchId,
        code: 'default',
      },
    },
    create: {
      merchantId: input.merchantId,
      branchId: input.branchId,
      code: 'default',
      name: 'Kitchen',
    },
    update: {},
    select: { id: true, active: true },
  });
  if (!station.active) throw new ConflictException('The default kitchen station is inactive.');

  return tx.posKitchenTicket.create({
    data: {
      merchantId: input.merchantId,
      branchId: input.branchId,
      stationId: station.id,
      orderId: input.orderId,
      dispatchMode: input.dispatchMode,
      dispatchedByPosEmployeeId: input.dispatchedByPosEmployeeId,
      ...(input.dispatchedAt ? { dispatchedAt: input.dispatchedAt } : {}),
    },
    select: { id: true },
  });
}
