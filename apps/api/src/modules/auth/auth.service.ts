import {
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
  type PosEmployeePermission,
  type BusinessActivityKey,
} from '@waffarly/contracts';
import { createHash, randomBytes } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { OwnerProfile, PosEmployeeSession, PosLoginRequest } from '@waffarly/contracts';
import { AppConfiguration } from '../../config/app-configuration.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { verifyPassword } from './password.js';

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const ADMIN_COOKIE = 'waffarly_admin_session';
const OWNER_COOKIE = 'waffarly_owner_session';
const POS_COOKIE = 'waffarly_pos_session';

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
    if (!account.merchant.firstMonthActivatedAt) {
      throw new ForbiddenException('Subscription is not active.');
    }
    await this.startSession('OWNER', account.id, OWNER_COOKIE, response);
  }

  async loginPos(input: PosLoginRequest, response: Response): Promise<void> {
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
        })
      : null;
    if (!employee || !(await verifyPassword(input.password, employee.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    if (!employee.active) throw new UnauthorizedException('Invalid credentials.');
    if (!merchant?.firstMonthActivatedAt) {
      throw new ForbiddenException('Subscription is not active.');
    }
    const activeBranchCount = await this.prisma.posEmployeeBranch.count({
      where: { employeeId: employee.id, merchantId: merchant.id, branch: { archivedAt: null } },
    });
    if (activeBranchCount === 0)
      throw new ForbiddenException('No active branch is assigned to this account.');
    await this.startSession('POS', employee.id, POS_COOKIE, response);
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
    if (!account.merchant.firstMonthActivatedAt) {
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
      firstMonthActivatedAt: account.merchant.firstMonthActivatedAt.toISOString(),
    };
  }

  async requirePosEmployee(request: Request): Promise<PosEmployeeSession> {
    const subjectId = await this.readSession(request, POS_COOKIE, 'POS');
    const employee = await this.prisma.posEmployee.findUnique({
      where: { id: subjectId },
      include: {
        merchant: true,
        branches: {
          where: { branch: { archivedAt: null } },
          orderBy: { branch: { name: 'asc' } },
          select: { branch: { select: { id: true, name: true } } },
        },
      },
    });
    if (!employee || !employee.active) throw new UnauthorizedException('POS session is invalid.');
    if (!employee.merchant.firstMonthActivatedAt) {
      throw new ForbiddenException('Subscription is not active.');
    }
    const branches = employee.branches.map(({ branch }) => ({ ...branch, archivedAt: null }));
    if (branches.length === 0)
      throw new ForbiddenException('No active branch is assigned to this account.');
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
      branches,
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
        branches: {
          where: { branch: { archivedAt: null } },
          select: { branchId: true },
        },
      },
    });
    if (!employee || !employee.active || !(await verifyPassword(input.password, employee.passwordHash))) {
      throw new UnauthorizedException('Supervisor approval credentials are invalid.');
    }
    if (employee.id === input.actingEmployeeId)
      throw new ForbiddenException('A different supervisor must approve this action.');
    if (!employee.branches.some((branch) => branch.branchId === input.branchId))
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
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.authSession.create({
      data: {
        tokenHash: tokenHash(token),
        subjectKind,
        subjectId,
        expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      },
    });
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
