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
      <div className="rs-online-branches-heading">
        <div>
          <h3 id="online-branches-title" className="rs-section-title">
            فروع الطلب أونلاين
          </h3>
          <p>حدد الفروع اللي هتستقبل الطلبات. إعدادات كل فرع بتحدد مكانه وطرق الاستلام ومناطق توصيله.</p>
        </div>
        {value.length > 0 && (
          <span className="rs-branch-count">{value.length} {value.length === 1 ? 'فرع' : 'فروع'}</span>
        )}
      </div>
      {error && <p role="alert">تعذر تحميل الفروع. حدّث الصفحة وحاول تاني.</p>}
      {availableBranches.length > 0 ? (
        <div className="rs-online-branch-add">
          <label>
            أضف فرعًا موجودًا
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">اختار فرع لإعداد الطلبات أونلاين</option>
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" size="sm" disabled={!selected} onClick={addBranch}>
            إضافة فرع
          </Button>
        </div>
      ) : value.length === 0 ? (
        <p className="rs-branch-empty">مفيش فروع متاحة للإضافة حاليًا. أضف فرعًا من إدارة الفروع أولًا.</p>
      ) : null}

      {value.map((branch) => {
        const physical = branches.find((entry) => entry.id === branch.branchId);
        const location = deliveryLocations.find((entry) => entry.id === branch.locationId);
        const areas = deliveryLocations.filter((entry) => entry.governorate === location?.governorate);
        const expanded = expandedBranchId === branch.branchId;
        const detailsId = `online-branch-${branch.branchId}`;
        const issues: string[] = [];
        if (!branch.locationId) issues.push('حدد موقع الفرع');
        if (!branch.pickup && !branch.delivery) issues.push('فعّل طريقة استلام واحدة على الأقل');
        if (branch.delivery && branch.areas.length === 0) issues.push('أضف منطقة توصيل');
        const paused = branch.paused || (!branch.pickup && !branch.delivery) || !branch.locationId || (branch.delivery && !branch.areas.length);

        return (
          <article key={branch.branchId} className="rs-online-branch">
            <button
              type="button"
              className="rs-online-branch-toggle"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpandedBranchId(expanded ? null : branch.branchId)}
            >
              <span className="rs-branch-title-group">
                <strong>{physical?.name ?? branch.branchId}</strong>
                <span className={`rs-branch-status${paused ? ' is-paused' : ''}`}>
                  {branch.paused ? 'متوقف مؤقتًا' : paused ? 'الإعداد غير مكتمل' : 'إعداد الفرع مكتمل'}
                </span>
              </span>
              <Icon name="chevron" />
            </button>
            <div id={detailsId} hidden={!expanded} className="rs-online-branch-fields">
              {physical?.address && <p className="rs-branch-address">عنوان الفرع المسجل: {physical.address}</p>}

              <section className="rs-branch-step">
                <div className="rs-branch-step-heading"><span>1</span><div><h4>مكان الفرع</h4><p>اختار المنطقة اللي موجود فيها الفرع؛ دي مش مناطق التوصيل.</p></div></div>
                <label className="grid gap-1">
                  المنطقة الجغرافية للفرع
                  <select
                    required
                    value={branch.locationId}
                    onChange={(event) => {
                      const next = deliveryLocations.find((entry) => entry.id === event.target.value);
                      update({
                        ...branch,
                        locationId: event.target.value,
                        areas: branch.areas.filter((area) => deliveryLocations.some(
                          (entry) => entry.id === area.locationId && entry.governorate === next?.governorate,
                        )),
                      });
                    }}
                  >
                    <option value="">اختار محافظة ومنطقة الفرع</option>
                    {deliveryLocations.map((entry) => <option key={entry.id} value={entry.id}>{deliveryLocationLabel(entry)}</option>)}
                  </select>
                </label>
              </section>

              <section className="rs-branch-step">
                <div className="rs-branch-step-heading"><span>2</span><div><h4>طرق استلام الطلب</h4><p>اختار طريقة واحدة على الأقل. لازم تكون متاحة كمان في إعدادات المطعم العامة.</p></div></div>
                <div className="rs-branch-options">
                  <label className="rs-branch-option"><input type="checkbox" role="switch" checked={branch.pickup} onChange={(event) => update({ ...branch, pickup: event.target.checked })} /><span><strong>استلام من الفرع</strong><small>العميل يستلم طلبه من المكان.</small></span></label>
                  <label className="rs-branch-option"><input type="checkbox" role="switch" checked={branch.delivery} onChange={(event) => update({ ...branch, delivery: event.target.checked })} /><span><strong>توصيل للعميل</strong><small>حدد المناطق والرسوم في الخطوة التالية.</small></span></label>
                </div>
              </section>

              {branch.delivery && (
                <section className="rs-branch-step">
                  <div className="rs-branch-step-heading"><span>3</span><div><h4>مناطق التوصيل لهذا الفرع</h4><p>المتاح حاليًا من مناطق الخدمة المسجلة في محافظة الفرع فقط.</p></div></div>
                  {!branch.locationId ? <p className="rs-branch-note">حدد موقع الفرع أولًا عشان تظهر المناطق المتاحة.</p> : areas.length === 0 ? <p className="rs-branch-note">مفيش مناطق خدمة مسجلة في محافظة الفرع حاليًا.</p> : (
                    <div className="rs-branch-area-list">
                      {areas.map((entry) => {
                        const area = branch.areas.find((item) => item.locationId === entry.id);
                        return <div key={entry.id} className={`rs-branch-area${area ? ' is-selected' : ''}`}>
                          <label className="rs-branch-area-toggle"><input type="checkbox" checked={Boolean(area)} onChange={(event) => update({ ...branch, areas: event.target.checked ? [...branch.areas, { locationId: entry.id, fee: '0.00', minimum: '0.00', etaMinutes: 35, priority: 1 }] : branch.areas.filter((item) => item.locationId !== entry.id) })} /><span>{deliveryLocationLabel(entry)}</span></label>
                          {area && <div className="rs-branch-area-fields">
                            {([['fee', 'رسوم التوصيل', 'ج.م'], ['minimum', 'الحد الأدنى للطلب', 'ج.م'], ['etaMinutes', 'المدة المتوقعة', 'دقيقة']] as const).map(([key, label, unit]) => <label key={key}>{label}<span className="rs-number-field"><input type="number" required min={key === 'etaMinutes' ? 1 : 0} max={key === 'etaMinutes' ? 1440 : undefined} step={key === 'etaMinutes' ? 1 : 0.01} value={area[key]} onChange={(event) => update({ ...branch, areas: branch.areas.map((item) => item.locationId === entry.id ? { ...item, [key]: typeof item[key] === 'number' ? Number(event.target.value) : event.target.value } : item) })} /><small>{unit}</small></span></label>)}
                            <details className="rs-branch-priority"><summary>إعداد متقدم: أولوية الفرع</summary><label>الأولوية (الرقم الأقل يُفضّل)<input type="number" min="1" max="1000" step="1" value={area.priority} onChange={(event) => update({ ...branch, areas: branch.areas.map((item) => item.locationId === entry.id ? { ...item, priority: Number(event.target.value) } : item) })} /></label></details>
                          </div>}
                        </div>;
                      })}
                    </div>
                  )}
                </section>
              )}

              <section className="rs-branch-step">
                <div className="rs-branch-step-heading"><span>{branch.delivery ? '4' : '3'}</span><div><h4>مواعيد الفرع</h4><p>مواعيد المطعم العامة تفضل مطبقة؛ الفترة دي بتضيف قيدًا يوميًا للفرع.</p></div></div>
                <label className="rs-branch-option rs-branch-hours-toggle"><input type="checkbox" role="switch" checked={Boolean(branch.dailyHours)} onChange={(event) => update({ ...branch, dailyHours: event.target.checked ? { open: '09:00', close: '23:00' } : null })} /><span><strong>حدد فترة يومية خاصة بالفرع</strong><small>اقفل الاختيار لو الفرع بيتبع مواعيد المطعم.</small></span></label>
                {branch.dailyHours && <div className="rs-branch-time-fields">{(['open', 'close'] as const).map((key) => <label key={key}>{key === 'open' ? 'يفتح يوميًا' : 'يقفل يوميًا'}<input type="time" required value={branch.dailyHours![key]} onChange={(event) => update({ ...branch, dailyHours: { ...branch.dailyHours!, [key]: event.target.value } })} /></label>)}</div>}
              </section>

              <section className="rs-branch-step rs-branch-activation">
                <div className="rs-branch-step-heading"><span>{branch.delivery ? '5' : '4'}</span><div><h4>استقبال الطلبات</h4><p>الإيقاف المؤقت يمنع الطلبات من الفرع حتى لو باقي الإعدادات جاهزة.</p></div></div>
                <label className="rs-branch-option"><input type="checkbox" role="switch" checked={!branch.paused} disabled={issues.length > 0} onChange={(event) => update({ ...branch, paused: !event.target.checked })} /><span><strong>السماح للفرع باستقبال الطلبات</strong><small>{issues.length ? `كمّل الأول: ${issues.join('، ')}` : 'تأكد من توفر طريقة الاستلام المناسبة في إعدادات المطعم.'}</small></span></label>
              </section>
              <div className="rs-branch-footer"><Button type="button" variant="ghost" onClick={() => { onChange(value.filter((entry) => entry.branchId !== branch.branchId)); setExpandedBranchId(null); }}>إزالة من إعدادات الطلب أونلاين</Button></div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
