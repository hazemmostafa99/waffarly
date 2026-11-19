import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { StorefrontCustomerAuthController } from './storefront-customer-auth.controller.js';
import { StorefrontCustomerAuthService } from './storefront-customer-auth.service.js';
import { StorefrontCustomerProfileController } from './storefront-customer-profile.controller.js';
import { StorefrontCustomerProfileService } from './storefront-customer-profile.service.js';
import { MerchantsModule } from '../merchants/index.js';

@Module({
  imports: [AuthModule, MerchantsModule],
  controllers: [
    CustomersController,
    StorefrontCustomerAuthController,
    StorefrontCustomerProfileController,
  ],
  providers: [CustomersService, StorefrontCustomerAuthService, StorefrontCustomerProfileService],
  exports: [CustomersService, StorefrontCustomerAuthService],
})
export class CustomersModule {}
