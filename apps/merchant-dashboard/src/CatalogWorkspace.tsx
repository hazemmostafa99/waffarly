import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Input, useLocale } from '@waffarly/ui';
import { apiRequest } from './lib/api-client.js';

export type MediaAsset = {
  id: string;
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
};
export type Category = {
  id: string;
  name: string;
  description?: string | null;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  availability: string;
  archivedAt: string | null;
  revision: number;
  effectiveVisible: boolean;
  image: MediaAsset;
  childCount?: number;
  productCount?: number;
};
export type Product = {
  id: string;
  name: string;
  basePrice: string;
  availability: string;
  archivedAt: string | null;
  revision: number;
  images: Array<{ mediaAssetId: string; publicUrl: string; isPrimary: boolean }>;
  categories: Array<{ id: string; name: string }>;
};

const initialMedia = { storageKey: '', publicUrl: '', mimeType: 'image/jpeg', sizeBytes: '1000' };
const initialCategory = { name: '', imageAssetId: '', parentId: '', availability: 'available' };
const initialProduct = { name: '', basePrice: '', availability: 'available' };

export type CatalogSnapshot = { media: MediaAsset[]; categories: Category[]; products: Product[] };

export function CatalogWorkspace({
  section = 'all',
  search = '',
  onSnapshot,
}: {
  section?: 'all' | 'products' | 'categories' | 'media';
  search?: string;
  onSnapshot?: (snapshot: CatalogSnapshot) => void;
}) {
  const { t, errorText } = useLocale();
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mediaDraft, setMediaDraft] = useState(initialMedia);
  const [categoryDraft, setCategoryDraft] = useState(initialCategory);
  const [productDraft, setProductDraft] = useState(initialProduct);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const [nextMedia, nextCategories, nextProducts] = await Promise.all([
      apiRequest<MediaAsset[]>('/owner/catalog/media'),
      apiRequest<Category[]>('/owner/catalog/categories'),
      apiRequest<Product[]>('/owner/catalog/products'),
    ]);
    setMedia(nextMedia);
    setCategories(nextCategories);
    setProducts(nextProducts);
    onSnapshot?.({ media: nextMedia, categories: nextCategories, products: nextProducts });
    setCategoryDraft((current) => ({
      ...current,
      imageAssetId: current.imageAssetId || nextMedia[0]?.id || '',
    }));
  }

  useEffect(() => {
    void refresh()
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load catalog.'),
      )
      .finally(() => setLoading(false));
  }, []);

  function resetFeedback() {
    setError('');
    setNotice('');
  }

  async function submitMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    resetFeedback();
    try {
      await apiRequest('/owner/catalog/media', {
        method: 'POST',
        body: JSON.stringify({ ...mediaDraft, sizeBytes: Number(mediaDraft.sizeBytes) }),
      });
      setMediaDraft(initialMedia);
      await refresh();
      setNotice('Media asset registered.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not register media.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    resetFeedback();
    try {
      await apiRequest('/owner/catalog/categories', {
        method: 'POST',
        body: JSON.stringify({
          ...categoryDraft,
          parentId: categoryDraft.parentId || null,
        }),
      });
      setCategoryDraft({ ...initialCategory, imageAssetId: media[0]?.id ?? '' });
      await refresh();
      setNotice('Category created.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create category.');
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    resetFeedback();
    try {
      await apiRequest('/owner/catalog/products', {
        method: 'POST',
        body: JSON.stringify({
          ...productDraft,
          imageAssetIds: productImages,
          primaryImageAssetId: productImages[0],
          categoryIds: productCategories,
        }),
      });
      setProductDraft(initialProduct);
      setProductImages([]);
      setProductCategories([]);
      await refresh();
      setNotice('Product created.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create product.');
    } finally {
      setBusy(false);
    }
  }

  async function archiveProduct(product: Product) {
    setBusy(true);
    resetFeedback();
    try {
      await apiRequest(`/owner/catalog/products/${product.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ revision: product.revision }),
      });
      await refresh();
      setNotice('Product archived.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive product.');
    } finally {
      setBusy(false);
    }
  }

  async function archiveCategory(category: Category) {
    setBusy(true);
    resetFeedback();
    try {
      await apiRequest(`/owner/catalog/categories/${category.id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ revision: category.revision }),
      });
      await refresh();
      setNotice('Category archived.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive category.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={`panel catalog-workspace catalog-section-${section}`}
      aria-labelledby="catalog-heading"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t('CATALOG')}</div>
          <h2 id="catalog-heading">{t('Products and categories')}</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={busy}
        >
          {t('Refresh')}
        </Button>
      </div>
      <p>{t('Keep your catalog organized, complete, and easy to manage.')}</p>
      {error && (
        <p className="error" role="alert">
          {errorText(error)}
        </p>
      )}
      {notice && (
        <p className="catalog-notice" role="status">
          {t(notice)}
        </p>
      )}
      {loading ? (
        <p>{t('Loading catalog…')}</p>
      ) : (
        <>
          <div className="catalog-forms">
            <form className="catalog-form" onSubmit={(event) => void submitMedia(event)}>
              <h3>{t('Add image')}</h3>
              <label>
                {t('Storage key')}
                <Input
                  required
                  value={mediaDraft.storageKey}
                  onChange={(event) =>
                    setMediaDraft({ ...mediaDraft, storageKey: event.target.value })
                  }
                />
              </label>
              <label>
                {t('Image URL')}
                <Input
                  required
                  type="url"
                  value={mediaDraft.publicUrl}
                  onChange={(event) =>
                    setMediaDraft({ ...mediaDraft, publicUrl: event.target.value })
                  }
                />
              </label>
              <label>
                {t('File size in bytes')}
                <Input
                  required
                  type="number"
                  min="1"
                  value={mediaDraft.sizeBytes}
                  onChange={(event) =>
                    setMediaDraft({ ...mediaDraft, sizeBytes: event.target.value })
                  }
                />
              </label>
              <label>
                {t('Format')}
                <select
                  value={mediaDraft.mimeType}
                  onChange={(event) =>
                    setMediaDraft({ ...mediaDraft, mimeType: event.target.value })
                  }
                >
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </label>
              <Button type="submit" disabled={busy}>
                {t('Add image')}
              </Button>
            </form>

            <form className="catalog-form" onSubmit={(event) => void submitCategory(event)}>
              <h3>{t('Create category')}</h3>
              <label>
                {t('Category name')}
                <Input
                  required
                  value={categoryDraft.name}
                  onChange={(event) =>
                    setCategoryDraft({ ...categoryDraft, name: event.target.value })
                  }
                />
              </label>
              <label>
                {t('Category image')}
                <select
                  required
                  value={categoryDraft.imageAssetId}
                  onChange={(event) =>
                    setCategoryDraft({ ...categoryDraft, imageAssetId: event.target.value })
                  }
                >
                  <option value="">{t('Select image')}</option>
                  {media.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.storageKey}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Parent category')}
                <select
                  value={categoryDraft.parentId}
                  onChange={(event) =>
                    setCategoryDraft({ ...categoryDraft, parentId: event.target.value })
                  }
                >
                  <option value="">{t('Main category')}</option>
                  {categories
                    .filter((category) => !category.parentId && !category.archivedAt)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t('Availability')}
                <select
                  value={categoryDraft.availability}
                  onChange={(event) =>
                    setCategoryDraft({ ...categoryDraft, availability: event.target.value })
                  }
                >
                  <option value="available">{t('Available')}</option>
                  <option value="unavailable">{t('Unavailable')}</option>
                </select>
              </label>
              <Button type="submit" disabled={busy || media.length === 0}>
                {t('Create category')}
              </Button>
            </form>

            <form className="catalog-form" onSubmit={(event) => void submitProduct(event)}>
              <h3>{t('Create product')}</h3>
              <label>
                {t('Product name')}
                <Input
                  required
                  value={productDraft.name}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, name: event.target.value })
                  }
                />
              </label>
              <label>
                {t('Base price (EGP)')}
                <Input
                  required
                  inputMode="decimal"
                  value={productDraft.basePrice}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, basePrice: event.target.value })
                  }
                />
              </label>
              <label>
                {t('Availability')}
                <select
                  value={productDraft.availability}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, availability: event.target.value })
                  }
                >
                  <option value="available">{t('Available')}</option>
                  <option value="unavailable">{t('Unavailable')}</option>
                </select>
              </label>
              <fieldset>
                <legend>{t('Product images')}</legend>
                {media.length === 0 ? (
                  <small>{t('Add an image first.')}</small>
                ) : (
                  media.map((asset) => (
                    <label className="catalog-check" key={asset.id}>
                      <input
                        type="checkbox"
                        checked={productImages.includes(asset.id)}
                        onChange={(event) =>
                          setProductImages(
                            event.target.checked
                              ? [...productImages, asset.id]
                              : productImages.filter((id) => id !== asset.id),
                          )
                        }
                      />
                      {asset.storageKey}
                    </label>
                  ))
                )}
              </fieldset>
              <fieldset>
                <legend>{t('Categories')}</legend>
                {categories.length === 0 ? (
                  <small>{t('Create a category first.')}</small>
                ) : (
                  categories.map((category) => (
                    <label className="catalog-check" key={category.id}>
                      <input
                        type="checkbox"
                        checked={productCategories.includes(category.id)}
                        onChange={(event) =>
                          setProductCategories(
                            event.target.checked
                              ? [...productCategories, category.id]
                              : productCategories.filter((id) => id !== category.id),
                          )
                        }
                      />
                      {category.name}
                    </label>
                  ))
                )}
              </fieldset>
              <Button
                type="submit"
                disabled={busy || productImages.length === 0 || productCategories.length === 0}
              >
                {t('Create product')}
              </Button>
            </form>
          </div>

          {section === 'media' && (
            <div className="media-gallery">
              {media.length === 0 ? (
                <p>{t('No media yet.')}</p>
              ) : (
                media
                  .filter((asset) =>
                    asset.storageKey.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                  )
                  .map((asset) => (
                    <article key={asset.id}>
                      <img src={asset.publicUrl} alt={asset.storageKey} loading="lazy" />
                      <strong>{asset.storageKey}</strong>
                      <small>
                        {asset.mimeType} · {Math.ceil(asset.sizeBytes / 1024)} KB
                      </small>
                    </article>
                  ))
              )}
            </div>
          )}
          {search && (
            <p role="status">
              {t('Search results')}:{' '}
              {section === 'media'
                ? media.filter((asset) =>
                    asset.storageKey.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                  ).length
                : section === 'categories'
                  ? categories.filter((category) =>
                      category.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                    ).length
                  : products.filter((product) =>
                      product.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                    ).length}
            </p>
          )}
          <div className="catalog-lists">
            <div>
              <h3>{t('Categories')}</h3>
              {categories.length === 0 ? (
                <p>{t('No categories yet.')}</p>
              ) : (
                categories
                  .filter((category) =>
                    category.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                  )
                  .map((category) => (
                    <div className="catalog-row" key={category.id}>
                      <span>
                        <strong>
                          {category.parentId ? '↳ ' : ''}
                          {category.name}
                        </strong>
                        <small>
                          {category.availability}
                          {category.archivedAt ? ' · archived' : ''}
                        </small>
                      </span>
                      {!category.archivedAt && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void archiveCategory(category)}
                        >
                          {t('Archive')}
                        </Button>
                      )}
                    </div>
                  ))
              )}
            </div>
            <div>
              <h3>{t('Products')}</h3>
              {products.length === 0 ? (
                <p>{t('No products yet.')}</p>
              ) : (
                products
                  .filter((product) =>
                    product.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                  )
                  .map((product) => (
                    <div className="catalog-row" key={product.id}>
                      <span>
                        <strong>{product.name}</strong>
                        <small>
                          {product.basePrice} EGP · {product.availability}
                          {product.archivedAt ? ' · archived' : ''}
                        </small>
                      </span>
                      {!product.archivedAt && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void archiveProduct(product)}
                        >
                          {t('Archive')}
                        </Button>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
