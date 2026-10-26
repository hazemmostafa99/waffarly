import { useMemo, useRef, useState } from 'react';
import { Button, Dialog, Input } from '@waffarly/ui';
import type { CatalogMediaAsset } from '@waffarly/contracts';
import { Icon } from '../Icons.js';

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageSize = 10 * 1024 * 1024;

function isSupportedMediaImage(asset: CatalogMediaAsset): boolean {
  return supportedImageTypes.has(asset.mimeType);
}

function fileName(asset: CatalogMediaAsset): string {
  return asset.storageKey.split(/[\\/]/).pop() || asset.storageKey;
}

export function MediaImagePickerDialog({
  assets,
  selectedId,
  copy,
  errorText,
  onClose,
  onApply,
  onUpload,
}: {
  assets: CatalogMediaAsset[];
  selectedId: string;
  copy: (message: string) => string;
  errorText: (message: string) => string;
  onClose: () => void;
  onApply: (asset: CatalogMediaAsset) => void;
  onUpload: (file: File) => Promise<CatalogMediaAsset>;
}) {
  const [search, setSearch] = useState('');
  const [draftSelectedId, setDraftSelectedId] = useState(selectedId);
  const [uploadedAsset, setUploadedAsset] = useState<CatalogMediaAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const images = useMemo(
    () => assets.filter(isSupportedMediaImage),
    [assets],
  );
  const visibleImages = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return images;
    return images.filter((asset) =>
      fileName(asset).toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [images, search]);
  const selectedAsset =
    images.find((asset) => asset.id === draftSelectedId) ??
    (uploadedAsset?.id === draftSelectedId ? uploadedAsset : null);

  async function upload(file: File) {
    setError('');
    if (!supportedImageTypes.has(file.type) || file.size <= 0 || file.size > maxImageSize) {
      setError(copy('Choose a JPEG, PNG, or WebP image up to 10 MB.'));
      return;
    }

    setBusy(true);
    try {
      const asset = await onUpload(file);
      setUploadedAsset(asset);
      setDraftSelectedId(asset.id);
      setSearch('');
    } catch (cause) {
      setError(
        cause instanceof Error ? errorText(cause.message) : copy('Could not upload the image.'),
      );
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={copy('Choose category image')}
      description={copy('Choose one image from your library or upload a new one.')}
      closeLabel={copy('Close image picker')}
      className="media-image-picker-dialog"
    >
      <div className="media-image-picker-content">
        <div className="media-image-picker-toolbar">
          <label className="media-image-picker-search">
            <Icon name="search" />
            <Input
              type="search"
              autoFocus
              maxLength={160}
              aria-label={copy('Search images')}
              placeholder={copy('Search by file name...')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="upload" />
            {copy(busy ? 'Uploading...' : 'Upload image')}
          </Button>
          <input
            ref={fileInputRef}
            className="media-image-picker-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>

        {error && (
          <p className="media-image-picker-error" role="alert">
            {error}
          </p>
        )}

        {visibleImages.length ? (
          <div
            className="media-image-picker-grid"
            role="group"
            aria-label={copy('Available images')}
          >
            {visibleImages.map((asset) => {
              const selected = draftSelectedId === asset.id;
              const name = fileName(asset);
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`media-image-picker-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setDraftSelectedId(asset.id)}
                >
                  <span className="media-image-picker-thumbnail">
                    <img src={asset.publicUrl} alt="" loading="lazy" />
                    {selected && <Icon name="check" />}
                  </span>
                  <span className="media-image-picker-name" title={name}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="media-image-picker-empty" role="status">
            {images.length
              ? copy('No images match this search.')
              : copy('No images in your library yet. Upload one to use it here.')}
          </p>
        )}

        <footer className="media-image-picker-footer">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {copy('Cancel')}
          </Button>
          <Button
            type="button"
            disabled={busy || !selectedAsset}
            onClick={() => {
              if (selectedAsset) onApply(selectedAsset);
              onClose();
            }}
          >
            <Icon name="check" />
            {copy('Use image')}
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
