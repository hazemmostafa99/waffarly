/** Shares merchant fixture defaults and removes subscriptions only for named test tenants. */
import type { Prisma } from '@waffarly/database';
import { randomUUID } from 'node:crypto';

type MerchantFixtureInput = Pick<Prisma.MerchantCreateInput, 'name' | 'storefrontSlug'> &
  Partial<
    Pick<Prisma.MerchantCreateInput, 'activity' | 'contactPhone' | 'ownerName' | 'ownerMobile'>
  >;

export function merchantFixture(input: MerchantFixtureInput): Prisma.MerchantCreateInput {
  return {
    activity: 'restaurant',
    contactPhone: '01000000000',
    ownerName: 'Database test owner',
    ownerMobile: '01100000000',
    ...input,
  };
}

export async function enableTestLegacyAccess(
  client: Pick<Prisma.TransactionClient, 'subscription'>,
  merchantId: string,
): Promise<void> {
  // Billing behavior is tested separately; legacy access adds no fictional payment.
  await client.subscription.update({ where: { merchantId }, data: { status: 'legacy' } });
}

export async function openTestBranchShift(
  client: Pick<Prisma.TransactionClient, 'posBranchOrderSession' | 'posRegister' | 'posShift'>,
  merchantId: string,
  branchId: string,
  employeeId: string,
): Promise<void> {
  const register = await client.posRegister.create({
    data: {
      merchantId,
      branchId,
      name: `Fixture ${randomUUID()}`,
      createdBy: 'test-fixture',
      updatedBy: 'test-fixture',
    },
  });
  const orderSession = await client.posBranchOrderSession.create({
    data: { merchantId, branchId },
    select: { id: true },
  });
  await client.posShift.create({
    data: {
      merchantId,
      branchId,
      branchOrderSessionId: orderSession.id,
      registerId: register.id,
      openedByEmployeeId: employeeId,
      openRequestId: randomUUID(),
      openingFloat: '0.00',
    },
  });
}

export async function deleteTestMerchantSubscriptions(
  client: Pick<
    Prisma.TransactionClient,
    'subscriptionEvent' | 'subscriptionPeriod' | 'subscription'
  >,
  merchantIds: readonly string[],
): Promise<void> {
  if (merchantIds.length === 0) return;
  if (
    merchantIds.some(
      (id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    )
  ) {
    throw new Error('Subscription fixture cleanup requires explicit merchant UUIDs.');
  }
  const where = { merchantId: { in: [...new Set(merchantIds)] } };
  await client.subscriptionEvent.deleteMany({ where });
  await client.subscriptionPeriod.deleteMany({ where });
  await client.subscription.deleteMany({ where });
}
