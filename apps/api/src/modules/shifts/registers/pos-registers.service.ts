/** Maintains the registers owners configure and cashiers use to start shifts. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CursorPage,
  PosEmployeeSession,
  PosRegisterOption,
  PosRegisterSummary,
} from '@waffarly/contracts';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  createPosRegisterSchema,
  updatePosRegisterSchema,
  type OwnerPosRegisterListQuery,
} from '../shifts.schemas.js';
import { registerInclude } from '../shift-records.js';
import { toRegisterSummary } from '../shift.mapper.js';
import { listOwnerRegisters, listRegistersForEmployee } from './registers.query.js';

@Injectable()
export class PosRegistersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listOwnerRegisters(
    merchantId: string,
    input: OwnerPosRegisterListQuery,
  ): Promise<CursorPage<PosRegisterSummary>> {
    return listOwnerRegisters(this.prisma, merchantId, input);
  }

  async createRegister(
    merchantId: string,
    actor: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    const parsed = parseRequest(createPosRegisterSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findFirst({
          where: { id: parsed.branchId, merchantId, archivedAt: null },
          select: { id: true },
        });
        if (!branch) throw new ConflictException('Select an active branch for this register.');
        const record = await tx.posRegister.create({
          data: {
            merchantId,
            branchId: branch.id,
            name: parsed.name,
            createdBy: actor,
            updatedBy: actor,
          },
          include: registerInclude,
        });
        return toRegisterSummary(record);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A register with this name already exists at the branch.');
      }
      throw error;
    }
  }

  async updateRegister(
    merchantId: string,
    actor: string,
    registerId: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    const parsed = parseRequest(updatePosRegisterSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "pos_registers"
          WHERE "id" = ${registerId} AND "merchantId" = ${merchantId}
          FOR UPDATE
        `;
        if (locked.length === 0) throw new NotFoundException('Register was not found.');

        const current = await tx.posRegister.findFirst({
          where: { id: registerId, merchantId },
          select: { id: true, active: true, revision: true },
        });
        if (!current) throw new NotFoundException('Register was not found.');
        if (current.revision !== parsed.revision) {
          throw new ConflictException(
            'Register changed since it was loaded. Refresh and try again.',
          );
        }
        if (current.active && !parsed.active) {
          const openShift = await tx.posShift.findFirst({
            where: { merchantId, registerId, status: { in: ['open', 'closing'] } },
            select: { id: true },
          });
          if (openShift)
            throw new ConflictException('Close the active shift before disabling this register.');
        }

        const changed = await tx.posRegister.updateMany({
          where: { id: registerId, merchantId, revision: parsed.revision },
          data: {
            name: parsed.name,
            active: parsed.active,
            revision: { increment: 1 },
            updatedBy: actor,
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException(
            'Register changed since it was loaded. Refresh and try again.',
          );
        }
        const updated = await tx.posRegister.findFirst({
          where: { id: registerId, merchantId },
          include: registerInclude,
        });
        if (!updated) throw new NotFoundException('Register was not found.');
        return toRegisterSummary(updated);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A register with this name already exists at the branch.');
      }
      throw error;
    }
  }

  listRegistersForEmployee(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<PosRegisterOption[]> {
    return listRegistersForEmployee(this.prisma, employee, input);
  }
}
