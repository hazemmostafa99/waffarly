import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import type { BusinessActivitySettings } from '@waffarly/contracts';
import { Icon } from './Icons.js';
import {
  dashboardLink,
  settingsLink,
  navigationGroupsForActivity,
  findMerchantNavigationLink,
  type MerchantNavigationLink,
  type MerchantNavigationGroup,
} from './merchant-navigation.js';

export function MerchantNavigation({
  onNavigate,
  activitySettings,
}: {
  onNavigate: () => void;
  activitySettings: BusinessActivitySettings;
}) {
  const { locale, t } = useLocale();
  const { pathname } = useLocation();
  const groups = navigationGroupsForActivity(activitySettings);
  const current = findMerchantNavigationLink(pathname);
  const activeGroup = groups.find((group) =>
    current ? group.links.includes(current) : false,
  );
  const [openState, setOpenState] = useState({
    pathname,
    groupId: activeGroup?.id ?? null,
  });
  const openGroupId =
    openState.pathname === pathname ? openState.groupId : (activeGroup?.id ?? null);

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
      {groups.map((group) => (
        <NavigationGroup
          key={group.id}
          group={group}
          active={current !== undefined && group.links.includes(current)}
          open={openGroupId === group.id}
          onToggle={() =>
            setOpenState({
              pathname,
              groupId: openGroupId === group.id ? null : group.id,
            })
          }
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
  open,
  onToggle,
  children,
}: {
  group: MerchantNavigationGroup;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { locale } = useLocale();

  return (
    <div className="merchant-nav-group">
      <button
        type="button"
        className={`merchant-nav-item merchant-nav-group-toggle ${active ? 'has-active-page' : ''}`}
        aria-expanded={open}
        aria-controls={`merchant-nav-${group.id}`}
        onClick={onToggle}
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
