'use client';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CustomerOrdersPage, CustomerOrderView } from '@waffarly/contracts';
import { useCustomerSession } from '@/features/marketplace/account/hooks/use-customer-session';
import { customerOrdersRequest } from '../data/customer-orders-api';
import { isFinishedOrder } from '../model/customer-order-presentation';
export function useCustomerOrders() {
 const session=useCustomerSession();
 const query=useInfiniteQuery({queryKey:['customer-orders',session.data?.id??'guest','list'],queryFn:({pageParam})=>customerOrdersRequest<CustomerOrdersPage>('customer/orders'+(pageParam?'?cursor='+encodeURIComponent(pageParam):'')),initialPageParam:undefined as string|undefined,getNextPageParam:page=>page.nextCursor??undefined,enabled:!session.isPending,retry:false,staleTime:0});
 return {session,query};
}
export function useCustomerOrder(orderId:string) {
 const session=useCustomerSession();const client=useQueryClient();
 const query=useQuery({queryKey:['customer-orders',session.data?.id??'guest',orderId],queryFn:()=>customerOrdersRequest<CustomerOrderView>('customer/orders/'+encodeURIComponent(orderId)),enabled:!session.isPending,retry:false,staleTime:0,refetchInterval:state=>state.state.error||state.state.data&&isFinishedOrder(state.state.data.status)?false:15000,refetchIntervalInBackground:false});
 const claim=useMutation({mutationFn:()=>customerOrdersRequest<CustomerOrderView>('customer/orders/'+encodeURIComponent(orderId)+'/claim',{}),onSuccess:async()=>{await client.invalidateQueries({queryKey:['customer-orders']});}});
 return {session,query,claim};
}
