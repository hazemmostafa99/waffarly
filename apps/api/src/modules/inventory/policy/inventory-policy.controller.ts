/** Receives owner requests to read and change the inventory policy. */
import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import type {
  InventoryPolicy,
  OwnerProfile,
  UpdateInventoryPolicyRequest,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../auth/index.js';

import { InventoryLocationsService } from '../inventory-locations.service.js';

import { inventoryPolicyUpdateSchema } from '../inventory.schemas.js';
@UseGuards(OwnerGuard)
@Controller('owner/inventory')
export class InventoryPolicyController {
  constructor(
    @Inject(InventoryLocationsService) private readonly locations: InventoryLocationsService,
  ) {}
  @Get('policy')
  getPolicy(@CurrentOwner() owner: OwnerProfile): Promise<InventoryPolicy> {
    return this.locations.getPolicy(owner.merchantId);
  }
  @Patch('policy')
  updatePolicy(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(inventoryPolicyUpdateSchema, { format: 'messages' }))
    input: UpdateInventoryPolicyRequest,
  ): Promise<InventoryPolicy> {
    return this.locations.updatePolicy(owner.merchantId, owner.username, input);
  }
}
