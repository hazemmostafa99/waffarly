import type { PosCheckTender, PosTenderMethod } from '@waffarly/contracts';

export interface PosTenderDraft {
  id: string;
  method: PosTenderMethod;
  amount: string;
  receivedAmount: string;
}

export interface PosTenderPreview {
  tenders: PosCheckTender[];
  appliedCents: bigint;
  changeCents: bigint;
  balanceAfterCents: bigint;
}

export type PosTenderFieldErrors = Record<
  string,
  Partial<Record<'amount' | 'receivedAmount', string>>
>;

export function parseMoneyCents(value: string): bigint | null {
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = BigInt(match[1]!);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  return whole * 100n + fraction;
}

export function formatMoneyCents(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function previewPosTenders(
  drafts: PosTenderDraft[],
  balanceDue: string,
): { preview: PosTenderPreview | null; error: string | null; fieldErrors: PosTenderFieldErrors } {
  const fieldErrors: PosTenderFieldErrors = {};
  const dueCents = parseMoneyCents(balanceDue);
  if (dueCents === null || dueCents <= 0n) {
    return { preview: null, error: 'This check has no remaining balance.', fieldErrors };
  }
  if (drafts.length === 0 || drafts.length > 4) {
    return { preview: null, error: 'Add between one and four payment methods.', fieldErrors };
  }

  let appliedCents = 0n;
  let changeCents = 0n;
  const tenders: PosCheckTender[] = [];
  for (const draft of drafts) {
    const amountCents = parseMoneyCents(draft.amount);
    if (amountCents === null || amountCents <= 0n) {
      fieldErrors[draft.id] = { amount: 'Enter a positive amount with up to two decimal places.' };
      continue;
    }
    appliedCents += amountCents;
    if (draft.method === 'cash') {
      const receivedCents = parseMoneyCents(draft.receivedAmount);
      if (receivedCents === null || receivedCents < amountCents) {
        fieldErrors[draft.id] = { receivedAmount: 'Cash received must cover the payment amount.' };
        continue;
      }
      changeCents += receivedCents - amountCents;
      tenders.push({
        method: 'cash',
        amount: formatMoneyCents(amountCents),
        receivedAmount: formatMoneyCents(receivedCents),
      });
    } else {
      tenders.push({ method: 'terminal', amount: formatMoneyCents(amountCents) });
    }
  }
  const firstFieldError = Object.values(fieldErrors)[0];
  if (firstFieldError) {
    return {
      preview: null,
      error: firstFieldError.amount ?? firstFieldError.receivedAmount ?? null,
      fieldErrors,
    };
  }
  if (appliedCents > dueCents) {
    return { preview: null, error: 'Payment cannot exceed the remaining balance.', fieldErrors };
  }
  return {
    preview: {
      tenders,
      appliedCents,
      changeCents,
      balanceAfterCents: dueCents - appliedCents,
    },
    error: null,
    fieldErrors,
  };
}
