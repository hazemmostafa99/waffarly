/** Divides a bill into exact item, equal or custom amounts without losing order value. */
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { SplitPosOrderChecksRequest } from '@waffarly/contracts';
import { toCents } from '../../../common/money/money.js';
export function buildCheckValues(
  lines: Array<{ id: string; quantity: number; unitPrice: { toString(): string } }>,
  orderTotal: string,
  request: SplitPosOrderChecksRequest,
): Array<{
  amountCents: bigint;
  allocations: Array<{ orderLineId: string; quantity: number; amountCents: bigint }>;
}> {
  const totalCents = toCents(orderTotal);
  if (request.method === 'equal') {
    if (BigInt(request.checkCount) > totalCents)
      throw new BadRequestException('The total is too small for that many separate checks.');
    const each = totalCents / BigInt(request.checkCount);
    let remainder = totalCents % BigInt(request.checkCount);
    return Array.from({ length: request.checkCount }, () => {
      const amountCents = each + (remainder > 0n ? 1n : 0n);
      if (remainder > 0n) remainder -= 1n;
      return { amountCents, allocations: [] };
    });
  }
  if (request.method === 'custom') {
    const amounts = request.amounts.map((value) => toCents(value));
    if (amounts.some((value) => value <= 0n))
      throw new BadRequestException('Every check amount must be greater than zero.');
    if (amounts.reduce((sum, value) => sum + value, 0n) !== totalCents)
      throw new BadRequestException('Custom check amounts must equal the complete order total.');
    return amounts.map((amountCents) => ({ amountCents, allocations: [] }));
  }

  const linesById = new Map(lines.map((line) => [line.id, line]));
  const allocated = new Map<string, number>();
  const checks = request.checks.map((check) => {
    const allocations = check.lines.map(({ orderLineId, quantity }) => {
      const line = linesById.get(orderLineId);
      if (!line) throw new BadRequestException('A split references a line outside this order.');
      allocated.set(orderLineId, (allocated.get(orderLineId) ?? 0) + quantity);
      if (allocated.get(orderLineId)! > line.quantity)
        throw new BadRequestException('A check split cannot allocate more items than were sold.');
      return {
        orderLineId,
        quantity,
        amountCents: toCents(line.unitPrice.toString()) * BigInt(quantity),
      };
    });
    return {
      amountCents: allocations.reduce((sum, value) => sum + value.amountCents, 0n),
      allocations,
    };
  });
  if (lines.some((line) => allocated.get(line.id) !== line.quantity))
    throw new BadRequestException('Assign every whole item quantity to exactly one check.');
  if (checks.some((check) => check.amountCents <= 0n))
    throw new BadRequestException('Every item check must include at least one item.');
  if (checks.reduce((sum, check) => sum + check.amountCents, 0n) !== totalCents)
    throw new ConflictException('The order lines do not conserve the saved order total.');
  return checks;
}
