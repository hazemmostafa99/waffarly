/**
 * Connects customer sessions, order history and the action that adds a guest order to an account.
 */
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Prisma } from '@waffarly/database';

import { CustomerAuthService } from '../../auth/index.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { AppConfiguration } from '../../../config/app-configuration.js';

import { CustomerOrderSession } from './customer-order-session.js';
import { type OrderIdentity, orderIdentityWhere } from './order-identity.rules.js';
import { listCustomerOrders, getCustomerOrderDetails } from './customer-orders.query.js';
export { orderIdentityWhere, type OrderIdentity } from './order-identity.rules.js';

@Injectable()
export class CustomerOrderAccessService {
  private readonly session: CustomerOrderSession;
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(CustomerAuthService) auth: CustomerAuthService,
    @Inject(AppConfiguration) config: AppConfiguration,
  ) {
    this.session = new CustomerOrderSession(auth, config);
  }
  account(request: Request) {
    return this.session.resolveAccount(request);
  }
  guest(request: Request) {
    return this.session.readGuestIdentity(request);
  }
  prepare(request: Request, response: Response) {
    return this.session.prepareOrderSession(request, response);
  }
  identity(request: Request): Promise<OrderIdentity> {
    return this.session.resolveOrderIdentity(request);
  }
  scope(request: Request): Promise<Prisma.CustomerOrderAccessWhereInput> {
    return this.session.buildOrderAccessScope(request);
  }
  async list(request: Request, cursor?: string) {
    const result = await listCustomerOrders(this.db, await this.scope(request), cursor);
    return { ...result, signedIn: (await this.account(request)) !== null };
  }
  async detail(request: Request, orderId: string) {
    return getCustomerOrderDetails(this.db, await this.scope(request), orderId);
  }
  async claim(request: Request, orderId: string) {
    // 1. Only a signed-in customer can add a guest order to their account.
    const account = await this.account(request);
    if (!account) throw new UnauthorizedException('Sign in is required.');
    if (
      await this.db.customerOrderAccess.findFirst({
        where: { orderId, accountId: account.id },
        select: { orderId: true },
      })
    )
      return this.detail(request, orderId);
    // 2. Require the original browser proof; matching contact details is not enough.
    const guest = this.guest(request);
    if (!guest) throw new NotFoundException('Order was not found.');
    // 3. Replace guest access with account ownership only while that proof is valid.
    const changed = await this.db.customerOrderAccess.updateMany({
      where: { orderId, ...orderIdentityWhere(guest) },
      data: { accountId: account.id, guestHash: null, guestExpiresAt: null, claimedAt: new Date() },
    });
    if (
      !changed.count &&
      !(await this.db.customerOrderAccess.findFirst({
        where: { orderId, accountId: account.id },
        select: { orderId: true },
      }))
    )
      throw new NotFoundException('Order was not found.');
    return this.detail(request, orderId);
  }
}
