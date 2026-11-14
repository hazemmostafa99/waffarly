/** Receives cashier requests to open, inspect and close shifts and record cash movements. */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type {
  PosEmployeeSession,
  PosRegisterOption,
  PosShiftCloseReport,
  PosShiftClosePreview,
  PosShiftLiveSummary,
  PosShiftSummary,
  RecordPosShiftCashMovementResponse,
} from '@waffarly/contracts';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { AuthService, CurrentPosEmployee, PosEmployeeGuard } from '../../../auth/index.js';
import {
  closePosShiftSchema,
  deliveryHandoverRecipientsSchema,
  openPosShiftSchema,
  posCurrentShiftSchema,
  posRegisterListSchema,
  posShiftClosePreviewSchema,
  recordPosShiftCashMovementSchema,
} from '../../shifts.schemas.js';
import { ShiftsService } from '../../shifts.service.js';

@UseGuards(PosEmployeeGuard)
@Controller('pos')
export class PosShiftsController {
  constructor(
    @Inject(ShiftsService) private readonly shifts: ShiftsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get('registers')
  listRegisters(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosRegisterOption[]> {
    requireShiftPermission(employee);
    return this.shifts.listForEmployee(employee, parseRequest(posRegisterListSchema, query));
  }

  @Get('shifts/delivery-handover-recipients')
  deliveryHandoverRecipients(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ) {
    requireShiftPermission(employee);
    return this.shifts.listDeliveryHandoverRecipients(
      employee,
      parseRequest(deliveryHandoverRecipientsSchema, query),
    );
  }

  @Get('shifts/current')
  currentShift(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosShiftSummary | null> {
    requireShiftPermission(employee);
    const parsed = parseRequest(posCurrentShiftSchema, query);
    return this.shifts.getCurrentShift(employee, parsed.registerId);
  }

  @Post('shifts/open')
  openShift(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Body() input: unknown,
  ): Promise<PosShiftSummary> {
    requireShiftPermission(employee);
    return this.shifts.openShift(employee, parseRequest(openPosShiftSchema, input));
  }

  @Get('shifts/latest-close')
  latestCloseReport(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Query() query: unknown,
  ): Promise<PosShiftCloseReport | null> {
    requireShiftPermission(employee);
    const parsed = parseRequest(posCurrentShiftSchema, query);
    return this.shifts.getLatestCloseReport(employee, parsed.registerId);
  }

  @Get('shifts/:shiftId/reconciliation')
  reconciliation(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
  ): Promise<PosShiftLiveSummary> {
    requireShiftPermission(employee);
    return this.shifts.getReconciliation(employee, shiftId);
  }

  @Get('shifts/:shiftId/close-report')
  closeReport(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
  ): Promise<PosShiftCloseReport> {
    requireShiftPermission(employee);
    return this.shifts.getCloseReport(employee, shiftId);
  }

  @Post('shifts/:shiftId/close-preview')
  closePreview(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
    @Body() input: unknown,
  ): Promise<PosShiftClosePreview> {
    requireShiftPermission(employee);
    return this.shifts.previewCloseShift(
      employee,
      shiftId,
      parseRequest(posShiftClosePreviewSchema, input),
    );
  }

  @Post('shifts/:shiftId/cash-movements')
  async recordCashMovement(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
    @Body() input: unknown,
  ): Promise<RecordPosShiftCashMovementResponse> {
    requireShiftPermission(employee);
    const parsed = parseRequest(recordPosShiftCashMovementSchema, input);
    const branchId = await this.shifts.getShiftBranch(employee, shiftId);
    const approverEmployeeId = parsed.approval
      ? await this.auth.verifyPosEmployeeApproval({
          merchantId: employee.merchantId,
          branchId,
          actingEmployeeId: employee.id,
          ...parsed.approval,
          permission: 'manage_cash_movements',
        })
      : undefined;
    return this.shifts.recordManualCashMovement(employee, shiftId, parsed, approverEmployeeId);
  }

  @Post('shifts/:shiftId/close')
  async closeShift(
    @CurrentPosEmployee() employee: PosEmployeeSession,
    @Param('shiftId', new ParseUUIDPipe()) shiftId: string,
    @Body() input: unknown,
  ): Promise<PosShiftCloseReport> {
    requireShiftPermission(employee);
    const parsed = parseRequest(closePosShiftSchema, input);
    const branchId = await this.shifts.getShiftBranch(employee, shiftId);
    const approverEmployeeId = parsed.approval
      ? await this.auth.verifyPosEmployeeApproval({
          merchantId: employee.merchantId,
          branchId,
          actingEmployeeId: employee.id,
          ...parsed.approval,
          permission: 'approve_shift_close',
        })
      : undefined;
    return this.shifts.closeShift(employee, shiftId, parsed, approverEmployeeId);
  }
}

function requireShiftPermission(employee: PosEmployeeSession): void {
  if (!employee.permissions.includes('open_register_shift')) {
    throw new ForbiddenException('This employee is not authorized to use register shifts.');
  }
}
