import { useRef } from 'react';
import type { RestaurantImage } from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
export function RestaurantImageField({
  kind,
  value,
  onChange,
  onUpload,
}: {
  kind: 'logo' | 'cover';
  value: RestaurantImage | null;
  onChange: (image: RestaurantImage | null) => void;
  onUpload: (file?: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const title = kind === 'logo'
    ? (ar ? 'شعار المطعم' : 'Restaurant logo')
    : (ar ? 'غلاف المطعم' : 'Restaurant cover');
  return (
    <section className={`rs-image-card rs-image-${kind}`} aria-label={title}>
      <div className="rs-image-preview">
        {value?.src ? (
          <img src={value.src} alt={value.alt} />
        ) : (
          <div className="rs-image-empty">
            <Icon name="image" />
            <span>{title}</span>
          </div>
        )}
      </div>
      <div className="rs-image-caption">
        <div>
          <strong>{title}</strong>
          <small>
            {kind === 'logo'
              ? (ar ? 'صورة مربعة، حتى 10 ميجابايت' : 'Square image, up to 10 MB')
              : (ar ? 'صورة أفقية، حتى 10 ميجابايت' : 'Landscape image, up to 10 MB')}
          </small>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <Icon name="upload" />
          {value ? (ar ? 'تغيير' : 'Replace') : (ar ? 'رفع صورة' : 'Upload')}
        </Button>
      </div>
      <Input
        ref={input}
        className="rs-file-input"
        type="file"
        aria-label={ar ? `رفع ${title}` : `Upload ${title.toLowerCase()}`}
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          onUpload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <details className="rs-image-details">
        <summary>{ar ? 'رابط الصورة والتفاصيل' : 'Image link and details'}</summary>
        <label>
          {ar ? 'رابط الصورة' : 'Image link'}
          <Input
            type="url"
            value={value?.src ?? ''}
            placeholder="https://…"
            onChange={(event) =>
              onChange(
                event.target.value ? { src: event.target.value, alt: value?.alt ?? title } : null,
              )
            }
          />
        </label>
        <label>
          {ar ? 'وصف الصورة' : 'Image description'}
          <Input
            maxLength={500}
            value={value?.alt ?? ''}
            disabled={!value}
            onChange={(event) => {
              if (value) onChange({ ...value, alt: event.target.value });
            }}
          />
        </label>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {ar ? 'إزالة الصورة' : 'Remove image'}
          </Button>
        )}
      </details>
    </section>
  );
}
