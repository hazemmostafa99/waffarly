import { BadRequestException } from '@nestjs/common';
import type { CatalogProductQuoteSelection } from '@waffarly/contracts';

/** Legacy selected IDs mean one; metadata may only quantify an explicitly selected ID. */
export function selectedOptionQuantities(
  selection: CatalogProductQuoteSelection,
): Map<string, number> {
  if (
    selection.optionIds.length > 100 ||
    new Set(selection.optionIds).size !== selection.optionIds.length
  ) {
    throw new BadRequestException('Modifier options must be unique within a group.');
  }
  const quantities = new Map(selection.optionIds.map((id) => [id, 1]));
  const seen = new Set<string>();
  for (const entry of selection.optionQuantities ?? []) {
    if (
      seen.has(entry.optionId) ||
      !quantities.has(entry.optionId) ||
      !Number.isSafeInteger(entry.quantity) ||
      entry.quantity < 1 ||
      entry.quantity > 99
    ) {
      throw new BadRequestException(
        'Modifier quantities must uniquely reference selected options and be whole numbers between 1 and 99.',
      );
    }
    seen.add(entry.optionId);
    quantities.set(entry.optionId, entry.quantity);
  }
  return quantities;
}
