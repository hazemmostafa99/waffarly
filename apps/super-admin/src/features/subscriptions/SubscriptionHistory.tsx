import { formatSubscriptionMoney } from './subscription-money.js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, Clock3, History } from 'lucide-react';
import { Button, useLocale } from '@waffarly/ui';
import type { SubscriptionCommand, SubscriptionDetail } from '@waffarly/contracts';
import { apiRequestPage } from '../../lib/api-client.js';
import { subscriptionActions } from './subscription-actions.js';

export function SubscriptionHistory({ subscription }: { subscription: SubscriptionDetail }) {
  const { t } = useLocale();
  return (
    <details className="subscription-history subscription-surface">
      <summary>
        <span className="subscription-section-icon">
          <History size={18} />
        </span>
        <span>
          <strong>{t('Subscription history')}</strong>
          <small>{t('Paid periods, collections, and account changes')}</small>
        </span>
        <ChevronDown size={18} className="subscription-history-chevron" />
      </summary>
      <div className="subscription-history-columns">
        <HistoryEntries subscription={subscription} kind="periods" />
        <HistoryEntries subscription={subscription} kind="events" />
      </div>
    </details>
  );
}

function HistoryEntries({
  subscription: s,
  kind,
}: {
  subscription: SubscriptionDetail;
  kind: 'periods' | 'events';
}) {
  const { t, formatDate, locale, errorText } = useLocale();
  type Entry = SubscriptionDetail['periods'][number] | SubscriptionDetail['events'][number];
  const history = useInfiniteQuery({
    queryKey: ['subscriptions', 'history', s.merchantId, s.revision, kind],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiRequestPage<Entry>(
        `/admin/subscriptions/${s.merchantId}/history/${kind}${pageParam ? `?cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
    initialData: {
      pages: [
        {
          items: s[kind] as Entry[],
          nextCursor: kind === 'periods' ? s.nextPeriodCursor : s.nextEventCursor,
        },
      ],
      pageParams: [null],
    },
  });
  const entries = history.data.pages.flatMap((p) => p.items);
  const money = (amount: string) => formatSubscriptionMoney(amount, locale);
  return (
    <section className="subscription-history-section">
      <h3>{t(kind === 'periods' ? 'Paid coverage history' : 'Subscription activity')}</h3>
      {!entries.length && (
        <div className="subscription-empty-history">
          {kind === 'periods' ? <CalendarDays size={24} /> : <Clock3 size={24} />}
          <span>
            {t(kind === 'periods' ? 'No paid coverage recorded.' : 'No subscription activity yet.')}
          </span>
        </div>
      )}
      <ol className="subscription-timeline">
        {entries.map((e) => (
          <li key={e.id}>
            {'planName' in e ? (
              <>
                <div className="subscription-timeline-title">
                  <strong>{e.planName}</strong>
                  <span>{t('{{months}} months', { months: e.months })}</span>
                </div>
                <small>
                  {formatDate(e.startsAt)} — {formatDate(e.coverageEndsAt)}
                </small>
                <div className="subscription-timeline-amount">
                  <span>{t('Collected')}</span>
                  <strong>{money(e.collected)}</strong>
                </div>
                {e.credit !== '0.00' && (
                  <small>
                    {t('Unused coverage credit')}: {money(e.credit)}
                  </small>
                )}
              </>
            ) : (
              <>
                <div className="subscription-timeline-title">
                  <strong>
                    {t(subscriptionActions[e.action as SubscriptionCommand['action']] ?? e.action)}
                  </strong>
                  <small>{formatDate(e.createdAt)}</small>
                </div>
                <small>
                  {e.administrator}
                  {e.collected !== '0.00' && ` · ${money(e.collected)}`}
                </small>
                <p>{t(e.reason)}</p>
              </>
            )}
          </li>
        ))}
      </ol>
      {history.isError && <p role="alert">{errorText(history.error.message)}</p>}
      {history.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {t('Load older records')}
        </Button>
      )}
    </section>
  );
}
