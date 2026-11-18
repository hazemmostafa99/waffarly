/** Receives owner requests to edit and approve attendance by month. */
import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AttendanceMonthSummary, OwnerProfile } from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { attendanceMonthSchema } from './attendance.schemas.js';
import { AttendanceService } from './attendance.service.js';

@UseGuards(OwnerGuard)
@Controller('owner/attendance')
export class AttendanceController {
  constructor(@Inject(AttendanceService) private readonly attendance: AttendanceService) {}

  @Get()
  month(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(attendanceMonthSchema, { format: 'messages' }))
    query: { month: string; branchId?: string },
  ): Promise<AttendanceMonthSummary & { staff: unknown[] }> {
    return this.attendance.month(owner.merchantId, query.month, query.branchId);
  }

  @Post(':month/entries')
  setEntry(
    @CurrentOwner() owner: OwnerProfile,
    @Param('month') month: string,
    @Body() input: unknown,
  ) {
    return this.attendance.setEntry(owner.merchantId, owner.username, month, input);
  }

  @Post(':month/approve')
  approve(@CurrentOwner() owner: OwnerProfile, @Param('month') month: string) {
    return this.attendance.approve(owner.merchantId, owner.username, month);
  }
}
