'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CustomerProfile } from '@waffarly/contracts';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import {
  customerAuthError,
  customerSessionKey,
  signOutCustomer,
} from '@/features/account/data/customer-auth-api';
import { useAccountStore } from '../hooks/use-account-store';

export function CustomerAccountPanel({ customer }: { customer: CustomerProfile }) {
  const client = useQueryClient();
  const leaveDemoAccount = useAccountStore((state) => state.leaveDemoAccount);
  const logout = useMutation({
    mutationFn: signOutCustomer,
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: customerSessionKey });
      client.setQueryData(customerSessionKey, null);
      leaveDemoAccount();
    },
  });

  return (
    <section
      dir="rtl"
      className="grid gap-5 rounded-3xl border border-border bg-white p-5 text-right shadow-[var(--shadow)] sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-xl font-black text-primary">
          أهلاً، {customer.displayName ?? 'عميل وفّرلي'}
        </h1>
        <MarketplaceButton
          type="button"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
          className="min-h-10 rounded-xl border border-border px-4 text-sm font-bold"
        >
          {logout.isPending ? 'جارٍ الخروج…' : 'تسجيل الخروج'}
        </MarketplaceButton>
      </div>
      <dl className="m-0 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">البريد الإلكتروني</dt>
          <dd className="m-0 mt-1 break-all" dir="ltr">
            {customer.email ?? 'غير مسجل'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">الموبايل</dt>
          <dd className="m-0 mt-1" dir="ltr">
            {customer.phone}
          </dd>
        </div>
      </dl>
      {logout.isError && (
        <p role="alert" className="m-0 text-sm text-red-700">
          {customerAuthError(logout.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-4 text-sm font-bold text-accent">
        <Link href="/restaurants">تصفح المطاعم</Link>
        <Link href="/favorites">مفضلة الجلسة الحالية</Link>
        <Link href="/orders">طلبات الجلسة الحالية</Link>
      </div>
    </section>
  );
}
