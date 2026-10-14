import { useLocale } from '@waffarly/ui';
import { Icon } from './Icons.js';
import { useNavigate } from 'react-router-dom';

type ComingSoonProps = {
  view: 'orders' | 'customers' | 'discounts' | 'branches';
};

const viewLabels: Record<ComingSoonProps['view'], string> = {
  orders: 'Orders',
  customers: 'Customers',
  discounts: 'Discounts',
  branches: 'Branches',
};

export function ComingSoon({ view }: ComingSoonProps) {
  const { t } = useLocale();
  const navigate = useNavigate();

  return (
    <section className="merchant-card merchant-coming-soon">
      <div className="merchant-card-heading">
        <h2>{t(viewLabels[view])}</h2>
        <span className="status-badge">{t('Coming soon')}</span>
      </div>
      <p>{t('This workspace is ready for your next merchant workflow.')}</p>
      <button type="button" onClick={() => navigate('/')}>
        {t('Back to dashboard')} <Icon name="arrow" />
      </button>
    </section>
  );
}
