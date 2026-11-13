import type { CheckoutItem, Fulfillment } from './checkout';
import { restaurantScenario } from '@/features/marketplace/data/restaurant-scenarios';
import {
  mealAvailable,
  validMealSelection,
} from '@/features/marketplace/restaurants/model/meal-options';

export function restaurantCheckout(items: CheckoutItem[], fulfillment: Fulfillment) {
  const restaurant = items.find((item) => item.merchantType === 'restaurant');
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (!restaurant) return { name: '', subtotal, deliveryFee: 0, total: subtotal, issue: '' };
  const name = restaurant.merchantName ?? '';
  const scenario = restaurant.restaurantSettings
    ? {
        deliveryFee: Number(restaurant.restaurantSettings.deliveryFee),
        minimumOrder: Number(restaurant.restaurantSettings.minimumDeliveryOrder),
      }
    : restaurantScenario(name);
  const deliveryFee = fulfillment === 'delivery' ? scenario.deliveryFee : 0;
  let issue = '';
  if (items.some((item) => item.merchantType !== 'restaurant' || item.merchantName !== name))
    issue = 'طلب المطاعم لازم يكون من مطعم واحد.';
  else if (
    items.some((item) => !mealAvailable(item) || !validMealSelection(item.selection ?? {}, item))
  )
    issue = 'فيه وجبة غير متاحة أو اختيارات ناقصة. راجع السلة.';
  else if (fulfillment === 'delivery' && subtotal < scenario.minimumOrder)
    issue = `لم تصل للحد الأدنى للتوصيل التجريبي. أضف وجبات أو اختار الاستلام.`;
  return { name, subtotal, deliveryFee, total: subtotal + deliveryFee, issue };
}
