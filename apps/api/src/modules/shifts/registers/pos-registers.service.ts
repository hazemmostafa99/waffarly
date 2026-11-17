/** Maintains the registers owners configure and cashiers use to start shifts. */
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CursorPage,
  PosEmployeeRegister,
  PosEmployeeSession,
  PosRegisterOption,
  PosRegisterSummary,
} from '@waffarly/contracts';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { assertShiftBranchAssignment } from '../access/shift-access.rules.js';
import {
  createPosRegisterSchema,
  pairPosRegisterSchema,
  unpairPosRegisterSchema,
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

  async pairDeviceToRegister(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<PosEmployeeRegister> {
    const deviceId = employee.deviceId;
    if (!deviceId) throw new ForbiddenException('Sign in again to register this browser.');
    const parsed = parseRequest(pairPosRegisterSchema, input);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{
            id: string;
            branchId: string;
            deviceId: string | null;
            active: boolean;
            name: string;
          }>
        >`
          SELECT "id", "branchId", "deviceId", "active", "name"
          FROM "pos_registers"
          WHERE "id" = ${parsed.registerId}::uuid
            AND "merchantId" = ${employee.merchantId}::uuid
          FOR UPDATE
        `;
        const register = locked[0];
        if (!register) throw new NotFoundException('Register was not found.');
        assertShiftBranchAssignment(employee, register.branchId);
        if (!register.active) throw new ConflictException('Choose an active POS register.');

        const existingPair = await tx.posRegister.findFirst({
          where: { merchantId: employee.merchantId, deviceId },
          select: { id: true },
        });
        if (existingPair && existingPair.id !== register.id) {
          throw new ConflictException(
            'This browser is already paired with another register. Ask the owner to unpair it first.',
          );
        }
        if (register.deviceId && register.deviceId !== deviceId) {
          throw new ConflictException('This register is already paired with another browser.');
        }
        if (register.deviceId === deviceId) {
          return { id: register.id, branchId: register.branchId, name: register.name };
        }

        const changed = await tx.posRegister.updateMany({
          where: { id: register.id, merchantId: employee.merchantId, deviceId: null },
          data: {
            deviceId,
            revision: { increment: 1 },
            updatedBy: employee.username,
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException('Register availability changed. Refresh and try again.');
        }
        return { id: register.id, branchId: register.branchId, name: register.name };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('This browser or register is already paired elsewhere.');
      }
      throw error;
    }
  }

  async unpairDevice(
    merchantId: string,
    actor: string,
    registerId: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    const parsed = parseRequest(unpairPosRegisterSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; deviceId: string | null }>>`
        SELECT "id", "deviceId"
        FROM "pos_registers"
        WHERE "id" = ${registerId}::uuid
          AND "merchantId" = ${merchantId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('Register was not found.');

      const current = await tx.posRegister.findFirst({
        where: { id: registerId, merchantId },
        select: { id: true, revision: true },
      });
      if (!current) throw new NotFoundException('Register was not found.');
      if (current.revision !== parsed.revision) {
        throw new ConflictException('Register changed since it was loaded. Refresh and try again.');
      }

      const openShift = await tx.posShift.findFirst({
        where: { merchantId, registerId, status: { in: ['open', 'closing'] } },
        select: { id: true },
      });
      if (openShift) {
        throw new ConflictException('Close the active shift before unpairing this browser.');
      }

      if (locked[0]!.deviceId) {
        const changed = await tx.posRegister.updateMany({
          where: { id: registerId, merchantId, revision: parsed.revision },
          data: {
            deviceId: null,
            revision: { increment: 1 },
            updatedBy: actor,
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException('Register changed since it was loaded. Refresh and try again.');
        }
      }

      const unpaired = await tx.posRegister.findFirst({
        where: { id: registerId, merchantId },
        include: registerInclude,
      });
      if (!unpaired) throw new NotFoundException('Register was not found.');
      return toRegisterSummary(unpaired);
    });
  }

  listRegistersForEmployee(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<PosRegisterOption[]> {
    return listRegistersForEmployee(this.prisma, employee, input);
  }
}
