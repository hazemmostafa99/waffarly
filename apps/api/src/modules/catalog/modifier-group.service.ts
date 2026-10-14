import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CatalogModifierGroupFields,
  CatalogModifierGroupSummary,
  UpdateCatalogModifierGroupRequest,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class ModifierGroupService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(merchantId: string): Promise<CatalogModifierGroupSummary[]> {
    const groups = await this.prisma.modifierGroup.findMany({
      where: { merchantId },
      include: {
        options: { orderBy: { position: 'asc' } },
        _count: { select: { assignments: true } },
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    return groups.map(toSummary);
  }

  async get(merchantId: string, id: string): Promise<CatalogModifierGroupSummary> {
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id, merchantId },
      include: {
        options: { orderBy: { position: 'asc' } },
        _count: { select: { assignments: true } },
      },
    });
    if (!group) throw new NotFoundException('Modifier group was not found.');
    return toSummary(group);
  }

  async create(
    merchantId: string,
    input: CatalogModifierGroupFields,
  ): Promise<CatalogModifierGroupSummary> {
    assertModifierGroupFields(input);
    const group = await this.prisma.modifierGroup.create({
      data: {
        merchantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        options: {
          create: input.options.map((option) => ({
            name: option.name.trim(),
            position: option.position,
          })),
        },
      },
      include: {
        options: { orderBy: { position: 'asc' } },
        _count: { select: { assignments: true } },
      },
    });
    return toSummary(group);
  }

  async update(
    merchantId: string,
    id: string,
    input: UpdateCatalogModifierGroupRequest,
  ): Promise<CatalogModifierGroupSummary> {
    const { revision, ...patch } = input;
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new BadRequestException('Modifier group name is required.');
    }

    try {
      const group = await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.modifierGroup.findFirst({
            where: { id, merchantId, revision },
            include: { _count: { select: { assignments: true } } },
          });
          if (!current) throw new ConflictException('Modifier group is missing or stale.');
          const assigned = await transaction.productModifierGroupAssignment.findFirst({
            where: { modifierGroupId: id, merchantId },
            select: { id: true },
          });
          if (assigned) {
            throw new ConflictException(
              'Detach this modifier group from every product before editing its shared definition.',
            );
          }
          if (patch.options !== undefined) {
            assertModifierGroupFields({
              name: patch.name ?? current.name,
              description: patch.description ?? current.description ?? undefined,
              options: patch.options,
            });
          }
          const changed = await transaction.modifierGroup.updateMany({
            where: { id, merchantId, revision },
            data: {
              ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
              ...(patch.description === undefined
                ? {}
                : { description: patch.description.trim() || null }),
              revision: { increment: 1 },
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException('Modifier group is missing or stale.');
          }
          if (patch.options !== undefined) {
            await transaction.modifierOption.deleteMany({ where: { groupId: id, merchantId } });
            await transaction.modifierOption.createMany({
              data: patch.options.map((option) => ({
                groupId: id,
                merchantId,
                name: option.name.trim(),
                position: option.position,
              })),
            });
          }
          return transaction.modifierGroup.findUniqueOrThrow({
            where: { id },
            include: {
              options: { orderBy: { position: 'asc' } },
              _count: { select: { assignments: true } },
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
      return toSummary(group);
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new ConflictException('Modifier group changed concurrently. Please retry.');
      }
      throw error;
    }
  }
}

function assertModifierGroupFields(input: CatalogModifierGroupFields): void {
  if (!input.name.trim() || input.name.trim().length > 160) {
    throw new BadRequestException('Modifier group name must contain between 1 and 160 characters.');
  }
  if (input.description?.trim().length && input.description.trim().length > 1000) {
    throw new BadRequestException('Modifier group description is too long.');
  }
  if (input.options.length < 1 || input.options.length > 100) {
    throw new BadRequestException('A modifier group must contain between 1 and 100 options.');
  }
  const positions = new Set<number>();
  for (const option of input.options) {
    if (!option.name.trim() || option.name.trim().length > 160) {
      throw new BadRequestException('Modifier option name must contain between 1 and 160 characters.');
    }
    if (!Number.isInteger(option.position) || option.position < 0 || positions.has(option.position)) {
      throw new BadRequestException('Modifier option positions must be unique non-negative integers.');
    }
    positions.add(option.position);
  }
}

function toSummary(group: {
  id: string;
  name: string;
  description: string | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  options: Array<{ id: string; name: string; position: number }>;
  _count: { assignments: number };
}): CatalogModifierGroupSummary {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    revision: group.revision,
    options: group.options.map((option) => ({
      id: option.id,
      name: option.name,
      position: option.position,
    })),
    assignedProductCount: group._count.assignments,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2034'
  );
}
