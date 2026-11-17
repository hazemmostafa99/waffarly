/** Names the existing database suites so local development and CI select the same files. */
export const databaseTestSuites = {
  customers: ['customers'],
  'customer-auth': ['customer-auth'],
  catalog: ['catalog', 'catalog-seed', 'pagination', 'product-inventory', 'modifier-effects'],
  inventory: ['inventory', 'inventory-ledger', 'inventory-visibility'],
  purchasing: ['purchasing'],
  orders: ['storefront-orders', 'recipe-order-lifecycle'],
  pos: ['pos-dining', 'pos-operations-report'],
  'pos-number': ['pos-order-numbers'],
  shifts: ['shift-reconciliation', 'shifts', 'pos-delivery', 'cash-custody'],
  cash: ['cash-custody'],
  employees: ['employee-roles'],
  'delivery-couriers': ['delivery-couriers'],
  'pos-appearance': ['merchant-pos-appearance'],
  'pos-returns': ['pos-returns', 'pos-returns-report'],
  activities: ['activities-modules'],
  subscriptions: ['subscriptions'],
} as const;

export function selectDatabaseTestFiles(
  suite: string,
  availableFiles: readonly string[],
): string[] {
  if (suite === 'all') return [...availableFiles].sort();
  if (!Object.hasOwn(databaseTestSuites, suite)) {
    throw new Error(
      `Unknown database suite. Choose all or: ${Object.keys(databaseTestSuites).join(', ')}.`,
    );
  }
  const files = databaseTestSuites[suite as keyof typeof databaseTestSuites].map(
    (name) => `${name}.database.test.ts`,
  );
  if (files.some((name) => !availableFiles.includes(name))) {
    throw new Error('A configured database test file is missing. Check database-test-suites.ts.');
  }
  return files;
}
