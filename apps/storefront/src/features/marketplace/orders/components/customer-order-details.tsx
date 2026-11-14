'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, ChefHat, Clock3, Copy, PackageCheck, ReceiptText, Store, Truck, ShoppingBag, RefreshCw } from 'lucide-react';
import type { CustomerOrderView } from '@waffarly/contracts';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceCard } from '@/components/marketplace/marketplace-card';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { money } from '@/features/marketplace/shared/lib/format-money';
import { useCustomerOrder } from '../hooks/use-customer-orders';
import { fulfillmentLabel, isFinishedOrder, orderDate, orderStatus, shortOrderId } from '../model/customer-order-presentation';
import { CustomerOrderStatus, CustomerOrderError, CustomerOrdersSkeleton, GuestOrderNotice } from './customer-order-shared';
const detailCardClass = 'rounded-2xl border border-border bg-card p-4 shadow-none sm:p-5';
function OrderReference({id}:{id:string}) {
 const [notice,setNotice]=useState('');
 async function copy() {try {await navigator.clipboard.writeText(id);setNotice('تم نسخ رقم الطلب');} catch {setNotice('تعذر النسخ. تقدر تحدد الرقم الكامل وتنسخه.');}}
 return <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><bdi className="font-semibold tracking-wide text-primary">#{shortOrderId(id)}</bdi><MarketplaceButton type="button" onClick={()=>void copy()} aria-label="نسخ رقم الطلب الكامل" className="grid size-8 place-items-center rounded-lg hover:bg-secondary"><Copy size={15}/></MarketplaceButton><span role="status">{notice}</span></div>;
}
function OrderProgress({order}:{order:CustomerOrderView}) {
 const stopped=order.status==='cancelled'||order.status==='rejected';
 const stages=[
 {status:'pending',label:'وصل طلبك',icon:ReceiptText,at:order.createdAt},
 {status:'accepted',label:'قبول المطعم',icon:CheckCircle2,at:order.acceptedAt},
 {status:'preparing',label:'التحضير',icon:ChefHat,at:order.preparationStartedAt},
 {status:'ready',label:order.fulfillmentType==='pickup'?'جاهز للاستلام':'جاهز للتسليم',icon:PackageCheck,at:order.readyAt},
 {status:'completed',label:'تم التسليم',icon:CheckCircle2,at:order.completedAt},
 ];
 const active=stages.findIndex(stage=>stage.status===order.status);
 return <ol aria-label="مراحل الطلب" className="m-0 grid list-none gap-0 p-0 sm:grid-cols-5">{stages.map((stage,index)=>{
 const done=stopped?Boolean(stage.at):index<active;const current=!stopped&&index===active;const Icon=done?Check:stage.icon;
 return <li key={stage.status} aria-current={current?'step':undefined} className="relative flex min-h-[64px] items-start gap-3 pb-4 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center">
 {index<stages.length-1&&<span aria-hidden="true" className={'absolute start-[15px] top-8 h-[calc(100%-32px)] w-px sm:start-[calc(50%+16px)] sm:top-[15px] sm:h-px sm:w-[calc(100%-32px)] '+(done?'bg-accent/35':'bg-border')}/>}
 <span className={'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border '+(done?'border-accent bg-accent text-white':current?'border-primary bg-primary text-white ring-2 ring-secondary':'border-border bg-white text-muted-foreground')}><Icon size={15}/></span>
 <div className="pt-1 sm:pt-0"><span className={'block text-[11px] font-semibold '+(done||current?'text-primary':'text-muted-foreground')}>{stage.label}</span>{stage.at&&<time dateTime={stage.at} className="mt-1 block text-[10px] text-muted-foreground">{orderDate(stage.at).time}</time>}</div>
 </li>;
 })}</ol>;
}
export function CustomerOrderDetails({orderId}:{orderId:string}) {
 const {session,query,claim}=useCustomerOrder(orderId);const order=query.data;const loading=session.isPending||query.isPending;
 const info=order?orderStatus[order.status]:null;
 return <main id="marketplace-main" className="min-h-[65vh] pb-10 pt-6 sm:pt-8"><MarketplaceContainer><div className="mx-auto w-full max-w-[1040px]">
 <h1 className="sr-only">تفاصيل ومتابعة الطلب</h1>
 <div className="mb-4 flex min-h-10 items-center justify-between gap-3">
 <nav aria-label="مسار التنقل" className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground"><Link href="/" className="hover:text-accent">الرئيسية</Link><span aria-hidden="true">/</span><Link href="/orders" className="hover:text-accent">طلباتي</Link><span aria-hidden="true">/</span><span aria-current="page">تفاصيل الطلب</span></nav>
 <MarketplaceButton type="button" disabled={loading||query.isFetching} onClick={()=>void query.refetch()} aria-label="تحديث حالة الطلب" className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-white text-accent hover:bg-secondary sm:w-auto sm:px-3"><RefreshCw size={14} aria-hidden="true" className={query.isFetching?'animate-spin motion-reduce:animate-none':''}/><span className="hidden text-xs font-bold sm:inline">تحديث</span></MarketplaceButton>
 </div>
 {loading?<CustomerOrdersSkeleton detail/>:query.isError?<CustomerOrderError error={query.error} retry={()=>{void query.refetch();}}/>:order&&info&&<>
 <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
 <div className="grid min-w-0 gap-4">
 <MarketplaceCard className={detailCardClass+' grid gap-4'}>
 <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-accent"><Store size={20}/></span><div><h2 className="m-0 text-sm font-bold text-primary">{order.restaurantName}</h2><OrderReference id={order.id}/></div></div><CustomerOrderStatus status={order.status}/></div>
 {['cancelled','rejected'].includes(order.status)&&<p className={'m-0 rounded-lg border px-3 py-2 text-xs leading-6 '+info.tone}>{info.description}</p>}
 <OrderProgress order={order}/>
 <p className="m-0 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground"><RefreshCw size={13}/>{isFinishedOrder(order.status)?'الطلب انتهى. تقدر ترجع لتفاصيله في أي وقت.':'تحديث تلقائي كل 15 ثانية.'}</p>
 {order.cancelledAt&&<p className="m-0 text-xs text-muted-foreground">تم الإلغاء: {orderDate(order.cancelledAt).date} · {orderDate(order.cancelledAt).time}</p>}
 </MarketplaceCard>
 <MarketplaceCard className={detailCardClass}>
 <div className="mb-4 flex items-center justify-between"><h2 className="m-0 text-sm font-bold text-primary">أصناف طلبك</h2><span className="text-xs text-muted-foreground">{order.items.reduce((sum,item)=>sum+item.quantity,0)} قطعة</span></div>
 <ul className="m-0 grid list-none divide-y divide-border p-0">{order.items.map(item=><li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold text-primary">{item.quantity}×</span><div className="min-w-0 flex-1"><h3 className="m-0 text-sm font-bold leading-6 text-primary">{item.productName}</h3>{item.variantName&&<p className="mb-0 mt-0.5 text-xs text-muted-foreground">{item.variantName}</p>}{item.selections.length>0&&<p className="mb-0 mt-1 text-xs leading-6 text-muted-foreground">{item.selections.map(selection=>selection.optionName+(selection.quantity>1?' × '+selection.quantity:'')).join('، ')}</p>}{item.quantity>1&&<p className="mb-0 mt-1 text-[11px] text-muted-foreground">سعر الوحدة {money(Number(item.unitPrice))}</p>}</div><strong className="shrink-0 pt-1 text-sm font-bold text-primary">{money(Number(item.lineTotal))}</strong></li>)}</ul>
 </MarketplaceCard>
 </div>
 <aside className="grid min-w-0 gap-4 lg:sticky lg:top-5">
 <MarketplaceCard className={detailCardClass+' grid gap-4'}>
 <h2 className="m-0 flex items-center gap-2 text-sm font-bold text-primary"><ReceiptText size={19}/>ملخص الطلب</h2>
 <div className="grid gap-2.5 border-y border-border py-3 text-xs"><div className="flex items-start gap-2 text-muted-foreground">{order.fulfillmentType==='pickup'?<ShoppingBag size={17}/>:<Truck size={17}/>}<span>{fulfillmentLabel(order)}</span></div><div className="flex items-start gap-2 text-muted-foreground"><Clock3 size={17}/><span>{orderDate(order.createdAt).date}<small className="mt-0.5 block text-xs">{orderDate(order.createdAt).time}</small></span></div></div>
 <dl className="m-0 grid gap-2.5 text-xs">{order.subtotal!==null&&<div className="flex justify-between gap-3"><dt className="text-muted-foreground">إجمالي الأصناف</dt><dd className="m-0 font-medium">{money(Number(order.subtotal))}</dd></div>}{order.deliveryFee!==null&&<div className="flex justify-between gap-3"><dt className="text-muted-foreground">التوصيل</dt><dd className="m-0 font-medium">{Number(order.deliveryFee)===0?'بدون رسوم':money(Number(order.deliveryFee))}</dd></div>}{order.subtotal!==null&&order.deliveryFee!==null&&Number(order.subtotal)+Number(order.deliveryFee)>Number(order.total)&&<div className="flex justify-between gap-3 text-success"><dt>الخصم المطبق</dt><dd className="m-0">−{money(Number(order.subtotal)+Number(order.deliveryFee)-Number(order.total))}</dd></div>}<div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-4"><dt className="font-bold text-primary">الإجمالي</dt><dd className="m-0 text-lg font-bold text-primary">{money(Number(order.total))}</dd></div></dl>
 <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1 font-medium text-accent">معلومات التحصيل</summary><p className="mb-0 mt-1 leading-6">حالة الطلب لا تعني سداد قيمته. تفاصيل التحصيل تُراجع مع المطعم.</p></details>
 <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1 font-medium text-accent">رقم الطلب الكامل</summary><p dir="ltr" className="mb-0 mt-2 select-all break-all leading-6">{order.id}</p></details>
 </MarketplaceCard>
 {order.guest&&<><GuestOrderNotice signedIn={Boolean(session.data)}/>{session.data&&<MarketplaceButton type="button" tone="gold" disabled={claim.isPending} onClick={()=>claim.mutate()} className="min-h-11 rounded-xl px-4 py-3 text-sm font-bold">{claim.isPending?'جارٍ حفظ الطلب…':'احفظ الطلب في حسابي'}</MarketplaceButton>}</>}
 {claim.isError&&<p role="alert" className="m-0 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-destructive">تعذر حفظ الطلب في حسابك. حاول مرة أخرى بعد التأكد من تسجيل الدخول.</p>}
 </aside>
 </div>
 </>}
 </div></MarketplaceContainer></main>;
}
