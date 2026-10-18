import { BadRequestException } from '@nestjs/common';
import type { PosCheckTender } from '@waffarly/contracts';
import { formatCents, toCents } from '../../common/money/money.js';

export interface NormalizedTender {
  method: PosCheckTender['method'];
  amount: string;
  receivedAmount: string;
  changeAmount: string;
  terminalReference: string | null;
}

export function normalizeTenders(
  tenders: PosCheckTender[],
  balanceDue: string,
): NormalizedTender[] {
  const dueCents = toCents(balanceDue);
  let appliedCents = 0n;
  const normalized = tenders.map((tender) => {
    const amountCents = toCents(tender.amount);
    if (amountCents <= 0n) throw new BadRequestException('Each tender amount must be positive.');
    appliedCents += amountCents;
    if (tender.method === 'cash') {
      const receivedCents = toCents(tender.receivedAmount);
      if (receivedCents < amountCents)
        throw new BadRequestException('Cash received cannot be less than the amount applied.');
      return {
        method: tender.method,
        amount: formatCents(amountCents),
        receivedAmount: formatCents(receivedCents),
        changeAmount: formatCents(receivedCents - amountCents),
        terminalReference: null,
      };
    }
    return {
      method: tender.method,
      amount: formatCents(amountCents),
      receivedAmount: formatCents(amountCents),
      changeAmount: '0.00',
      terminalReference: tender.terminalReference?.trim() || null,
    };
  });
  if (appliedCents > dueCents)
    throw new BadRequestException('The tender total exceeds the check balance.');
  return normalized;
}
