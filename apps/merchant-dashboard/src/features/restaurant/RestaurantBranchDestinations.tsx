import { useState } from 'react';
import {
  deliveryDestination,
  deliveryLocationLabel,
  deliveryLocations,
  type BranchDeliveryArea,
  type RestaurantBranchSettings,
} from '@waffarly/contracts';
import { Button } from '@waffarly/ui';

const cities = deliveryLocations.filter((entry) => !entry.area);
const governorates = [...new Set(cities.map((entry) => entry.governorate))];

export function BranchCityField({ locationId, onChange }: {
  locationId: string;
  onChange: (id: string) => void;
}) {
  const saved = deliveryLocations.find((entry) => entry.id === locationId);
  const [pendingGovernorate, setPendingGovernorate] = useState('');
  const governorate = saved?.governorate ?? pendingGovernorate;
  const city = cities.find((entry) =>
    entry.governorate === governorate && entry.locality === saved?.locality);
  return (
    <div className="rs-branch-place-fields">
      <label>المحافظة
        <select value={governorate} onChange={(event) => {
          setPendingGovernorate(event.target.value);
          onChange('');
        }}>
          <option value="">اختار المحافظة</option>
          {governorates.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label>مدينة أو حي الفرع
        <select required value={city?.id ?? ''} disabled={!governorate} onChange={(event) => {
          setPendingGovernorate(governorate);
          onChange(event.target.value);
        }}>
          <option value="">اختار المدينة أو الحي</option>
          {cities.filter((entry) => entry.governorate === governorate).map((entry) =>
            <option key={entry.id} value={entry.id}>{entry.locality}</option>)}
        </select>
      </label>
    </div>
  );
}

type DeliveryTerms = Pick<BranchDeliveryArea, 'fee' | 'minimum' | 'etaMinutes'>;
const initialTerms: DeliveryTerms = { fee: '0.00', minimum: '0.00', etaMinutes: 35 };

function TermsFields({ value, onChange }: {
  value: DeliveryTerms;
  onChange: (terms: DeliveryTerms) => void;
}) {
  return <div className="rs-branch-area-fields">
    <label>رسوم التوصيل (ج.م)
      <input type="number" min="0" step="0.01" value={value.fee}
        onChange={(event) => onChange({ ...value, fee: event.target.value })} />
    </label>
    <label>الحد الأدنى (ج.م)
      <input type="number" min="0" step="0.01" value={value.minimum}
        onChange={(event) => onChange({ ...value, minimum: event.target.value })} />
    </label>
    <label>المدة المتوقعة (دقيقة)
      <input type="number" min="1" max="1440" step="1" value={value.etaMinutes}
        onChange={(event) => onChange({ ...value, etaMinutes: Number(event.target.value) })} />
    </label>
  </div>;
}

export function BranchDestinations({ branch, onChange }: {
  branch: RestaurantBranchSettings;
  onChange: (branch: RestaurantBranchSettings) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [governorate, setGovernorate] = useState('');
  const [cityId, setCityId] = useState('');
  const [externalAreaId, setExternalAreaId] = useState('');
  const [localTerms, setLocalTerms] = useState(initialTerms);
  const [externalTerms, setExternalTerms] = useState(initialTerms);
  const home = deliveryLocations.find((entry) => entry.id === branch.locationId);
  const added = new Set(branch.areas.map((entry) => entry.locationId));
  const localAreas = deliveryLocations.filter((entry) =>
    entry.area && entry.governorate === home?.governorate && entry.locality === home?.locality);
  const visibleAreas = localAreas.filter((entry) =>
    !added.has(entry.id) && entry.area.includes(search.trim()));
  const localIds = selected.filter((id) => localAreas.some((entry) => entry.id === id) && !added.has(id));
  const otherCities = cities.filter((entry) =>
    entry.governorate !== home?.governorate || entry.locality !== home?.locality);
  const externalCity = otherCities.find((entry) => entry.id === cityId);
  const externalAreas = deliveryLocations.filter((entry) =>
    entry.area && entry.governorate === externalCity?.governorate
    && entry.locality === externalCity?.locality && !added.has(entry.id));
  const externalDestination = externalAreaId || (!added.has(cityId) ? cityId : '');
  const limit = 100 - branch.areas.length;

  function canAdd(terms: DeliveryTerms) {
    const money = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
    return money.test(terms.fee) && money.test(terms.minimum)
      && Number.isInteger(terms.etaMinutes) && terms.etaMinutes >= 1 && terms.etaMinutes <= 1440;
  }

  function addDestinations(ids: string[], terms: DeliveryTerms) {
    if (!ids.length || ids.length > limit || !canAdd(terms)) return;
    onChange({
      ...branch,
      areas: [...branch.areas, ...ids.map((locationId) => ({ locationId, ...terms, priority: 1 }))],
    });
  }

  function editDestination(entry: BranchDeliveryArea) {
    onChange({
      ...branch,
      areas: branch.areas.map((current) => current.locationId === entry.locationId ? entry : current),
    });
  }

  return <div className="rs-branch-destinations">
    <div className="rs-branch-area">
      <h5>داخل {home?.locality}</h5>
      {localAreas.length ? <>
        <label className="rs-branch-search">ابحث عن منطقة
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="rs-branch-area-choices">
          {visibleAreas.map((entry) => (
            <button key={entry.id} type="button" aria-pressed={selected.includes(entry.id)}
              onClick={() => setSelected((ids) =>
                ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id])}>
              {selected.includes(entry.id) && <span aria-hidden="true">✓</span>}
              {entry.area}
            </button>
          ))}
        </div>
        {!visibleAreas.length && <p>مفيش مناطق متاحة للإضافة هنا.</p>}
        {localIds.length > 0 && <>
          <p>المناطق المختارة: {localAreas.filter((entry) => localIds.includes(entry.id)).map((entry) => entry.area).join('، ')}</p>
          <TermsFields value={localTerms} onChange={setLocalTerms} />
          <Button type="button" size="sm" disabled={localIds.length > limit || !canAdd(localTerms)}
            onClick={() => { addDestinations(localIds, localTerms); setSelected([]); }}>
            أضف المناطق المختارة بنفس السعر
          </Button>
        </>}
      </> : <p>الكتالوج لسه مفيهوش مناطق مسجلة داخل المدينة دي.</p>}
    </div>
    <details className="rs-branch-area">
      <summary>إضافة مدينة خارج نطاق الفرع</summary>
      <p>اختار مدينة كاملة لو الفرع بيوصل لكل عناوينها.</p>
      <div className="rs-branch-place-fields">
        <label>محافظة الوجهة
          <select value={governorate} onChange={(event) => {
            setGovernorate(event.target.value); setCityId(''); setExternalAreaId('');
          }}>
            <option value="">اختار المحافظة</option>
            {[...new Set(otherCities.map((entry) => entry.governorate))].map((name) =>
              <option key={name}>{name}</option>)}
          </select>
        </label>
        <label>مدينة أو حي الوجهة
          <select disabled={!governorate} value={cityId} onChange={(event) => {
            setCityId(event.target.value); setExternalAreaId('');
          }}>
            <option value="">اختار المدينة أو الحي</option>
            {otherCities.filter((entry) => entry.governorate === governorate).map((entry) =>
              <option key={entry.id} value={entry.id}>{entry.locality}</option>)}
          </select>
        </label>
      </div>
      {cityId && <>
        <label className="rs-branch-search">التغطية داخل المدينة
          <select value={externalAreaId} onChange={(event) => setExternalAreaId(event.target.value)}>
            <option value="">{added.has(cityId) ? 'المدينة بالكامل مضافة بالفعل' : 'المدينة بالكامل'}</option>
            {externalAreas.map((entry) => <option key={entry.id} value={entry.id}>{entry.area}</option>)}
          </select>
        </label>
        <TermsFields value={externalTerms} onChange={setExternalTerms} />
        <Button type="button" size="sm" disabled={!externalDestination || limit < 1 || !canAdd(externalTerms)}
          onClick={() => { addDestinations([externalDestination], externalTerms); setExternalAreaId(''); }}>
          أضف الوجهة
        </Button>
      </>}
    </details>
    {limit <= 0 && <p role="status">وصلت للحد الأقصى: 100 وجهة للفرع.</p>}
    <div className="rs-branch-area-list">
      {branch.areas.length > 0 && <h5>التغطية المضافة ({branch.areas.length})</h5>}
      {branch.areas.map((entry) => {
        const location = deliveryDestination(entry);
        const name = location ? deliveryLocationLabel(location) : entry.locationId;
        return <details className="rs-branch-area" key={entry.locationId}>
          <summary>
            {name}{location && !location.area ? ' (المدينة بالكامل)' : ''} · {entry.fee} ج.م
          </summary>
          <TermsFields value={entry} onChange={(terms) => editDestination({ ...entry, ...terms })} />
          {!canAdd(entry) && <p role="alert">راجع الرسوم والحد الأدنى والمدة قبل الحفظ.</p>}
          <details className="rs-branch-priority">
            <summary>أولوية الفرع عند تداخل التغطية</summary>
            <label>الأولوية (الرقم الأقل يُفضّل)
              <input type="number" min="1" max="1000" step="1" value={entry.priority}
                onChange={(event) => editDestination({ ...entry, priority: Number(event.target.value) })} />
            </label>
          </details>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({
            ...branch, areas: branch.areas.filter((item) => item.locationId !== entry.locationId),
          })}>إزالة {location?.area || location?.locality || 'الوجهة'}</Button>
        </details>;
      })}
    </div>
  </div>;
}
