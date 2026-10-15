import { BadRequestException } from '@nestjs/common';
import type { StockBaseUnit, StockItemUnitFields } from '@waffarly/contracts';
import { STOCK_QUANTITY_PATTERN } from '@waffarly/contracts';

const SCALE = 1_000_000n;
export const MAX_STOCK_QUANTITY_SCALED = 999_999_999_999_999_999n;
const units: Record<StockBaseUnit, { dimension: string; factor: bigint }> = {
  piece: { dimension: 'count', factor: 1n },
  g: { dimension: 'mass', factor: 1n },
  kg: { dimension: 'mass', factor: 1000n },
  ml: { dimension: 'volume', factor: 1n },
  l: { dimension: 'volume', factor: 1000n },
};

export function parseStockQuantity(value: string): bigint {
  if (typeof value !== 'string')
    throw new BadRequestException('Quantity must be a decimal string.');
  const match = STOCK_QUANTITY_PATTERN.exec(value);
  if (!match) {
    throw new BadRequestException(
      'Quantity must be a decimal string with up to 12 integer and 6 fractional digits.',
    );
  }
  const scaled = BigInt(match[1]!) * SCALE + BigInt((match[2] ?? '').padEnd(6, '0'));
  if (scaled <= 0n) throw new BadRequestException('Quantity must be greater than zero.');
  return scaled;
}

export function formatStockQuantity(scaled: bigint): string {
  const fraction = (scaled % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return `${scaled / SCALE}${fraction ? `.${fraction}` : ''}`;
}

export function normalizeStockQuantity(value: string): string {
  return formatStockQuantity(parseStockQuantity(value));
}

export function convertToBaseQuantity(
  quantity: string,
  unitCode: string,
  baseUnit: StockBaseUnit,
  packs: readonly StockItemUnitFields[],
): string {
  const amount = parseStockQuantity(quantity);
  const base = units[baseUnit];
  if (!base) throw new BadRequestException('Base unit is invalid.');
  const standard = Object.hasOwn(units, unitCode) ? units[unitCode as StockBaseUnit] : undefined;
  let numerator: bigint;
  let denominator: bigint;
  if (standard) {
    if (standard.dimension !== base.dimension) {
      throw new BadRequestException('Unit is incompatible with this stock item.');
    }
    numerator = amount * standard.factor;
    denominator = base.factor;
  } else {
    const pack = packs.find((candidate) => candidate.code === unitCode);
    if (!pack) throw new BadRequestException('Unit does not belong to this stock item.');
    numerator = amount * parseStockQuantity(pack.baseQuantity);
    denominator = SCALE;
  }
  if (numerator % denominator !== 0n) {
    throw new BadRequestException('Conversion would require rounding beyond 6 decimal places.');
  }
  const result = numerator / denominator;
  if (result > MAX_STOCK_QUANTITY_SCALED)
    throw new BadRequestException('Converted quantity exceeds the supported range.');
  return formatStockQuantity(result);
}
