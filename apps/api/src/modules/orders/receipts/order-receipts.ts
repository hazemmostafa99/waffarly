/**
 * Saves an immutable receipt inside the payment transaction and reads its stored snapshot.
 */
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { PosEmployeeSession, PosReceipt } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { randomUUID } from 'node:crypto';

import { buildPosReceiptSnapshot } from './pos-receipt.mapper.js';

const posReceiptOrderInclude = {
  merchant: { select: { name: true } },
  branch: { select: { name: true } },
  posShift: { include: { register: { select: { name: true } } } },
  diningSession: { include: { table: { select: { code: true } } } },
  lines: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
    },
  },
} satisfies Prisma.StorefrontOrderInclude;

export async function issueSettledCheckReceipt(
  tx: Prisma.TransactionClient,
  employee: PosEmployeeSession,
  orderId: string,
  checkId: string,
  issuedAt: Date,
): Promise<PosReceipt> {
  const check = await tx.posOrderCheck.findFirst({
    where: { id: checkId, orderId, merchantId: employee.merchantId },
    include: {
      order: { include: posReceiptOrderInclude },
      allocations: {
        include: {
          orderLine: {
            include: {
              selections: {
                orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }],
              },
              variantAttributes: { orderBy: { position: 'asc' } },
            },
          },
        },
      },
      payments: { orderBy: [{ createdAt: 'asc' }, { position: 'asc' }] },
    },
  });
  if (!check) throw new NotFoundException('The check was not found.');
  const receiptId = randomUUID();
  const receiptNumber = `POS-${receiptId.replaceAll('-', '').slice(0, 16).toUpperCase()}`;
  const toItem = (line: (typeof check.order.lines)[number], quantity: number, total: string) => ({
    name: line.productName,
    variantName:
      [
        line.variantName,
        ...line.variantAttributes.map(
          (attribute) => `${attribute.attributeName}: ${attribute.attributeValue}`,
        ),
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ') || null,
    selections: line.selections.map(
      (selection) =>
        `${selection.groupName}: ${selection.optionName}${selection.quantity > 1 ? ` ×${selection.quantity}` : ''}`,
    ),
    quantity,
    unitPrice: line.unitPrice.toString(),
    total,
  });
  const items =
    check.splitMethod === 'whole'
      ? check.order.lines.map((line) => toItem(line, line.quantity, line.lineTotal.toString()))
      : check.splitMethod === 'items'
        ? [...check.allocations]
            .sort((left, right) => left.orderLine.position - right.orderLine.position)
            .map((allocation) =>
              toItem(allocation.orderLine, allocation.quantity, allocation.amount.toString()),
            )
        : [];
  const splitMethod = ['whole', 'items', 'equal', 'custom'].includes(check.splitMethod)
    ? (check.splitMethod as PosReceipt['splitMethod'])
    : null;
  if (!splitMethod)
    throw new InternalServerErrorException('The POS check split method is invalid.');
  const receipt = buildPosReceiptSnapshot({
    id: receiptId,
    receiptNumber,
    issuedAt,
    merchantName: check.order.merchant.name,
    branchName: check.order.branch?.name ?? null,
    orderId: check.order.id,
    orderReference: check.order.orderReference,
    orderCreatedAt: check.order.createdAt,
    fulfillmentType: check.order.fulfillmentType as PosReceipt['fulfillmentType'],
    tableCode: check.order.diningSession?.table.code ?? null,
    cashierName: employee.displayName,
    registerName: check.order.posShift?.register.name ?? null,
    currency: check.order.currency,
    checkNumber: check.position + 1,
    splitMethod,
    amount: check.amount.toString(),
    items,
    payments: check.payments.map((payment) => ({
      method: payment.method as 'cash' | 'terminal',
      amount: payment.amount.toString(),
      receivedAmount: payment.receivedAmount.toString(),
      changeAmount: payment.changeAmount.toString(),
      ...(payment.cashCustody === 'courier' ? { cashCustody: 'courier' as const } : {}),
    })),
  });
  await tx.posCheckReceipt.create({
    data: {
      id: receipt.id,
      merchantId: employee.merchantId,
      orderId,
      checkId,
      createdByEmployeeId: employee.id,
      receiptNumber: receipt.receiptNumber,
      issuedAt,
      snapshot: receipt as unknown as Prisma.InputJsonValue,
    },
  });
  return receipt;
}

export function parseStoredPosReceipt(value: Prisma.JsonValue): PosReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InternalServerErrorException('The POS receipt snapshot is invalid.');
  }
  const receipt = value as unknown as PosReceipt;
  if (
    receipt.version !== 1 ||
    typeof receipt.id !== 'string' ||
    typeof receipt.receiptNumber !== 'string' ||
    typeof receipt.issuedAt !== 'string' ||
    typeof receipt.amount !== 'string' ||
    receipt.currency !== 'EGP' ||
    !Array.isArray(receipt.items) ||
    !Array.isArray(receipt.payments)
  ) {
    throw new InternalServerErrorException('The POS receipt snapshot is invalid.');
  }
  return receipt;
}
