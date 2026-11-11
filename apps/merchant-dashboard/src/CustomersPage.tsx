import { useOutletContext } from 'react-router-dom';
import type { MerchantOutletContext } from './lib/merchant-context.js';
import { CustomersWorkspace } from './features/customers/CustomersWorkspace.js';

export function CustomersPage() {
  const { profile, search } = useOutletContext<MerchantOutletContext>();
  return <CustomersWorkspace key={profile.merchantId} globalSearch={search} />;
}
