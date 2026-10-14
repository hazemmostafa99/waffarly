'use client';

import type {
  CreateStorefrontOrderRequest,
  CatalogProductQuoteResponse,
  CatalogProductQuoteSelection,
  PublicStorefrontCatalog,
  PublicStorefrontProduct,
  StorefrontOrderReceipt,
} from '@waffarly/contracts';
import Image from 'next/image';
import { useLocale } from '@waffarly/ui';
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { apiPost } from '../../../lib/api-client';

type CartLine = {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  selections: string[];
  configuration: CatalogProductQuoteSelection[];
  unitPrice: string;
  quantity: number;
};

const copy = {
  en: {
    menu: 'Menu',
    all: 'All items',
    addToCart: 'Customize',
    unavailable: 'Currently unavailable',
    customize: 'Customize your item',
    close: 'Close',
    chooseVariant: 'Choose a size or variant',
    required: 'Required',
    optional: 'Optional',
    noChoice: 'No selection',
    getPrice: 'Get current price',
    calculating: 'Checking price…',
    add: 'Add to basket',
    basket: 'Your basket',
    empty: 'Your basket is empty.',
    orderLater: 'Online ordering is not enabled yet. Your basket is only saved on this page.',
    total: 'Basket total',
    customerName: 'Your name',
    customerPhone: 'Phone number',
    fulfillment: 'How would you like your order?',
    pickup: 'Pickup',
    delivery: 'Delivery',
    deliveryAddress: 'Delivery address',
    placeOrder: 'Place order',
    submittingOrder: 'Placing your order…',
    checkoutNote: 'No online payment is collected in this MVP. The store will contact you to confirm.',
    orderError: 'We could not place your order. Please review your details and try again.',
    orderReceived: 'Order received',
    orderReference: 'Your order reference',
    orderPending: 'The store will contact you to confirm your order.',
    placeAnother: 'Start another order',
    customerNamePlaceholder: 'Enter your name',
    customerPhonePlaceholder: '01xxxxxxxxx',
    increaseQuantity: 'Add one',
    decreaseQuantity: 'Remove one',
    removeLine: 'Remove',
    min: 'Choose at least',
    max: 'Choose up to',
    options: 'options',
    noProducts: 'No products are available right now.',
    priceError: 'We could not check this price. Please try again.',
  },
  ar: {
    menu: 'القائمة',
    all: 'كل المنتجات',
    addToCart: 'تخصيص',
    unavailable: 'غير متاح حالياً',
    customize: 'خصص طلبك',
    close: 'إغلاق',
    chooseVariant: 'اختر الحجم أو النوع',
    required: 'مطلوب',
    optional: 'اختياري',
    noChoice: 'بدون اختيار',
    getPrice: 'اعرف السعر الحالي',
    calculating: 'جارٍ التحقق من السعر…',
    add: 'أضف إلى السلة',
    basket: 'سلتك',
    empty: 'سلتك فارغة.',
    orderLater: 'الطلب عبر الإنترنت غير متاح بعد. ستظل سلتك محفوظة على هذه الصفحة فقط.',
    total: 'إجمالي السلة',
    customerName: 'اسمك',
    customerPhone: 'رقم الهاتف',
    fulfillment: 'كيف ترغب في استلام طلبك؟',
    pickup: 'استلام من المتجر',
    delivery: 'توصيل',
    deliveryAddress: 'عنوان التوصيل',
    placeOrder: 'تأكيد الطلب',
    submittingOrder: 'جارٍ إرسال طلبك…',
    checkoutNote: 'لا يتم تحصيل دفع إلكتروني في هذه النسخة. سيتواصل معك المتجر لتأكيد الطلب.',
    orderError: 'تعذر إرسال الطلب. راجع بياناتك وحاول مرة أخرى.',
    orderReceived: 'تم استلام طلبك',
    orderReference: 'رقم الطلب',
    orderPending: 'سيتواصل معك المتجر لتأكيد الطلب.',
    placeAnother: 'بدء طلب جديد',
    customerNamePlaceholder: 'اكتب اسمك',
    customerPhonePlaceholder: '01xxxxxxxxx',
    increaseQuantity: 'أضف واحدة',
    decreaseQuantity: 'احذف واحدة',
    removeLine: 'إزالة',
    min: 'اختر على الأقل',
    max: 'اختر بحد أقصى',
    options: 'اختيارات',
    noProducts: 'لا توجد منتجات متاحة الآن.',
    priceError: 'تعذر التحقق من السعر. حاول مرة أخرى.',
  },
} as const;

export function StorefrontMenu({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const language = locale === 'ar' ? 'ar' : 'en';
  const t = copy[language];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<PublicStorefrontProduct | null>(null);
  const [variantId, setVariantId] = useState('');
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [quote, setQuote] = useState<CatalogProductQuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [basket, setBasket] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderReceipt, setOrderReceipt] = useState<StorefrontOrderReceipt | null>(null);

  const visibleProducts = useMemo(
    () =>
      categoryId
        ? catalog.products.filter((product) => product.categories.some((category) => category.id === categoryId))
        : catalog.products,
    [catalog.products, categoryId],
  );
  const selectedVariant = activeProduct?.variants.find((variant) => variant.id === variantId);
  const selectionIsValid = Boolean(
    activeProduct &&
      (!activeProduct.variants.length || selectedVariant?.availability === 'available') &&
      activeProduct.modifierGroups.every((group) => {
        const count = choices[group.id]?.length ?? 0;
        return count >= group.minSelections && count <= group.maxSelections;
      }),
  );
  const basketTotal = basket.reduce(
    (sum, item) => sum + Math.round(Number(item.unitPrice) * 100) * item.quantity,
    0,
  ) / 100;

  function money(value: string | number) {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
    }).format(Number(value));
  }

  function openProduct(product: PublicStorefrontProduct) {
    setActiveProduct(product);
    setVariantId(product.variants.find((variant) => variant.availability === 'available')?.id ?? '');
    setChoices(
      Object.fromEntries(
        product.modifierGroups.map((group) => [
          group.id,
          group.options.filter((option) => option.defaultSelected).map((option) => option.id),
        ]),
      ),
    );
    setQuote(null);
    setQuoteError('');
  }

  async function getPrice() {
    if (!activeProduct || !selectionIsValid) return;
    setQuoting(true);
    setQuote(null);
    setQuoteError('');
    try {
      const result = await apiPost<CatalogProductQuoteResponse>(
        `/catalog/stores/${catalog.slug}/products/${activeProduct.id}/quote`,
        {
          ...(activeProduct.variants.length ? { variantId } : {}),
          selections: activeProduct.modifierGroups.map((group) => ({
            groupId: group.id,
            optionIds: choices[group.id] ?? [],
          })),
        },
      );
      setQuote(result);
    } catch {
      setQuoteError(t.priceError);
    } finally {
      setQuoting(false);
    }
  }

  function addQuotedItem() {
    if (!activeProduct || !quote) return;
    const chosenNames = activeProduct.modifierGroups.flatMap((group) =>
      group.options
        .filter((option) => (choices[group.id] ?? []).includes(option.id))
        .map((option) => `${group.name}: ${option.name}`),
    );
    const key = JSON.stringify([quote.productId, quote.variantId, quote.selections]);
    setBasket((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) =>
          item.key === key ? { ...item, quantity: Math.min(item.quantity + 1, 99) } : item,
        );
      }
      return [
        ...current,
        {
          key,
          productId: quote.productId,
          variantId: quote.variantId,
          productName: activeProduct.name,
          variantName: quote.variantName,
          selections: chosenNames,
          configuration: quote.selections.map(({ groupId, optionIds }) => ({ groupId, optionIds })),
          unitPrice: quote.totalPrice,
          quantity: 1,
        },
      ];
    });
    setActiveProduct(null);
  }

  function changeBasketQuantity(key: string, change: number) {
    setBasket((current) =>
      current.flatMap((item) => {
        if (item.key !== key) return [item];
        const quantity = item.quantity + change;
        return quantity < 1 ? [] : [{ ...item, quantity: Math.min(quantity, 99) }];
      }),
    );
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (basket.length === 0 || placingOrder) return;
    setPlacingOrder(true);
    setOrderError('');
    try {
      const request: CreateStorefrontOrderRequest = {
        customerName,
        customerPhone,
        fulfillmentType,
        ...(fulfillmentType === 'delivery' ? { deliveryAddress } : {}),
        items: basket.map((item) => ({
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          selections: item.configuration,
          quantity: item.quantity,
        })),
      };
      const receipt = await apiPost<StorefrontOrderReceipt>(
        `/catalog/stores/${catalog.slug}/orders`,
        request,
      );
      setOrderReceipt(receipt);
      setBasket([]);
    } catch (error) {
      setOrderError(error instanceof Error && error.message ? error.message : t.orderError);
    } finally {
      setPlacingOrder(false);
    }
  }

  function changeGroupChoice(groupId: string, optionId: string, checked: boolean, single: boolean) {
    setChoices((current) => {
      const existing = current[groupId] ?? [];
      const next = single
        ? checked
          ? [optionId]
          : existing.filter((id) => id !== optionId)
        : checked
          ? [...existing, optionId]
          : existing.filter((id) => id !== optionId);
      return { ...current, [groupId]: next };
    });
    setQuote(null);
    setQuoteError('');
  }

  return (
    <main
      id="main-content"
      className={`public-store ${catalog.template?.layout === 'hero' ? 'public-layout-hero' : ''}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{ '--store-accent': catalog.accentColor } as CSSProperties}
    >
      <header className="public-store-hero">
        {catalog.logoData ? (
          <Image
            className="public-store-logo"
            src={catalog.logoData}
            alt={`${catalog.merchantName} logo`}
            width={76}
            height={76}
            unoptimized
          />
        ) : (
          <span className="public-store-mark" aria-hidden="true">{catalog.merchantName.slice(0, 1)}</span>
        )}
        <div>
          <p className="public-store-eyebrow">{t.menu}</p>
          <h1>{catalog.merchantName}</h1>
          {catalog.template?.name && <p className="public-store-template">{catalog.template.name}</p>}
        </div>
      </header>

      <div className="public-store-layout">
        <section className="public-menu" aria-label={t.menu}>
          <div className="public-menu-heading">
            <h2>{t.menu}</h2>
            <div className="public-category-list" aria-label={t.menu}>
              <button
                type="button"
                className={!categoryId ? 'active' : ''}
                onClick={() => setCategoryId(null)}
              >
                {t.all}
              </button>
              {catalog.categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={categoryId === category.id ? 'active' : ''}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <p className="public-store-empty">{t.noProducts}</p>
          ) : (
            <div className="public-product-grid">
              {visibleProducts.map((product) => {
                const firstImage = product.images.find((image) => image.isPrimary) ?? product.images[0];
                const prices = product.variants
                  .filter((variant) => variant.availability === 'available')
                  .map((variant) => Number(variant.price));
                const displayPrice = prices.length ? Math.min(...prices) : Number(product.basePrice);
                const canCustomize = !product.variants.length || prices.length > 0;
                return (
                  <article className="public-product-card" key={product.id}>
                    {firstImage ? (
                      <Image
                        src={firstImage.publicUrl}
                        alt={product.name}
                        width={640}
                        height={360}
                        sizes="(max-width: 620px) 100vw, (max-width: 900px) 50vw, 420px"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className="public-product-placeholder" aria-hidden="true">✦</div>
                    )}
                    <div className="public-product-copy">
                      <div className="public-product-title-row">
                        <h3>{product.name}</h3>
                        <strong>{canCustomize ? money(displayPrice) : '—'}</strong>
                      </div>
                      {product.description && <p>{product.description}</p>}
                      {product.categories.length > 0 && (
                        <span className="public-product-category">
                          {product.categories.map((category) => category.name).join(' · ')}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={!canCustomize}
                        onClick={() => openProduct(product)}
                      >
                        {canCustomize ? t.addToCart : t.unavailable}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="public-basket" aria-label={t.basket}>
          <h2>{t.basket}</h2>
          {orderReceipt ? (
            <div className="public-order-success" role="status">
              <h3>{t.orderReceived}</h3>
              <p>{t.orderPending}</p>
              <span>{t.orderReference}</span>
              <strong dir="ltr">{orderReceipt.id.slice(0, 8).toLocaleUpperCase()}</strong>
              <div className="public-basket-total">
                <strong>{t.total}</strong>
                <strong>{money(orderReceipt.total)}</strong>
              </div>
              <button type="button" onClick={() => setOrderReceipt(null)}>{t.placeAnother}</button>
            </div>
          ) : basket.length === 0 ? (
            <p>{t.empty}</p>
          ) : (
            <>
              <ul>
                {basket.map((item) => (
                  <li key={item.key}>
                    <div>
                      <strong>{item.quantity} × {item.productName}</strong>
                      {item.variantName && <span>{item.variantName}</span>}
                      {item.selections.map((selection) => <span key={selection}>{selection}</span>)}
                      <div className="public-basket-quantity">
                        <button
                          type="button"
                          aria-label={t.decreaseQuantity}
                          onClick={() => changeBasketQuantity(item.key, -1)}
                        >
                          −
                        </button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={t.increaseQuantity}
                          disabled={item.quantity >= 99}
                          onClick={() => changeBasketQuantity(item.key, 1)}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="is-remove"
                          onClick={() => setBasket((current) => current.filter((line) => line.key !== item.key))}
                        >
                          {t.removeLine}
                        </button>
                      </div>
                    </div>
                    <strong>{money(Number(item.unitPrice) * item.quantity)}</strong>
                  </li>
                ))}
              </ul>
              <div className="public-basket-total"><strong>{t.total}</strong><strong>{money(basketTotal)}</strong></div>
              <form className="public-checkout-form" onSubmit={(event) => void submitOrder(event)}>
                <label>
                  {t.customerName}
                  <input
                    autoComplete="name"
                    maxLength={120}
                    minLength={2}
                    required
                    value={customerName}
                    placeholder={t.customerNamePlaceholder}
                    onChange={(event) => setCustomerName(event.currentTarget.value)}
                  />
                </label>
                <label>
                  {t.customerPhone}
                  <input
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={32}
                    minLength={7}
                    required
                    type="tel"
                    value={customerPhone}
                    placeholder={t.customerPhonePlaceholder}
                    onChange={(event) => setCustomerPhone(event.currentTarget.value)}
                  />
                </label>
                <fieldset>
                  <legend>{t.fulfillment}</legend>
                  <label>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="pickup"
                      checked={fulfillmentType === 'pickup'}
                      onChange={() => setFulfillmentType('pickup')}
                    />
                    {t.pickup}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="delivery"
                      checked={fulfillmentType === 'delivery'}
                      onChange={() => setFulfillmentType('delivery')}
                    />
                    {t.delivery}
                  </label>
                </fieldset>
                {fulfillmentType === 'delivery' && (
                  <label>
                    {t.deliveryAddress}
                    <textarea
                      autoComplete="street-address"
                      maxLength={1000}
                      minLength={8}
                      required
                      rows={3}
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.currentTarget.value)}
                    />
                  </label>
                )}
                {orderError && <p className="public-checkout-error" role="alert">{orderError}</p>}
                <button type="submit" disabled={placingOrder}>
                  {placingOrder ? t.submittingOrder : t.placeOrder}
                </button>
                <p>{t.checkoutNote}</p>
              </form>
            </>
          )}
        </aside>
      </div>

      {activeProduct && (
        <div className="public-config-overlay">
          <section className="public-config-dialog" role="dialog" aria-modal="true" aria-labelledby="config-title">
            <div className="public-config-heading">
              <div>
                <p className="public-store-eyebrow">{t.customize}</p>
                <h2 id="config-title">{activeProduct.name}</h2>
              </div>
              <button type="button" className="public-config-close" onClick={() => setActiveProduct(null)} aria-label={t.close}>×</button>
            </div>
            {activeProduct.variants.length > 0 && (
              <fieldset className="public-config-group">
                <legend>{t.chooseVariant} <span>*</span></legend>
                {activeProduct.variants.map((variant) => (
                  <label className="public-config-option" key={variant.id}>
                    <input
                      type="radio"
                      name="product-variant"
                      value={variant.id}
                      checked={variantId === variant.id}
                      disabled={variant.availability !== 'available'}
                      onChange={() => { setVariantId(variant.id); setQuote(null); }}
                    />
                    <span>{variant.name}</span>
                    <strong>{variant.availability === 'available' ? money(variant.price) : t.unavailable}</strong>
                  </label>
                ))}
              </fieldset>
            )}
            {activeProduct.modifierGroups.map((group) => (
              <fieldset className="public-config-group" key={group.id}>
                <legend>
                  {group.name}{' '}
                  <small>{group.minSelections > 0 ? t.required : t.optional}</small>
                </legend>
                {group.description && <p>{group.description}</p>}
                {group.selectionMode === 'single' && group.minSelections === 0 && (
                  <label className="public-config-option">
                    <input
                      type="radio"
                      name={`group-${group.id}`}
                      checked={(choices[group.id] ?? []).length === 0}
                      onChange={() => { setChoices((current) => ({ ...current, [group.id]: [] })); setQuote(null); }}
                    />
                    <span>{t.noChoice}</span>
                  </label>
                )}
                {group.options.map((option) => {
                  const checked = (choices[group.id] ?? []).includes(option.id);
                  const disabled =
                    group.selectionMode === 'multiple' &&
                    !checked &&
                    (choices[group.id]?.length ?? 0) >= group.maxSelections;
                  return (
                    <label className="public-config-option" key={option.id}>
                      <input
                        type={group.selectionMode === 'single' ? 'radio' : 'checkbox'}
                        name={`group-${group.id}`}
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) =>
                          changeGroupChoice(group.id, option.id, event.currentTarget.checked, group.selectionMode === 'single')
                        }
                      />
                      <span>{option.name}</span>
                      <strong>{Number(option.priceAdjustment) ? `+ ${money(option.priceAdjustment)}` : money(0)}</strong>
                    </label>
                  );
                })}
                {group.selectionMode === 'multiple' && group.maxSelections > 1 && (
                  <small className="public-config-hint">
                    {t.min} {group.minSelections}, {t.max} {group.maxSelections} {t.options}
                  </small>
                )}
              </fieldset>
            ))}
            {quoteError && <p className="public-config-error" role="alert">{quoteError}</p>}
            {quote && <p className="public-config-quote" role="status">{t.total}: <strong>{money(quote.totalPrice)}</strong></p>}
            <div className="public-config-actions">
              <button type="button" disabled={!selectionIsValid || quoting} onClick={() => void getPrice()}>
                {quoting ? t.calculating : t.getPrice}
              </button>
              <button type="button" disabled={!quote} onClick={addQuotedItem}>{t.add}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
