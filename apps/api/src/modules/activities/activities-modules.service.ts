import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActivitiesModulesCatalog,
  BusinessActivityKey,
  BusinessActivitySummary,
  PlatformModuleKey,
  PlatformModuleSummary,
  UpdateBusinessActivityRequest,
  UpdatePlatformModuleRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { activityDefinitions, moduleDefinitions } from './capability-registry.js';

const conflict = () =>
  new ConflictException('This catalog entry changed. Refresh the catalog and reopen the editor.');

@Injectable()
export class ActivitiesModulesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async catalog(): Promise<ActivitiesModulesCatalog> {
    const [activities, modules] = await Promise.all([
      this.prisma.businessActivity.findMany(),
      this.prisma.platformModule.findMany(),
    ]);
    return {
      activities: activityDefinitions.map((definition) => {
        const record = activities.find((entry) => entry.key === definition.key);
        return record
          ? {
              ...definition,
              name: record.name,
              description: record.description,
              moduleKeys: record.moduleKeys as PlatformModuleKey[],
              revision: record.revision,
              updatedAt: record.updatedAt.toISOString(),
              updatedBy: record.updatedBy,
            }
          : { ...definition };
      }),
      modules: moduleDefinitions.map((definition) => {
        const record = modules.find((entry) => entry.key === definition.key);
        return {
          ...definition,
          name: record?.name ?? definition.name,
          description: record?.description ?? definition.description,
          revision: record?.revision ?? 0,
          updatedAt: record?.updatedAt.toISOString() ?? null,
          updatedBy: record?.updatedBy ?? null,
        };
      }),
    };
  }

  async updateActivity(
    key: BusinessActivityKey,
    input: UpdateBusinessActivityRequest,
    administrator: string,
  ): Promise<BusinessActivitySummary> {
    const definition = activityDefinitions.find((entry) => entry.key === key);
    if (!definition) throw new NotFoundException('Business activity was not found.');
    const selected = new Set(input.moduleKeys);
    if (selected.size !== input.moduleKeys.length)
      throw new BadRequestException('Select each module only once.');
    for (const moduleKey of selected) {
      const module = moduleDefinitions.find((entry) => entry.key === moduleKey);
      if (!module || !module.supportedActivities.includes(key)) {
        throw new BadRequestException('A selected module does not support this activity.');
      }
      if (module.dependencies.some((dependency) => !selected.has(dependency))) {
        throw new BadRequestException(`Select the required modules for ${module.name}.`);
      }
    }
    const { revision, ...settings } = input;
    const data = { ...settings, moduleKeys: [...selected].sort(), updatedBy: administrator };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (revision === 0) {
          const record = await transaction.businessActivity.create({ data: { key, ...data } });
          return {
            ...definition,
            ...record,
            key,
            moduleKeys: record.moduleKeys as PlatformModuleKey[],
            updatedAt: record.updatedAt.toISOString(),
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
          ...record,
          key,
          moduleKeys: record.moduleKeys as PlatformModuleKey[],
          updatedAt: record.updatedAt.toISOString(),
        };
      });
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002')
        throw conflict();
      throw cause;
    }
  }

  async updateModule(
    key: PlatformModuleKey,
    input: UpdatePlatformModuleRequest,
    administrator: string,
  ): Promise<PlatformModuleSummary> {
    const definition = moduleDefinitions.find((entry) => entry.key === key);
    if (!definition) throw new NotFoundException('Platform module was not found.');
    const { revision, ...settings } = input;
    const data = { ...settings, updatedBy: administrator };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (revision === 0) {
          const record = await transaction.platformModule.create({ data: { key, ...data } });
          return { ...definition, ...record, key, updatedAt: record.updatedAt.toISOString() };
        }
        const changed = await transaction.platformModule.updateMany({
          where: { key, revision },
          data: { ...data, revision: { increment: 1 } },
        });
        if (changed.count !== 1) throw conflict();
        const record = await transaction.platformModule.findUniqueOrThrow({ where: { key } });
        return { ...definition, ...record, key, updatedAt: record.updatedAt.toISOString() };
      });
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002')
        throw conflict();
      throw cause;
    }
  }
}
