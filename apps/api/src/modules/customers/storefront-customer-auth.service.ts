/** Owns merchant-scoped customer credentials and their linked customer directory entries. */
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Prisma } from '@waffarly/database';
import type {
  CustomerSignInRequest,
  CustomerSignUpRequest,
  StorefrontCustomerProfile,
} from '@waffarly/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import {
  CustomerAuthService,
  customerSignInSchema,
  customerSignUpSchema,
  hashPassword,
  verifyPassword,
} from '../auth/index.js';
import { MerchantService } from '../merchants/index.js';

const profileFields = { id: true, name: true } satisfies Prisma.MerchantCustomerSelect;
type CustomerRecord = Prisma.MerchantCustomerGetPayload<{ select: typeof profileFields }>;
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;

function profile(
  customer: CustomerRecord,
  email: string,
  phone: string,
): StorefrontCustomerProfile {
  return { id: customer.id, name: customer.name, email, phone };
}

@Injectable()
export class StorefrontCustomerAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomerAuthService) private readonly auth: CustomerAuthService,
    @Inject(MerchantService) private readonly merchants: MerchantService,
  ) {}

  async signUp(
    slug: string,
    input: CustomerSignUpRequest,
    request: Request,
    response: Response,
  ): Promise<StorefrontCustomerProfile> {
    const { merchantId } = await this.merchants.resolveStorefrontSlug(slug);
    const data = parseRequest(customerSignUpSchema, input);
    await this.auth.limitStorefrontCustomerAttempt('sign-up', merchantId, request);
    const passwordHash = await hashPassword(data.password);
    const creationRequest = randomUUID();
    const creationFingerprint = createHash('sha256')
      .update(JSON.stringify({ name: data.name, email: data.email, phone: data.phone }))
      .digest('hex');

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const customer = await tx.merchantCustomer.create({
          data: {
            merchantId,
            name: data.name,
            phone: data.phone,
            email: data.email,
            firstChannel: 'storefront',
            creationRequest,
            creationFingerprint,
            createdBy: 'storefront-signup',
            updatedBy: 'storefront-signup',
          },
          select: profileFields,
        });
        await tx.merchantCustomerCredential.create({
          data: {
            merchantId,
            merchantCustomerId: customer.id,
            email: data.email,
            phone: data.phone,
            passwordHash,
          },
        });
        const token = await this.auth.createStorefrontCustomerSession(
          tx,
          slug,
          customer.id,
          request,
        );
        return { customer, token };
      });
      this.auth.setStorefrontCustomerCookie(response, slug, created.token);
      return profile(created.customer, data.email, data.phone);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('An account already uses these contact details at this store.');
      }
      throw error;
    }
  }

  async signIn(
    slug: string,
    input: CustomerSignInRequest,
    request: Request,
    response: Response,
  ): Promise<StorefrontCustomerProfile> {
    const { merchantId } = await this.merchants.resolveStorefrontSlug(slug);
    const data = parseRequest(customerSignInSchema, input);
    await this.auth.limitStorefrontCustomerAttempt('login', merchantId, request, data.identifier);
    const credential = await this.prisma.merchantCustomerCredential.findFirst({
      where: {
        merchantId,
        ...(data.identifier.includes('@')
          ? { email: data.identifier }
          : { phone: data.identifier }),
        customer: { archivedAt: null },
      },
      select: {
        passwordHash: true,
        email: true,
        phone: true,
        customer: { select: profileFields },
      },
    });
    const valid = await verifyPassword(data.password, credential?.passwordHash ?? DUMMY_HASH);
    if (!credential || !valid) throw new UnauthorizedException('Invalid credentials.');
    const token = await this.prisma.$transaction((tx) =>
      this.auth.createStorefrontCustomerSession(tx, slug, credential.customer.id, request),
    );
    this.auth.setStorefrontCustomerCookie(response, slug, token);
    return profile(credential.customer, credential.email, credential.phone);
  }

  async me(slug: string, request: Request): Promise<StorefrontCustomerProfile> {
    const account = await this.current(slug, request);
    if (!account) throw new UnauthorizedException('Sign in is required.');
    return account.profile;
  }

  async current(
    slug: string,
    request: Request,
  ): Promise<{
    merchantId: string;
    customerId: string;
    profile: StorefrontCustomerProfile;
  } | null> {
    const { merchantId } = await this.merchants.resolveStorefrontSlug(slug);
    const customerId = await this.auth.readStorefrontCustomerId(slug, request);
    if (!customerId) return null;
    const credential = await this.prisma.merchantCustomerCredential.findFirst({
      where: {
        merchantId,
        merchantCustomerId: customerId,
        customer: { archivedAt: null },
      },
      select: {
        email: true,
        phone: true,
        customer: { select: profileFields },
      },
    });
    if (!credential) return null;
    return {
      merchantId,
      customerId,
      profile: profile(credential.customer, credential.email, credential.phone),
    };
  }

  async logout(
    slug: string,
    request: Request,
    response: Response,
  ): Promise<{ authenticated: false }> {
    await this.auth.logoutStorefrontCustomer(slug, request, response);
    return { authenticated: false };
  }
}
