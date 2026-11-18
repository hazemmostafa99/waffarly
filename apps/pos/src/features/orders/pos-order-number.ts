type PosOrderNumberSource = {
  id: string;
  branchOrderNumber?: number | null | undefined;
  orderReference?: string | null | undefined;
};

/** Returns the branch-session number, with a stable fallback for historical orders. */
export function getPosOrderNumber(order: PosOrderNumberSource): string {
  if (Number.isSafeInteger(order.branchOrderNumber) && (order.branchOrderNumber ?? 0) > 0)
    return String(order.branchOrderNumber);

  const legacySequence = order.orderReference?.match(/^B\d+-\d{8}-(\d+)$/)?.[1];
  return legacySequence ? String(Number(legacySequence)) : order.id.slice(0, 6).toUpperCase();
}
