import { Dialog, Input, Popover, cn, useLocale } from '@waffarly/ui';
import { Check, ChevronUp, FileText, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PosButton } from '../../components/pos-button.js';

export interface PosSwitcherEntry {
  id: string;
  kind: 'draft' | 'confirmed';
  reference: string;
  title: string;
  subtitle: string;
  total?: string | undefined;
  updatedAt: string;
  lastOpenedAt: string;
  empty?: boolean;
  protected?: boolean;
}

export function PosOrderSwitcher({
  entries,
  selectedId,
  onSelect,
  onDelete,
  onCleanEmpty,
  emptyCount,
}: {
  entries: PosSwitcherEntry[];
  selectedId: string;
  onSelect: (entry: PosSwitcherEntry) => void;
  onDelete: (id: string) => void;
  onCleanEmpty: () => void;
  emptyCount: number;
}) {
  const { t, formatNumber } = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'draft' | 'confirmed'>('draft');
  const [deleting, setDeleting] = useState<PosSwitcherEntry | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const selected = entries.find((entry) => entry.id === selectedId);
  const recent = [
    selected,
    ...entries
      .filter((entry) => entry.id !== selectedId)
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)),
  ]
    .filter((entry): entry is PosSwitcherEntry => Boolean(entry))
    .slice(0, 3);
  const query = search.trim().toLocaleLowerCase();
  const matching = entries
    .filter(
      (entry) =>
        entry.kind === kind &&
        `${entry.reference} ${entry.title} ${entry.subtitle}`.toLocaleLowerCase().includes(query),
    )
    .sort(
      (a, b) =>
        Number(b.id === selectedId) - Number(a.id === selectedId) ||
        b.lastOpenedAt.localeCompare(a.lastOpenedAt),
    );
  const timestamp = (value: string) =>
    new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  function changeOpen(value: boolean) {
    if (value) {
      setSearch('');
      setKind(selected?.kind ?? 'draft');
    }
    setOpen(value);
  }
  function select(entry: PosSwitcherEntry) {
    onSelect(entry);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }
  function closeDelete() {
    setDeleting(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }
  const content = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="space-y-3 border-b border-border p-3 sm:p-4">
        {!mobile && (
          <div>
            <h2 className="text-sm font-semibold">{t('All orders')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('Saved for this cashier on this device.')}
            </p>
          </div>
        )}
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute start-3 top-3 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="ps-9"
            aria-label={t('Search saved orders')}
            placeholder={t('Search reference, customer or table...')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1"
          role="group"
          aria-label={t('Order type')}
        >
          {(['draft', 'confirmed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                'min-h-10 rounded-md px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring',
                kind === value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(value === 'draft' ? 'Drafts' : 'Confirmed orders')}{' '}
              <bdi className="ms-1 text-muted-foreground">
                ({formatNumber(entries.filter((entry) => entry.kind === value).length)})
              </bdi>
            </button>
          ))}
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        data-testid="saved-orders-list"
      >
        {matching.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
            {t('No matching saved orders.')}
          </p>
        )}
        {matching.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              'mb-1 flex items-center gap-1 rounded-lg border',
              entry.id === selectedId
                ? 'border-primary bg-[var(--pos-active)]'
                : 'border-transparent hover:bg-secondary',
            )}
          >
            <button
              type="button"
              data-order-id={entry.id}
              aria-pressed={entry.id === selectedId}
              aria-label={`${t(entry.kind === 'draft' ? 'Resume draft' : 'Open confirmed order')} ${entry.reference}`}
              onClick={() => select(entry)}
              className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3 rounded-lg p-3 text-start focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                {entry.id === selectedId ? (
                  <Check size={16} className="text-primary" />
                ) : (
                  <FileText size={16} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{entry.title}</span>
                <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <bdi dir="ltr">{entry.reference}</bdi>
                  <span>{entry.subtitle}</span>
                  {entry.total && <bdi className="font-semibold text-primary">{entry.total}</bdi>}
                </span>
                <time
                  dateTime={entry.updatedAt}
                  className="mt-1 block text-[11px] text-muted-foreground"
                >
                  {timestamp(entry.updatedAt)}
                </time>
                {entry.protected && (
                  <span className="mt-1 block text-xs text-warning">
                    {t('Sale result needs confirmation')}
                  </span>
                )}
              </span>
            </button>
            {entry.kind === 'draft' && (
              <PosButton
                type="button"
                size="icon"
                variant="outline"
                className="me-2 shrink-0"
                disabled={entry.protected}
                aria-label={`${t('Delete draft')} ${entry.reference}`}
                title={
                  entry.protected
                    ? t('Resolve the saved sale request before deleting this draft.')
                    : t('Delete draft')
                }
                onClick={() => {
                  if (entry.empty) onDelete(entry.id);
                  else {
                    setOpen(false);
                    setDeleting(entry);
                  }
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </PosButton>
            )}
          </div>
        ))}
      </div>
      {kind === 'draft' && emptyCount > 0 && (
        <div className="border-t border-border p-3">
          <PosButton type="button" size="sm" className="w-full" onClick={onCleanEmpty}>
            <Trash2 size={14} aria-hidden="true" />
            {t('Remove empty drafts ({{count}})', { count: emptyCount })}
          </PosButton>
        </div>
      )}
    </div>
  );
  const triggerClass =
    'flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring';
  return (
    <>
      <footer
        className="pos-draft-dock flex min-h-[64px] shrink-0 items-center gap-2 border-t border-border bg-card p-2 group-data-[input-mode=true]/pos:hidden"
        aria-label={t('Saved orders')}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {recent.map((entry) => (
            <button
              key={entry.id}
              type="button"
              data-order-id={entry.id}
              aria-pressed={entry.id === selectedId}
              onClick={() => onSelect(entry)}
              className={cn(
                'pos-draft-tab flex min-h-11 min-w-40 max-w-64 shrink-0 items-center gap-2 rounded-lg border px-3 text-start focus-visible:outline-2 focus-visible:outline-ring',
                entry.id === selectedId
                  ? 'is-active border-primary bg-[var(--pos-active)] text-[var(--pos-active-ink)]'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {entry.id === selectedId && (
                <Check className="shrink-0" size={14} aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{entry.title}</span>
                <span className="mt-0.5 flex gap-2 text-xs">
                  <bdi dir="ltr">{entry.reference}</bdi>
                  <span className="truncate">{entry.subtitle}</span>
                </span>
                {entry.total && (
                  <bdi className="block text-xs font-semibold text-primary">{entry.total}</bdi>
                )}
              </span>
            </button>
          ))}
        </div>
        {mobile ? (
          <button
            ref={triggerRef}
            type="button"
            className={triggerClass}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => changeOpen(true)}
          >
            {t('All orders')}
            <span className="rounded bg-secondary px-1.5 py-0.5 tabular-nums">
              {formatNumber(entries.length)}
            </span>
            <ChevronUp size={14} aria-hidden="true" />
          </button>
        ) : (
          <Popover
            open={open}
            onOpenChange={changeOpen}
            label={t('Saved orders')}
            className="bottom-full top-auto mb-4 mt-0 flex max-h-[min(70dvh,560px)] w-[min(480px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl"
            trigger={(props) => (
              <button
                {...props}
                ref={(node) => {
                  props.ref(node);
                  triggerRef.current = node;
                }}
                className={triggerClass}
              >
                {t('All orders')}
                <span className="rounded bg-secondary px-1.5 py-0.5 tabular-nums">
                  {formatNumber(entries.length)}
                </span>
                <ChevronUp size={14} aria-hidden="true" />
              </button>
            )}
          >
            {content}
          </Popover>
        )}
      </footer>
      {mobile && open && (
        <Dialog
          open
          onOpenChange={changeOpen}
          title={t('Saved orders')}
          description={t('Saved for this cashier on this device.')}
          closeLabel={t('Close')}
          className="mb-2 mt-auto flex max-h-[85dvh] flex-col overflow-hidden rounded-xl"
        >
          {content}
        </Dialog>
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value) closeDelete();
          }}
          title={t('Delete draft?')}
          description={t('This removes its items and customer details from this device.')}
          closeLabel={t('Close')}
        >
          <div className="space-y-4 p-5">
            <p className="text-sm font-semibold">
              {deleting.title} <bdi dir="ltr">{deleting.reference}</bdi>
            </p>
            <div className="flex justify-end gap-2">
              <PosButton type="button" onClick={closeDelete}>
                {t('Keep draft')}
              </PosButton>
              <PosButton
                type="button"
                className="border-destructive bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  onDelete(deleting.id);
                  closeDelete();
                }}
              >
                {t('Delete draft')}
              </PosButton>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
