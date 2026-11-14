'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CustomerOrdersList } from '@/features/marketplace/orders/components/customer-orders';
import { FavoritesPage } from '@/features/marketplace/favorites/components/favorites-page';
import { ArrowLeft, Heart, LogOut, Mail, Phone, ShoppingBag, Store, UserRound } from 'lucide-react';
import { MarketplaceCard as Card } from '@/components/marketplace/marketplace-card';
import type { CustomerProfile } from '@waffarly/contracts';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { useCustomerSignOut } from '../hooks/use-customer-sign-out';
import { customerName } from '../model/customer-name';

export function CustomerAccountPanel({ customer }: { customer: CustomerProfile }) {
  const logout = useCustomerSignOut();
  const [section, setSection] = useState<'profile' | 'orders' | 'favorites'>('profile');
  const identity = customerName(customer.displayName);
  const name = identity.full;
  const sections = [
    { id: 'profile', label: 'بياناتي', description: 'معلوماتك وبيانات التواصل', Icon: UserRound },
    { id: 'orders', label: 'طلباتي', description: 'اعرض طلباتك وتفاصيلها', Icon: ShoppingBag },
    { id: 'favorites', label: 'المفضلة', description: 'اختياراتك المحفوظة على المتصفح', Icon: Heart },
  ] as const;
  const activeSection = sections.find(item => item.id === section)!;
  const ActiveIcon = activeSection.Icon;
  return (
    <div className="mx-auto grid max-w-[1200px] overflow-hidden rounded-[24px] border border-border bg-white text-right shadow-[0_8px_32px_rgba(43,13,55,0.04)] md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-border bg-[var(--purple-50)] md:border-b-0 md:border-e">
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-[18px] font-medium text-waffarly-gold" aria-hidden="true">{identity.initials}</span>
          <div className="min-w-0">
            <p className="mb-1 mt-0 text-[11px] text-muted-foreground">أهلاً بيك على وفّرلي</p>
            <h1 className="m-0 truncate text-[16px] font-bold leading-6 text-primary" title={name}><bdi>{name.split(/\s+/)[0]}</bdi></h1>
          </div>
        </div>
        <nav aria-label="أقسام الحساب" className="flex gap-1 overflow-x-auto px-2 pb-3 md:grid md:gap-1.5">
          {sections.map(({id, label, Icon}) => (
            <MarketplaceButton
              key={id} type="button" aria-pressed={section === id} aria-controls="account-section"
              onClick={() => setSection(id)}
              className={`inline-flex min-h-10 flex-1 items-center justify-start gap-2.5 whitespace-nowrap rounded-xl px-3 text-[13px] font-medium transition-colors md:w-full md:flex-none ${section === id ? 'bg-primary text-white hover:bg-[var(--purple-800)]' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              <Icon size={17} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
              <span className="flex-1 text-start">{label}</span>
              {section === id && <ArrowLeft size={14} className="hidden text-waffarly-gold md:block" aria-hidden="true" />}
            </MarketplaceButton>
          ))}
        </nav>
        <div className="mx-4 border-t border-border py-2">
          <Link href="/restaurants" className="flex min-h-10 items-center gap-2.5 rounded-lg px-1 text-[12px] text-accent no-underline hover:bg-secondary"><Store size={16} aria-hidden="true" />استكشف المطاعم</Link>
          <MarketplaceButton type="button" disabled={logout.isPending} onClick={() => logout.mutate()} className="inline-flex min-h-10 w-full items-center justify-start gap-2.5 rounded-lg px-1 text-[12px] text-destructive hover:bg-red-50">
            <LogOut size={16} aria-hidden="true" />{logout.isPending ? 'جارٍ الخروج…' : 'تسجيل الخروج'}
          </MarketplaceButton>
          {logout.isError && <p role="alert" className="m-0 py-2 text-[12px] text-destructive">تعذّر تسجيل الخروج. حاول مرة أخرى.</p>}
        </div>
      </aside>
      <div id="account-section" className="min-w-0 p-4 sm:p-5">
        {section !== 'orders' && <div className="mb-3 border-b border-border pb-3"><div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--purple-50)] text-accent"><ActiveIcon size={17} strokeWidth={1.6} aria-hidden="true" /></span>
            <h2 className="m-0 text-[18px] font-bold leading-7 text-primary">{activeSection.label}</h2>
          </div></div>}
        {section === 'profile' ? (
          <Card className="overflow-hidden rounded-2xl border border-border bg-white">
            <dl className="m-0 divide-y divide-border">
              {[
                {label: 'الاسم بالكامل', value: name, Icon: UserRound, dir: 'auto'},
                {label: 'البريد الإلكتروني', value: customer.email, Icon: Mail, dir: 'ltr'},
                {label: 'رقم الموبايل', value: customer.phone, Icon: Phone, dir: 'ltr'},
              ].map(({label, value, Icon, dir}) => (
                <div key={label} className="flex min-w-0 items-center justify-between gap-3 px-3 py-4 odd:bg-[var(--purple-50)]/50 sm:px-4">
                  <dt className="flex shrink-0 items-center gap-2 text-[12px] text-muted-foreground">
                    <Icon size={15} strokeWidth={1.6} className="hidden text-accent/70 sm:block" aria-hidden="true" />{label}
                  </dt>
                  <dd className="m-0 min-w-0 text-left text-[13px] font-medium leading-6 text-primary"><bdi dir={dir} className="block break-words [overflow-wrap:anywhere]">{value || 'غير مسجل'}</bdi></dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : section === 'orders' ? <CustomerOrdersList embedded heading={<div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--purple-50)] text-accent"><ActiveIcon size={17} strokeWidth={1.6} aria-hidden="true" /></span>
            <h2 className="m-0 text-[18px] font-bold leading-7 text-primary">{activeSection.label}</h2>
          </div>} /> : <FavoritesPage embedded />}
      </div>
    </div>
  );
}
