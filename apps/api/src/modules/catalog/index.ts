export { CatalogModule } from './catalog.module.js';

export { CatalogQueryService } from './catalog-query.service.js';
export { ProductPricingService } from './pricing/product-pricing.service.js';
export { parseQuoteBody } from './pricing/quote.schemas.js';
export { calculateInventoryRequirements } from './products/product-inventory.calculator.js';
export type {
  InventoryRequirement,
  InventoryRequirementInput,
  InventoryRequirementEffectInput,
} from './products/product-inventory.calculator.js';

export { ProductConsumptionService } from './products/product-consumption.service.js';

export { MenuSettingsService, menuSettingsSchema } from './menu-settings.service.js';
