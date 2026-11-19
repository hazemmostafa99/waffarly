/** Owns self-service profile and delivery-address changes for merchant storefront customers. */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Prisma } from '@waffarly/database';
import type {
  CreateStorefrontCustomerAddressRequest,
  DeleteStorefrontCustomerAddressRequest,
  StorefrontCustomerAddress,
  StorefrontCustomerProfile,
  UpdateStorefrontCustomerAddressRequest,
  UpdateStorefrontCustomerProfileRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { verifyPassword } from '../auth/index.js';
import { StorefrontCustomerAuthService } from './storefront-customer-auth.service.js';

const addressFields = {
  id: true,
  label: true,
  deliveryAreaId: true,
  governorate: true,
  locality: true,
  area: true,
  streetAddress: true,
  notes: true,
  isDefault: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MerchantCustomerAddressSelect;
type AddressRecord = Prisma.MerchantCustomerAddressGetPayload<{ select: typeof addressFields }>;

function toAddress(row: AddressRecord): StorefrontCustomerAddress {
  return {
    id: row.id,
    label: row.label,
    deliveryAreaId: row.deliveryAreaId,
    governorate: row.governorate,
    locality: row.locality,
    area: row.area,
    streetAddress: row.streetAddress,
    notes: row.notes,
    isDefault: row.isDefault,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class StorefrontCustomerProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorefrontCustomerAuthService) private readonly auth: StorefrontCustomerAuthService,
  ) {}

  async updateProfile(
    slug: string,
    request: Request,
    data: UpdateStorefrontCustomerProfileRequest,
  ): Promise<StorefrontCustomerProfile> {
    const account = await this.requireAccount(slug, request);
    const credential = await this.prisma.merchantCustomerCredential.findFirst({
      where: { merchantId: account.merchantId, merchantCustomerId: account.customerId },
      select: { email: true, phone: true, passwordHash: true },
    });
    if (!credential) throw new UnauthorizedException('Sign in is required.');

    const email = data.email ?? credential.email;
    const phone = data.phone ?? credential.phone;
    const contactChanged = email !== credential.email || phone !== credential.phone;
    const currentPassword = data.currentPassword;
    if (contactChanged && !currentPassword)
      throw new BadRequestException('Enter your current password to change your email or phone.');
    if (
      contactChanged &&
      currentPassword &&
      !(await verifyPassword(currentPassword, credential.passwordHash))
    )
      throw new UnauthorizedException('Current password is incorrect.');

    try {
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.merchantCustomer.updateMany({
          where: {
            id: account.customerId,
            merchantId: account.merchantId,
            revision: data.revision,
            archivedAt: null,
          },
          data: {
            ...(data.name === undefined ? {} : { name: data.name }),
            ...(contactChanged ? { email, phone } : {}),
            revision: { increment: 1 },
            updatedBy: 'storefront-profile',
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('Account details have changed. Reload and try again.');

        if (contactChanged) {
          const credentialChanged = await tx.merchantCustomerCredential.updateMany({
            where: {
              merchantId: account.merchantId,
              merchantCustomerId: account.customerId,
              email: credential.email,
              phone: credential.phone,
            },
            data: { email, phone },
          });
          if (credentialChanged.count !== 1)
            throw new ConflictException('Account details changed. Reload and try again.');
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('That email or phone is already used at this store.');
      throw error;
    }

    const updated = await this.prisma.merchantCustomer.findFirst({
      where: { id: account.customerId, merchantId: account.merchantId, archivedAt: null },
      select: {
        id: true,
        name: true,
        revision: true,
        storefrontCredential: { select: { email: true, phone: true } },
      },
    });
    if (!updated?.storefrontCredential) throw new UnauthorizedException('Sign in is required.');
    return {
      id: updated.id,
      name: updated.name,
      email: updated.storefrontCredential.email,
      phone: updated.storefrontCredential.phone,
      revision: updated.revision,
    };
  }

  async listAddresses(slug: string, request: Request): Promise<StorefrontCustomerAddress[]> {
    const account = await this.requireAccount(slug, request);
    const rows = await this.prisma.merchantCustomerAddress.findMany({
      where: { merchantId: account.merchantId, merchantCustomerId: account.customerId },
      select: addressFields,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toAddress);
  }

  async createAddress(
    slug: string,
    request: Request,
    data: CreateStorefrontCustomerAddressRequest,
  ): Promise<StorefrontCustomerAddress> {
    const account = await this.requireAccount(slug, request);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockCustomer(tx, account.merchantId, account.customerId);
        const count = await tx.merchantCustomerAddress.count({
          where: { merchantId: account.merchantId, merchantCustomerId: account.customerId },
        });
        if (count >= 20) throw new BadRequestException('You can save up to 20 addresses.');
        const isDefault = data.isDefault ?? count === 0;
        if (isDefault) await this.clearDefault(tx, account.merchantId, account.customerId);
        const row = await tx.merchantCustomerAddress.create({
          data: {
            merchantId: account.merchantId,
            merchantCustomerId: account.customerId,
            label: data.label,
            deliveryAreaId: data.deliveryAreaId,
            governorate: data.governorate,
            locality: data.locality,
            area: data.area,
            streetAddress: data.streetAddress,
            notes: data.notes ?? '',
            isDefault,
          },
          select: addressFields,
        });
        return toAddress(row);
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Could not set this address as the default. Reload and try again.',
        );
      throw error;
    }
  }

  async updateAddress(
    slug: string,
    request: Request,
    id: string,
    data: UpdateStorefrontCustomerAddressRequest,
  ): Promise<StorefrontCustomerAddress> {
    const account = await this.requireAccount(slug, request);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockCustomer(tx, account.merchantId, account.customerId);
        const current = await tx.merchantCustomerAddress.findFirst({
          where: { id, merchantId: account.merchantId, merchantCustomerId: account.customerId },
          select: addressFields,
        });
        if (!current) throw new NotFoundException('Address was not found.');
        if (current.revision !== data.revision)
          throw new ConflictException('Address has changed. Reload and try again.');

        const makeDefault = data.isDefault === true;
        if (makeDefault) await this.clearDefault(tx, account.merchantId, account.customerId, id);
        const updated = await tx.merchantCustomerAddress.updateMany({
          where: {
            id,
            merchantId: account.merchantId,
            merchantCustomerId: account.customerId,
            revision: data.revision,
          },
          data: {
            ...(data.label === undefined ? {} : { label: data.label }),
            ...(data.deliveryAreaId === undefined ? {} : { deliveryAreaId: data.deliveryAreaId }),
            ...(data.governorate === undefined ? {} : { governorate: data.governorate }),
            ...(data.locality === undefined ? {} : { locality: data.locality }),
            ...(data.area === undefined ? {} : { area: data.area }),
            ...(data.streetAddress === undefined ? {} : { streetAddress: data.streetAddress }),
            ...(data.notes === undefined ? {} : { notes: data.notes }),
            ...(data.isDefault === undefined ? {} : { isDefault: data.isDefault }),
            revision: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('Address has changed. Reload and try again.');
        if (current.isDefault && data.isDefault === false)
          await this.promoteOldestAddress(tx, account.merchantId, account.customerId, id);
        const row = await tx.merchantCustomerAddress.findFirstOrThrow({
          where: { id, merchantId: account.merchantId, merchantCustomerId: account.customerId },
          select: addressFields,
        });
        return toAddress(row);
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Could not set this address as the default. Reload and try again.',
        );
      throw error;
    }
  }

  async deleteAddress(
    slug: string,
    request: Request,
    id: string,
    input: DeleteStorefrontCustomerAddressRequest,
  ): Promise<{ deleted: true }> {
    const account = await this.requireAccount(slug, request);
    const { revision } = input;
    return this.prisma.$transaction(async (tx) => {
      await this.lockCustomer(tx, account.merchantId, account.customerId);
      const current = await tx.merchantCustomerAddress.findFirst({
        where: { id, merchantId: account.merchantId, merchantCustomerId: account.customerId },
        select: { revision: true, isDefault: true },
      });
      if (!current) throw new NotFoundException('Address was not found.');
      if (current.revision !== revision)
        throw new ConflictException('Address has changed. Reload and try again.');
      const deleted = await tx.merchantCustomerAddress.deleteMany({
        where: {
          id,
          merchantId: account.merchantId,
          merchantCustomerId: account.customerId,
          revision,
        },
      });
      if (deleted.count !== 1)
        throw new ConflictException('Address has changed. Reload and try again.');
      if (current.isDefault)
        await this.promoteOldestAddress(tx, account.merchantId, account.customerId);
      return { deleted: true };
    });
  }

  private async requireAccount(slug: string, request: Request) {
    const account = await this.auth.current(slug, request);
    if (!account) throw new UnauthorizedException('Sign in is required.');
    return account;
  }

  private async lockCustomer(tx: Prisma.TransactionClient, merchantId: string, customerId: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "merchant_customers"
      WHERE "merchantId" = ${merchantId}::uuid AND "id" = ${customerId}::uuid
        AND "archivedAt" IS NULL
      FOR UPDATE
    `;
    if (locked.length !== 1) throw new UnauthorizedException('Sign in is required.');
  }

  private async clearDefault(
    tx: Prisma.TransactionClient,
    merchantId: string,
    customerId: string,
    exceptId?: string,
  ) {
    await tx.merchantCustomerAddress.updateMany({
      where: {
        merchantId,
        merchantCustomerId: customerId,
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false, revision: { increment: 1 } },
    });
  }

  private async promoteOldestAddress(
    tx: Prisma.TransactionClient,
    merchantId: string,
    customerId: string,
    exceptId?: string,
  ) {
    const oldest = await tx.merchantCustomerAddress.findFirst({
      where: {
        merchantId,
        merchantCustomerId: customerId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, revision: true },
    });
    if (oldest)
      await tx.merchantCustomerAddress.updateMany({
        where: {
          id: oldest.id,
          merchantId,
          merchantCustomerId: customerId,
          revision: oldest.revision,
        },
        data: { isDefault: true, revision: { increment: 1 } },
      });
  }
}
