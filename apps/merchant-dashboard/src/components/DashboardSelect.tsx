import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Input, useLocale } from '@waffarly/ui';
import { Icon } from '../Icons.js';
import './PagedEntitySelect.css';

/** Local options use the same searchable control and menu as the dashboard entity picker. */
export function DashboardSelect({
  label,
  value,
  options,
  onChange,
  name,
  required = false,
  disabled = false,
  placeholder,
  footer,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  footer?: ReactNode;
}) {
  const { locale } = useLocale();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  useEffect(() => {
    input.current?.setCustomValidity(
      required && !selected?.value
        ? locale === 'ar'
          ? 'اختر قيمة من القائمة.'
          : 'Choose an option from the list.'
        : '',
    );
  }, [required, selected, locale]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, active, open]);
  function choose(option: { value: string; label: string }) {
    onChange(option.value);
    setOpen(false);
    setSearch('');
  }
  return (
    <div ref={root} className="entity-picker entity-picker--combobox dashboard-select">
      {name && <input type="hidden" name={name} value={value} />}
      <div className="entity-picker-combobox">
        <div className={`entity-picker-combobox-control${open ? ' is-open' : ''}`}>
          <Icon name="search" />
          <Input
            ref={input}
            className="entity-picker-combobox-input"
            role="combobox"
            aria-label={label}
            aria-required={required}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={open ? id : undefined}
            aria-activedescendant={open && filtered[active] ? `${id}-${active}` : undefined}
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder ?? (locale === 'ar' ? 'اختر من القائمة' : 'Choose an option')}
            value={open ? search : (selected?.label ?? '')}
            onFocus={() => {
              setOpen(true);
              setSearch('');
              setActive(0);
            }}
            onClick={() => {
              setOpen(true);
              setSearch('');
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onBlur={(event) => {
              if (!(
                event.relatedTarget instanceof Node && root.current?.contains(event.relatedTarget)
              )) {
                setOpen(false);
                setSearch('');
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                setActive((current) =>
                  Math.max(
                    0,
                    Math.min(filtered.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)),
                  ),
                );
              }
              if (event.key === 'Enter' && open) {
                event.preventDefault();
                if (filtered[active]) choose(filtered[active]);
              }
              if (event.key === 'Escape' && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setSearch('');
              }
              if (event.key === 'Tab') {
                setOpen(false);
                setSearch('');
              }
            }}
          />
          <span className={`entity-picker-combobox-chevron${open ? ' is-open' : ''}`}>
            <Icon name="chevron" />
          </span>
        </div>
        {open && (
          <div className="entity-picker-menu">
            <div className="entity-picker-listbox" id={id} role="listbox" aria-label={label}>
              {filtered.map((option, index) => (
                <div
                  key={option.value}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={`entity-picker-option${active === index ? ' is-active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Icon name="check" />}
                </div>
              ))}
            </div>
            {!filtered.length && (
              <div className="entity-picker-menu-message" role="status">
                {locale === 'ar' ? 'لا توجد نتائج مطابقة.' : 'No matching options.'}
              </div>
            )}
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
