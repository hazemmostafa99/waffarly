import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { inventoryCopy } from './inventory-copy.js';

export function InventoryHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  const { locale, t } = useLocale();
  const { pathname } = useLocation();
  const text = (value: string) => inventoryCopy(value, locale, t);
  return (
    <>
      <header className="products-heading inventory-intro">
        <div>
          <h1>{text(title)}</h1>
          <p>{text(description)}</p>
        </div>
        <div className="inventory-intro-actions">{actions}</div>
      </header>
      <nav className="inventory-navigation" aria-label={text('Inventory navigation')}>
        <div>
          {[
            ['/inventory', 'Stock overview', 'box'],
            ['/inventory/items', 'Items', 'layers'],
            ['/inventory/purchases', 'Purchases', 'file'],
            ['/inventory/history', 'Movement history', 'orders'],
          ].map(([to, label, icon]) => (
            <NavLink
              key={to}
              className={`products-button ${pathname === to ? 'primary' : ''}`}
              to={to!}
              end
            >
              <Icon name={icon!} />
              {text(label!)}
            </NavLink>
          ))}
        </div>
        <details className="inventory-more">
          <summary>{text('Setup and settings')}</summary>
          <div>
            <NavLink to="/branches">{text('Branches and warehouses')}</NavLink>
            <NavLink to="/inventory/opening">{text('Opening stock')}</NavLink>
            <NavLink to="/inventory/settings">{text('Inventory settings')}</NavLink>
          </div>
        </details>
      </nav>
    </>
  );
}
