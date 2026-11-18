import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addAmounts,
  calculateBasePay,
  minAmount,
  subtractAmount,
} from '../../src/modules/payroll/payroll.rules.js';

const monthStart = new Date('2026-04-01T00:00:00.000Z');
const monthEnd = new Date('2026-04-30T00:00:00.000Z');

function attendance(date: string, status: string) {
  return { staffMemberId: 'staff-1', attendanceDate: date, status };
}

function staff(
  basis: 'monthly' | 'daily',
  amount: string,
  startDate = '2026-04-01',
  effectiveDate = '2026-04-01',
) {
  return {
    id: 'staff-1',
    displayName: 'Test employee',
    startDate,
    endDate: null,
    branch: { name: 'Main branch' },
    payRates: [{ effectiveDate, basis, amount }],
  };
}

describe('payroll calculation rules', () => {
  it('prorates monthly pay from the employee start date', () => {
    const result = calculateBasePay(
      staff('monthly', '3000.00', '2026-04-16'),
      monthStart,
      monthEnd,
      [attendance('2026-04-16', 'present'), attendance('2026-04-18', 'present')],
    );

    assert.equal(result.basePay, '1500.00');
    assert.equal(result.presentDays, 2);
    assert.equal(result.payBasis, 'monthly');
  });

  it('pays daily rates only for present attendance dates', () => {
    const result = calculateBasePay(staff('daily', '125.50'), monthStart, monthEnd, [
      attendance('2026-04-02', 'present'),
      attendance('2026-04-03', 'absent'),
      attendance('2026-04-04', 'present'),
    ]);

    assert.equal(result.basePay, '251.00');
    assert.equal(result.presentDays, 2);
  });

  it('uses effective dated rates and keeps decimal arithmetic exact', () => {
    const result = calculateBasePay(
      {
        ...staff('daily', '100.00'),
        payRates: [
          { effectiveDate: '2026-04-01', basis: 'daily' as const, amount: '100.00' },
          { effectiveDate: '2026-04-15', basis: 'daily' as const, amount: '150.00' },
        ],
      },
      monthStart,
      monthEnd,
      [attendance('2026-04-14', 'present'), attendance('2026-04-15', 'present')],
    );

    assert.equal(result.basePay, '250.00');
    assert.equal(addAmounts('0.10', '0.20'), '0.30');
    assert.equal(subtractAmount('1.00', '1.25'), '0.00');
    assert.equal(minAmount('10.00', '3.25', '5.00'), '3.25');
  });
});
