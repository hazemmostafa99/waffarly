import { mealOptionGroups, restaurantScenario } from '@/features/marketplace/data/restaurant-scenarios';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export type MealSelection = Record<string, string[]>;

export function validMealSelection(selection: MealSelection) {
  return Object.keys(selection).every((id) => mealOptionGroups.some((group) => group.id === id)) &&
    mealOptionGroups.every((group) => {
      const selected = selection[group.id] ?? [];
      return (!group.required || selected.length === 1) &&
        new Set(selected).size === selected.length &&
        selected.every((id) => group.choices.some((choice) => choice.id === id));
    });
}

export function mealConfiguration(selection: MealSelection) {
  const choices = mealOptionGroups.flatMap((group) =>
    group.choices.filter((choice) => selection[group.id]?.includes(choice.id)),
  );
  return { extraPrice: choices.reduce((sum, choice) => sum + choice.price, 0),
    label: choices.map((choice) => choice.label).join(' · ') };
}

export function mealAvailable(product: MarketplaceProduct) {
  return product.merchantType !== 'restaurant' ||
    (product.available !== false && restaurantScenario(product.merchantName ?? '').open);
}
