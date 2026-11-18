import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { Icon } from './Icons.js';
import {
  dashboardLink,
  settingsLink,
  merchantNavigationGroups,
  findMerchantNavigationLink,
  type MerchantNavigationLink,
  type MerchantNavigationGroup,
} from './merchant-navigation.js';

export function MerchantNavigation({ onNavigate }: { onNavigate: () => void }) {
  const { locale, t } = useLocale();
  const { pathname } = useLocation();
  const current = findMerchantNavigationLink(pathname);

  function renderLink(link: MerchantNavigationLink) {
    const active = current === link;
    return (
      <Link
        key={link.path}
        to={link.path}
        className={`merchant-nav-item ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <Icon name={link.icon} />
        <span>{locale === 'ar' ? link.ar : link.en}</span>
      </Link>
    );
  }

  return (
    <nav aria-label={t('Merchant navigation')}>
      {renderLink(dashboardLink)}
      {merchantNavigationGroups.map((group) => (
        <NavigationGroup
          key={group.id}
          group={group}
          active={current !== undefined && group.links.includes(current)}
          pathname={pathname}
        >
          {group.links.map(renderLink)}
        </NavigationGroup>
      ))}
      {renderLink(settingsLink)}
    </nav>
  );
}

function NavigationGroup({
  group,
  active,
  pathname,
  children,
}: {
  group: MerchantNavigationGroup;
  active: boolean;
  pathname: string;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active, pathname]);

  return (
    <div className="merchant-nav-group">
      <button
        type="button"
        className={`merchant-nav-item merchant-nav-group-toggle ${active ? 'has-active-page' : ''}`}
        aria-expanded={open}
        aria-controls={`merchant-nav-${group.id}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={group.icon} />
        <span>{locale === 'ar' ? group.ar : group.en}</span>
        <Icon name="chevron" />
      </button>
      <div id={`merchant-nav-${group.id}`} className="merchant-nav-group-links" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
