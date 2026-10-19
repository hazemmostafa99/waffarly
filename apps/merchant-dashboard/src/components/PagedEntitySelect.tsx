import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from 'react';
import { Button, Input, useLocale } from '@waffarly/ui';
import type { OwnerProfile } from '@waffarly/contracts';
import { useOutletContext } from 'react-router-dom';
import { Icon } from '../Icons.js';
import { lookupPage, lookupSelection } from '../lib/entity-lookup.js';
import './PagedEntitySelect.css';

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
  emptyState,
  searchMode = 'separate',
  onCreate,
  createLabel,
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
  emptyState?: ReactNode;
  searchMode?: 'separate' | 'combobox';
  onCreate?: ((search: string) => void) | undefined;
  createLabel?: string | undefined;
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listboxId = `entity-picker-${useId()}-listbox`;
  const isCombobox = searchMode === 'combobox';
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
  const hasNoOptions = !loading && options.length === 0;
  const hasSearch = search.trim().length > 0;
  const visibleOptions =
    isCombobox && hasSearch && selected
      ? options.filter(
          (item) =>
            item.id !== selected.id ||
            optionLabel(item).toLowerCase().includes(search.trim().toLowerCase()),
        )
      : options;

  useEffect(() => {
    if (!isCombobox || !isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
        setCursors([]);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isCombobox, isOpen]);

  useEffect(() => {
    if (activeIndex >= visibleOptions.length) setActiveIndex(visibleOptions.length ? 0 : -1);
  }, [activeIndex, visibleOptions.length]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, isOpen, listboxId]);

  function closeCombobox() {
    setIsOpen(false);
    setSearch('');
    setCursors([]);
    setActiveIndex(-1);
  }

  function selectOption(item: T | null) {
    setSelected(item);
    onSelect(item);
    if (isCombobox) closeCombobox();
  }

  return (
    <div
      className={`entity-picker${isCombobox ? ' entity-picker--combobox' : ''}`}
      role={isCombobox ? undefined : 'group'}
      aria-label={isCombobox ? undefined : label}
      ref={isCombobox ? pickerRef : undefined}
    >
      {isCombobox ? (
        <div className="entity-picker-combobox">
          <div className={`entity-picker-combobox-control${isOpen ? ' is-open' : ''}`}>
            <Icon name="search" />
            <Input
              className="entity-picker-combobox-input"
              aria-label={label}
              aria-required={required}
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls={isOpen ? listboxId : undefined}
              aria-activedescendant={
                isOpen && !loading && activeIndex >= 0
                  ? `${listboxId}-option-${activeIndex}`
                  : undefined
              }
              role="combobox"
              type="text"
              autoComplete="off"
              maxLength={160}
              disabled={disabled}
              value={isOpen ? search : selected?.id === value ? optionLabel(selected) : ''}
              placeholder={
                isOpen
                  ? text('Search by name…', 'ابحث بالاسم…')
                  : (emptyLabel ?? text('Choose an option', 'اختر خيارًا'))
              }
              onFocus={() => {
                if (isOpen) return;
                setSearch('');
                setCursors([]);
                setActiveIndex(options.findIndex((item) => item.id === value));
                setIsOpen(true);
              }}
              onBlur={(event) => {
                if (!(
                  event.relatedTarget instanceof Node &&
                  pickerRef.current?.contains(event.relatedTarget)
                )) {
                  closeCombobox();
                }
              }}
              onChange={(event) => {
                setSearch(event.target.value);
                setCursors([]);
                setActiveIndex(0);
                setIsOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  if (!isOpen) setIsOpen(true);
                  setActiveIndex((current) =>
                    visibleOptions.length ? Math.min(current + 1, visibleOptions.length - 1) : -1,
                  );
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (!isOpen) setIsOpen(true);
                  setActiveIndex((current) =>
                    visibleOptions.length
                      ? current < 0
                        ? visibleOptions.length - 1
                        : Math.max(current - 1, 0)
                      : -1,
                  );
                } else if (event.key === 'Enter' && isOpen && !loading && visibleOptions.length) {
                  event.preventDefault();
                  const index = activeIndex < 0 ? 0 : activeIndex;
                  selectOption(visibleOptions[index] ?? null);
                } else if (event.key === 'Escape' && isOpen) {
                  event.preventDefault();
                  closeCombobox();
                }
              }}
            />
            <span className={`entity-picker-combobox-chevron${isOpen ? ' is-open' : ''}`}>
              <Icon name="chevron" />
            </span>
          </div>
          {isOpen && (
            <div className="entity-picker-menu">
              <div
                className="entity-picker-listbox"
                id={listboxId}
                role="listbox"
                aria-label={label}
                aria-busy={loading}
              >
                {!loading &&
                  visibleOptions.map((item, index) => (
                    <div
                      className={`entity-picker-option${activeIndex === index ? ' is-active' : ''}`}
                      id={`${listboxId}-option-${index}`}
                      key={item.id}
                      role="option"
                      aria-selected={value === item.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => selectOption(item)}
                    >
                      <span>{optionLabel(item)}</span>
                      {value === item.id && <Icon name="check" />}
                    </div>
                  ))}
              </div>
              {loading ? (
                <div className="entity-picker-menu-message" role="status">
                  {text('Loading options…', 'جارٍ تحميل الخيارات…')}
                </div>
              ) : !error && visibleOptions.length === 0 ? (
                <div className="entity-picker-menu-message" role="status">
                  {emptyState && !hasSearch ? (
                    <div className="entity-picker-empty">{emptyState}</div>
                  ) : (
                    text(
                      hasSearch ? 'No matches. Try another search.' : 'No options available.',
                      hasSearch ? 'لا توجد نتائج. جرّب كلمة بحث أخرى.' : 'لا توجد خيارات متاحة.',
                    )
                  )}
                </div>
              ) : null}
              {error && (
                <div className="entity-picker-error" role="alert">
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
              {onCreate && (
                <div className="entity-picker-create">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const query = search.trim();
                      closeCombobox();
                      onCreate(query);
                    }}
                  >
                    <Icon name="plus" />
                    {createLabel ?? text('Create new item', 'إنشاء صنف جديد')}
                    {search.trim() && <span>«{search.trim()}»</span>}
                  </Button>
                </div>
              )}
              {(next || cursors.length > 0) && (
                <div className="entity-picker-pages">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || loading || !cursors.length}
                    onClick={() => setCursors((current) => current.slice(0, -1))}
                  >
                    {text('Previous', 'السابق')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
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
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="entity-picker-search">
            <Icon name="search" />
            <Input
              className="entity-picker-search-input"
              aria-label={`${label}: ${text('Search', 'بحث')}`}
              type="search"
              maxLength={160}
              disabled={disabled}
              value={search}
              placeholder={text('Search by name…', 'ابحث بالاسم…')}
              onChange={(event) => {
                setSearch(event.target.value);
                setCursors([]);
              }}
            />
          </div>
          <div className="entity-picker-select">
            <select
              aria-label={label}
              required={required}
              disabled={disabled || loading || hasNoOptions}
              value={value}
              onChange={(event) => {
                const item =
                  options.find((candidate) => candidate.id === event.target.value) ?? null;
                selectOption(item);
              }}
            >
              <option value="">
                {loading
                  ? text('Loading options…', 'جارٍ تحميل الخيارات…')
                  : hasNoOptions
                    ? hasSearch
                      ? text('No matching options', 'لا توجد نتائج مطابقة')
                      : text('No options available', 'لا توجد خيارات متاحة')
                    : (emptyLabel ?? text('Choose an option', 'اختر خيارًا'))}
              </option>
              {options.map((item) => (
                <option key={item.id} value={item.id}>
                  {optionLabel(item)}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </div>
        </>
      )}
      {!isCombobox && (next || cursors.length > 0) && (
        <div className="entity-picker-pages">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || loading || !cursors.length}
            onClick={() => setCursors((current) => current.slice(0, -1))}
          >
            {text('Previous', 'السابق')}
          </Button>
          <Button
            type="button"
            variant="outline"
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
      {!isCombobox && hasNoOptions && !error && !hasSearch && emptyState && (
        <div className="entity-picker-empty" role="status">
          {emptyState}
        </div>
      )}
      {!isCombobox && hasNoOptions && !error && hasSearch && (
        <small className="entity-picker-no-results" role="status">
          {text('No matches. Try another search.', 'لا توجد نتائج. جرّب كلمة بحث أخرى.')}
        </small>
      )}
      {!isCombobox && error && (
        <div className="entity-picker-error" role="alert">
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
