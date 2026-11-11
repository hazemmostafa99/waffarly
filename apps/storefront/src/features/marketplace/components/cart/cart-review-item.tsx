'use client';

import Link from 'next/link';
import { QuantitySelector } from '@/components/marketplace/quantity-selector';
import { money, type MarketplaceProduct } from '../../model/catalog';
import { productHref } from '../../model/product-navigation';

export function CartReviewItem({
  product,
  onQuantityChange,
  onRemove,
}: {
  product: MarketplaceProduct & { quantity: number };
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const href = productHref(product.id);
  return (
    <li className="cart-review-item">
      <Link href={href} className="cart-review-image" aria-label={product.name}>
        <img {...product.image} />
      </Link>
      <div className="cart-review-info">
        <span className="seller">{product.seller}</span>
        <h2><Link href={href}>{product.name}</Link></h2>
        <p className="cart-review-unit-price">{money(product.price)} للقطعة</p>
        <div className="cart-review-controls">
          <QuantitySelector value={product.quantity} onChange={onQuantityChange} label={`كمية ${product.cartName}`} />
          <button type="button" className="cart-review-remove" onClick={onRemove} aria-label={`حذف ${product.cartName}`}>حذف المنتج</button>
        </div>
      </div>
      <div className="cart-review-line-total">
        <span>إجمالي المنتج</span>
        <strong>{money(product.price * product.quantity)}</strong>
      </div>
    </li>
  );
}
