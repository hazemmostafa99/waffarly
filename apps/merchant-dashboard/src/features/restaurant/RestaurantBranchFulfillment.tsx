import { useEffect, useState } from 'react';
import {
  deliveryLocationLabel,
  deliveryLocations,
  type InventoryBranch,
  type RestaurantBranchSettings,
} from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export function RestaurantBranchFulfillment({ value, onChange }: {
  value: RestaurantBranchSettings[];
  onChange: (branches: RestaurantBranchSettings[]) => void;
}) {
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<InventoryBranch[]>('/owner/inventory/branches').then(
      (result) => { if (active) setBranches(result.filter((branch) => !branch.archivedAt)); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, []);
  function update(next: RestaurantBranchSettings) {
    onChange(value.map((branch) => branch.branchId === next.branchId ? next : branch));
  }
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <h2 className="font-bold">تشغيل فروع الطلب أونلاين</h2>
      <p className="text-sm">اختار الفروع اللي تستقبل طلبات، واضبط المناطق والأولوية لكل فرع. رقم الأولوية الأصغر ييجي الأول.</p>
      {error && <p role="alert">تعذر تحميل الفروع.</p>}
      <label className="grid gap-2">
        إضافة فرع للطلبات الأونلاين
        <select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">اختار فرع</option>
          {branches.filter((branch) => !value.some((entry) => entry.branchId === branch.id))
            .map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </label>
      <button type="button" disabled={!selected} onClick={() => {
        onChange([...value, { branchId: selected, locationId: '', paused: true, pickup: false, delivery: false, dailyHours: null, areas: [] }]);
        setSelected('');
      }}>أضف الفرع</button>
      {value.map((branch) => {
        const physical = branches.find((entry) => entry.id === branch.branchId);
        const location = deliveryLocations.find((entry) => entry.id === branch.locationId);
        const areas = deliveryLocations.filter((entry) => entry.governorate === location?.governorate);
        return (
          <fieldset key={branch.branchId} className="grid gap-3 rounded-xl border p-4">
            <legend>{physical?.name ?? branch.branchId}</legend>
            {physical?.address && <p>{physical.address}</p>}
            <label className="grid gap-1">موقع الفرع
              <select required value={branch.locationId} onChange={(event) => {
                const next = deliveryLocations.find((entry) => entry.id === event.target.value);
                update({ ...branch, locationId: event.target.value,
                  areas: branch.areas.filter((area) => areas.some((entry) =>
                    entry.id === area.locationId && entry.governorate === next?.governorate)),
                });
              }}>
                <option value="">اختار موقع الفرع</option>
                {deliveryLocations.map((entry) => <option key={entry.id} value={entry.id}>{deliveryLocationLabel(entry)}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-4">
              <label><input type="checkbox" checked={branch.paused} onChange={(event) => update({ ...branch, paused: event.target.checked })} /> إيقاف مؤقت</label>
              <label><input type="checkbox" checked={branch.pickup} onChange={(event) => update({ ...branch, pickup: event.target.checked })} /> استلام من الفرع</label>
              <label><input type="checkbox" checked={branch.delivery} onChange={(event) => update({ ...branch, delivery: event.target.checked })} /> توصيل</label>
              <label><input type="checkbox" checked={Boolean(branch.dailyHours)} onChange={(event) => update({ ...branch, dailyHours: event.target.checked ? { open: '09:00', close: '23:00' } : null })} /> ساعات يومية خاصة بالفرع</label>
            </div>
            {branch.dailyHours && (
              <div className="flex gap-4">
                {(['open', 'close'] as const).map((key) => (
                  <label key={key}>{key === 'open' ? 'يفتح' : 'يقفل'}{' '}
                    <input type="time" required value={branch.dailyHours![key]} onChange={(event) =>
                      update({ ...branch, dailyHours: { ...branch.dailyHours!, [key]: event.target.value } })
                    } />
                  </label>
                ))}
              </div>
            )}
            {areas.map((entry) => {
              const area = branch.areas.find((item) => item.locationId === entry.id);
              return <div key={entry.id} className="grid gap-2 border-t pt-2">
                <label><input type="checkbox" checked={Boolean(area)} onChange={(event) => update({
                  ...branch,
                  areas: event.target.checked
                    ? [...branch.areas, { locationId: entry.id, fee: '0.00', minimum: '0.00', etaMinutes: 35, priority: 1 }]
                    : branch.areas.filter((item) => item.locationId !== entry.id),
                })} /> {deliveryLocationLabel(entry)}</label>
                {area && <div className="flex flex-wrap gap-3">
                  {([
                    ['fee', 'رسوم التوصيل', '0.01', 0, undefined],
                    ['minimum', 'الحد الأدنى', '0.01', 0, undefined],
                    ['etaMinutes', 'الدقايق المتوقعة', '1', 1, 1440],
                    ['priority', 'الأولوية', '1', 1, 1000],
                  ] as const).map(([key, label, step, min, max]) => (
                    <label key={key} className="grid gap-1">{label}
                      <input className="w-28" type="number" required min={min} max={max} step={step} value={area[key]}
                        onChange={(event) => update({ ...branch, areas: branch.areas.map((item) =>
                          item.locationId === entry.id ? { ...item, [key]: typeof item[key] === 'number'
                            ? Number(event.target.value) : event.target.value } : item),
                        })} />
                    </label>
                  ))}
                </div>}
              </div>;
            })}
            <button type="button" onClick={() => onChange(value.filter((entry) => entry.branchId !== branch.branchId))}>احذف إعدادات الفرع</button>
          </fieldset>
        );
      })}
    </section>
  );
}
