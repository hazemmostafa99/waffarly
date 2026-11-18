/** Read-only report loading; responses are discarded as soon as their URL scope changes. */
import { useEffect, useState } from 'react';
import type {
  InventoryBranch,
  OwnerBusinessReport,
  OwnerProductProfitabilityReport,
  OwnerPosOperationsReport,
  OwnerShiftReportPage,
  CursorPage,
  OwnerPosItemReturnReportRow,
} from '@waffarly/contracts';
import { apiRequest, apiRequestSingle } from '../../lib/api-client.js';
import { cairoStart, shiftReportDate, reportRange } from './reference-report-dates.js';
export type ReferenceReportView = 'overview' | 'profit' | 'pos' | 'shifts' | 'returns';
export type ReferenceReportData = {
  business?: OwnerBusinessReport;
  profit?: OwnerProductProfitabilityReport;
  pos?: OwnerPosOperationsReport;
  shifts?: OwnerShiftReportPage;
  returns?: CursorPage<OwnerPosItemReturnReportRow>;
};
export function useReferenceReport({
  view,
  month,
  branchId,
  period,
  cursor,
  refresh,
}: {
  view: ReferenceReportView;
  month: string;
  branchId: string;
  period: string;
  cursor: string;
  refresh: number;
}) {
  const scope = JSON.stringify([view, month, branchId, period, cursor, refresh]);
  const [loaded, setLoaded] = useState<{
    scope: string;
    data: ReferenceReportData;
    error: string;
  } | null>(null);
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [branchError, setBranchError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setBranchError('');
    void apiRequest<InventoryBranch[]>('/owner/inventory/branches?limit=100&status=all', {
      signal: controller.signal,
    })
      .then((items) => {
        if (!controller.signal.aborted) setBranches(items);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setBranchError(error instanceof Error ? error.message : 'Could not load branches.');
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const range = reportRange(month, view === 'pos' ? period : 'month');
    const query = new URLSearchParams();
    if (branchId) query.set('branchId', branchId);
    const dateQuery = () => {
      query.set('from', cairoStart(range.from));
      query.set('to', cairoStart(shiftReportDate(range.to, 1)));
    };
    let request: Promise<ReferenceReportData>;
    if (view === 'overview') {
      query.set('month', month);
      request = apiRequestSingle<OwnerBusinessReport>(`/owner/reports/business?${query}`, {
        signal: controller.signal,
      }).then((business) => ({ business }));
    } else if (view === 'profit') {
      query.set('from', range.from);
      query.set('to', range.to);
      query.set('limit', '100');
      request = apiRequestSingle<OwnerProductProfitabilityReport>(
        `/owner/reports/profitability/products?${query}`,
        { signal: controller.signal },
      ).then((profit) => ({ profit }));
    } else if (view === 'pos') {
      dateQuery();
      request = apiRequestSingle<OwnerPosOperationsReport>(
        `/owner/pos/reports/operations?${query}`,
        { signal: controller.signal },
      ).then((pos) => ({ pos }));
    } else {
      dateQuery();
      query.set('limit', '25');
      if (cursor) query.set('cursor', cursor);
      request =
        view === 'shifts'
          ? apiRequestSingle<OwnerShiftReportPage>(`/owner/pos/shifts/reports?${query}`, {
              signal: controller.signal,
            }).then((shifts) => ({ shifts }))
          : apiRequestSingle<CursorPage<OwnerPosItemReturnReportRow>>(
              `/owner/pos/returns/reports?${query}`,
              { signal: controller.signal },
            ).then((returns) => ({ returns }));
    }
    void request
      .then((data) => {
        if (!controller.signal.aborted) setLoaded({ scope, data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoaded({
            scope,
            data: {},
            error: error instanceof Error ? error.message : 'Could not load report.',
          });
      });
    return () => controller.abort();
  }, [scope, view, month, branchId, period, cursor, refresh]);
  const current = loaded?.scope === scope ? loaded : null;
  return {
    data: current?.data ?? {},
    loading: !current,
    error: current?.error ?? '',
    branches,
    branchError,
  };
}
