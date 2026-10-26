import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { OwnerProfile, StockItem } from '@waffarly/contracts';
import { lookupSelection } from '../../../lib/entity-lookup.js';
import type { GroupDraft } from './product-builder.types.js';

/** Hydrate only referenced identities, with tenant-scoped reads and bounded concurrency. */
export function useModifierStockItems(groups: GroupDraft[]) {
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const tenant = profile.merchantId;
  const idsKey = JSON.stringify(
    [
      ...new Set(
        groups.flatMap((group) =>
          group.options.flatMap((option) =>
            [
              ...(option.effects ?? []),
              ...(option.variantOverrides ?? []).flatMap((override) => override.effects ?? []),
            ]
              .map((effect) => effect.stockItemId)
              .filter(Boolean),
          ),
        ),
      ),
    ].sort(),
  );
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState<{
    tenant: string;
    key: string;
    items: Record<string, StockItem>;
    failed: string[];
  }>({ tenant, key: idsKey, items: {}, failed: [] });
  useEffect(() => {
    let active = true;
    const ids = JSON.parse(idsKey) as string[];
    const items: Record<string, StockItem> = {};
    const failed: string[] = [];
    void (async () => {
      for (let offset = 0; offset < ids.length && active; offset += 4) {
        const batch = ids.slice(offset, offset + 4);
        const results = await Promise.allSettled(
          batch.map((id) =>
            lookupSelection<StockItem>(tenant, `/owner/inventory/items/${encodeURIComponent(id)}`),
          ),
        );
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') items[batch[index]!] = result.value;
          else failed.push(batch[index]!);
        });
        if (active) setResolved({ tenant, key: idsKey, items: { ...items }, failed: [...failed] });
      }
      if (active && !ids.length) setResolved({ tenant, key: idsKey, items, failed });
    })();
    return () => {
      active = false;
    };
  }, [tenant, idsKey, attempt]);
  const current = resolved.tenant === tenant && resolved.key === idsKey;
  return {
    items: current ? resolved.items : {},
    failed: current ? resolved.failed : [],
    retry: () => setAttempt((value) => value + 1),
  };
}
