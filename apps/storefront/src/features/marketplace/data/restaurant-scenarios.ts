import reference from './reference.json';
import scenarios from './merchant-detail-scenarios.json';

// Deliberately local UI scenarios, never actual menus, opening hours or delivery policies.
export const restaurantScenarioProducts = reference.restaurants.flatMap((restaurant, index) =>
  scenarios.restaurantProducts.map((template, itemIndex) => ({
    ...template,
    id: index === 0 ? template.id : `mock-restaurant-${index}-${itemIndex}`,
    merchantName: restaurant.name,
    seller: restaurant.name,
    merchantType: 'restaurant' as const,
    origin: 'local-mock' as const,
    name: index === 0 ? template.name : ['وجبة تجريبية', 'وجبة مميزة تجريبية', 'طبق جانبي تجريبي'][itemIndex]!,
    cartName: index === 0 ? template.cartName : ['وجبة تجريبية', 'وجبة مميزة تجريبية', 'طبق جانبي تجريبي'][itemIndex]!,
    searchName: `${restaurant.name} ${template.searchName} وجبة تجريبية`,
    menuSection: itemIndex === 2 ? 'أطباق جانبية' : 'الوجبات',
    available: itemIndex !== 2 || index !== 0,
  })),
);

export function restaurantScenario(name: string) {
  const index = reference.restaurants.findIndex((restaurant) => restaurant.name === name);
  return {
    open: index >= 0 && index !== reference.restaurants.length - 1,
    deliveryFee: 25,
    minimumOrder: 100,
    area: 'منطقة التوصيل التجريبية',
  };
}

export const mealOptionGroups = [
  {
    id: 'size', label: 'الحجم', required: true,
    choices: [{ id: 'regular', label: 'عادي', price: 0 }, { id: 'large', label: 'كبير', price: 40 }],
  },
  {
    id: 'extras', label: 'إضافات', required: false,
    choices: [{ id: 'cheese', label: 'جبنة إضافية', price: 20 }, { id: 'sauce', label: 'صوص إضافي', price: 10 }],
  },
];
