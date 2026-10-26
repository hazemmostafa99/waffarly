import { cn, useLocale } from '@waffarly/ui';
import {
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  Palette,
  ReceiptText,
  ShoppingBag,
  Sun,
  Utensils,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  hasPosEmployeePermission,
  posEmployeeHome,
  type PosEmployeeSession,
} from '@waffarly/contracts';
import { PosButton } from '../../components/pos-button.js';
import { usePosViewport } from '../../lib/use-pos-viewport.js';
import { isReadablePosLabel } from '../../lib/display-label.js';
import { usePosAppearanceStore } from '../../app/pos-appearance-store.js';
import { getPosAppearance, posAppearanceKey } from './pos-appearance.api.js';
import '@waffarly/ui/pos-theme.css';

export function PosWorkspaceFrame({
  employee,
  branchName,
  signingOut,
  onSignOut,
  children,
}: {
  employee: PosEmployeeSession;
  branchName: string;
  signingOut: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const { t, locale, setLocale } = useLocale();
  const location = useLocation();
  const theme = usePosAppearanceStore((state) => state.theme);
  const setTheme = usePosAppearanceStore((state) => state.setTheme);
  const appearanceQuery = useQuery({
    queryKey: posAppearanceKey(employee.merchantId),
    queryFn: getPosAppearance,
    staleTime: 60_000,
    retry: false,
  });
  const accent = appearanceQuery.data?.accent ?? 'orange';
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const viewport = usePosViewport();
  const selling = location.pathname === '/catalog';
  useEffect(() => {
    if (!selling || !viewport.editing) return;
    const frame = requestAnimationFrame(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest('#main-content'))
        focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [selling, viewport.height, viewport.top, viewport.editing]);
  const selectedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const displayName = employee.displayName.trim();
  const hasDisplayName = isReadablePosLabel(displayName);
  const operatorName = hasDisplayName ? displayName : t('POS operator');
  const employeeInitials =
    displayName
      .match(/[\p{L}\p{N}]/gu)
      ?.slice(0, 2)
      .join('') ?? '';
  const visibleBranchName = isReadablePosLabel(branchName) ? branchName.trim() : t('Branch');
  const navigation = [
    ...(hasPosEmployeePermission(employee, 'view_orders')
      ? [{ to: '/', label: 'Incoming orders', icon: LayoutDashboard, end: true }]
      : []),
    ...(employee.permissions.includes('sell')
      ? [
          { to: '/catalog', label: 'New sale', icon: ShoppingBag },
          { to: '/dining', label: 'Tables', icon: Utensils },
          { to: '/deliveries', label: 'Delivery follow-up', icon: ShoppingBag },
        ]
      : []),
    ...(hasPosEmployeePermission(employee, 'view_receipts')
      ? [{ to: '/receipts', label: 'Receipts', icon: ReceiptText }]
      : []),
    ...(hasPosEmployeePermission(employee, 'view_inventory')
      ? [{ to: '/inventory', label: 'Inventory', icon: LayoutGrid }]
      : []),
    ...(employee.permissions.includes('open_register_shift')
      ? [{ to: '/shift', label: 'Register shift', icon: LayoutGrid }]
      : []),
  ];

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  return (
    <div
      className={cn(
        'pos-theme pos-workspace-theme group/pos min-h-dvh bg-background font-sans text-sm text-foreground lg:h-dvh lg:min-h-0 lg:overflow-hidden',
        selling && 'h-dvh min-h-0 overflow-hidden',
      )}
      style={selling && window.innerWidth < 1024 ? { height: viewport.height } : undefined}
      data-input-mode={selling && viewport.editing}
      data-theme={selectedTheme}
      data-accent={accent}
    >
      <a
        className="fixed start-2 top-2 z-50 -translate-y-[150%] rounded-lg bg-primary px-3 py-2 text-primary-foreground focus:translate-y-0"
        href="#main-content"
      >
        {t('Skip to content')}
      </a>
      <div className={cn('flex min-h-dvh lg:h-full lg:min-h-0', selling && 'h-full min-h-0')}>
        <nav
          className="pos-workspace-rail fixed inset-x-0 bottom-0 z-20 flex h-16 w-full flex-row items-center justify-around border-t border-border bg-[var(--pos-rail)] px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] group-data-[input-mode=true]/pos:hidden lg:sticky lg:inset-x-auto lg:top-0 lg:h-dvh lg:w-[76px] lg:shrink-0 lg:flex-col lg:justify-start lg:border-t-0 lg:border-e lg:px-2 lg:py-5 xl:w-[90px]"
          aria-label={t('POS navigation')}
        >
          <NavLink
            to={posEmployeeHome(employee)}
            aria-label={t('Waffarly POS')}
            className="mb-8 hidden size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:flex"
          >
            <LayoutGrid aria-hidden="true" size={24} />
          </NavLink>
          <div className="flex w-full flex-row gap-1 lg:flex-col lg:gap-3">
            {navigation.map(({ to, label, icon: Icon, ...props }) => (
              <NavLink
                key={to}
                to={to}
                end={'end' in props ? props.end : false}
                title={t(label)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] leading-tight font-medium transition-colors lg:min-h-[67px] lg:flex-none lg:gap-2 lg:text-xs xl:text-[13px]',
                    isActive
                      ? 'bg-[var(--pos-active)] text-[var(--pos-active-ink)]'
                      : 'text-muted-foreground hover:bg-secondary',
                  )
                }
              >
                <Icon aria-hidden="true" size={21} strokeWidth={1.6} />
                <span className="line-clamp-2 max-w-full text-balance">{t(label)}</span>
              </NavLink>
            ))}
          </div>
          <div className="mt-auto hidden max-w-full flex-col items-center gap-4 pt-8 lg:flex">
            <span className="flex size-10 items-center justify-center rounded-full border-4 border-card bg-[var(--pos-peach)] text-sm font-semibold text-[var(--pos-art-ink)]">
              {hasDisplayName && employeeInitials ? (
                employeeInitials.toLocaleUpperCase()
              ) : (
                <UserRound aria-hidden="true" size={16} />
              )}
            </span>
            <span className="line-clamp-2 max-w-16 text-center text-xs leading-tight text-muted-foreground">
              {operatorName}
            </span>
          </div>
        </nav>

        <div
          className={cn(
            'flex min-h-dvh min-w-0 flex-1 flex-col pb-16 lg:h-full lg:min-h-0 lg:pb-0',
            selling && 'h-full min-h-0 group-data-[input-mode=true]/pos:pb-0',
          )}
        >
          <header
            className={cn(
              'flex min-h-[76px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 group-data-[input-mode=true]/pos:hidden sm:px-5 xl:px-7',
              selling && 'min-h-16 gap-2 py-2',
            )}
          >
            <div className={cn('flex min-w-0 items-center gap-3', selling && 'hidden lg:flex')}>
              <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-border sm:flex">
                <LayoutGrid aria-hidden="true" size={17} strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {visibleBranchName}{' '}
                  <span className="mx-2 font-normal text-muted-foreground">/</span>
                  <span className="font-normal text-muted-foreground">{operatorName}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t('POS workspace')}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span className="me-2 hidden items-center gap-1.5 text-xs text-success xl:inline-flex">
                <span className="size-1.5 rounded-full bg-current" />
                {t('Live POS')}
              </span>
              <div className="flex h-10 items-center gap-1 rounded-lg border border-border px-2">
                {selectedTheme === 'dark' ? (
                  <Moon aria-hidden="true" size={15} />
                ) : (
                  <Sun aria-hidden="true" size={15} />
                )}
                <select
                  aria-label={t('Theme')}
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as 'light' | 'dark' | 'system')}
                  className="max-w-24 bg-transparent text-xs"
                >
                  <option value="light">{t('Light')}</option>
                  <option value="dark">{t('Dark')}</option>
                  <option value="system">{t('System')}</option>
                </select>
              </div>
              <span
                className="pos-merchant-accent flex min-h-10 items-center gap-2 rounded-lg border border-border px-2.5 text-xs font-medium"
                aria-label={
                  appearanceQuery.isError
                    ? t('Merchant accent unavailable; using orange default')
                    : t('Merchant accent')
                }
                title={
                  appearanceQuery.isError
                    ? t('Merchant accent unavailable; using orange default')
                    : t('Set by merchant')
                }
              >
                <Palette aria-hidden="true" size={15} />
                <span className="hidden sm:inline">{t('Accent')}</span>
                <span className="size-3.5 rounded-full bg-primary ring-2 ring-background ring-offset-1 ring-offset-border" />
              </span>
              <PosButton
                type="button"
                variant="outline"
                aria-label={t('Change language')}
                className="pos-workspace-language min-h-10 rounded-lg px-3 text-xs"
                onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
              >
                {locale === 'en' ? 'العربية' : 'English'}
              </PosButton>
              <PosButton
                type="button"
                variant="outline"
                aria-label={signingOut ? t('Signing out…') : t('Sign out')}
                className="min-h-10 gap-2 rounded-lg px-3 text-xs"
                disabled={signingOut}
                onClick={onSignOut}
              >
                <LogOut aria-hidden="true" size={15} />
                <span className="hidden sm:inline">
                  {signingOut ? t('Signing out…') : t('Sign out')}
                </span>
              </PosButton>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-auto',
              selling && 'overflow-hidden',
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
