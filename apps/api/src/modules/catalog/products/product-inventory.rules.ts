import { BadRequestException } from '@nestjs/common';
import type {
  CatalogProductInventoryConfigurationFields,
  ProductInventoryMode,
} from '@waffarly/contracts';
import { normalizeStockQuantity } from '../../inventory/index.js';

export function defaultInventoryModeForActivity(activity: string): ProductInventoryMode {
  return activity === 'restaurant' ? 'RECIPE' : 'DIRECT';
}

export function assertInventoryConfigurationShape(
  configuration: CatalogProductInventoryConfigurationFields,
): void {
  if (!configuration.targets.length) {
    throw new BadRequestException('Inventory configuration must cover every sellable product.');
  }
  const targetIds = configuration.targets.map((target) => target.variantId ?? 'product');
  if (new Set(targetIds).size !== targetIds.length) {
    throw new BadRequestException('Each product or variant can have only one inventory target.');
  }
  for (const target of configuration.targets) {
    if (!target.components.length) {
      throw new BadRequestException('Every inventory target needs at least one stock item.');
    }
    if (configuration.mode === 'DIRECT' && target.components.length !== 1) {
      throw new BadRequestException(
        'Direct inventory requires exactly one stock item per sellable.',
      );
    }
    for (const component of target.components) {
      try {
        normalizeStockQuantity(component.quantity);
      } catch {
        throw new BadRequestException(
          'Inventory quantities must be positive with up to 6 decimals.',
        );
      }
    }
  }
}

export function inventoryConfigurationMatches(
  configuration: CatalogProductInventoryConfigurationFields,
  current: {
    mode: string;
    targets: Array<{
      variantId: string | null;
      components: Array<{ stockItemId: string; unitCode: string; quantity: string }>;
    }>;
  } | null,
): boolean {
  if (!current || configuration.mode !== current.mode) return false;
  const normalizedTargets = (targets: typeof configuration.targets) =>
    targets
      .map((target) => ({
        variantId: target.variantId,
        components: target.components.map((component) => ({
          stockItemId: component.stockItemId,
          unitCode: component.unitCode,
          quantity: normalizeStockQuantity(component.quantity),
        })),
      }))
      .sort((left, right) => (left.variantId ?? '').localeCompare(right.variantId ?? ''));
  const requested = normalizedTargets(configuration.targets);
  const saved = normalizedTargets(current.targets);
  return JSON.stringify(requested) === JSON.stringify(saved);
}
