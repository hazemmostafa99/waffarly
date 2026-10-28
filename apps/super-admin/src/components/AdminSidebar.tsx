import {
  Activity,
  BadgeCheck,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Store,
  Tags,
  Utensils,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { useAdminUiStore } from '../stores/admin-ui-store.js';

const navigation = [
  { to: '/dashboard', label: 'Platform overview', icon: LayoutDashboard },
  { to: '/merchants', label: 'Businesses', icon: Store },
  { to: '/plans', label: 'Subscription plans', icon: Tags },
  { to: '/subscriptions', label: 'Subscription management', icon: BadgeCheck },
  { to: '/activities', label: 'Business activities', icon: Activity },
  { to: '/modules', label: 'Modules', icon: Network },
  { to: '/templates', label: 'Design library', icon: Utensils },
] as const;

export function AdminSidebar() {
  const { t, locale } = useLocale();
  const collapsed = useAdminUiStore((state) => state.sidebarCollapsed);
  const mobileOpen = useAdminUiStore((state) => state.mobileNavigationOpen);
  const toggleSidebar = useAdminUiStore((state) => state.toggleSidebar);
  const setMobileNavigationOpen = useAdminUiStore((state) => state.setMobileNavigationOpen);
  const sidebarRef = useRef<HTMLElement>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => window.matchMedia('(max-width: 900px)').matches,
  );
  const isCollapsedDesktop = collapsed && !isMobileLayout;
  const mobileNavigationActive = isMobileLayout && mobileOpen;
  const CollapseIcon = locale === 'ar' ? PanelRightClose : PanelLeftClose;
  const ExpandIcon = locale === 'ar' ? PanelRightOpen : PanelLeftOpen;
  const sidebarPosition = isMobileLayout
    ? 'fixed inset-y-0 start-0 z-50 h-screen w-[min(84vw,280px)] shadow-xl'
    : `sticky top-0 h-screen min-w-0 shrink-0 ${collapsed ? 'w-[72px]' : 'w-[206px]'} shadow-none`;
  const sidebarTransform = mobileNavigationActive
    ? 'translate-x-0'
    : isMobileLayout && locale === 'ar'
      ? 'translate-x-full'
      : isMobileLayout
        ? '-translate-x-full'
        : 'translate-x-0';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const updateLayout = () => {
      setIsMobileLayout(media.matches);
      if (!media.matches) setMobileNavigationOpen(false);
    };
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, [setMobileNavigationOpen]);

  useEffect(() => {
    if (!mobileNavigationActive) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableElements = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      ).filter((element) => element.getClientRects().length > 0);

    focusableElements()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavigationOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusableElements();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mobileNavigationActive, setMobileNavigationOpen]);

  return (
    <>
      {mobileNavigationActive && (
        <button
          className="fixed inset-0 z-40 bg-waffarly-ink/30 backdrop-blur-[1px]"
          type="button"
          aria-label={t('Close navigation')}
          onClick={() => setMobileNavigationOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`flex flex-col border-e border-waffarly-border bg-waffarly-surface px-3 py-5 transition-[transform,width] duration-200 ease-out ${sidebarPosition} ${sidebarTransform}`}
        role={mobileNavigationActive ? 'dialog' : undefined}
        aria-modal={mobileNavigationActive || undefined}
        aria-label={mobileNavigationActive ? t('Platform navigation') : undefined}
        aria-hidden={isMobileLayout && !mobileOpen}
        inert={isMobileLayout && !mobileOpen}
      >
        <div
          className={`mb-6 border-b border-waffarly-border pb-4 ${isCollapsedDesktop ? 'grid justify-items-center gap-2' : 'flex min-h-12 items-center justify-between gap-2'}`}
        >
          <NavLink
            className={`flex min-w-0 items-center gap-2.5 text-inherit no-underline ${isCollapsedDesktop ? 'w-full justify-center' : 'flex-1'}`}
            to="/dashboard"
            title={isCollapsedDesktop ? 'Waffarly' : undefined}
            onClick={() => setMobileNavigationOpen(false)}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-waffarly-primary text-lg font-bold text-white"
              aria-hidden="true"
            >
              W
            </span>
            {!isCollapsedDesktop && (
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-waffarly-ink">Waffarly</strong>
                <small
                  className={`mt-0.5 block text-[9px] font-bold text-waffarly-muted ${locale === 'ar' ? '' : 'tracking-[0.14em]'}`}
                >
                  {t('SUPER ADMIN')}
                </small>
              </span>
            )}
          </NavLink>
          {!isMobileLayout && (
            <button
              className={`flex shrink-0 items-center justify-center rounded-lg border border-waffarly-border bg-white p-0 text-waffarly-muted transition-colors hover:bg-waffarly-input hover:text-waffarly-primary ${isCollapsedDesktop ? 'size-7' : 'size-8'}`}
              type="button"
              aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <ExpandIcon className="block" size={18} strokeWidth={1.8} />
              ) : (
                <CollapseIcon className="block" size={18} strokeWidth={1.8} />
              )}
            </button>
          )}
        </div>

        {!isCollapsedDesktop && (
          <p
            className={`mb-2 px-2 text-[10px] font-bold text-waffarly-muted ${locale === 'ar' ? '' : 'tracking-[0.13em]'}`}
          >
            {t('PLATFORM')}
          </p>
        )}
        <nav className="grid gap-1.5" aria-label={t('Platform administration')}>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={
                to === '/dashboard' ||
                to === '/subscriptions' ||
                to === '/activities' ||
                to === '/modules'
              }
              title={isCollapsedDesktop ? t(label) : undefined}
              className={({ isActive }) =>
                `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold no-underline transition-colors ${isCollapsedDesktop ? 'justify-center px-0' : ''} ${isActive ? 'bg-waffarly-kpi-mint text-waffarly-primary' : 'text-waffarly-ink hover:bg-waffarly-input'}`
              }
              onClick={() => setMobileNavigationOpen(false)}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`shrink-0 transition-colors ${isActive ? 'text-waffarly-primary' : 'text-waffarly-muted group-hover:text-waffarly-primary'}`}
                    size={18}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  {!isCollapsedDesktop && <span className="min-w-0 truncate">{t(label)}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {!isCollapsedDesktop && (
          <div className="mt-auto flex items-start gap-2.5 rounded-2xl bg-waffarly-gold-light p-3 text-waffarly-ink">
            <div
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-waffarly-gold"
              aria-hidden="true"
            >
              <Utensils size={17} />
            </div>
            <div className="min-w-0">
              <strong className="block text-xs leading-5">{t('Good food, brighter days')}</strong>
              <p className="mb-0 mt-1 text-[11px] leading-5 text-waffarly-muted">
                {t('Manage the Waffarly platform from one place.')}
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
