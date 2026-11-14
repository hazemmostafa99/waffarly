import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { it } from 'node:test';

config({ path: new URL('../../../../.env', import.meta.url), quiet: true });

it('enforces EGP on every persisted currency column and rejects foreign-currency plans', async () => {
  assert.ok(process.env.DATABASE_URL, 'Configure DATABASE_URL and apply EGP migrations first.');
  const client = new PrismaClient({ adapter: createPostgresAdapter(process.env.DATABASE_URL) });
  const rollback = new Error('Rollback currency verification');
  try {
    const checks = await client.$queryRaw<Array<{ table_name: string; definition: string }>>`
      SELECT rel.relname AS table_name, pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = current_schema() AND con.contype = 'c'
        AND con.conname LIKE '%_currency_check'
    `;
    for (const table of [
      'monthly_plans',
      'storefront_orders',
      'pos_shifts',
      'pos_order_payments',
      'pos_order_refunds',
      'pos_order_item_returns',
      'pos_shift_close_reports',
    ]) {
      const check = checks.find((row) => row.table_name === table);
      assert.ok(check, `Missing EGP constraint on ${table}`);
      assert.match(check.definition, /currency.*= 'EGP'/);
    }
    await assert.rejects(
      client.$transaction(async (tx) => {
        const base = {
          name: 'Temporary EGP verification',
          description: '',
          monthlyPrice: '1.00',
          createdBy: 'currency-verification',
          updatedBy: 'currency-verification',
        };
        const saved = await tx.monthlyPlan.create({
          data: { ...base, creationRequest: randomUUID() },
        });
        assert.equal(saved.currency, 'EGP');
        for (const currency of ['USD', 'EUR']) {
          await tx.$executeRawUnsafe('SAVEPOINT currency_check');
          await assert.rejects(
            tx.monthlyPlan.create({ data: { ...base, currency, creationRequest: randomUUID() } }),
            /monthly_plans_currency_check/,
          );
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT currency_check');
        }
        throw rollback;
      }),
      (error) => error === rollback,
    );
  } finally {
    await client.$disconnect();
  }
});
