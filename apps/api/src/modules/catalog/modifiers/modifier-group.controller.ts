import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../auth/index.js';
import { ModifierGroupService } from './modifier-group.service.js';

const optionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  position: z.number().int().nonnegative(),
});
const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  options: z.array(optionSchema).min(1).max(100),
});
const createSchema = fieldsSchema.strict();
const updateSchema = fieldsSchema
  .partial()
  .extend({
    revision: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 1) {
      context.addIssue({
        code: 'custom',
        message: 'Provide at least one modifier group field to update.',
      });
    }
  });

@UseGuards(OwnerGuard)
@Controller('owner/catalog/modifier-groups')
export class ModifierGroupController {
  constructor(@Inject(ModifierGroupService) private readonly groups: ModifierGroupService) {}

  @Get()
  async list(@CurrentOwner() owner: OwnerProfile) {
    return this.groups.list(owner.merchantId);
  }

  @Get(':id')
  async get(@CurrentOwner() owner: OwnerProfile, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.groups.get(owner.merchantId, id);
  }

  @Post()
  async create(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    const parsed = parseRequest(createSchema, body);
    return this.groups.create(owner.merchantId, parsed);
  }

  @Patch(':id')
  async update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = parseRequest(updateSchema, body);
    return this.groups.update(owner.merchantId, id, parsed);
  }
}
