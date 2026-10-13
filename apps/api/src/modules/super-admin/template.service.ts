import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateStorefrontTemplateRequest,
  StorefrontTemplateSummary,
  UpdateStorefrontTemplateRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

type TemplateRecord = Omit<
  StorefrontTemplateSummary,
  'createdAt' | 'updatedAt' | 'activity' | 'layout' | 'status'
> & {
  createdAt: Date;
  updatedAt: Date;
  activity: string;
  layout: string;
  status: string;
};

function toSummary(record: TemplateRecord): StorefrontTemplateSummary {
  return {
    ...record,
    // These values are validated on writes and constrained by the database migration.
    activity: record.activity as StorefrontTemplateSummary['activity'],
    layout: record.layout as StorefrontTemplateSummary['layout'],
    status: record.status as StorefrontTemplateSummary['status'],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class TemplateService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<StorefrontTemplateSummary[]> {
    const records = await this.prisma.storefrontTemplate.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return records.map(toSummary);
  }

  async create(
    input: CreateStorefrontTemplateRequest,
    administrator: string,
  ): Promise<StorefrontTemplateSummary> {
    try {
      return toSummary(
        await this.prisma.storefrontTemplate.create({
          data: { ...input, updatedBy: administrator },
        }),
      );
    } catch (cause) {
      if (
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        cause.code === 'P2002'
      ) {
        throw new ConflictException('Template key is already in use.');
      }
      throw cause;
    }
  }

  async update(
    id: string,
    input: UpdateStorefrontTemplateRequest,
    administrator: string,
  ): Promise<StorefrontTemplateSummary> {
    const { revision, ...settings } = input;
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.storefrontTemplate.updateMany({
        where: { id, revision },
        data: { ...settings, revision: { increment: 1 }, updatedBy: administrator },
      });
      if (changed.count !== 1) {
        const existing = await transaction.storefrontTemplate.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Template was not found.');
        throw new ConflictException(
          'Template changed since you opened it. Reload the library before editing again.',
        );
      }
      const updated = await transaction.storefrontTemplate.findUniqueOrThrow({ where: { id } });
      return toSummary(updated);
    });
  }
}
