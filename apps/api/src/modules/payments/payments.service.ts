import { Inject, Injectable } from '@nestjs/common';
import type { PosEmployeeSession, PosPaymentSummary, PosCheckTender } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { formatCents, requireEgpCurrency, toCents } from '../../common/money/money.js';
import { ShiftsService } from '../shifts/index.js';
import { normalizeTenders } from './payment.rules.js';

export interface RecordCheckTendersCommand {
  merchantId: string;
  orderId: string;
  checkId: string;
  shiftId: string;
  requestId: string;
  currency: string;
  balanceDue: string;
  employee: PosEmployeeSession;
  tenders: PosCheckTender[];
  cashCustody?: 'courier';
}

@Injectable()
export class PaymentsService {
  constructor(@Inject(ShiftsService) private readonly shifts: ShiftsService) {}

  async recordCheckTenders(
    tx: Prisma.TransactionClient,
    command: RecordCheckTendersCommand,
  ): Promise<{ payments: PosPaymentSummary[]; appliedAmount: string; balanceDue: string }> {
    const currency = requireEgpCurrency(command.currency);
    const normalized = normalizeTenders(command.tenders, command.balanceDue);
    const rows: PosPaymentSummary[] = [];
    for (const [position, tender] of normalized.entries()) {
      const payment = await tx.posOrderPayment.create({
        data: {
          merchantId: command.merchantId,
          orderId: command.orderId,
          checkId: command.checkId,
          shiftId: command.shiftId,
          operatorEmployeeId: command.employee.id,
          requestId: command.requestId,
          position,
          method: tender.method,
          amount: tender.amount,
          receivedAmount: tender.receivedAmount,
          changeAmount: tender.changeAmount,
          currency,
          terminalReference: tender.terminalReference,
          cashCustody: command.cashCustody ?? 'drawer',
        },
      });
      if (payment.method === 'cash' && command.cashCustody !== 'courier') {
        await this.shifts.recordCashSale(tx, {
          merchantId: payment.merchantId,
          shiftId: payment.shiftId,
          paymentId: payment.id,
          operatorEmployeeId: payment.operatorEmployeeId,
          amount: payment.amount.toFixed(2),
        });
      }
      rows.push({
        id: payment.id,
        position: payment.position,
        method: payment.method as PosPaymentSummary['method'],
        amount: payment.amount.toFixed(2),
        receivedAmount: payment.receivedAmount.toFixed(2),
        changeAmount: payment.changeAmount.toFixed(2),
        terminalReference: payment.terminalReference,
        operatorEmployeeId: payment.operatorEmployeeId,
        createdAt: payment.createdAt.toISOString(),
        cashCustody: command.cashCustody ?? 'drawer',
      });
    }
    const appliedCents = normalized.reduce((sum, tender) => sum + toCents(tender.amount), 0n);
    const dueCents = toCents(command.balanceDue) - appliedCents;
    return {
      payments: rows,
      appliedAmount: formatCents(appliedCents),
      balanceDue: formatCents(dueCents),
    };
  }
}
