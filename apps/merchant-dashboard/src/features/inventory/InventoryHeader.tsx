import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { inventoryCopy } from './inventory-copy.js';

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
  const text = (value: string) => inventoryCopy(value, locale, t);
  const pageTitle = <h1 className="sr-only">{text(title)}</h1>;
  const actionGroup = actions && <div className="inventory-toolbar-actions">{actions}</div>;
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
          {!filters && actionGroup && <>{pageTitle}{actionGroup}</>}
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
