import { useEffect, useEffectEvent, useState } from 'react';
import { Button, Input, useLocale } from '@waffarly/ui';
import type { OwnerProfile } from '@waffarly/contracts';
import { useOutletContext } from 'react-router-dom';
import { lookupPage, lookupSelection } from '../lib/entity-lookup.js';

/** A bounded selector: fetch one search page, and hydrate only the selected identity. */
export function PagedEntitySelect<T extends { id: string; name: string }>({
  path,
  value,
  label,
  onSelect,
  onResolve,
  optionLabel = (item) => item.name,
  disabled = false,
  required = true,
  emptyLabel,
}: {
  path: string;
  value: string;
  label: string;
  onSelect: (item: T | null) => void;
  onResolve?: ((item: T) => void) | undefined;
  optionLabel?: (item: T) => string;
  disabled?: boolean;
  required?: boolean;
  emptyLabel?: string | undefined;
}) {
  const { locale, errorText } = useLocale();
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const tenant = profile.merchantId;
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);
  const [items, setItems] = useState<T[]>([]);
  const [selected, setSelected] = useState<T | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const resolveSelection = useEffectEvent((item: T) => onResolve?.(item));
  const cursor = cursors.at(-1);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ status: 'active', limit: '25', search });
      if (cursor) query.set('cursor', cursor);
      void lookupPage<T>(tenant, `${path}?${query}`)
        .then((page) => {
          if (controller.signal.aborted) return;
          setItems(page.items);
          setNext(page.nextCursor);
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted)
            setError(cause instanceof Error ? errorText(cause.message) : 'Could not load options.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tenant, path, search, cursor, errorText, reload]);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const controller = new AbortController();
    void lookupSelection<T>(tenant, `${path}/${value}`)
      .then((item) => {
        if (controller.signal.aborted) return;
        setSelected(item);
        resolveSelection(item);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? errorText(cause.message) : 'Could not load selection.');
      });
    return () => controller.abort();
  }, [tenant, path, value, errorText, reload]);

  const options =
    selected?.id === value && !items.some((item) => item.id === value)
      ? [selected, ...items]
      : items;
  return (
    <div className="entity-picker" role="group" aria-label={label}>
      <Input
        aria-label={`${label}: ${text('Search', 'بحث')}`}
        type="search"
        maxLength={160}
        disabled={disabled}
        value={search}
        placeholder={text('Search…', 'ابحث…')}
        onChange={(event) => {
          setSearch(event.target.value);
          setCursors([]);
        }}
      />
      <select
        aria-label={label}
        required={required}
        disabled={disabled || loading}
        value={value}
        onChange={(event) => {
          const item = options.find((candidate) => candidate.id === event.target.value) ?? null;
          setSelected(item);
          onSelect(item);
        }}
      >
        <option value="">
          {loading ? text('Loading…', 'جارٍ التحميل…') : (emptyLabel ?? text('Choose…', 'اختر…'))}
        </option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {optionLabel(item)}
          </option>
        ))}
      </select>
      {(next || cursors.length > 0) && (
        <div className="entity-picker-pages">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || loading || !cursors.length}
            onClick={() => setCursors((current) => current.slice(0, -1))}
          >
            {text('Previous', 'السابق')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || loading || !next}
            onClick={() => {
              if (next) setCursors((current) => [...current, next]);
            }}
          >
            {text('Next', 'التالي')}
          </Button>
        </div>
      )}
      {!loading && !items.length && !error && (
        <small>{text('No matching options.', 'لا توجد نتائج مطابقة.')}</small>
      )}
      {error && (
        <div role="alert">
          <small>{error}</small>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || loading}
            onClick={() => setReload((current) => current + 1)}
          >
            {text('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      )}
    </div>
  );
}
