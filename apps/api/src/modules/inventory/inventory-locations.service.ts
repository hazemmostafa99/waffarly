/** Routes branch, warehouse and stock policy requests to their responsible operation. */
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateInventoryBranchRequest,
  CreateInventoryWarehouseRequest,
  InventoryBranch,
  InventoryPolicy,
  SetDefaultConsumptionWarehouseRequest,
  UpdateInventoryBranchRequest,
  UpdateInventoryPolicyRequest,
  UpdateInventoryWarehouseRequest,
} from '@waffarly/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { type InventoryBranchListQuery } from './inventory.schemas.js';
import { getWarehouse, listWarehouses } from './locations/warehouse.queries.js';
import {
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  setBranchArchived,
} from './locations/branches.js';

import {
  createWarehouse,
  updateWarehouse,
  setDefaultConsumptionWarehouse,
  setWarehouseArchived,
} from './locations/warehouses.js';

import { getPolicy, updatePolicy } from './policy/inventory-policy.js';

@Injectable()
export class InventoryLocationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBranches(merchantId: string, input: InventoryBranchListQuery) {
    return listBranches(this.prisma, merchantId, input);
  }

  listWarehouses(merchantId: string, input: InventoryBranchListQuery) {
    return listWarehouses(this.prisma, merchantId, input);
  }

  getWarehouse(merchantId: string, id: string) {
    return getWarehouse(this.prisma, merchantId, id);
  }

  async getBranch(merchantId: string, id: string): Promise<InventoryBranch> {
    return getBranch(this.prisma, merchantId, id);
  }

  async createBranch(
    merchantId: string,
    actor: string,
    input: CreateInventoryBranchRequest,
  ): Promise<InventoryBranch> {
    return createBranch(this.prisma, merchantId, actor, input);
  }

  async updateBranch(
    merchantId: string,
    actor: string,
    id: string,
    input: UpdateInventoryBranchRequest,
  ): Promise<InventoryBranch> {
    return updateBranch(this.prisma, merchantId, actor, id, input);
  }

  async setBranchArchived(
    merchantId: string,
    actor: string,
    id: string,
    archived: boolean,
    input: { revision: number },
  ): Promise<InventoryBranch> {
    return setBranchArchived(this.prisma, merchantId, actor, id, archived, input);
  }

  async createWarehouse(
    merchantId: string,
    actor: string,
    branchId: string,
    input: CreateInventoryWarehouseRequest,
  ): Promise<InventoryBranch> {
    return createWarehouse(this.prisma, merchantId, actor, branchId, input);
  }

  async updateWarehouse(
    merchantId: string,
    actor: string,
    branchId: string,
    warehouseId: string,
    input: UpdateInventoryWarehouseRequest,
  ): Promise<InventoryBranch> {
    return updateWarehouse(this.prisma, merchantId, actor, branchId, warehouseId, input);
  }

  async setDefaultConsumptionWarehouse(
    merchantId: string,
    actor: string,
    branchId: string,
    input: SetDefaultConsumptionWarehouseRequest,
  ): Promise<InventoryBranch> {
    return setDefaultConsumptionWarehouse(this.prisma, merchantId, actor, branchId, input);
  }

  async setWarehouseArchived(
    merchantId: string,
    actor: string,
    branchId: string,
    warehouseId: string,
    archived: boolean,
    input: { revision: number },
  ): Promise<InventoryBranch> {
    return setWarehouseArchived(
      this.prisma,
      merchantId,
      actor,
      branchId,
      warehouseId,
      archived,
      input,
    );
  }

  async getPolicy(merchantId: string): Promise<InventoryPolicy> {
    return getPolicy(this.prisma, merchantId);
  }

  async updatePolicy(
    merchantId: string,
    actor: string,
    input: UpdateInventoryPolicyRequest,
  ): Promise<InventoryPolicy> {
    return updatePolicy(this.prisma, merchantId, actor, input);
  }
}
