/** Builds cashier order services with the same shared dependencies used by the application. */
import { PosOrdersService } from '../../src/modules/orders/pos-sales/pos-orders.service.js';
import { PosSaleService } from '../../src/modules/orders/pos-sales/pos-sale.service.js';

type Dependencies =
  ConstructorParameters<typeof PosOrdersService> extends [...infer Dependencies, unknown]
    ? Dependencies
    : never;

export function createPosOrdersService(...dependencies: Dependencies): PosOrdersService {
  const [prisma, pricing, consumption, ledger, shifts, dining] = dependencies;
  const sales = new PosSaleService(prisma, pricing, consumption, ledger, shifts, dining);
  return new PosOrdersService(...dependencies, sales);
}
