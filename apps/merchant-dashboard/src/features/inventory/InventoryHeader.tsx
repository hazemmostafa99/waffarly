import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { inventoryCopy, useInventoryText } from './inventory-copy.js';

export function InventoryHeader({
  title,
  actions,
  filters,
  showInventoryNavigation = true,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  filters?: ReactNode;
  showInventoryNavigation?: boolean;
}) {
  const { locale, t } = useLocale();
  const { pathname } = useLocation();
  const text = useInventoryText();
  const pageTitle = <h1 className="sr-only">{text(title)}</h1>;
  const actionGroup = actions && <div className="inventory-toolbar-actions">{actions}</div>;
  const isInventoryWorkspace =
    pathname === '/inventory' ||
    pathname.startsWith('/inventory/') ||
    pathname === '/profitability';

  if (showInventoryNavigation && isInventoryWorkspace) {
    const sections = [
      {
        to: '/inventory',
        label: 'Stock balances',
        active: pathname === '/inventory' || pathname === '/inventory/health',
      },
      { to: '/inventory/items', label: 'Items', active: pathname.startsWith('/inventory/items') },
      {
        to: '/inventory/purchases',
        label: 'Purchases',
        active: pathname.startsWith('/inventory/purchases'),
      },
      {
        to: '/inventory/history',
        label: 'Movement history',
        active: pathname === '/inventory/history' || pathname.startsWith('/inventory/movements/'),
      },
      {
        to: '/profitability',
        label: 'Product profitability',
        active: pathname === '/profitability',
      },
    ];
    return (
      <header className="inventory-workspace-header">
        <div className="inventory-workspace-heading">
          <h1>{text(title)}</h1>
          <div className="inventory-workspace-actions">
            {actionGroup}
            <details
              className="inventory-operations-menu"
              key={pathname}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}
            >
              <summary>
                {text('Stock operations')} <Icon name="more" />
              </summary>
              <div className="inventory-operations-links">
                {[
                  ['/inventory/items?new=1', 'Add item', 'plus'],
                  ['/inventory/waste', 'Record stock waste', 'trash'],
                  ['/inventory/transfers', 'Transfer stock', 'box'],
                  ['/inventory/opening', 'Opening stock', 'plus'],
                ].map(([to, label, icon]) => (
                  <Link
                    key={to}
                    to={to!}
                    onClick={(event) =>
                      event.currentTarget.closest('details')?.removeAttribute('open')
                    }
                  >
                    <Icon name={icon!} />
                    {text(label!)}
                  </Link>
                ))}
              </div>
            </details>
            <Link
              className="inventory-workspace-settings"
              to="/inventory/settings"
              aria-label={text('Inventory settings')}
              aria-current={pathname === '/inventory/settings' ? 'page' : undefined}
            >
              <Icon name="settings" />
            </Link>
          </div>
        </div>
        <nav className="inventory-workspace-navigation" aria-label={text('Inventory navigation')}>
          {sections.map(({ to, label, active }) => (
            <Link key={to} to={to} aria-current={active ? 'page' : undefined}>
              {text(label)}
            </Link>
          ))}
        </nav>
        {filters && <div className="inventory-workspace-filters">{filters}</div>}
      </header>
    );
  }
  return (
    <>
      {showInventoryNavigation && (
        <div className="inventory-nav-toolbar">
          <nav className="inventory-navigation" aria-label={text('Inventory navigation')}>
            <div>
              {[
                ['/inventory', 'Stock overview', 'box'],
                ['/inventory/health', 'Stock health', 'box'],
                ['/inventory/items', 'Items', 'layers'],
                ['/inventory/purchases', 'Purchases', 'file'],
                ['/inventory/history', 'Movement history', 'orders'],
                ['/inventory/opening', 'Opening stock', 'plus'],
                ['/inventory/waste', 'Record stock waste', 'trash'],
                ['/inventory/transfers', 'Transfer stock', 'box'],
                ['/inventory/settings', 'Inventory settings', 'settings'],
              ].map(([to, label, icon]) => (
                <NavLink
                  key={to}
                  className={`products-button ${pathname === to || (to === '/inventory/purchases' && pathname.startsWith('/inventory/purchases/')) || (to === '/inventory/items' && pathname.startsWith('/inventory/items/')) || (to === '/inventory/history' && pathname.startsWith('/inventory/movements/')) ? 'primary' : ''}`}
                  to={to!}
                  end={to !== '/inventory/purchases'}
                >
                  <Icon name={icon!} />
                  {text(label!)}
                </NavLink>
              ))}
            </div>
          </nav>
          {!filters && actionGroup && (
            <>
              {pageTitle}
              {actionGroup}
            </>
          )}
          {!filters && !actions && pageTitle}
        </div>
      )}
      {filters && (
        <div className="inventory-controls-toolbar">
          {pageTitle}
          <div className="inventory-toolbar-filters">{filters}</div>
          {actionGroup}
        </div>
      )}
      {!showInventoryNavigation && !filters && actions && (
        <div className="inventory-controls-toolbar inventory-toolbar-actions-only">
          {pageTitle}
          {actionGroup}
        </div>
      )}
      {!showInventoryNavigation && !filters && !actions && pageTitle}
    </>
  );
}
