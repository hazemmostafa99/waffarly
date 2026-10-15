export { InventoryModule } from './inventory.module.js';
export { InventoryService } from './inventory.service.js';
export { InventoryLedgerService } from './inventory-ledger.service.js';
export type { InventoryMovementBatchCommand } from './inventory-ledger.service.js';
export {
  convertToBaseQuantity,
  MAX_STOCK_QUANTITY_SCALED,
  formatStockQuantity,
  normalizeStockQuantity,
  parseStockQuantity,
} from './stock-quantity.js';
