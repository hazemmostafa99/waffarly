import { createHash, randomBytes } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { OwnerProfile } from '@waffarly/contracts';
import { AppConfiguration } from '../../config/app-configuration.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { verifyPassword } from './password.js';

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const ADMIN_COOKIE = 'waffarly_admin_session';
const OWNER_COOKIE = 'waffarly_owner_session';

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
      contactPhone: account.merchant.contactPhone,
      ownerName: account.merchant.ownerName,
      ownerMobile: account.merchant.ownerMobile,
      firstMonthActivatedAt: account.merchant.firstMonthActivatedAt.toISOString(),
    };
  }

  async logout(request: Request, response: Response, kind: 'ADMIN' | 'OWNER'): Promise<void> {
    const name = kind === 'ADMIN' ? ADMIN_COOKIE : OWNER_COOKIE;
    const token = readCookie(request, name);
    if (token) {
      await this.prisma.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
    }
    response.clearCookie(name, this.cookieOptions());
  }

  private async startSession(
    subjectKind: 'ADMIN' | 'OWNER',
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
    expectedKind: 'ADMIN' | 'OWNER',
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
