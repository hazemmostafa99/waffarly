/** Gives POS staff a bounded list of active couriers assigned to their branch. */
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { CursorPage, DeliveryCourierOption, PosEmployeeSession } from '@waffarly/contracts';
import { ZodValidationPipe } from '../../../../common/http/zod-validation.pipe.js';
import { CurrentPosEmployee, PosEmployeeGuard } from '../../../auth/index.js';
import { DeliveryCourierService } from '../../delivery/delivery-courier.service.js';
import { listPosDeliveryCouriersSchema } from '../../delivery/delivery-courier.schemas.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos/delivery-couriers')
export class PosDeliveryCouriersController {
  constructor(@Inject(DeliveryCourierService) private readonly couriers: DeliveryCourierService) {}

  @Get()
  list(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query(new ZodValidationPipe(listPosDeliveryCouriersSchema, { format: 'messages' }))
    query: unknown,
  ): Promise<CursorPage<DeliveryCourierOption>> {
    return this.couriers.listForPos(employee, query);
  }
}
