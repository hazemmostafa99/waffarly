import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CustomerProfile,
  CustomerSignInRequest,
  CustomerSignUpRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AppConfiguration } from '../../config/app-configuration.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { customerSignInSchema, customerSignUpSchema } from './customer-auth.schemas.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

const COOKIE = 'waffarly_customer_session';
const LIFETIME = 8 * 60 * 60 * 1000;
// Valid scrypt encoding so unknown accounts perform the same expensive password work.
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`;
const profileSelect = {
  id: true,
  displayName: true,
  email: true,
  phone: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
} satisfies Prisma.CustomerAccountSelect;
type ProfileRecord = Prisma.CustomerAccountGetPayload<{ select: typeof profileSelect }>;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function profile(account: ProfileRecord): CustomerProfile {
  return {
    id: account.id,
    displayName: account.displayName,
    email: account.email,
    phone: account.phone,
    emailVerified: account.emailVerifiedAt !== null,
    phoneVerified: account.phoneVerifiedAt !== null,
  };
}
function sessionToken(request: Request): string | undefined {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
}

@Injectable()
export class CustomerAuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfiguration) private readonly config: AppConfiguration,
  ) {}

  async signUp(
    input: CustomerSignUpRequest,
    request: Request,
    response: Response,
  ): Promise<CustomerProfile> {
    const data = parseRequest(customerSignUpSchema, input);
    await this.limit(`signup:ip:${request.ip ?? 'unknown'}`, 5, 60 * 60 * 1000);
    const passwordHash = await hashPassword(data.password);
    const token = randomBytes(32).toString('base64url');
    let account: ProfileRecord;
    try {
      account = await this.prisma.$transaction(async (tx) => {
        const created = await tx.customerAccount.create({
          data: {
            displayName: data.name,
            email: data.email,
            phone: data.phone,
            passwordHash,
          },
          select: profileSelect,
        });
        await this.createSession(tx, created.id, token, request);
        return created;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account already uses these contact details.');
      }
      throw error;
    }
    this.setCookie(response, token);
    return profile(account);
  }

  async signIn(
    input: CustomerSignInRequest,
    request: Request,
    response: Response,
  ): Promise<CustomerProfile> {
    const data = parseRequest(customerSignInSchema, input);
    await this.limit(`login:ip:${request.ip ?? 'unknown'}`, 100, 15 * 60 * 1000);
    await this.limit(`login:identifier:${data.identifier}`, 20, 15 * 60 * 1000);
    const account = await this.prisma.customerAccount.findUnique({
      where: data.identifier.includes('@')
        ? { email: data.identifier }
        : { phone: data.identifier },
      select: { ...profileSelect, passwordHash: true },
    });
    const valid = await verifyPassword(data.password, account?.passwordHash ?? DUMMY_HASH);
    if (!account?.passwordHash || !valid) throw new UnauthorizedException('Invalid credentials.');
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction((tx) => this.createSession(tx, account.id, token, request));
    this.setCookie(response, token);
    return profile(account);
  }

  async me(request: Request): Promise<CustomerProfile> {
    const token = sessionToken(request);
    if (!token || token.length > 128) throw new UnauthorizedException('Sign in is required.');
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!session || session.subjectKind !== 'CUSTOMER' || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session has expired.');
    }
    const account = await this.prisma.customerAccount.findUnique({
      where: { id: session.subjectId },
      select: profileSelect,
    });
    if (!account) throw new UnauthorizedException('Session is invalid.');
    return profile(account);
  }

  async logout(request: Request, response: Response): Promise<void> {
    const token = sessionToken(request);
    if (token)
      await this.prisma.authSession.deleteMany({
        where: { tokenHash: digest(token), subjectKind: 'CUSTOMER' },
      });
    response.clearCookie(COOKIE, this.cookieOptions());
  }

  private async createSession(
    tx: Prisma.TransactionClient,
    id: string,
    token: string,
    request: Request,
  ): Promise<void> {
    await tx.authSession.deleteMany({
      where: { subjectKind: 'CUSTOMER', expiresAt: { lt: new Date() } },
    });
    const previous = sessionToken(request);
    if (previous)
      await tx.authSession.deleteMany({
        where: { tokenHash: digest(previous), subjectKind: 'CUSTOMER' },
      });
    await tx.authSession.create({
      data: {
        tokenHash: digest(token),
        subjectKind: 'CUSTOMER',
        subjectId: id,
        expiresAt: new Date(Date.now() + LIFETIME),
      },
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.isProduction,
      path: '/',
    };
  }
  private setCookie(response: Response, token: string) {
    response.cookie(COOKIE, token, { ...this.cookieOptions(), maxAge: LIFETIME });
  }

  private async limit(key: string, max: number, lifetime: number): Promise<void> {
    const now = new Date();
    await this.prisma.customerAuthLimit.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    });
    // Atomic across processes; rejected requests keep their counter outside the account transaction.
    const [row] = await this.prisma.$queryRaw<{ attempts: number }[]>`
      INSERT INTO "customer_auth_limits" ("key", "attempts", "expiresAt")
      VALUES (${digest(key)}, 1, ${new Date(now.getTime() + lifetime)})
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "customer_auth_limits"."expiresAt" <= ${now} THEN 1
          ELSE "customer_auth_limits"."attempts" + 1 END,
        "expiresAt" = CASE WHEN "customer_auth_limits"."expiresAt" <= ${now} THEN EXCLUDED."expiresAt"
          ELSE "customer_auth_limits"."expiresAt" END
      RETURNING "attempts"`;
    if (!row || row.attempts > max)
      throw new HttpException('Too many attempts. Please try again later.', 429);
  }
}
