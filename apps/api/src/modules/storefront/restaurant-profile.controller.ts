import { MenuSettingsService, menuSettingsSchema } from '../catalog/index.js';
import { Body, Controller, Get, Inject, Param, Put, Query, UseGuards } from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import { z } from 'zod';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { restaurantSettingsSchema } from './restaurant.schemas.js';
import { RestaurantProfileService } from './restaurant-profile.service.js';
const slugSchema = z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
@Controller('owner/restaurant')
@UseGuards(OwnerGuard)
export class OwnerRestaurantProfileController {
  constructor(@Inject(RestaurantProfileService) private readonly service: RestaurantProfileService,
    @Inject(MenuSettingsService) private readonly menu: MenuSettingsService) {}
  @Put('menu') saveMenu(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    return this.menu.save(owner.merchantId, owner.username, parseRequest(menuSettingsSchema, body));
  }
  @Get() get(@CurrentOwner() owner: OwnerProfile) { return this.service.get(owner.merchantId); }
  @Put() save(@CurrentOwner() owner: OwnerProfile, @Body() body: unknown) {
    return this.service.save(owner.merchantId, owner.username, parseRequest(restaurantSettingsSchema, body));
  }
}
@Controller('marketplace/restaurants')
export class PublicRestaurantProfileController {
  constructor(@Inject(RestaurantProfileService) private readonly service: RestaurantProfileService) {}
  @Get() list(@Query() query: unknown) {
    const input = parseRequest(z.object({ cursor: z.uuid().optional(), q: z.string().trim().max(160).optional() }).strict(), query);
    return this.service.list(input.cursor, input.q);
  }
  @Get(':slug/products/:id') product(@Param('slug') slug: string, @Param('id') id: string) {
    return this.service.product(parseRequest(slugSchema, slug), parseRequest(z.uuid(), id));
  }
  @Get(':slug/products') menu(@Param('slug') slug: string, @Query() query: unknown) {
    const input = parseRequest(z.object({ cursor: z.uuid().optional() }).strict(), query);
    return this.service.menu(parseRequest(slugSchema, slug), input.cursor);
  }
  @Get(':slug') detail(@Param('slug') slug: string) { return this.service.detail(parseRequest(slugSchema, slug)); }
}
