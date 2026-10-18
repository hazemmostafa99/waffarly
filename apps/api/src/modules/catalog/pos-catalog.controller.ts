import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { CurrentPosEmployee, PosEmployeeGuard } from '../auth/index.js';
import { CatalogQueryService } from './catalog-query.service.js';

const posCatalogQuerySchema = z
  .object({
    productCursor: z.string().uuid().optional(),
    categoryCursor: z.string().uuid().optional(),
  })
  .strict();

@UseGuards(PosEmployeeGuard)
@Controller('pos/catalog')
export class PosCatalogController {
  constructor(@Inject(CatalogQueryService) private readonly catalog: CatalogQueryService) {}

  @Get()
  list(@CurrentPosEmployee() employee: PosEmployeeSession, @Query() query: unknown) {
    const parsed = parseRequest(posCatalogQuerySchema, query);
    return this.catalog.getPosSellableCatalog(
      employee.merchantId,
      parsed.productCursor,
      parsed.categoryCursor,
    );
  }
}
