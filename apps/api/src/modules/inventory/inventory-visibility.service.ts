/** Routes movement, stock health and reorder threshold requests to their responsible operation. */
import { Inject, Injectable } from '@nestjs/common';
import type {
  InventoryHealthPage,
  InventoryReorderThreshold,
  ClearInventoryReorderThresholdResult,
  StockMovement,
  UpdateInventoryReorderThresholdRequest,
} from '@waffarly/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { type InventoryHealthListQuery } from './inventory.schemas.js';

import { getMovement, listHealth } from './visibility/stock-health.query.js';

import { saveThreshold, deleteThreshold } from './visibility/reorder-thresholds.js';

@Injectable()
export class InventoryVisibilityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMovement(merchantId: string, id: string): Promise<StockMovement> {
    return getMovement(this.prisma, merchantId, id);
  }

  async listHealth(
    merchantId: string,
    input: InventoryHealthListQuery,
  ): Promise<InventoryHealthPage> {
    return listHealth(this.prisma, merchantId, input);
  }

  async saveThreshold(
    merchantId: string,
    actor: string,
    warehouseId: string,
    stockItemId: string,
    input: UpdateInventoryReorderThresholdRequest,
  ): Promise<InventoryReorderThreshold> {
    return saveThreshold(this.prisma, merchantId, actor, warehouseId, stockItemId, input);
  }

  async deleteThreshold(
    merchantId: string,
    warehouseId: string,
    stockItemId: string,
    input: { revision: number },
  ): Promise<ClearInventoryReorderThresholdResult> {
    return deleteThreshold(this.prisma, merchantId, warehouseId, stockItemId, input);
  }
}
