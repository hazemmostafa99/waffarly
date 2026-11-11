import reference from './reference.json';
import scenarios from './merchant-detail-scenarios.json';

// Deliberately local UI scenarios, never actual menus, opening hours or delivery policies.
const baseRestaurantProducts = reference.restaurants.flatMap((restaurant, index) =>
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
    description: index === 0
      ? ['برجر مشوي مع الخضار والصوص، بالحجم اللي يناسبك.', 'برجر بطبقة جبنة وصوص، مع إضافات من اختيارك.', 'بطاطس مقرمشة كطبق جانبي مع وجبتك.'][itemIndex]
      : 'صنف توضيحي للمنيو، بحجم وإضافات حسب اختيارك.',
    available: itemIndex !== 2 || index !== 0,
  })),
);

// Extra local examples make the restaurant layout browsable; none are actual menu records.
const burgerTemplate = scenarios.restaurantProducts[0]!;
const sideTemplate = scenarios.restaurantProducts[2]!;
const burgerRestaurant = reference.restaurants[0]!;
const coffeeImage = reference.restaurants.find((restaurant) => restaurant.name === 'قهوة ومزاج')?.logo ?? burgerTemplate.image;
const saladImage = reference.restaurants.find((restaurant) => restaurant.name === 'جرين بايتس')?.logo ?? sideTemplate.image;
const additionalMenuExamples = [
  { id: 'mock-burger-grill', name: 'وجبة مشويات تجريبية', description: 'وجبة مشويات مع طبق جانبي وصوص من اختيارك.', price: 199, menuSection: 'الوجبات', image: scenarios.restaurantProducts[1]!.image },
  { id: 'mock-burger-onion', name: 'حلقات بصل تجريبية', description: 'حلقات بصل مقرمشة مع صوص جانبي.', price: 85, menuSection: 'أطباق جانبية', image: sideTemplate.image },
  { id: 'mock-burger-salad', name: 'سلطة خضراء تجريبية', description: 'خضار مشكلة مع صوص خفيف كطبق جانبي.', price: 95, menuSection: 'أطباق جانبية', image: saladImage },
  { id: 'mock-burger-coffee', name: 'قهوة تجريبية', description: 'مشروب قهوة لاكتمال تجربة تصفح المنيو.', price: 45, menuSection: 'مشروبات', image: coffeeImage },
  { id: 'mock-burger-latte', name: 'لاتيه تجريبي', description: 'قهوة بالحليب ضمن أمثلة المنيو المحلية.', price: 65, menuSection: 'مشروبات', image: coffeeImage },
].map((example) => ({
  ...burgerTemplate,
  ...example,
  image: { src: example.image.src, alt: `صورة توضيحية للتجربة: ${example.name}` },
  cartImage: example.image.src,
  cartName: example.name,
  searchName: example.name,
  displayPrice: `${example.price} ج.م`,
  merchantName: burgerRestaurant.name,
  seller: burgerRestaurant.name,
  merchantType: 'restaurant' as const,
  origin: 'local-mock' as const,
  available: true,
}));

export const restaurantScenarioProducts = [...baseRestaurantProducts, ...additionalMenuExamples];

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

export const drinkOptionGroups = [
  {
    id: 'size', label: 'الحجم', required: true,
    choices: [{ id: 'regular', label: 'عادي', price: 0 }, { id: 'large', label: 'كبير', price: 15 }],
  },
  {
    id: 'extras', label: 'إضافات', required: false,
    choices: [{ id: 'milk', label: 'حليب إضافي', price: 5 }, { id: 'caramel', label: 'كراميل', price: 10 }],
  },
];
