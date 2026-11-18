import { cn, useLocale } from '@waffarly/ui';
import {
  ClipboardList,
  Clock3,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  Monitor,
  ShoppingBag,
  Sun,
  Utensils,
  UserRound,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
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
import { getCurrentPosShift, posCurrentShiftKey } from '../shifts/pos-shifts.api.js';
import '@waffarly/ui/pos-theme.css';

export function PosWorkspaceFrame({
  employee,
  signingOut,
  onSignOut,
  children,
}: {
  employee: PosEmployeeSession;
  signingOut: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const location = useLocation();
  const theme = usePosAppearanceStore((state) => state.theme);
  const setTheme = usePosAppearanceStore((state) => state.setTheme);
  const appearanceQuery = useQuery({
    queryKey: posAppearanceKey(employee.merchantId),
    queryFn: getPosAppearance,
    staleTime: 60_000,
    retry: false,
  });
  const registerId = employee.deviceRegister?.id ?? '';
  const branchId = employee.branch.id;
  const canSell = employee.permissions.includes('sell');
  const shiftQuery = useQuery({
    queryKey: posCurrentShiftKey(employee.merchantId, branchId, registerId),
    queryFn: ({ signal }) => getCurrentPosShift(registerId, signal),
    enabled: canSell && Boolean(branchId && registerId),
    refetchOnWindowFocus: true,
  });
  const accent = appearanceQuery.data?.accent ?? 'orange';
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const viewport = usePosViewport();
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );
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
  const navigation: Array<{
    to: string;
    label: string;
    icon: LucideIcon;
    end?: boolean;
  }> = [
    ...(employee.permissions.includes('sell')
      ? [
          { to: '/catalog', label: 'New sale', icon: ShoppingBag },
          { to: '/dining', label: 'Tables', icon: Utensils },
          { to: '/deliveries', label: 'Delivery follow-up', icon: ShoppingBag },
        ]
      : []),
    ...(hasPosEmployeePermission(employee, 'view_orders')
      ? [{ to: '/kitchen', label: 'Kitchen', icon: LayoutDashboard }]
      : []),
    ...(hasPosEmployeePermission(employee, 'view_receipts')
      ? [{ to: '/orders', label: canSell ? 'Orders' : 'Receipts', icon: ClipboardList }]
      : []),
    ...(hasPosEmployeePermission(employee, 'view_inventory')
      ? [{ to: '/inventory', label: 'Inventory', icon: LayoutGrid }]
      : []),
    ...(employee.permissions.includes('open_register_shift')
      ? [{ to: '/shift', label: 'Register shift', icon: LayoutGrid }]
      : []),
  ];
  const themeOptions = [
    { value: 'light', label: t('Light') },
    { value: 'dark', label: t('Dark') },
    { value: 'system', label: t('System') },
  ] as const;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
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
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end ?? false}
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
          <header className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5 group-data-[input-mode=true]/pos:hidden sm:px-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {employee.deviceRegister?.name && (
                <span
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground"
                  aria-label={`${t('Cashier register')}: ${employee.deviceRegister.name}`}
                  title={`${t('Cashier register')}: ${employee.deviceRegister.name}`}
                >
                  <Monitor aria-hidden="true" size={14} />
                  <span className="hidden max-w-32 truncate sm:inline">
                    {employee.deviceRegister.name}
                  </span>
                </span>
              )}
              {canSell && (
                <span
                  className={cn(
                    'inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 text-xs',
                    shiftQuery.data
                      ? 'bg-[var(--pos-active)] text-[var(--pos-active-ink)]'
                      : 'bg-[var(--pos-note)] text-[var(--pos-note-ink)]',
                  )}
                  role={shiftQuery.isError && !shiftQuery.data ? 'alert' : 'status'}
                >
                  <Clock3 aria-hidden="true" size={14} />
                  {shiftQuery.isLoading
                    ? t('Loading shift…')
                    : shiftQuery.isError && !shiftQuery.data
                      ? t('Shift status unavailable')
                      : shiftQuery.data
                        ? t('Shift open')
                        : t('No open shift')}
                  {!shiftQuery.isLoading && !shiftQuery.data && (
                    <Link className="underline" to="/shift">
                      {t('Open shift')}
                    </Link>
                  )}
                </span>
              )}
              {!isOnline && (
                <span
                  className="inline-flex size-7 items-center justify-center rounded-md bg-[var(--pos-note)] text-[var(--pos-note-ink)]"
                  role="status"
                  aria-label={t('Offline - drafts saved')}
                  title={t('Offline - drafts saved')}
                >
                  <WifiOff aria-hidden="true" size={15} />
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <label
                className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary focus-within:ring-2 focus-within:ring-ring"
                title={t('Theme')}
              >
                {selectedTheme === 'dark' ? (
                  <Moon aria-hidden="true" size={16} />
                ) : (
                  <Sun aria-hidden="true" size={16} />
                )}
                <select
                  aria-label={t('Theme')}
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as 'light' | 'dark' | 'system')}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                >
                  {themeOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <PosButton
                type="button"
                variant="outline"
                aria-label={signingOut ? t('Signing out…') : t('Sign out')}
                title={signingOut ? t('Signing out…') : t('Sign out')}
                size="sm"
                className="h-8 w-8 min-h-0 rounded-md p-0"
                disabled={signingOut}
                onClick={onSignOut}
              >
                <LogOut aria-hidden="true" size={15} />
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
