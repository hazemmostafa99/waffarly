import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import type { Category, MediaAsset, Product } from './CatalogWorkspace.js';
import { apiRequest } from './lib/api-client.js';
import { productsCopy } from './products-copy.js';
import { DashboardDialog } from './components/DashboardDialog.js';

export function ProductEditor({
  product,
  categories,
  media,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  media: MediaAsset[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { locale, errorText } = useLocale();
  const copy = (text: string) => productsCopy(text, locale);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.basePrice ?? '');
  const [availability, setAvailability] = useState(product?.availability ?? 'available');
  const [imageIds, setImageIds] = useState(
    product?.images.map((image) => image.mediaAssetId) ?? [],
  );
  const [primaryImageId, setPrimaryImageId] = useState(
    product?.images.find((image) => image.isPrimary)?.mediaAssetId,
  );
  const [categoryIds, setCategoryIds] = useState(
    product?.categories.map((category) => category.id) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/owner/catalog/products${product ? `/${product.id}` : ''}`, {
        method: product ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name,
          description,
          basePrice: price,
          availability,
          imageAssetIds: imageIds,
          primaryImageAssetId: imageIds.includes(primaryImageId ?? '')
            ? primaryImageId
            : imageIds[0],
          categoryIds,
          ...(product ? { revision: product.revision } : {}),
        }),
      });
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy('Could not save product.'));
    } finally {
      setBusy(false);
    }
  }
  function toggle(ids: string[], id: string, checked: boolean) {
    return checked ? [...ids, id] : ids.filter((value) => value !== id);
  }
  return (
    <DashboardDialog
      title={copy(product ? 'Edit product' : 'Add Product')}
      closeLabel={copy('Close')}
      onClose={onClose}
      busy={busy}
    >
      <form className="products-form" onSubmit={(event) => void submit(event)}>
        {error && (
          <p className="products-error" role="alert">
            {errorText(error)}
          </p>
        )}
        <fieldset disabled={busy} className="products-fields">
          <label>
            {copy('Product name')}
            <input
              required
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {copy('Description')}
            <textarea
              maxLength={1000}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="products-form-grid">
            <label>
              {copy('Base price (EGP)')}
              <input
                required
                type="number"
                lang="en"
                dir="ltr"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
            <label>
              {copy('Publication status')}
              <select
                value={availability}
                onChange={(event) =>
                  setAvailability(event.target.value as 'available' | 'unavailable')
                }
              >
                <option value="available">{copy('Available')}</option>
                <option value="unavailable">{copy('Unavailable')}</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>{copy('Categories')}</legend>
            {categories
              .filter((category) => !category.archivedAt || categoryIds.includes(category.id))
              .map((category) => (
                <label className="products-check" key={category.id}>
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(category.id)}
                    onChange={(event) =>
                      setCategoryIds(toggle(categoryIds, category.id, event.target.checked))
                    }
                  />
                  {category.name}
                </label>
              ))}
            {!categories.length && (
              <p>
                {copy('Create a category before creating a product.')}{' '}
                <Link to="/categories">{copy('Categories')}</Link>
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend>{copy('Product images')}</legend>
            <div className="products-image-options">
              {media.map((asset) => (
                <div className="products-image-choice" key={asset.id}>
                  <label className="products-check">
                    <input
                      type="checkbox"
                      checked={imageIds.includes(asset.id)}
                      disabled={!imageIds.includes(asset.id) && imageIds.length >= 10}
                      onChange={(event) => {
                        const nextIds = toggle(imageIds, asset.id, event.target.checked);
                        setImageIds(nextIds);
                        if (event.target.checked && !primaryImageId) setPrimaryImageId(asset.id);
                        if (!event.target.checked && asset.id === primaryImageId) {
                          setPrimaryImageId(nextIds[0]);
                        }
                      }}
                    />
                    <img src={asset.publicUrl} alt="" />
                    <span>{asset.storageKey}</span>
                  </label>
                  {imageIds.includes(asset.id) && (
                    <label className="products-primary-image">
                      <input
                        type="radio"
                        name="primary-product-image"
                        checked={primaryImageId === asset.id}
                        onChange={() => setPrimaryImageId(asset.id)}
                      />
                      {copy('Primary image')}
                    </label>
                  )}
                </div>
              ))}
            </div>
            {!media.length && (
              <p>
                {copy('Add an image in Media Library before creating a product.')}{' '}
                <Link to="/media">{copy('Media Library')}</Link>
              </p>
            )}
          </fieldset>
        </fieldset>
        <p className="products-form-hint">{copy('Choose at least one category and one image.')}</p>
        <footer>
          <button type="button" className="products-button" onClick={onClose} disabled={busy}>
            {copy('Cancel')}
          </button>
          <button
            type="submit"
            className="products-button primary"
            disabled={busy || !categoryIds.length || !imageIds.length}
          >
            {copy(product ? 'Save changes' : 'Add Product')}
          </button>
        </footer>
      </form>
    </DashboardDialog>
  );
}
