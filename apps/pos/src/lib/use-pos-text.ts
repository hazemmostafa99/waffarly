import { useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  activityPosTextOverrides,
  actorActivityFeatures,
  type PosEmployeeSession,
} from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';

type Translate = ReturnType<typeof useLocale>['t'];

/**
 * Activity-aware replacement for `t` in POS screens, with the same signature.
 * Shops see "sale" wording and their own choice names; restaurants get `t` unchanged.
 * Outside the workspace layout (no employee in context) it behaves exactly like `t`.
 */
export function usePosText(): Translate {
  const { t, locale } = useLocale();
  const context = useOutletContext<{ employee?: PosEmployeeSession } | null | undefined>();
  const employee = context?.employee;
  const activity = employee?.activity;
  const kitchenEnabled = employee ? actorActivityFeatures(employee).kitchen : true;
  const overrides = useMemo(
    () => (employee ? activityPosTextOverrides(activity, kitchenEnabled) : {}),
    [employee, activity, kitchenEnabled],
  );
  return useCallback<Translate>(
    (message, values) => {
      const override = typeof message === 'string' ? overrides[message] : undefined;
      if (override) return locale === 'ar' ? override.ar : override.en;
      return t(message, values);
    },
    [overrides, locale, t],
  );
}
