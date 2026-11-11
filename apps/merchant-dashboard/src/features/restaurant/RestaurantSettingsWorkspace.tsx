import { useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { Button, Card, Dialog, useLocale } from '@waffarly/ui';
import type { OwnerProfile } from '@waffarly/contracts';
import { Icon } from '../../Icons.js';
import { StorefrontSettings } from '../../StorefrontSettings.js';
import { RestaurantSettings } from './RestaurantSettings.js';
import './restaurant-settings.css';
type Tab = 'identity'|'hours'|'delivery'|'design'|'account';
const tabs: {id:Tab;icon:string;ar:string;en:string;description:string}[] = [
 {id:'identity',icon:'store',ar:'هوية المطعم',en:'Restaurant identity',description:'الاسم والصور وظهور المطعم'},
 {id:'hours',icon:'clock',ar:'مواعيد العمل',en:'Opening hours',description:'الجدول الأسبوعي والإجازات'},
 {id:'delivery',icon:'location',ar:'التوصيل والاستلام',en:'Delivery & pickup',description:'الرسوم والمناطق والمدة'},
 {id:'design',icon:'settings',ar:'تصميم المتجر الخاص',en:'Storefront design',description:'القالب وألوان متجرك المستقل'},
 {id:'account',icon:'customers',ar:'الحساب والاشتراك',en:'Account & subscription',description:'بيانات المالك وإدارة الحساب'},
];
export function RestaurantSettingsWorkspace({profile,onNameSaved}:{profile:OwnerProfile;onNameSaved:(name:string)=>void}) {
 const {locale}=useLocale();
 const [params,setParams]=useSearchParams();
 const selected=params.get('section');
 const active:Tab=tabs.find((entry)=>entry.id===selected)?.id??'identity';
 const setActive=(id:Tab)=>{const next=new URLSearchParams(params);next.set('section',id);setParams(next);};
 const [profileDirty,setProfileDirty]=useState(false);
 const blocker=useBlocker(({currentLocation,nextLocation})=>profileDirty&&currentLocation.pathname!==nextLocation.pathname);
 return <div className="rs-workspace">
  <aside className="rs-navigation">
   <nav aria-label={locale==='ar'?'أقسام الإعدادات':'Settings sections'}>{tabs.map((entry)=><button key={entry.id} type="button" aria-current={active===entry.id?'page':undefined} className={active===entry.id?'is-active':''} onClick={()=>setActive(entry.id)}><span className="rs-nav-icon"><Icon name={entry.icon}/></span><span><strong>{locale==='ar'?entry.ar:entry.en}</strong><small>{entry.description}</small></span></button>)}</nav>
  </aside>
  <div className="rs-main">
   <div hidden={!['identity','hours','delivery'].includes(active)}><RestaurantSettings profile={profile} onNameSaved={onNameSaved} onDirtyChange={setProfileDirty} activeSection={active==='hours'||active==='delivery'?active:'identity'}/></div>
   <div hidden={active!=='design'} className="rs-design"><StorefrontSettings profile={profile}/></div>
   <div hidden={active!=='account'}><Card className="rs-panel"><div className="rs-card-heading"><span className="rs-section-icon"><Icon name="customers"/></span><div><h3>حسابك واشتراكك</h3><p>بيانات المالك والتواصل والفواتير في صفحة الحساب.</p></div></div><div className="rs-account-details"><div><small>اسم النشاط</small><strong>{profile.merchantName}</strong></div><div><small>اسم المالك</small><strong>{profile.ownerName==='Reference demo'?'حساب عرض تجريبي':profile.ownerName}</strong></div></div><Link className="rs-link-button" to="/account">فتح إدارة الحساب <Icon name="arrow"/></Link></Card></div>
  </div>
  <Dialog open={blocker.state==='blocked'} onOpenChange={(open)=>{if(!open&&blocker.state==='blocked')blocker.reset();}} title="عندك تغييرات غير محفوظة" closeLabel="إغلاق"><div className="p-5"><p className="text-sm leading-6">احفظ تغييرات المطعم قبل مغادرة الإعدادات، أو اختار المغادرة بدون حفظ.</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={()=>{if(blocker.state==='blocked')blocker.reset();}}>استمرار في الإعدادات</Button><Button type="button" variant="outline" onClick={()=>{if(blocker.state==='blocked')blocker.proceed();}}>مغادرة بدون حفظ</Button></div></div></Dialog>
 </div>;
}
