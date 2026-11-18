import { useEffect, useState } from 'react';
import {
  deliveryLocationLabel,
  deliveryLocations,
  type InventoryBranch,
  type RestaurantBranchSettings,
} from '@waffarly/contracts';
import { Button } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { apiRequest } from '../../lib/api-client.js';

export function RestaurantBranchFulfillment({
  value,
  onChange,
}: {
  value: RestaurantBranchSettings[];
  onChange: (branches: RestaurantBranchSettings[]) => void;
}) {
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState('');
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void apiRequest<InventoryBranch[]>('/owner/inventory/branches').then(
      (result) => {
        if (active) setBranches(result.filter((branch) => !branch.archivedAt));
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  function update(next: RestaurantBranchSettings) {
    onChange(value.map((branch) => (branch.branchId === next.branchId ? next : branch)));
  }

  const availableBranches = branches.filter(
    (branch) => !value.some((entry) => entry.branchId === branch.id),
  );

  function addBranch() {
    if (!availableBranches.some((branch) => branch.id === selected)) return;
    onChange([
      ...value,
      {
        branchId: selected,
        locationId: '',
        paused: true,
        pickup: false,
        delivery: false,
        dailyHours: null,
        areas: [],
      },
    ]);
    setExpandedBranchId(selected);
    setSelected('');
  }

  return (
    <section className="rs-online-branches" aria-labelledby="online-branches-title">
      <div>
        <h3 id="online-branches-title" className="rs-section-title">
          فروع الطلب أونلاين
        </h3>
        <p>اختار الفروع اللي هتستقبل الطلبات واضبط التوصيل والاستلام لكل فرع.</p>
      </div>
      {error && <p role="alert">تعذر تحميل الفروع.</p>}
      <div className="rs-online-branch-add">
        <label>
          الفرع
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">اختار فرع</option>
            {availableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={addBranch}>
          إضافة فرع
        </Button>
      </div>
      {value.map((branch) => {
        const physical = branches.find((entry) => entry.id === branch.branchId);
        const location = deliveryLocations.find((entry) => entry.id === branch.locationId);
        const areas = deliveryLocations.filter(
          (entry) => entry.governorate === location?.governorate,
        );
        const expanded = expandedBranchId === branch.branchId;
        const detailsId = 'online-branch-' + branch.branchId;
        return (
          <div key={branch.branchId} className="rs-online-branch">
            <button
              type="button"
              className="rs-online-branch-toggle"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpandedBranchId(expanded ? null : branch.branchId)}
            >
              <strong>{physical?.name ?? branch.branchId}</strong>
              <Icon name="chevron" />
            </button>
            <div id={detailsId} hidden={!expanded} className="rs-online-branch-fields">
              {physical?.address && <p>{physical.address}</p>}
              <label className="grid gap-1">
                موقع الفرع
                <select
                  required
                  value={branch.locationId}
                  onChange={(event) => {
                    const next = deliveryLocations.find((entry) => entry.id === event.target.value);
                    update({
                      ...branch,
                      locationId: event.target.value,
                      areas: branch.areas.filter((area) =>
                        areas.some(
                          (entry) =>
                            entry.id === area.locationId && entry.governorate === next?.governorate,
                        ),
                      ),
                    });
                  }}
                >
                  <option value="">اختار موقع الفرع</option>
                  {deliveryLocations.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {deliveryLocationLabel(entry)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-4">
                <label>
                  <input
                    type="checkbox"
                    checked={branch.paused}
                    onChange={(event) => update({ ...branch, paused: event.target.checked })}
                  />{' '}
                  إيقاف مؤقت
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={branch.pickup}
                    onChange={(event) => update({ ...branch, pickup: event.target.checked })}
                  />{' '}
                  استلام من الفرع
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={branch.delivery}
                    onChange={(event) => update({ ...branch, delivery: event.target.checked })}
                  />{' '}
                  توصيل
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(branch.dailyHours)}
                    onChange={(event) =>
                      update({
                        ...branch,
                        dailyHours: event.target.checked ? { open: '09:00', close: '23:00' } : null,
                      })
                    }
                  />{' '}
                  ساعات يومية خاصة بالفرع
                </label>
              </div>
              {branch.dailyHours && (
                <div className="flex gap-4">
                  {(['open', 'close'] as const).map((key) => (
                    <label key={key}>
                      {key === 'open' ? 'يفتح' : 'يقفل'}{' '}
                      <input
                        type="time"
                        required
                        value={branch.dailyHours![key]}
                        onChange={(event) =>
                          update({
                            ...branch,
                            dailyHours: { ...branch.dailyHours!, [key]: event.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              {areas.length > 0 && <p>في التوصيل، رقم الأولوية الأصغر بيتختار الأول.</p>}
              {areas.map((entry) => {
                const area = branch.areas.find((item) => item.locationId === entry.id);
                return (
                  <div key={entry.id} className="grid gap-2 border-t pt-2">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(area)}
                        onChange={(event) =>
                          update({
                            ...branch,
                            areas: event.target.checked
                              ? [
                                  ...branch.areas,
                                  {
                                    locationId: entry.id,
                                    fee: '0.00',
                                    minimum: '0.00',
                                    etaMinutes: 35,
                                    priority: 1,
                                  },
                                ]
                              : branch.areas.filter((item) => item.locationId !== entry.id),
                          })
                        }
                      />{' '}
                      {deliveryLocationLabel(entry)}
                    </label>
                    {area && (
                      <div className="flex flex-wrap gap-3">
                        {(
                          [
                            ['fee', 'رسوم التوصيل', '0.01', 0, undefined],
                            ['minimum', 'الحد الأدنى', '0.01', 0, undefined],
                            ['etaMinutes', 'الدقايق المتوقعة', '1', 1, 1440],
                            ['priority', 'الأولوية', '1', 1, 1000],
                          ] as const
                        ).map(([key, label, step, min, max]) => (
                          <label key={key} className="grid gap-1">
                            {label}
                            <input
                              className="w-28"
                              type="number"
                              required
                              min={min}
                              max={max}
                              step={step}
                              value={area[key]}
                              onChange={(event) =>
                                update({
                                  ...branch,
                                  areas: branch.areas.map((item) =>
                                    item.locationId === entry.id
                                      ? {
                                          ...item,
                                          [key]:
                                            typeof item[key] === 'number'
                                              ? Number(event.target.value)
                                              : event.target.value,
                                        }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onChange(value.filter((entry) => entry.branchId !== branch.branchId));
                  setExpandedBranchId(null);
                }}
              >
                احذف إعدادات الفرع
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
