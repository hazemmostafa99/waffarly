export type Category =
  'All items' | 'Waffles' | 'Breakfast' | 'Desserts' | 'Coffee' | 'Cold drinks';
export type FoodKind = 'waffle' | 'coffee' | 'toast' | 'bowl' | 'drink';
export interface Product {
  id: string;
  name: string;
  category: Category;
  description: string;
  cents: number;
  kind: FoodKind;
  tone: 'peach' | 'mint' | 'lilac' | 'rose' | 'sky';
  configurable?: boolean;
  unavailable?: boolean;
}
export const categories: Category[] = [
  'All items',
  'Waffles',
  'Breakfast',
  'Desserts',
  'Coffee',
  'Cold drinks',
];
export const products: Product[] = [
  {
    id: 'classic',
    name: 'Classic waffle',
    category: 'Waffles',
    description: 'Golden, crisp & a little buttery',
    cents: 8500,
    kind: 'waffle',
    tone: 'peach',
    configurable: true,
  },
  {
    id: 'chocolate',
    name: 'Chocolate dream',
    category: 'Waffles',
    description: 'Chocolate, hazelnuts & happiness',
    cents: 12500,
    kind: 'waffle',
    tone: 'lilac',
    configurable: true,
  },
  {
    id: 'berry',
    name: 'Berry lovely',
    category: 'Waffles',
    description: 'Fresh berries & vanilla cream',
    cents: 14500,
    kind: 'waffle',
    tone: 'rose',
    configurable: true,
  },
  {
    id: 'pistachio',
    name: 'Pistachio crunch',
    category: 'Waffles',
    description: 'Pistachio cream & roasted nuts',
    cents: 16500,
    kind: 'waffle',
    tone: 'mint',
    configurable: true,
  },
  {
    id: 'toast',
    name: 'Avocado toast',
    category: 'Breakfast',
    description: 'Sourdough, avocado & a little zing',
    cents: 11000,
    kind: 'toast',
    tone: 'mint',
  },
  {
    id: 'breakfast',
    name: 'The breakfast waffle',
    category: 'Breakfast',
    description: 'Eggs, cheese & a savory waffle',
    cents: 15500,
    kind: 'waffle',
    tone: 'peach',
    configurable: true,
  },
  {
    id: 'yogurt',
    name: 'Granola & berries',
    category: 'Breakfast',
    description: 'Greek yogurt, honey & granola',
    cents: 9500,
    kind: 'bowl',
    tone: 'rose',
  },
  {
    id: 'sundae',
    name: 'Vanilla cloud',
    category: 'Desserts',
    description: 'Vanilla scoops & chocolate drizzle',
    cents: 9000,
    kind: 'bowl',
    tone: 'lilac',
  },
  {
    id: 'latte',
    name: 'Café latte',
    category: 'Coffee',
    description: 'Double espresso & silky milk',
    cents: 6500,
    kind: 'coffee',
    tone: 'peach',
    configurable: true,
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    category: 'Coffee',
    description: 'Espresso with a soft milk cloud',
    cents: 6000,
    kind: 'coffee',
    tone: 'sky',
  },
  {
    id: 'matcha',
    name: 'Iced matcha',
    category: 'Cold drinks',
    description: 'Matcha, milk & a moment of calm',
    cents: 8500,
    kind: 'drink',
    tone: 'mint',
  },
  {
    id: 'lemon',
    name: 'Mint lemonade',
    category: 'Cold drinks',
    description: 'Fresh lemon, mint & crushed ice',
    cents: 7000,
    kind: 'drink',
    tone: 'sky',
    unavailable: true,
  },
];
export const extras = [
  { id: 'chocolate', name: 'Chocolate drizzle', cents: 1500 },
  { id: 'berries', name: 'Extra berries', cents: 2000 },
  { id: 'ice-cream', name: 'Vanilla ice cream', cents: 2500 },
];
export const prototypeKeys = {
  catalog: ['pos-design-preview', 'catalog'] as const,
  orders: ['pos-design-preview', 'orders'] as const,
};
