/**
 * Lets Super Admin review and edit each business activity: its display details and
 * which features (kitchen, dining tables, delivery) merchants of that activity may use.
 */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ActivityFeatureSettings,
  BusinessActivityKey,
  BusinessActivitySummary,
  UpdateBusinessActivityRequest,
} from '@waffarly/contracts';
import {
  ACTIVITY_FEATURES,
  activityFeatureAvailability,
  resolveActivityFeatures,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { activityDefinitions } from './activity-definitions.js';

/** The stored activity columns this service reads. */
interface StoredActivity {
  name: string;
  description: string;
  kitchenEnabled: boolean;
  diningTablesEnabled: boolean;
  deliveryEnabled: boolean;
  revision: number;
  updatedAt: Date;
  updatedBy: string;
}

const conflict = () =>
  new ConflictException('This activity changed. Refresh the catalog and reopen the editor.');

/** Saved switches of a stored row, in contract shape. */
function savedFeatures(record: StoredActivity): ActivityFeatureSettings {
  return {
    kitchen: record.kitchenEnabled,
    diningTables: record.diningTablesEnabled,
    delivery: record.deliveryEnabled,
  };
}

/** Combines the code definition with the saved row; activities never saved use defaults. */
function toActivitySummary(
  definition: BusinessActivitySummary,
  record: StoredActivity | null,
): BusinessActivitySummary {
  const base = {
    ...definition,
    features: resolveActivityFeatures(definition.key, record ? savedFeatures(record) : null),
    availableFeatures: activityFeatureAvailability(definition.key),
  };
  return record
    ? {
        ...base,
        name: record.name,
        description: record.description,
        revision: record.revision,
        updatedAt: record.updatedAt.toISOString(),
        updatedBy: record.updatedBy,
      }
    : base;
}

/** Rejects switching on a feature the activity cannot have, e.g. a kitchen for clothing stores. */
function assertAvailableFeatures(key: BusinessActivityKey, features: ActivityFeatureSettings) {
  const available = activityFeatureAvailability(key);
  const unavailable = ACTIVITY_FEATURES.filter(
    (feature) => features[feature] && !available[feature],
  );
  if (unavailable.length) {
    throw new BadRequestException(
      `These features are not available for this activity: ${unavailable.join(', ')}.`,
    );
  }
}

@Injectable()
export class ActivitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<BusinessActivitySummary[]> {
    const records = await this.prisma.businessActivity.findMany();
    return activityDefinitions.map((definition) =>
      toActivitySummary(definition, records.find((entry) => entry.key === definition.key) ?? null),
    );
  }

  async update(
    key: BusinessActivityKey,
    input: UpdateBusinessActivityRequest,
    administrator: string,
  ): Promise<BusinessActivitySummary> {
    const definition = activityDefinitions.find((entry) => entry.key === key);
    if (!definition) throw new NotFoundException('Business activity was not found.');
    assertAvailableFeatures(key, input.features);
    const { revision, features, name, description } = input;
    const data = {
      name,
      description,
      kitchenEnabled: features.kitchen,
      diningTablesEnabled: features.diningTables,
      deliveryEnabled: features.delivery,
      updatedBy: administrator,
    };

    try {
      return await this.prisma.$transaction(async (transaction) => {
        // 1. First save of an activity creates its row; later saves need the current revision.
        if (revision === 0) {
          const record = await transaction.businessActivity.create({ data: { key, ...data } });
          return toActivitySummary(definition, record);
        }

        const changed = await transaction.businessActivity.updateMany({
          where: { key, revision },
          data: { ...data, revision: { increment: 1 } },
        });
        if (changed.count !== 1) throw conflict();
        const record = await transaction.businessActivity.findUniqueOrThrow({ where: { key } });
        return toActivitySummary(definition, record);
      });
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002')
        throw conflict();
      throw cause;
    }
  }
}
