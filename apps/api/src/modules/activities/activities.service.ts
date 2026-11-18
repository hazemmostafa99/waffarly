import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BusinessActivityKey,
  BusinessActivitySummary,
  UpdateBusinessActivityRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { activityDefinitions } from './activity-definitions.js';

const conflict = () =>
  new ConflictException('This activity changed. Refresh the catalog and reopen the editor.');

@Injectable()
export class ActivitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<BusinessActivitySummary[]> {
    const records = await this.prisma.businessActivity.findMany();
    return activityDefinitions.map((definition) => {
      const record = records.find((entry) => entry.key === definition.key);
      return record
        ? {
            ...definition,
            name: record.name,
            description: record.description,
            revision: record.revision,
            updatedAt: record.updatedAt.toISOString(),
            updatedBy: record.updatedBy,
          }
        : definition;
    });
  }

  async update(
    key: BusinessActivityKey,
    input: UpdateBusinessActivityRequest,
    administrator: string,
  ): Promise<BusinessActivitySummary> {
    const definition = activityDefinitions.find((entry) => entry.key === key);
    if (!definition) throw new NotFoundException('Business activity was not found.');
    const { revision, ...settings } = input;
    const data = { ...settings, updatedBy: administrator };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (revision === 0) {
          const record = await transaction.businessActivity.create({ data: { key, ...data } });
          return {
            ...definition,
            name: record.name,
            description: record.description,
            revision: record.revision,
            updatedAt: record.updatedAt.toISOString(),
            updatedBy: record.updatedBy,
          };
        }

        const changed = await transaction.businessActivity.updateMany({
          where: { key, revision },
          data: { ...data, revision: { increment: 1 } },
        });
        if (changed.count !== 1) throw conflict();
        const record = await transaction.businessActivity.findUniqueOrThrow({ where: { key } });
        return {
          ...definition,
          name: record.name,
          description: record.description,
          revision: record.revision,
          updatedAt: record.updatedAt.toISOString(),
          updatedBy: record.updatedBy,
        };
      });
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002')
        throw conflict();
      throw cause;
    }
  }
}
