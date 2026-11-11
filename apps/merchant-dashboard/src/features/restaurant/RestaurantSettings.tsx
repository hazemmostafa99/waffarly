import { RestaurantImageField } from './RestaurantImageField.js';
import { Icon } from '../../Icons.js';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { OwnerProfile, OwnerRestaurantSettings, RestaurantPeriod } from '@waffarly/contracts';
import { Button, Card, Input, Textarea, useLocale } from '@waffarly/ui';
import { ApiError, apiRequest, apiUpload } from '../../lib/api-client.js';

function initial(profile: OwnerProfile): OwnerRestaurantSettings {
  return { name: profile.merchantName, description: '', cuisines: [], logoImage: null, coverImage: null,
    published: false, displayOrder: 0, timezone: 'Africa/Cairo', alwaysOpen: false, openingHours: [], scheduleExceptions: [],
    ordersPaused: false, pauseReason: null, deliveryEnabled: true, pickupEnabled: true, deliveryFee: '0.00', minimumDeliveryOrder: '0.00',
    deliveryTimeMinMinutes: 25, deliveryTimeMaxMinutes: 35, deliveryAreas: [], revision: 0 };
}
function editable(data: OwnerRestaurantSettings): OwnerRestaurantSettings {
  return { name: data.name, description: data.description, cuisines: data.cuisines, logoImage: data.logoImage, coverImage: data.coverImage,
    published: data.published, displayOrder: data.displayOrder, timezone: 'Africa/Cairo', alwaysOpen: data.alwaysOpen,
    openingHours: data.openingHours, scheduleExceptions: data.scheduleExceptions, ordersPaused: data.ordersPaused, pauseReason: data.pauseReason,
    deliveryEnabled: data.deliveryEnabled, pickupEnabled: data.pickupEnabled, deliveryFee: data.deliveryFee, minimumDeliveryOrder: data.minimumDeliveryOrder,
    deliveryTimeMinMinutes: data.deliveryTimeMinMinutes, deliveryTimeMaxMinutes: data.deliveryTimeMaxMinutes, deliveryAreas: data.deliveryAreas, revision: data.revision };
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-2 text-sm font-medium">{label}{children}</label>;
}
const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function Periods({ value, onChange }: { value: RestaurantPeriod[]; onChange: (periods: RestaurantPeriod[]) => void }) {
  return <div className="grid gap-2">{value.length === 0 && <span className="text-xs text-muted-foreground">مغلق في هذا اليوم</span>}{value.map((period, index) => <div key={index} className="flex flex-wrap items-center gap-2">
    <label className="flex items-center gap-2 text-xs">من<Input type="time" required value={period.open} onChange={(event) => onChange(value.map((entry,i) => i === index ? { ...entry, open: event.target.value } : entry))} className="w-32" /></label>
    <label className="flex items-center gap-2 text-xs">إلى<Input type="time" required value={period.close} onChange={(event) => onChange(value.map((entry,i) => i === index ? { ...entry, close: event.target.value } : entry))} className="w-32" /></label>
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_,i) => i !== index))}>حذف الفترة</Button>
  </div>)}<Button type="button" variant="outline" size="sm" disabled={value.length >= 8} onClick={() => onChange([...value,{open:'09:00',close:'22:00'}])} className="w-fit">إضافة فترة</Button></div>;
}
export function RestaurantSettings({ profile, onNameSaved, onDirtyChange, activeSection = 'identity' }: { profile: OwnerProfile; onNameSaved?: (name: string) => void; onDirtyChange?: (dirty:boolean)=>void; activeSection?: 'identity'|'hours'|'delivery' }) {
  const { locale } = useLocale();
  const [draft,setDraft] = useState(() => initial(profile));
  const [saved,setSaved] = useState('');
  const savedDraft = useRef<OwnerRestaurantSettings>(initial(profile));
  const [loading,setLoading] = useState(true);
  const [failed,setFailed] = useState(false);
  const [busy,setBusy] = useState(false);
  const [conflict,setConflict] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const lock = useRef(false);
  const dirty = saved !== '' && saved !== JSON.stringify(draft);
  useEffect(()=>{onDirtyChange?.(dirty||busy);},[dirty,busy,onDirtyChange]);
  async function load() {
    setLoading(true); setFailed(false); setError(''); setNotice('');
    try {
      let next: OwnerRestaurantSettings;
      try { next = editable(await apiRequest<OwnerRestaurantSettings>('/owner/restaurant')); }
      catch (cause) { if (cause instanceof ApiError && cause.statusCode === 404) next = initial(profile); else throw cause; }
      savedDraft.current=structuredClone(next); setDraft(next); setSaved(JSON.stringify(next)); setConflict(false);
    } catch (cause) { setFailed(true); setError(cause instanceof Error ? cause.message : 'تعذر تحميل إعدادات المطعم.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [profile.merchantId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn);
  }, [dirty]);
  function change<K extends keyof OwnerRestaurantSettings>(key: K, value: OwnerRestaurantSettings[K]) { setDraft((current) => ({...current,[key]:value})); setNotice(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    const validation = !draft.name.trim() || draft.cuisines.some((value)=>!value.trim()) ? 'راجع اسم المطعم وأنواع الأكل في هوية المطعم.'
      : draft.deliveryTimeMaxMinutes < draft.deliveryTimeMinMinutes ? 'مدة التوصيل إلى لازم تكون أكبر من أو تساوي المدة من.'
      : draft.scheduleExceptions.some((entry)=>!entry.date) ? 'حدد تاريخًا لكل يوم استثنائي في مواعيد العمل.'
      : draft.deliveryAreas.some((entry)=>!entry.name.trim()) ? 'اكتب اسم كل منطقة توصيل.' : '';
    if(validation){setError(validation);return;}
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = editable(await apiRequest<OwnerRestaurantSettings>('/owner/restaurant',{method:'PUT',body:JSON.stringify(draft)}));
      savedDraft.current=structuredClone(next); setDraft(next); setSaved(JSON.stringify(next)); setConflict(false); onNameSaved?.(next.name); setNotice('تم حفظ إعدادات المطعم. ستظهر في وفرلي عند تحديث بيانات الصفحة.');
    } catch (cause) { setConflict(cause instanceof ApiError && cause.statusCode === 409); setError(cause instanceof Error ? cause.message : 'تعذر الحفظ.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function upload(key: 'logoImage'|'coverImage', file?: File) {
    if (!file || lock.current) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('اختار صورة JPG أو PNG أو WebP لا تتجاوز 10 ميجابايت.');return;}
    lock.current = true; setBusy(true); setError('');
    try { const asset = await apiUpload<{publicUrl:string}>('/owner/catalog/media/upload',file); change(key,{src:asset.publicUrl,alt:draft.name}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر رفع الصورة.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (loading) return <Card className="p-5" role="status">جارٍ تحميل إعدادات المطعم…</Card>;
  if (failed) return <Card className="p-5"><p role="alert">{error}</p><Button onClick={() => void load()}>إعادة المحاولة</Button></Card>;
  return <Card id="restaurant-settings" className="rs-panel" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <div className="rs-card-heading"><span className="rs-section-icon"><Icon name={activeSection==='identity'?'store':activeSection==='hours'?'clock':'location'}/></span><div><h3>{activeSection==='identity'?'بيانات تعرّف العملاء بمطعمك':activeSection==='hours'?'حدد أوقات استقبال الطلبات':'طرق استلام تناسب عملاءك'}</h3><p>{activeSection==='identity'?'الاسم والوصف والصور اللي بتظهر في وفرلي.':activeSection==='hours'?'تحكم في الجدول الأسبوعي والاستثناءات من مكان واحد.':'حدد الرسوم والمدة والمناطق اللي بتوصل لها.'}</p></div></div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-destructive p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-secondary p-3 text-sm">{notice}</p>}
    {conflict && <div className="mb-4"><p className="text-sm">الإعدادات اتغيرت من مكان آخر. مسودتك لم تُمسح. إعادة التحميل تستبدلها بالنسخة الحالية.</p><Button variant="outline" onClick={() => void load()}>تحميل النسخة الحالية واستبدال المسودة</Button></div>}
    <form noValidate onSubmit={(event) => void save(event)}>
      <fieldset disabled={busy} className="m-0 min-w-0 space-y-6 border-0 p-0">
        <section hidden={activeSection!=='identity'} className="rs-editor-section"><h3 className="rs-section-title">الاسم والوصف</h3>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="اسم المطعم"><Input required maxLength={160} value={draft.name} onChange={(event) => change('name',event.target.value)} /></Field><Field label="أنواع الأكل — افصل بفاصلة"><Input value={draft.cuisines.join('، ')} onChange={(event) => change('cuisines',event.target.value.split(/[,،]/).map((v) => v.trim()))} onBlur={() => change('cuisines',draft.cuisines.filter(Boolean))} /></Field></div>
          <Field label="وصف مختصر"><Textarea maxLength={1000} rows={3} value={draft.description} onChange={(event) => change('description',event.target.value)} /></Field>
          <div className="rs-image-grid"><RestaurantImageField kind="cover" value={draft.coverImage} onChange={(image)=>change('coverImage',image)} onUpload={(file)=>void upload('coverImage',file)}/><RestaurantImageField kind="logo" value={draft.logoImage} onChange={(image)=>change('logoImage',image)} onUpload={(file)=>void upload('logoImage',file)}/></div>
          <div className="rs-publication"><label className="rs-toggle-label"><input type="checkbox" role="switch" checked={draft.published} onChange={(event) => change('published',event.target.checked)} />نشر المطعم في وفرلي</label><Field label="ترتيب الظهور"><Input type="number" min={0} required value={draft.displayOrder} onChange={(event) => change('displayOrder',Number(event.target.value))} className="w-24" /></Field></div>
        </section>
        <section hidden={activeSection!=='hours'} className="rs-editor-section"><h3 className="rs-section-title">حالة استقبال الطلبات</h3>
          <div hidden={!draft.ordersPaused}><Field label="سبب الإيقاف المؤقت"><Input maxLength={500} value={draft.pauseReason ?? ''} onChange={(event) => change('pauseReason',event.target.value || null)} /></Field></div>
          <div className="rs-toggle-grid"><label className="rs-toggle-label"><input type="checkbox" role="switch" checked={draft.alwaysOpen} onChange={(event) => change('alwaysOpen',event.target.checked)} />مفتوح طوال اليوم</label><label className="rs-toggle-label"><input type="checkbox" role="switch" data-pause="true" checked={draft.ordersPaused} onChange={(event) => change('ordersPaused',event.target.checked)} />إيقاف استقبال الطلبات مؤقتًا</label></div>
          <p className="text-xs leading-5 text-muted-foreground">لو وقت الإغلاق أقل من الفتح، الفترة تمتد لليوم التالي. الإجازات أدناه لها أولوية. إيقاف الطلبات لا يخفي المنيو.</p>
          {!draft.alwaysOpen && <div className="grid gap-3">{days.map((day,index) => <div key={day} className="rs-day-row"><label className="rs-day-toggle"><input type="checkbox" role="switch" checked={Boolean(draft.openingHours.find((entry)=>entry.day===index)?.periods.length)} onChange={(event)=>change('openingHours',[...draft.openingHours.filter((entry)=>entry.day!==index),{day:index,periods:event.target.checked?[{open:'09:00',close:'22:00'}]:[]}])}/><strong>{day}</strong></label><Periods value={draft.openingHours.find((entry) => entry.day === index)?.periods ?? []} onChange={(periods) => change('openingHours',[...draft.openingHours.filter((entry) => entry.day !== index),{day:index,periods}])} /></div>)}</div>}
          <h4 className="rs-section-title">الإجازات والمواعيد الاستثنائية</h4><p className="rs-hint">أضف يومًا بدون فترات ليصبح إجازة، أو حدد مواعيد خاصة له.</p>
          {draft.scheduleExceptions.map((entry,index) => <div key={index} className="space-y-3 rounded-xl border border-border p-3"><div className="flex items-end gap-3"><Field label="التاريخ"><Input type="date" required value={entry.date} onChange={(event) => change('scheduleExceptions',draft.scheduleExceptions.map((item,i) => i === index ? {...item,date:event.target.value} : item))} /></Field><Button type="button" variant="ghost" onClick={() => change('scheduleExceptions',draft.scheduleExceptions.filter((_,i) => i !== index))}>حذف اليوم</Button></div><Periods value={entry.periods} onChange={(periods) => change('scheduleExceptions',draft.scheduleExceptions.map((item,i) => i === index ? {...item,periods} : item))} /></div>)}
          <Button type="button" variant="outline" disabled={draft.scheduleExceptions.length >= 366} onClick={() => change('scheduleExceptions',[...draft.scheduleExceptions,{date:'',periods:[]}])}>إضافة يوم استثنائي</Button>
        </section>
        <section hidden={activeSection!=='delivery'} className="rs-editor-section"><h3 className="rs-section-title">طرق الاستلام</h3>
          <div className="rs-toggle-grid">{(['deliveryEnabled','pickupEnabled'] as const).map((key) => <label key={key} className="rs-toggle-label"><input type="checkbox" role="switch" checked={draft[key]} onChange={(event) => change(key,event.target.checked)} />{key === 'deliveryEnabled' ? 'التوصيل متاح' : 'الاستلام من المطعم متاح'}</label>)}</div>
          <div className="grid gap-4 sm:grid-cols-2">{(['deliveryFee','minimumDeliveryOrder'] as const).map((key) => <Field key={key} label={key === 'deliveryFee' ? 'رسوم التوصيل الثابتة — ج.م' : 'الحد الأدنى للتوصيل — ج.م'}><Input type="number" step="0.01" min="0" required value={draft[key]} onChange={(event) => change(key,event.target.value)} /></Field>)}{(['deliveryTimeMinMinutes','deliveryTimeMaxMinutes'] as const).map((key) => <Field key={key} label={key === 'deliveryTimeMinMinutes' ? 'مدة التوصيل من — دقيقة' : 'مدة التوصيل إلى — دقيقة'}><Input type="number" min="0" max="1440" required value={draft[key]} onChange={(event) => change(key,Number(event.target.value))} /></Field>)}</div>
          <h4 className="text-sm font-bold">مناطق التوصيل — اختياري</h4><p className="text-xs text-muted-foreground">عند إضافة مناطق، يُطلب من العميل اختيار منطقة ويُستخدم رسمها. بدون مناطق يُستخدم الرسم الثابت.</p>
          {draft.deliveryAreas.map((entry,index) => <div key={entry.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_140px_auto]"><Field label="اسم المنطقة"><Input required maxLength={160} value={entry.name} onChange={(event) => change('deliveryAreas',draft.deliveryAreas.map((item,i) => i === index ? {...item,name:event.target.value} : item))} /></Field><Field label="الرسوم — ج.م"><Input type="number" min="0" step="0.01" required value={entry.fee} onChange={(event) => change('deliveryAreas',draft.deliveryAreas.map((item,i) => i === index ? {...item,fee:event.target.value} : item))} /></Field><Button type="button" variant="ghost" onClick={() => change('deliveryAreas',draft.deliveryAreas.filter((_,i) => i !== index))}>حذف</Button></div>)}
          <Button type="button" variant="outline" disabled={draft.deliveryAreas.length >= 100} onClick={() => change('deliveryAreas',[...draft.deliveryAreas,{id:crypto.randomUUID(),name:'',fee:'0.00'}])}>إضافة منطقة</Button>
        </section>
        <footer className="rs-savebar"><span role="status"><i className={dirty?'is-dirty':''}/>{busy?'جارٍ حفظ التغييرات…':dirty?'عندك تغييرات غير محفوظة':'كل التغييرات محفوظة'}</span><div><Button type="button" variant="outline" disabled={busy||!dirty} onClick={()=>{setDraft(structuredClone(savedDraft.current));setError('');setNotice('');}}>تراجع عن التغييرات</Button><Button type="submit" disabled={busy||conflict||!dirty} className="rs-primary">{busy?'جارٍ الحفظ…':'حفظ التغييرات'}</Button></div></footer>
      </fieldset>
    </form>
  </Card>;
}
