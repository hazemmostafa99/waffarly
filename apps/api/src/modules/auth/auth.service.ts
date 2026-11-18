import {
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
  type PosEmployeePermission,
  type PosEmployeeRegister,
  type BusinessActivityKey,
  type OwnerProfile,
  type PosEmployeeSession,
  type PosLoginRequest,
  type ResetMerchantOwnerPasswordRequest,
  type ResetMerchantOwnerPasswordResponse,
} from '@waffarly/contracts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppConfiguration } from '../../config/app-configuration.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { resetMerchantOwnerPasswordSchema } from './owner-password-reset.schemas.js';
import { SubscriptionService, isSubscriptionRecoveryRequest } from '../subscriptions/index.js';

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const ADMIN_COOKIE = 'waffarly_admin_session';
const OWNER_COOKIE = 'waffarly_owner_session';
const POS_COOKIE = 'waffarly_pos_session';
const POS_DEVICE_COOKIE = 'waffarly_pos_device';
const POS_DEVICE_COOKIE_LIFETIME_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(request: Request, name: string): string | null {
  const pair = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfiguration) private readonly config: AppConfiguration,
    @Inject(SubscriptionService)
    private readonly subscriptions: SubscriptionService = new SubscriptionService(prisma),
  ) {}

  async loginAdmin(username: string, password: string, response: Response): Promise<void> {
    const configuredUsername = this.config.superAdminUsername;
    const configuredHash = this.config.superAdminPasswordHash;
    if (!configuredUsername || !configuredHash) {
      throw new ServiceUnavailableException('Super Admin credentials are not configured.');
    }

    const validPassword = await verifyPassword(password, configuredHash);
    if (username.trim().toLowerCase() !== configuredUsername || !validPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    await this.startSession('ADMIN', this.adminSessionKey(), ADMIN_COOKIE, response);
  }

  async loginOwner(username: string, password: string, response: Response): Promise<void> {
    const account = await this.prisma.ownerAccount.findUnique({
      where: { username: username.trim().toLowerCase() },
      include: { merchant: true },
    });
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    // Owners can sign in to inspect subscription status even while operations are restricted.
    await this.startSession('OWNER', account.id, OWNER_COOKIE, response, account.passwordHash);
  }

  async resetMerchantOwnerPassword(
    merchantId: string,
    administrator: string,
    input: ResetMerchantOwnerPasswordRequest,
  ): Promise<ResetMerchantOwnerPasswordResponse> {
    const { password } = parseRequest(resetMerchantOwnerPasswordSchema, input, {
      format: 'messages',
    });
    // Hashing is deliberately outside the transaction to keep the account lock short.
    const passwordHash = await hashPassword(password);

    return this.prisma.$transaction(async (tx) => {
      // 1. Serialize resets with owner session creation on this same account row.
      const [account] = await tx.$queryRaw<{ id: string; username: string }[]>`
        SELECT "id", "username" FROM "owner_accounts"
        WHERE "merchantId" = ${merchantId}::uuid
        FOR UPDATE
      `;
      if (!account) throw new NotFoundException('Merchant owner account was not found.');

      // 2. Commit the password and its attribution together with session revocation.
      const passwordResetAt = new Date();
      await tx.ownerAccount.update({
        where: { id: account.id, merchantId },
        data: { passwordHash, passwordResetAt, passwordResetBy: administrator },
      });
      await tx.authSession.deleteMany({
        where: { subjectKind: 'OWNER', subjectId: account.id },
      });

      return {
        merchantId,
        username: account.username,
        passwordResetAt: passwordResetAt.toISOString(),
      };
    });
  }

  async loginPos(input: PosLoginRequest, request: Request, response: Response): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: input.storefrontSlug.trim().toLowerCase() },
      select: { id: true, firstMonthActivatedAt: true },
    });
    const employee = merchant
      ? await this.prisma.posEmployee.findUnique({
          where: {
            merchantId_username: {
              merchantId: merchant.id,
              username: input.username.trim().toLowerCase(),
            },
          },
          include: { branch: { select: { archivedAt: true } } },
        })
      : null;
    if (!merchant || !employee || !(await verifyPassword(input.password, employee.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!employee.active) throw new UnauthorizedException('Invalid credentials.');
    if (employee.branch.archivedAt)
      throw new ForbiddenException('The assigned branch is inactive.');
    const deviceId = this.getOrCreatePosDeviceId(request);
    await this.startSession('POS', employee.id, POS_COOKIE, response, undefined, deviceId);
    response.cookie(POS_DEVICE_COOKIE, deviceId, {
      ...this.cookieOptions(),
      maxAge: POS_DEVICE_COOKIE_LIFETIME_MS,
    });
  }

  async requireAdmin(request: Request): Promise<string> {
    const subjectId = await this.readSession(request, ADMIN_COOKIE, 'ADMIN');
    if (subjectId !== this.adminSessionKey() || !this.config.superAdminUsername) {
      throw new UnauthorizedException('Super Admin session is invalid.');
    }
    return this.config.superAdminUsername;
  }

  async requireOwner(request: Request): Promise<OwnerProfile> {
    const subjectId = await this.readSession(request, OWNER_COOKIE, 'OWNER');
    const account = await this.prisma.ownerAccount.findUnique({
      where: { id: subjectId },
      include: { merchant: true },
    });
    if (!account) throw new UnauthorizedException('Owner session is invalid.');
    const access = await this.subscriptions.access(account.merchantId);
    if (!access.allowed && !isSubscriptionRecoveryRequest(request.method, request.path)) {
      throw new ForbiddenException('Subscription is not active.');
    }
    return {
      username: account.username,
      merchantId: account.merchantId,
      merchantName: account.merchant.name,
      activity: account.merchant.activity as BusinessActivityKey,
      contactPhone: account.merchant.contactPhone,
      ownerName: account.merchant.ownerName,
      ownerMobile: account.merchant.ownerMobile,
      firstMonthActivatedAt: account.merchant.firstMonthActivatedAt?.toISOString() ?? null,
      subscriptionStatus: access.status,
    };
  }

  async requirePosEmployee(request: Request): Promise<PosEmployeeSession> {
    const session = await this.readPosSession(request);
    const employee = await this.prisma.posEmployee.findUnique({
      where: { id: session.subjectId },
      include: {
        merchant: true,
        branch: { select: { id: true, name: true, archivedAt: true } },
      },
    });
    if (!employee || !employee.active) throw new UnauthorizedException('POS session is invalid.');
    const access = await this.subscriptions.access(employee.merchantId);
    if (!access.allowed && !isSubscriptionRecoveryRequest(request.method, request.path)) {
      throw new ForbiddenException('Subscription is not active.');
    }
    if (employee.branch.archivedAt)
      throw new ForbiddenException('The assigned branch is inactive.');
    const pairedRegister = await this.prisma.posRegister.findFirst({
      where: { merchantId: employee.merchantId, deviceId: session.deviceId },
      select: {
        id: true,
        branchId: true,
        name: true,
        active: true,
        branch: { select: { archivedAt: true } },
      },
    });
    if (pairedRegister && pairedRegister.branchId !== employee.branch.id) {
      throw new ForbiddenException(
        'This browser is paired with a register at another branch. Ask the owner to unpair it.',
      );
    }
    if (pairedRegister && (!pairedRegister.active || pairedRegister.branch.archivedAt)) {
      throw new ForbiddenException(
        'The register paired with this browser is inactive. Ask the owner to review the register.',
      );
    }
    const deviceRegister: PosEmployeeRegister | null = pairedRegister
      ? { id: pairedRegister.id, branchId: pairedRegister.branchId, name: pairedRegister.name }
      : null;
    return {
      id: employee.id,
      merchantId: employee.merchantId,
      username: employee.username,
      displayName: employee.displayName,
      role: isPosEmployeeRole(employee.role) ? employee.role : null,
      permissions: resolvePosEmployeePermissions(
        isPosEmployeeRole(employee.role) ? employee.role : null,
        employee.permissions,
      ),
      branch: { ...employee.branch, archivedAt: null },
      deviceId: session.deviceId,
      deviceRegister,
    };
  }

  async verifyPosEmployeeApproval(input: {
    merchantId: string;
    branchId: string;
    actingEmployeeId: string;
    username: string;
    password: string;
    permission: Extract<
      PosEmployeePermission,
      'approve_voids' | 'approve_refunds' | 'approve_shift_close' | 'manage_cash_movements'
    >;
  }): Promise<string> {
    const employee = await this.prisma.posEmployee.findUnique({
      where: {
        merchantId_username: {
          merchantId: input.merchantId,
          username: input.username.trim().toLowerCase(),
        },
      },
      include: {
        branch: { select: { id: true, archivedAt: true } },
      },
    });
    if (
      !employee ||
      !employee.active ||
      !(await verifyPassword(input.password, employee.passwordHash))
    ) {
      throw new UnauthorizedException('Supervisor approval credentials are invalid.');
    }
    if (employee.id === input.actingEmployeeId)
      throw new ForbiddenException('A different supervisor must approve this action.');
    if (employee.branch.archivedAt || employee.branch.id !== input.branchId)
      throw new ForbiddenException('The supervisor is not assigned to this branch.');
    const role = isPosEmployeeRole(employee.role) ? employee.role : null;
    if (!resolvePosEmployeePermissions(role, employee.permissions).includes(input.permission))
      throw new ForbiddenException('The supervisor is not authorized to approve this action.');
    return employee.id;
  }

  async logout(
    request: Request,
    response: Response,
    kind: 'ADMIN' | 'OWNER' | 'POS',
  ): Promise<void> {
    const name = kind === 'ADMIN' ? ADMIN_COOKIE : kind === 'OWNER' ? OWNER_COOKIE : POS_COOKIE;
    const token = readCookie(request, name);
    if (token) {
      await this.prisma.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
    }
    response.clearCookie(name, this.cookieOptions());
  }

  private async startSession(
    subjectKind: 'ADMIN' | 'OWNER' | 'POS',
    subjectId: string,
    cookieName: string,
    response: Response,
    verifiedOwnerPasswordHash?: string,
    deviceId?: string,
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const data = {
      tokenHash: tokenHash(token),
      subjectKind,
      subjectId,
      ...(deviceId ? { deviceId } : {}),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
    };

    if (subjectKind === 'OWNER') {
      await this.prisma.$transaction(async (tx) => {
        // A reset may have committed while scrypt verified the previously read hash.
        const [account] = await tx.$queryRaw<{ passwordHash: string }[]>`
          SELECT "passwordHash" FROM "owner_accounts"
          WHERE "id" = ${subjectId}::uuid
          FOR UPDATE
        `;
        if (!account || account.passwordHash !== verifiedOwnerPasswordHash) {
          throw new UnauthorizedException('Invalid credentials.');
        }
        await tx.authSession.create({ data });
      });
    } else {
      await this.prisma.authSession.create({ data });
    }

    // Never send a session cookie until its database transaction has committed.
    response.cookie(cookieName, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_LIFETIME_MS,
    });
  }

  private async readSession(
    request: Request,
    cookieName: string,
    expectedKind: 'ADMIN' | 'OWNER' | 'POS',
  ): Promise<string> {
    const token = readCookie(request, cookieName);
    if (!token) throw new UnauthorizedException('Sign in is required.');
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!session || session.subjectKind !== expectedKind || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session has expired.');
    }
    return session.subjectId;
  }

  private async readPosSession(request: Request): Promise<{ subjectId: string; deviceId: string }> {
    const token = readCookie(request, POS_COOKIE);
    if (!token) throw new UnauthorizedException('Sign in is required.');
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (
      !session ||
      session.subjectKind !== 'POS' ||
      session.expiresAt <= new Date() ||
      !session.deviceId
    ) {
      throw new UnauthorizedException('POS session has expired. Sign in again to register this browser.');
    }
    return { subjectId: session.subjectId, deviceId: session.deviceId };
  }

  private getOrCreatePosDeviceId(request: Request): string {
    const current = readCookie(request, POS_DEVICE_COOKIE);
    return current && UUID_PATTERN.test(current) ? current : randomUUID();
  }

  private cookieOptions(): { httpOnly: true; sameSite: 'lax'; secure: boolean; path: string } {
    return { httpOnly: true, sameSite: 'lax', secure: this.config.isProduction, path: '/' };
  }

  private adminSessionKey(): string {
    return createHash('sha256')
      .update(this.config.superAdminUsername)
      .update(':')
      .update(this.config.superAdminPasswordHash)
      .digest('hex');
  }
}
