import { useRef } from 'react';
import type { RestaurantImage } from '@waffarly/contracts';
import { Button, Input } from '@waffarly/ui';
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
  const title = kind === 'logo' ? 'شعار المطعم' : 'غلاف المطعم';
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
          <small>{kind === 'logo' ? 'صورة مربعة واضحة' : 'صورة أفقية لكارت المطعم'}</small>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <Icon name="upload" />
          {value ? 'تغيير' : 'رفع صورة'}
        </Button>
      </div>
      <Input
        ref={input}
        className="rs-file-input"
        type="file"
        aria-label={`رفع ${title}`}
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          onUpload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <details className="rs-image-details">
        <summary>رابط الصورة والتفاصيل</summary>
        <label>
          رابط الصورة
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
          وصف الصورة
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
            إزالة الصورة
          </Button>
        )}
      </details>
    </section>
  );
}
