import {
  mealOptionGroups,
  drinkOptionGroups,
  restaurantScenario,
} from '@/features/marketplace/data/restaurant-scenarios';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export type MealSelection = Record<string, string[]>;

interface MealGroup {
  id: string;
  label: string;
  required: boolean;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  choices: { id: string; label: string; price: number }[];
}
export function mealGroups(
  product?: MarketplaceProduct,
  selection: MealSelection = {},
): MealGroup[] {
  if (product?.apiVariants) {
    const variants = product.apiVariants
      .filter((variant) => variant.availability === 'available')
      .sort((a, b) => a.position - b.position);
    const variantId = selection.size?.[0] ?? variants[0]?.id;
    return [
      ...(variants.length
        ? [
            {
              id: 'size',
              label: 'الحجم',
              required: true,
              selectionMode: 'single' as const,
              minSelections: 1,
              maxSelections: 1,
              choices: variants.map((variant) => ({
                id: variant.id,
                label: variant.name,
                price: Number(variant.price) - product.price,
              })),
            },
          ]
        : []),
      ...(product.apiModifierGroups ?? [])
        .filter(
          (group) =>
            group.variantOverrides?.find((item) => item.variantId === variantId)?.available !==
            false,
        )
        .map((group) => ({
          id: group.id,
          label: group.name,
          required: group.minSelections > 0,
          selectionMode: group.selectionMode,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          choices: group.options
            .filter(
              (option) =>
                option.variantOverrides?.find((item) => item.variantId === variantId)?.available !==
                false,
            )
            .map((option) => ({
              id: option.id,
              label: option.name,
              price: Number(
                option.variantOverrides?.find((item) => item.variantId === variantId)
                  ?.priceAdjustment ?? option.priceAdjustment,
              ),
            })),
        })),
    ];
  }
  return (product?.menuSection === 'مشروبات' ? drinkOptionGroups : mealOptionGroups).map(
    (group) => ({
      ...group,
      selectionMode: group.required ? 'single' : 'multiple',
      minSelections: group.required ? 1 : 0,
      maxSelections: group.required ? 1 : group.choices.length,
    }),
  );
}

export function defaultMealSelection(product?: MarketplaceProduct): MealSelection {
  return Object.fromEntries(
    mealGroups(product).flatMap((group) => {
      const first = group.choices[0];
      return group.required && first
        ? [[group.id, group.choices.slice(0, group.minSelections).map((choice) => choice.id)]]
        : [];
    }),
  );
}

export function validMealSelection(selection: MealSelection, product?: MarketplaceProduct) {
  const groups = mealGroups(product, selection);
  return (
    Object.keys(selection).every((id) => groups.some((group) => group.id === id)) &&
    groups.every((group) => {
      const selected = selection[group.id] ?? [];
      return (
        selected.length >= group.minSelections &&
        selected.length <= group.maxSelections &&
        new Set(selected).size === selected.length &&
        selected.every((id) => group.choices.some((choice) => choice.id === id))
      );
    })
  );
}

export function mealConfiguration(selection: MealSelection, product?: MarketplaceProduct) {
  const choices = mealGroups(product, selection).flatMap((group) =>
    group.choices.filter((choice) => selection[group.id]?.includes(choice.id)),
  );
  return {
    extraPrice: choices.reduce((sum, choice) => sum + choice.price, 0),
    label: choices.map((choice) => choice.label).join(' · '),
  };
}

export function mealAvailable(product: MarketplaceProduct) {
  if (product.restaurantSettings)
    return (
      product.available !== false &&
      product.restaurantSettings.acceptingOrders &&
      (!product.apiVariants?.length ||
        product.apiVariants.some((variant) => variant.availability === 'available'))
    );
  return (
    product.merchantType !== 'restaurant' ||
    (product.available !== false && restaurantScenario(product.merchantName ?? '').open)
  );
}
