import { mealOptionGroups, drinkOptionGroups, restaurantScenario } from '@/features/marketplace/data/restaurant-scenarios';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export type MealSelection = Record<string, string[]>;

export function mealGroups(product?: Pick<MarketplaceProduct, 'menuSection'>) {
  return product?.menuSection === 'مشروبات' ? drinkOptionGroups : mealOptionGroups;
}

export function validMealSelection(selection: MealSelection, product?: Pick<MarketplaceProduct, 'menuSection'>) {
  const groups = mealGroups(product);
  return Object.keys(selection).every((id) => groups.some((group) => group.id === id)) &&
    groups.every((group) => {
      const selected = selection[group.id] ?? [];
      return (!group.required || selected.length === 1) &&
        new Set(selected).size === selected.length &&
        selected.every((id) => group.choices.some((choice) => choice.id === id));
    });
}

export function mealConfiguration(selection: MealSelection, product?: Pick<MarketplaceProduct, 'menuSection'>) {
  const choices = mealGroups(product).flatMap((group) =>
    group.choices.filter((choice) => selection[group.id]?.includes(choice.id)),
  );
  return { extraPrice: choices.reduce((sum, choice) => sum + choice.price, 0),
    label: choices.map((choice) => choice.label).join(' · ') };
}

export function mealAvailable(product: MarketplaceProduct) {
  return product.merchantType !== 'restaurant' ||
    (product.available !== false && restaurantScenario(product.merchantName ?? '').open);
}
