import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@waffarly/database';
import type { CustomerProfile } from '@waffarly/contracts';
import { CustomerAuthService } from '../../auth/index.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { AppConfiguration } from '../../../config/app-configuration.js';

export type OrderIdentity = { accountId: string } | { guestHash: string; guestExpiresAt: Date };
const COOKIE = 'waffarly_guest_orders';
const AGE = 30 * 24 * 60 * 60 * 1000;
function cookie(request: Request, name: string) {
  return request.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(name + '='))
    ?.slice(name.length + 1);
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function orderIdentityWhere(identity: OrderIdentity): Prisma.CustomerOrderAccessWhereInput {
  return 'accountId' in identity
    ? { accountId: identity.accountId }
    : { accountId: null, guestHash: identity.guestHash, guestExpiresAt: { gt: new Date() } };
}
const projection = {
  orderId: true,
  accountId: true,
  order: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      total: true,
      subtotal: true,
      deliveryFee: true,
      fulfillmentType: true,
      acceptedAt: true,
      preparationStartedAt: true,
      readyAt: true,
      completedAt: true,
      cancelledAt: true,
      merchant: { select: { name: true } },
      lines: {
        orderBy: { position: 'asc' as const },
        select: {
          id: true,
          productName: true,
          variantName: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          selections: {
            orderBy: [{ groupPosition: 'asc' as const }, { optionPosition: 'asc' as const }],
            select: { groupName: true, optionName: true, quantity: true },
          },
        },
      },
    },
  },
} satisfies Prisma.CustomerOrderAccessSelect;
type Row = Prisma.CustomerOrderAccessGetPayload<{ select: typeof projection }>;
function view(row: Row) {
  const order = row.order;
  return {
    id: order.id,
    restaurantName: order.merchant.name,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    total: order.total.toFixed(2),
    subtotal: order.subtotal?.toFixed(2) ?? null,
    deliveryFee: order.deliveryFee?.toFixed(2) ?? null,
    fulfillmentType: order.fulfillmentType,
    guest: row.accountId === null,
    acceptedAt: order.acceptedAt?.toISOString() ?? null,
    preparationStartedAt: order.preparationStartedAt?.toISOString() ?? null,
    readyAt: order.readyAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    items: order.lines.map((line) => ({
      ...line,
      unitPrice: line.unitPrice.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2),
    })),
  };
}
@Injectable()
export class CustomerOrderAccessService {
  private readonly accounts = new WeakMap<Request, Promise<CustomerProfile | null>>();
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(CustomerAuthService) private readonly auth: CustomerAuthService,
    @Inject(AppConfiguration) private readonly config: AppConfiguration,
  ) {}
  account(request: Request): Promise<CustomerProfile | null> {
    const cached = this.accounts.get(request);
    if (cached) return cached;
    const result = cookie(request, 'waffarly_customer_session')
      ? this.auth.me(request)
      : Promise.resolve(null);
    this.accounts.set(request, result);
    return result;
  }
  guest(request: Request): OrderIdentity | null {
    const token = cookie(request, COOKIE);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token)
      ? { guestHash: hash(token), guestExpiresAt: new Date(Date.now() + AGE) }
      : null;
  }
  async prepare(request: Request, response: Response) {
    const account = await this.account(request);
    if (!this.guest(request))
      response.cookie(COOKIE, randomBytes(32).toString('base64url'), {
        httpOnly: true,
        secure: this.config.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: AGE,
      });
    return { signedIn: account !== null, guestLifetimeDays: 30 };
  }
  async identity(request: Request): Promise<OrderIdentity> {
    const account = await this.account(request);
    if (account) return { accountId: account.id };
    const guest = this.guest(request);
    if (!guest)
      throw new UnauthorizedException('Review checkout again to prepare secure order access.');
    return guest;
  }
  async scope(request: Request): Promise<Prisma.CustomerOrderAccessWhereInput> {
    const account = await this.account(request);
    const guest = this.guest(request);
    const choices: Prisma.CustomerOrderAccessWhereInput[] = [];
    if (account) choices.push({ accountId: account.id });
    if (guest) choices.push(orderIdentityWhere(guest));
    return choices.length ? { OR: choices } : { orderId: { in: [] } };
  }
  async list(request: Request, cursor?: string) {
    const scope = await this.scope(request);
    if (
      cursor &&
      !(await this.db.customerOrderAccess.findFirst({
        where: { AND: [scope, { orderId: cursor }] },
        select: { orderId: true },
      }))
    )
      throw new NotFoundException('Order was not found.');
    const rows = await this.db.customerOrderAccess.findMany({
      where: scope,
      select: projection,
      orderBy: [{ createdAt: 'desc' }, { orderId: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { orderId: cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 20).map(view),
      nextCursor: rows.length > 20 ? rows[19]!.orderId : null,
      signedIn: (await this.account(request)) !== null,
    };
  }
  async detail(request: Request, orderId: string) {
    const row = await this.db.customerOrderAccess.findFirst({
      where: { AND: [await this.scope(request), { orderId }] },
      select: projection,
    });
    if (!row) throw new NotFoundException('Order was not found.');
    return view(row);
  }
  async claim(request: Request, orderId: string) {
    const account = await this.account(request);
    if (!account) throw new UnauthorizedException('Sign in is required.');
    if (
      await this.db.customerOrderAccess.findFirst({
        where: { orderId, accountId: account.id },
        select: { orderId: true },
      })
    )
      return this.detail(request, orderId);
    const guest = this.guest(request);
    if (!guest) throw new NotFoundException('Order was not found.');
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
