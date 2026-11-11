'use client';

import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { productsForRestaurant } from '@/features/marketplace/restaurants/model/restaurants';

export function RestaurantMenu({ restaurantName }: { restaurantName: string }) {
  const openCart = useCartStore((state) => state.setCartOpen);
  const products = productsForRestaurant({ name: restaurantName });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="mb-1 mt-0 text-[19px]">أمثلة من القائمة</h2>
          <p className="m-0 text-[12px] text-muted-foreground">
            أصناف وأسعار توضيحية لتجربة شكل الصفحة والسلة.
          </p>
        </div>
        <span className="rounded-lg bg-secondary px-2.5 py-[7px] text-[11px] font-bold text-accent">
          بيانات تجريبية
        </span>
      </div>
      <p className="mb-5 mt-0 rounded-[10px] bg-secondary px-4 py-3 text-[12px] leading-[1.8] text-accent">
        الأصناف والأسعار دي أمثلة محلية، مش منيو مستخرج من المطعم أو أسعاره الفعلية.
      </p>
      {products.length ? (
        <div className="grid grid-cols-4 gap-3.5 max-[1024px]:grid-cols-2 max-[700px]:flex max-[700px]:gap-3 max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onAdded={() => openCart(true)} />
          ))}
        </div>
      ) : (
        <p className="m-0 text-[13px] text-muted-foreground">مفيش أمثلة محلية مضافة للمطعم ده.</p>
      )}
    </>
  );
}
