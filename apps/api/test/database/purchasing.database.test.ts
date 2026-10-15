import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';
import type { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { InventoryLedgerService } from '../../src/modules/inventory/inventory-ledger.service.js';
import { InventoryLocationsService } from '../../src/modules/inventory/inventory-locations.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { PurchaseSuppliersService } from '../../src/modules/purchasing/purchase-suppliers.service.js';
import { PurchasingService } from '../../src/modules/purchasing/purchasing.service.js';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });
const databaseUrl = process.env.DATABASE_URL;
const actor = 'purchasing-database-test';

it(
  'keeps purchase drafts inert and atomically receives exact, tenant-scoped invoice quantities once',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply the purchasing migration first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    const merchantIds: string[] = [];
    try {
      const prisma = client as unknown as PrismaService;
      const token = randomUUID().replaceAll('-', '');
      const merchant = await client.merchant.create({
        data: {
          name: `Purchasing ${token}`,
          storefrontSlug: `purchasing-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'Purchasing test',
          ownerMobile: '01100000000',
        },
      });
      merchantIds.push(merchant.id);
      const otherMerchant = await client.merchant.create({
        data: {
          name: `Other purchasing ${token}`,
          storefrontSlug: `other-purchasing-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'Other purchasing test',
          ownerMobile: '01100000000',
        },
      });
      merchantIds.push(otherMerchant.id);
      const inventory = new InventoryService(prisma);
      const locations = new InventoryLocationsService(prisma);
      const ledger = new InventoryLedgerService(prisma);
      const suppliers = new PurchaseSuppliersService(prisma);
      const purchasing = new PurchasingService(prisma, ledger);
      const branch = await locations.createBranch(merchant.id, actor, {
        name: 'Central branch',
        defaultWarehouseName: 'Receiving',
      });
      const warehouse = branch.warehouses[0]!;
      const item = await inventory.create(merchant.id, actor, {
        requestId: randomUUID(),
        name: 'Whole milk',
        baseUnit: 'g',
        units: [{ code: 'case-12', name: 'Case of 12', baseQuantity: '12000' }],
      });
      const otherBranch = await locations.createBranch(otherMerchant.id, actor, {
        name: 'Other branch',
      });
      const otherSupplier = await suppliers.create(otherMerchant.id, actor, {
        requestId: randomUUID(),
        name: 'Other dairy supplier',
      });
      const otherItem = await inventory.create(otherMerchant.id, actor, {
        requestId: randomUUID(),
        name: 'Other milk',
        baseUnit: 'g',
      });

      const supplierInput = {
        requestId: randomUUID(),
        name: 'Dairy supplier',
        contactName: 'Sales desk',
        phone: '+20100000000',
        email: 'SALES@example.test',
      };
      const supplier = await suppliers.create(merchant.id, actor, supplierInput);
      assert.equal(supplier.email, 'sales@example.test');
      assert.equal((await suppliers.create(merchant.id, actor, supplierInput)).id, supplier.id);
      await assert.rejects(
        suppliers.create(merchant.id, actor, {
          requestId: randomUUID(),
          name: '  DAIRY SUPPLIER  ',
        }),
        /name already exists/i,
      );

      const invoiceInput = {
        requestId: randomUUID(),
        supplierId: supplier.id,
        supplierInvoiceNumber: ' INV-101 ',
        warehouseId: warehouse.id,
        lines: [
          {
            stockItemId: item.id,
            condition: 'available' as const,
            quantity: '1.5',
            unitCode: 'kg',
          },
          {
            stockItemId: item.id,
            condition: 'non_sellable' as const,
            quantity: '1',
            unitCode: 'case-12',
          },
        ],
      };
      const draft = await purchasing.createInvoice(merchant.id, actor, invoiceInput);
      assert.equal(draft.status, 'draft');
      assert.equal(draft.supplierInvoiceNumber, 'INV-101');
      assert.equal(draft.lines[0]?.stockItemName, 'Whole milk');
      assert.equal(draft.lines[1]?.unitName, 'Case of 12');
      assert.equal((await purchasing.createInvoice(merchant.id, actor, invoiceInput)).id, draft.id);
      assert.equal(
        (await ledger.listBalances(merchant.id, { limit: 10, search: '' })).items.length,
        0,
      );

      await assert.rejects(
        purchasing.createInvoice(merchant.id, actor, {
          ...invoiceInput,
          requestId: randomUUID(),
          supplierInvoiceNumber: 'inv-101',
        }),
        /already has a purchase invoice/i,
      );
      const draftForOtherSupplier = await purchasing.createInvoice(merchant.id, actor, {
        ...invoiceInput,
        requestId: randomUUID(),
        supplierId: (
          await suppliers.create(merchant.id, actor, {
            requestId: randomUUID(),
            name: 'Second dairy supplier',
          })
        ).id,
      });
      assert.equal(draftForOtherSupplier.status, 'draft');

      await assert.rejects(
        purchasing.createInvoice(merchant.id, actor, {
          ...invoiceInput,
          requestId: randomUUID(),
          supplierId: otherSupplier.id,
        }),
        /supplier was not found/i,
      );
      await assert.rejects(
        purchasing.createInvoice(merchant.id, actor, {
          ...invoiceInput,
          requestId: randomUUID(),
          warehouseId: otherBranch.warehouses[0]!.id,
        }),
        /warehouse was not found/i,
      );
      await assert.rejects(
        purchasing.createInvoice(merchant.id, actor, {
          ...invoiceInput,
          requestId: randomUUID(),
          lines: [
            {
              stockItemId: otherItem.id,
              condition: 'available',
              quantity: '1',
              unitCode: 'g',
            },
          ],
        }),
        /active stock item was not found/i,
      );
      await assert.rejects(
        purchasing.createInvoice(merchant.id, actor, {
          ...invoiceInput,
          requestId: randomUUID(),
          lines: [
            {
              stockItemId: item.id,
              condition: 'available',
              quantity: '1',
              unitCode: 'ml',
            },
          ],
        }),
        /incompatible/i,
      );

      await assert.rejects(
        suppliers.setArchived(merchant.id, actor, supplier.id, true, {
          revision: supplier.revision,
        }),
        /draft purchase invoices/i,
      );
      await assert.rejects(
        purchasing.updateInvoice(merchant.id, actor, draft.id, {
          revision: draft.revision + 1,
          supplierId: supplier.id,
          supplierInvoiceNumber: 'INV-101',
          warehouseId: warehouse.id,
          lines: invoiceInput.lines,
        }),
        /changed by another request/i,
      );

      const renamedSupplier = await suppliers.update(merchant.id, actor, supplier.id, {
        name: 'Dairy supplier renamed',
        revision: supplier.revision,
      });
      assert.equal((await suppliers.get(merchant.id, supplier.id)).name, renamedSupplier.name);
      await assert.rejects(suppliers.get(merchant.id, otherSupplier.id), /not found/i);
      const warehousePage = await locations.listWarehouses(merchant.id, {
        status: 'active',
        search: 'Central',
        limit: 1,
      });
      assert.equal(warehousePage.items[0]?.id, warehouse.id);
      assert.equal(
        (await locations.getWarehouse(merchant.id, warehouse.id)).branchName,
        'Central branch',
      );
      await assert.rejects(
        locations.getWarehouse(merchant.id, otherBranch.warehouses[0]!.id),
        /not found/i,
      );
      await assert.rejects(
        locations.listWarehouses(merchant.id, {
          status: 'active',
          search: '',
          limit: 10,
          cursor: otherBranch.warehouses[0]!.id,
        }),
        /cursor/i,
      );

      const confirmed = await purchasing.confirmInvoice(merchant.id, actor, draft.id, {
        requestId: randomUUID(),
        revision: draft.revision,
      });
      assert.equal(confirmed.invoice.status, 'confirmed');
      assert.equal(confirmed.receipt.replayed, false);
      assert.equal(confirmed.receipt.kind, 'purchase_receipt');
      assert.equal(confirmed.invoice.supplierName, renamedSupplier.name);
      assert.ok(confirmed.receipt.reason.includes(renamedSupplier.name));
      assert.deepEqual(
        confirmed.receipt.movements.map((movement) => movement.baseDelta),
        ['1500', '12000'],
      );
      const replay = await purchasing.confirmInvoice(merchant.id, actor, draft.id, {
        requestId: randomUUID(),
        revision: draft.revision,
      });
      assert.equal(replay.receipt.replayed, true);
      assert.equal(replay.receipt.id, confirmed.receipt.id);
      // Previously confirmed rows can have a refreshed supplier snapshot but an older
      // immutable movement reason. Retrying these historical receipts must still work.
      await client.purchaseInvoice.update({
        where: { id: draft.id },
        data: { supplierName: 'Historical refreshed supplier' },
      });
      const historicalReplay = await purchasing.confirmInvoice(merchant.id, actor, draft.id, {
        requestId: randomUUID(),
        revision: draft.revision,
      });
      assert.equal(historicalReplay.receipt.id, confirmed.receipt.id);
      assert.equal(historicalReplay.receipt.replayed, true);
      await assert.rejects(
        purchasing.updateInvoice(merchant.id, actor, draft.id, {
          revision: confirmed.invoice.revision,
          supplierId: supplier.id,
          supplierInvoiceNumber: 'INV-101',
          warehouseId: warehouse.id,
          lines: invoiceInput.lines,
        }),
        /confirmed purchase invoices cannot be changed/i,
      );
      const archivedSupplier = await suppliers.setArchived(merchant.id, actor, supplier.id, true, {
        revision: renamedSupplier.revision,
      });
      assert.ok(archivedSupplier.archivedAt);
      const balances = await ledger.listBalances(merchant.id, { limit: 10, search: '' });
      assert.equal(balances.items.length, 2);
      assert.deepEqual(
        balances.items.map((balance) => `${balance.condition}:${balance.quantity}`).sort(),
        ['available:1500', 'non_sellable:12000'],
      );
      const history = await ledger.listMovements(merchant.id, { limit: 10 });
      assert.equal(history.items.length, 2);
      assert.equal(history.items[0]?.sourceType, 'purchase_invoice');
      assert.equal(history.items[0]?.sourceId, draft.id);
      assert.equal(history.items[0]?.reason.includes('Dairy supplier'), true);
    } finally {
      if (merchantIds.length) await cleanupMerchants(client, merchantIds);
      await client.$disconnect();
    }
  },
);

it(
  'serializes concurrent confirms and adds one receipt batch',
  { skip: !databaseUrl },
  async () => {
    assert.ok(databaseUrl, 'Configure DATABASE_URL and apply the purchasing migration first.');
    const client = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });
    let merchantId: string | undefined;
    try {
      const token = randomUUID().replaceAll('-', '');
      const merchant = await client.merchant.create({
        data: {
          name: `Purchasing concurrency ${token}`,
          storefrontSlug: `purchasing-concurrency-${token}`,
          activity: 'restaurant',
          contactPhone: '01000000000',
          ownerName: 'Purchasing concurrency test',
          ownerMobile: '01100000000',
        },
      });
      merchantId = merchant.id;
      const prisma = client as unknown as PrismaService;
      const inventory = new InventoryService(prisma);
      const locations = new InventoryLocationsService(prisma);
      const ledger = new InventoryLedgerService(prisma);
      const suppliers = new PurchaseSuppliersService(prisma);
      const purchasing = new PurchasingService(prisma, ledger);
      const branch = await locations.createBranch(merchant.id, actor, { name: 'Branch' });
      const item = await inventory.create(merchant.id, actor, {
        requestId: randomUUID(),
        name: 'Flour',
        baseUnit: 'g',
      });
      const supplier = await suppliers.create(merchant.id, actor, {
        requestId: randomUUID(),
        name: 'Flour supplier',
      });
      const invoice = await purchasing.createInvoice(merchant.id, actor, {
        requestId: randomUUID(),
        supplierId: supplier.id,
        warehouseId: branch.warehouses[0]!.id,
        supplierInvoiceNumber: `CON-${token}`,
        lines: [{ stockItemId: item.id, condition: 'available', quantity: '750', unitCode: 'g' }],
      });
      const confirms = await Promise.all([
        purchasing.confirmInvoice(merchant.id, actor, invoice.id, {
          requestId: randomUUID(),
          revision: invoice.revision,
        }),
        purchasing.confirmInvoice(merchant.id, actor, invoice.id, {
          requestId: randomUUID(),
          revision: invoice.revision,
        }),
      ]);
      assert.equal(confirms.filter((result) => result.receipt.replayed).length, 1);
      const balances = await ledger.listBalances(merchant.id, { limit: 10, search: '' });
      assert.equal(balances.items[0]?.quantity, '750');
    } finally {
      if (merchantId) {
        await client.purchaseInvoiceLine.deleteMany({ where: { merchantId } });
        await client.purchaseInvoice.deleteMany({ where: { merchantId } });
        await client.stockMovement.deleteMany({ where: { merchantId } });
        await client.stockMovementBatch.deleteMany({ where: { merchantId } });
        await client.stockBalance.deleteMany({ where: { merchantId } });
        await client.warehouse.deleteMany({ where: { merchantId } });
        await client.branch.deleteMany({ where: { merchantId } });
        await client.stockItemUnit.deleteMany({ where: { merchantId } });
        await client.stockItem.deleteMany({ where: { merchantId } });
        await client.purchaseSupplier.deleteMany({ where: { merchantId } });
        await client.merchant.delete({ where: { id: merchantId } });
      }
      await client.$disconnect();
    }
  },
);

async function cleanupMerchants(client: PrismaClient, merchantIds: string[]) {
  const where = { merchantId: { in: merchantIds } };
  await client.purchaseInvoiceLine.deleteMany({ where });
  await client.purchaseInvoice.deleteMany({ where });
  await client.stockMovement.deleteMany({ where });
  await client.stockMovementBatch.deleteMany({ where });
  await client.stockBalance.deleteMany({ where });
  await client.warehouse.deleteMany({ where });
  await client.branch.deleteMany({ where });
  await client.stockItemUnit.deleteMany({ where });
  await client.stockItem.deleteMany({ where });
  await client.purchaseSupplier.deleteMany({ where });
  await client.merchant.deleteMany({ where: { id: { in: merchantIds } } });
}
