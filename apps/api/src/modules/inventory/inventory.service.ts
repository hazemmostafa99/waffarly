/** Routes stock item requests to item reads, editing, archiving and unit conversion. */
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateStockItemRequest,
  CursorPage,
  StockItem,
  StockItemConversion,
  StockItemConversionRequest,
  StockItemRevisionRequest,
  UpdateStockItemRequest,
} from '@waffarly/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { type StockItemListQuery } from './inventory.schemas.js';

import {
  listStockItems,
  getStockItem,
  convertStockItemQuantity,
} from './items/stock-item.queries.js';

import { createStockItem, updateStockItem } from './items/save-stock-item.js';

import { setArchived } from './items/archive-stock-item.js';

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(merchantId: string, input: StockItemListQuery): Promise<CursorPage<StockItem>> {
    return listStockItems(this.prisma, merchantId, input);
  }

  async get(merchantId: string, id: string): Promise<StockItem> {
    return getStockItem(this.prisma, merchantId, id);
  }

  async create(
    merchantId: string,
    actor: string,
    input: CreateStockItemRequest,
  ): Promise<StockItem> {
    return createStockItem(this.prisma, merchantId, actor, input);
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    input: UpdateStockItemRequest,
  ): Promise<StockItem> {
    return updateStockItem(this.prisma, merchantId, actor, id, input);
  }

  async setArchived(
    merchantId: string,
    actor: string,
    id: string,
    archived: boolean,
    input: StockItemRevisionRequest,
  ): Promise<StockItem> {
    return setArchived(this.prisma, merchantId, actor, id, archived, input);
  }

  async convert(
    merchantId: string,
    id: string,
    input: StockItemConversionRequest,
  ): Promise<StockItemConversion> {
    return convertStockItemQuantity(this.prisma, merchantId, id, input);
  }
}
