/**
 * Describes the order details and requested changes needed during preparation, handover and cancellation.
 */
import type {
  AcceptRecipeOrderRequest,
  CancelPosOrderRequest,
  CancelRecipeOrderRequest,
  HandoverPosOrderRequest,
  MarkOrderReadyRequest,
  MarkKitchenItemReadyRequest,
  StartOrderPreparationRequest,
} from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';

import { posKitchenTicketInclude } from '../kitchen/pos-kitchen.persistence.js';

export const orderTransitionInclude = {
  kitchenTicket: posKitchenTicketInclude,
  diningSession: { select: { table: { select: { code: true } } } },
  lines: {
    orderBy: { position: 'asc' as const },
    include: {
      selections: {
        orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
      },
      variantAttributes: { orderBy: { position: 'asc' as const } },
      stockRequirements: { orderBy: { position: 'asc' as const } },
    },
  },
};
export type OrderTransitionCommand =
  | { action: 'accept'; input: AcceptRecipeOrderRequest }
  | { action: 'prepare'; input: StartOrderPreparationRequest }
  | { action: 'ready'; input: MarkOrderReadyRequest }
  | { action: 'ready_item'; input: MarkKitchenItemReadyRequest; lineId: string }
  | { action: 'handover'; input: HandoverPosOrderRequest }
  | { action: 'cancel'; input: CancelRecipeOrderRequest }
  | {
      action: 'pos_cancel';
      branchId: string;
      input: Pick<CancelPosOrderRequest, 'requestId' | 'reason'>;
      approverEmployeeId?: string;
    };

export type OrderForTransition = Prisma.StorefrontOrderGetPayload<{
  include: typeof orderTransitionInclude;
}>;
export type PosCancellationActor = { employeeId: string; branchId: string };
