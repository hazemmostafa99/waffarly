import { Menu, ShieldCheck } from 'lucide-react';
import { Button, LanguageSwitcher, useLocale } from '@waffarly/ui';
import { useAdminUiStore } from '../stores/admin-ui-store.js';
import { useContext } from 'react';
import { PageTitleContext } from '../lib/page-title-context.js';

interface AdminTopbarProps {
  adminName: string;
  onSignOut: () => void;
  signingOut: boolean;
}

export function AdminTopbar({ adminName, onSignOut, signingOut }: AdminTopbarProps) {
  const { t } = useLocale();
  const pageTitle = useContext(PageTitleContext);
  const setMobileNavigationOpen = useAdminUiStore((state) => state.setMobileNavigationOpen);

  return (
    <header className="admin-topbar flex flex-wrap items-center justify-between border-b border-waffarly-border bg-waffarly-surface">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          className="admin-menu-toggle grid size-9 shrink-0 place-items-center rounded-lg border border-waffarly-border bg-white text-waffarly-ink min-[901px]:hidden"
          type="button"
          aria-label={t('Open navigation')}
          onClick={() => setMobileNavigationOpen(true)}
        >
          <Menu size={19} />
        </button>
        <div className="min-w-0">
          <span className="block truncate text-[10px] font-semibold text-waffarly-muted">
            {t('Waffarly platform')}
          </span>
          <h1 className="m-0 text-base font-bold leading-snug text-waffarly-ink md:text-lg">
            {pageTitle?.title ?? t('Administration workspace')}
          </h1>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        <span className="hidden h-8 w-px bg-waffarly-border sm:block" aria-hidden="true" />
        <div className="hidden items-center gap-2 sm:flex">
          <span
            className="grid size-9 place-items-center rounded-full bg-waffarly-kpi-mint text-waffarly-primary"
            aria-hidden="true"
          >
            <ShieldCheck size={17} />
          </span>
          <span className="max-w-40">
            <strong className="block truncate text-xs text-waffarly-ink">{adminName}</strong>
            <small className="block text-[10px] text-waffarly-muted">
              {t('Platform administrator')}
            </small>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-waffarly-border bg-white px-2.5 text-xs text-waffarly-ink hover:bg-waffarly-input sm:px-3"
          onClick={onSignOut}
          disabled={signingOut}
        >
          {signingOut ? t('Signing out…') : t('Sign out')}
        </Button>
      </div>
    </header>
  );
}
