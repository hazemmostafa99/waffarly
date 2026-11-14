/** Routes merchant creation, application review, store address and directory requests. */
import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  ApproveMerchantApplicationRequest,
  CreateMerchantRequest,
  MerchantApplicationSummary,
  MerchantSummary,
  CursorPage,
  RejectMerchantApplicationRequest,
  SubmitMerchantApplicationRequest,
  PublicStorefrontAddress,
} from '@waffarly/contracts';

import { type CursorPageQuery } from '../../common/http/pagination.js';

import { PrismaService } from '../../infrastructure/database/prisma.service.js';

import { SubscriptionService } from '../subscriptions/index.js';
import { listMerchants } from './queries/merchant-queries.js';
import { createMerchant, activateFirstMonth } from './onboarding/create-merchant.js';
import { assignStorefrontHandle, resolveStorefrontHandle } from './addresses/storefront-address.js';

import {
  submitApplication,
  listApplications,
  rejectApplication,
  approveApplication,
} from './applications/merchant-applications.js';

@Injectable()
export class MerchantService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(SubscriptionService)
    private readonly subscriptions: SubscriptionService = new SubscriptionService(prisma),
  ) {}

  async list(page: CursorPageQuery = { limit: 50 }): Promise<CursorPage<MerchantSummary>> {
    return listMerchants(this.prisma, page);
  }

  async create(
    input: CreateMerchantRequest,
    administrator = 'super-admin',
  ): Promise<MerchantSummary> {
    return createMerchant(this.prisma, this.subscriptions, input, administrator);
  }

  async assignStorefrontHandle(
    id: string,
    input: string,
    administrator: string,
  ): Promise<MerchantSummary> {
    return assignStorefrontHandle(this.prisma, id, input, administrator);
  }

  async resolveStorefrontHandle(handle: string): Promise<PublicStorefrontAddress> {
    return resolveStorefrontHandle(this.prisma, handle);
  }

  async submitApplication(input: SubmitMerchantApplicationRequest): Promise<{ received: true }> {
    return submitApplication(this.prisma, input);
  }

  async listApplications(): Promise<MerchantApplicationSummary[]> {
    return listApplications(this.prisma);
  }

  async rejectApplication(
    applicationId: string,
    input: RejectMerchantApplicationRequest,
    administratorUsername: string,
  ): Promise<MerchantApplicationSummary> {
    return rejectApplication(this.prisma, applicationId, input, administratorUsername);
  }

  async approveApplication(
    applicationId: string,
    input: ApproveMerchantApplicationRequest,
    administratorUsername: string,
  ): Promise<MerchantSummary> {
    return approveApplication(this.prisma, applicationId, input, administratorUsername);
  }

  async activateFirstMonth(
    merchantId: string,
    administratorUsername: string,
  ): Promise<MerchantSummary> {
    return activateFirstMonth(merchantId, administratorUsername);
  }
}
