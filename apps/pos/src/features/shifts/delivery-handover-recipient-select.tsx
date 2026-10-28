import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  CursorPage,
  PosDeliveryHandoverRecipient,
  PosEmployeeSession,
} from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { apiRequest } from '../../lib/api-client.js';

export function DeliveryHandoverRecipientSelect({
  employee,
  branchId,
  value,
  onChange,
  disabled,
}: {
  employee: PosEmployeeSession;
  branchId: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t, locale } = useLocale();
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const recipients = useQuery({
    queryKey: [
      'pos',
      employee.merchantId,
      employee.id,
      branchId,
      'delivery-handover-recipients',
      cursor,
    ],
    queryFn: ({ signal }) =>
      apiRequest<CursorPage<PosDeliveryHandoverRecipient>>(
        `/pos/shifts/delivery-handover-recipients?${new URLSearchParams({ branchId, limit: '25', ...(cursor ? { cursor } : {}) })}`,
        { signal },
      ),
    staleTime: 15000,
  });
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        {t('Receiving employee username')}
        <select
          className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={value}
          required
          disabled={disabled || recipients.isLoading || recipients.isError}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {text(
              'Choose the employee taking over delivery follow-up',
              'اختر الموظف المستلم لمتابعة الدليفري',
            )}
          </option>
          {value && !recipients.data?.items.some((item) => item.username === value) && (
            <option value={value} disabled>
              {value} · {text('Saved request', 'طلب محفوظ')}
            </option>
          )}
          {recipients.data?.items.map((item) => (
            <option key={item.id} value={item.username}>
              {item.displayName === item.username
                ? item.username
                : `${item.displayName} · ${item.username}`}
            </option>
          ))}
        </select>
      </label>
      <p className="m-0 text-xs leading-relaxed text-muted-foreground">
        {text(
          'This transfers responsibility for follow-up. Courier cash stays outside the drawer until actually received.',
          'ده تسليم مسؤولية المتابعة. كاش الطيار يفضل خارج الدرج لحد ما تستلمه فعليًا.',
        )}{' '}
        {text(
          'The receiving manager may also approve the handover if they are different from you.',
          'المدير المستلم يقدر يعتمد التسليم كمان بشرط يكون شخص غيرك.',
        )}
      </p>
      {recipients.isError && (
        <p role="alert" className="m-0 text-xs text-destructive">
          {text('Could not load eligible employees.', 'تعذر تحميل الموظفين المؤهلين.')}{' '}
          <button type="button" onClick={() => void recipients.refetch()}>
            {t('Retry')}
          </button>
        </p>
      )}
      {recipients.isSuccess && !recipients.data.items.length && (
        <p className="m-0 text-xs text-warning">
          {text(
            'No eligible recipient on this page. Ask the owner to assign another active cashier or manager to this branch.',
            'مفيش مستلم مؤهل في الصفحة دي. اطلب من المالك إسناد كاشير أو مدير نشط آخر لنفس الفرع.',
          )}
        </p>
      )}
      <div className="flex gap-3 text-xs">
        {cursors.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCursors((current) => current.slice(0, -1));
              onChange('');
            }}
          >
            {t('Previous')}
          </button>
        )}
        {recipients.data?.nextCursor && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCursors((current) => [...current, recipients.data!.nextCursor!]);
              onChange('');
            }}
          >
            {t('Next')}
          </button>
        )}
      </div>
    </div>
  );
}
