import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CreateStorefrontOrderRequest, UpdateStorefrontOrderStatusRequest } from '@waffarly/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { OwnerGuard } from '../auth/owner.guard.js';
import { StorefrontOrdersService } from './storefront-orders.service.js';

const orderSelectionSchema = z
  .object({
    groupId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).max(100),
  })
  .strict();

const createOrderSchema = z
  .object({
    customerName: z.string().trim().min(2).max(120),
    customerPhone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^[+\d\s().-]+$/)
      .refine((phone) => phone.replace(/\D/g, '').length >= 7),
    fulfillmentType: z.enum(['pickup', 'delivery']),
    deliveryAddress: z.string().trim().min(8).max(1000).optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            variantId: z.string().uuid().optional(),
            selections: z.array(orderSelectionSchema).max(30),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((order, context) => {
    if (order.fulfillmentType === 'delivery' && !order.deliveryAddress?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['deliveryAddress'],
        message: 'A delivery address is required for delivery orders.',
      });
    }
  });

const updateStatusSchema = z
  .object({ status: z.enum(['accepted', 'rejected']) })
  .strict();

@Controller('catalog/stores/:slug/orders')
export class PublicStorefrontOrdersController {
  constructor(@Inject(StorefrontOrdersService) private readonly orders: StorefrontOrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Param('slug') slug: string, @Body() body: unknown) {
    assertValidStorefrontSlug(slug);
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.orders.create(slug, parsed.data satisfies CreateStorefrontOrderRequest);
  }
}

@UseGuards(OwnerGuard)
@Controller('owner/orders')
export class OwnerStorefrontOrdersController {
  constructor(
    @Inject(StorefrontOrdersService) private readonly orders: StorefrontOrdersService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const owner = await this.auth.requireOwner(request);
    return this.orders.listForOwner(owner.merchantId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const owner = await this.auth.requireOwner(request);
    return this.orders.updateStatus(
      owner.merchantId,
      id,
      parsed.data.status satisfies UpdateStorefrontOrderStatusRequest['status'],
    );
  }
}

function assertValidStorefrontSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) {
    throw new BadRequestException('Storefront address is invalid.');
  }
}
