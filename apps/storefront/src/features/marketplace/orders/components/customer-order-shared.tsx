'use client';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ShoppingBag, ShieldCheck, RefreshCw } from 'lucide-react';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { MarketplaceCard } from '@/components/marketplace/marketplace-card';
import { ApiError } from '@/lib/api-client';
import { orderStatus } from '../model/customer-order-presentation';
import type { CustomerOrderView } from '@waffarly/contracts';
export const orderLinkClass='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white no-underline transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
export const orderCardClass='rounded-2xl border border-border bg-card p-5 shadow-[0_2px_8px_rgba(43,13,55,0.025)] sm:p-6';
export function CustomerOrderStatus({status}:{status:CustomerOrderView['status']}) {
 const info=orderStatus[status];
 return <span className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold '+info.tone}><span className="size-1.5 rounded-full bg-current" aria-hidden="true"/>{info.label}</span>;
}
export function GuestOrderNotice({signedIn}:{signedIn:boolean}) {
 return <div className="flex items-start gap-3 rounded-xl border border-border bg-white/60 p-4 text-sm leading-6 text-muted-foreground"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-accent" aria-hidden="true"/><p className="m-0">{signedIn?'عندك طلب ضيف على المتصفح ده. تقدر تحفظه في حسابك من تفاصيل الطلب.':<>تقدر تتابع طلب الضيف من المتصفح ده لمدة تصل إلى 30 يومًا. <Link href="/account/sign-in" className="font-bold text-accent underline underline-offset-4">سجّل دخول لحفظه في حسابك</Link>. مسح ملفات الارتباط أو تغيير المتصفح يفقدك صلاحية المتابعة.</>}</p></div>;
}
export function CustomerOrderError({error,retry}:{error:unknown;retry:()=>void}) {
 const status=error instanceof ApiError?error.statusCode:0;
 const title=status===401?'سجّل دخول لمتابعة طلباتك':status===404?'الطلب غير متاح':'تعذّر تحميل الطلبات';
 const detail=status===401?'جلسة حسابك انتهت. ادخل حسابك مرة أخرى علشان ترجع لطلباتك.':status===404?'الطلب مش مرتبط بالحساب أو المتصفح الحالي، أو صلاحية متابعته انتهت. رقم الطلب وحده لا يمنح الوصول.':'حصلت مشكلة في الاتصال. بيانات طلبك محفوظة، وتقدر تحاول مرة تانية.';
 return <MarketplaceCard className={orderCardClass+' flex flex-col items-center gap-4 py-12 text-center'}><span className="grid size-14 place-items-center rounded-2xl bg-red-50 text-destructive"><AlertCircle size={26}/></span><h2 className="m-0 text-lg font-bold text-primary">{title}</h2><p className="m-0 max-w-md text-sm leading-7 text-muted-foreground">{detail}</p><div className="flex flex-wrap justify-center gap-3">{status===401?<Link href="/account/sign-in" className={orderLinkClass}>تسجيل الدخول<ArrowLeft size={16}/></Link>:<MarketplaceButton tone="primary" type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"><RefreshCw size={16}/>إعادة المحاولة</MarketplaceButton>}<Link href="/orders" className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-accent">العودة لطلباتي</Link></div></MarketplaceCard>;
}
export function CustomerOrdersEmpty({filtered=false,onReset}:{filtered?:boolean;onReset?:()=>void}) {
 return <MarketplaceCard className={orderCardClass+' flex flex-col items-center gap-4 py-14 text-center'}><span className="grid size-16 place-items-center rounded-2xl bg-secondary text-accent"><ShoppingBag size={30}/></span><h2 className="m-0 text-xl font-bold text-primary">{filtered?'مفيش طلبات في القسم ده':'لسه مفيش طلبات'}</h2><p className="m-0 max-w-sm text-sm leading-7 text-muted-foreground">{filtered?'جرّب عرض كل الطلبات، أو حمّل طلبات أقدم لو متاحة.':'أول وجبة هتطلبها هتظهر هنا. اختار مطعمك، وبعد التأكيد تابع الطلب خطوة بخطوة.'}</p>{filtered?<MarketplaceButton tone="neutral" onClick={onReset} className="min-h-11 rounded-xl px-5 text-sm font-bold">عرض كل الطلبات</MarketplaceButton>:<Link href="/restaurants" className={orderLinkClass}>تصفح المطاعم<ArrowLeft size={16}/></Link>}</MarketplaceCard>;
}
export function CustomerOrdersSkeleton({detail=false, rows=false}:{detail?:boolean;rows?:boolean}) {
 return <div role="status" aria-label="جارٍ تحميل الطلبات" aria-busy="true" className={detail?'grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]':rows?'grid gap-3':'grid gap-4 md:grid-cols-2'}>{Array.from({length:detail?2:rows?3:4},(_,i)=><div key={i} className={orderCardClass+' animate-pulse motion-reduce:animate-none'}><div className="mb-6 flex items-center gap-3"><div className="size-12 rounded-xl bg-secondary"/><div className="grid flex-1 gap-2"><div className="h-4 w-2/3 rounded bg-secondary"/><div className="h-3 w-1/3 rounded bg-secondary"/></div></div><div className="mb-3 h-3 w-full rounded bg-secondary"/><div className="mb-6 h-3 w-4/5 rounded bg-secondary"/><div className="h-10 rounded-xl bg-secondary"/></div>)}</div>;
}
