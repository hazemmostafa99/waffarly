import { useState } from 'react';
import { DataTable, useLocale } from '@waffarly/ui';
import type { Category, MediaAsset } from './CatalogWorkspace.js';
import { DashboardDialog } from './components/DashboardDialog.js';
import { apiRequest } from './lib/api-client.js';
import { parseProductCsv, type ImportedProduct } from './product-import.js';
import { productsCopy } from './products-copy.js';

export function ProductImport({
  categories,
  media,
  onClose,
  onImported,
}: {
  categories: Category[];
  media: MediaAsset[];
  onClose: () => void;
  onImported: (complete: boolean) => Promise<void>;
}) {
  const { locale, formatNumber } = useLocale();
  const copy = (text: string) => productsCopy(text, locale);
  const [rows, setRows] = useState<ImportedProduct[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [imageId, setImageId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function readFile(file?: File) {
    setRows([]);
    setError('');
    if (!file) return;
    try {
      setRows(parseProductCsv(await file.text()));
    } catch {
      setError(
        copy(
          'Invalid CSV. Check the name, positive price, and availability (available or unavailable).',
        ),
      );
    }
  }
  async function importRows() {
    setBusy(true);
    setError('');
    let completed = 0;
    try {
      for (const row of rows) {
        await apiRequest('/owner/catalog/products', {
          method: 'POST',
          body: JSON.stringify({
            ...row,
            categoryIds: [categoryId],
            imageAssetIds: [imageId],
            primaryImageAssetId: imageId,
          }),
        });
        completed++;
      }
      setRows([]);
      await onImported(true);
      onClose();
    } catch {
      setRows((current) => current.slice(completed));
      setError(
        copy(
          'Import stopped. Successfully imported rows were removed from the preview; you can retry the remaining rows.',
        ),
      );
      if (completed) await onImported(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <DashboardDialog
      title={copy('Import products')}
      closeLabel={copy('Close')}
      onClose={onClose}
      busy={busy}
    >
      <div className="products-form">
        <p>{copy('Use a CSV with name, basePrice, and optional availability columns.')}</p>
        <code className="products-csv-example" dir="ltr">
          name,basePrice,availability
          <br />
          Classic Burger,145.00,available
        </code>
        {error && (
          <p role="alert" className="products-error">
            {error}
          </p>
        )}
        <label>
          {copy('CSV file')}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
        </label>
        <p>{copy('Imported products will use the category and image you choose below.')}</p>
        <div className="products-form-grid">
          <label>
            {copy('Category')}
            <select
              value={categoryId}
              disabled={busy}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">{copy('Choose category')}</option>
              {categories
                .filter((category) => !category.archivedAt)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {copy('Product images')}
            <select
              value={imageId}
              disabled={busy}
              onChange={(event) => setImageId(event.target.value)}
            >
              <option value="">{copy('Choose image')}</option>
              {media.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.storageKey}
                </option>
              ))}
            </select>
          </label>
        </div>
        {rows.length > 0 && (
          <DataTable
            caption={copy('Import preview')}
            rows={rows.slice(0, 6).map((row, index) => ({ ...row, index }))}
            rowKey={(row) => row.index}
            emptyState=""
            columns={[
              { id: 'name', header: copy('Product'), cell: (row) => row.name },
              { id: 'price', header: copy('Base price'), cell: (row) => `EGP ${formatNumber(Number(row.basePrice), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            ]}
          />
        )}
        <footer>
          <span>
            {formatNumber(rows.length)} {copy('products')}
          </span>
          <button
            type="button"
            className="products-button primary"
            disabled={busy || !rows.length || !categoryId || !imageId}
            onClick={() => void importRows()}
          >
            {copy('Import remaining products')}
          </button>
        </footer>
      </div>
    </DashboardDialog>
  );
}
