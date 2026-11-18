/** Applies the owner-requested October attendance entries to the identified local tenant. */
import { config } from '../apps/api/node_modules/dotenv/lib/main.js';
import { fileURLToPath } from 'node:url';
import { PrismaClient, createPostgresAdapter } from '../packages/database/src/index.js';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('This script requires the local development database.');
}

const merchantId = '7cdceb3f-7483-46c8-a1d0-3b201cb8dbe4';
const monthStart = new Date('2026-10-01T00:00:00.000Z');
const monthEnd = new Date('2026-11-01T00:00:00.000Z');
const actor = 'owner-request-october-2026';
const employeesToRecord = [
  {
    staffMemberId: '0eedb2e8-86c2-44c9-b920-234a12451368',
    displayName: 'أحمد',
    statuses: Array.from({ length: 31 }, (_, index) => index + 1 === 14 ? 'absent' : 'present'),
    reason: 'Owner-requested October 2026 attendance: present all month except October 14 absent.',
  },
  {
    staffMemberId: '3f1cfa27-ce28-443d-8712-6032af40fccd',
    displayName: 'مني',
    statuses: ['present', 'present', 'present', 'present', 'leave', 'leave', 'rest', 'absent'],
    reason: 'Owner-requested October 2026 attendance scenario; first eight days as agreed.',
  },
];
const apply = process.argv.includes('--apply');
const db = new PrismaClient({ adapter: createPostgresAdapter(databaseUrl) });

try {
  await db.$transaction(async (tx) => {
    const merchant = await tx.merchant.findFirst({
      where: { id: merchantId, storefrontSlug: 'reference-restaurant-1' },
      select: { id: true },
    });
    if (!merchant) throw new Error('The expected merchant was not found.');
    const period = await tx.attendancePeriod.findUniqueOrThrow({
      where: { merchantId_monthStart: { merchantId, monthStart } },
    });
    await tx.$queryRaw`SELECT "id" FROM "attendance_periods" WHERE "id"=${period.id}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
    const lockedPeriod = await tx.attendancePeriod.findUniqueOrThrow({ where: { id: period.id } });
    if (lockedPeriod.status !== 'draft') throw new Error('Attendance must still be a draft.');
    for (const { staffMemberId, displayName, statuses, reason } of employeesToRecord) {
      await tx.$queryRaw`SELECT "id" FROM "staff_members" WHERE "id"=${staffMemberId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
      const employee = await tx.staffMember.findFirstOrThrow({
        where: { id: staffMemberId, merchantId, displayName, branchId: 'dbc96a46-1c0e-4dff-b616-1d9b02e82509' },
        select: { displayName: true, startDate: true, endDate: true },
      });
      const existing = await tx.staffAttendance.findMany({
        where: { merchantId, staffMemberId, attendanceDate: { gte: monthStart, lt: monthEnd } },
      });
      // Refuse unexpected data rather than silently overwriting another edit.
      for (const entry of existing) {
        const day = entry.attendanceDate.getUTCDate();
        if (day > statuses.length || entry.status !== statuses[day - 1]) {
          throw new Error('Unexpected existing attendance; no changes were applied.');
        }
      }
      for (const [index, status] of statuses.entries()) {
        const attendanceDate = new Date(Date.UTC(2026, 9, index + 1));
        if (attendanceDate < employee.startDate || (employee.endDate && attendanceDate > employee.endDate)) {
          throw new Error('Requested date is outside employment dates.');
        }
        if (existing.some((entry) => entry.attendanceDate.getTime() === attendanceDate.getTime())) continue;
        if (apply) {
          await tx.staffAttendanceChange.create({ data: {
            merchantId, attendancePeriodId: period.id, staffMemberId, attendanceDate,
            previousStatus: null, newStatus: status,
            reason,
            changedBy: actor,
          } });
          await tx.staffAttendance.create({ data: {
            merchantId, attendancePeriodId: period.id, staffMemberId, attendanceDate,
            status, updatedBy: actor,
          } });
        }
      }
      console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', employee: employee.displayName,
        month: '2026-10', monthStatus: lockedPeriod.status,
        entries: statuses.map((status, index) => ({ date: `2026-10-${String(index + 1).padStart(2, '0')}`, status })),
      }, null, 2));
    }
  });
  if (apply) {
    const employees = await db.staffMember.findMany({
      where: { merchantId, id: { in: employeesToRecord.map((employee) => employee.staffMemberId) } },
      select: { displayName: true, attendance: {
        where: { attendanceDate: { gte: monthStart, lt: monthEnd } },
        select: { attendanceDate: true, status: true }, orderBy: { attendanceDate: 'asc' },
      } },
    });
    console.log(JSON.stringify({ verifiedAttendance: employees.map((employee) => ({
      displayName: employee.displayName,
      present: employee.attendance.filter((entry) => entry.status === 'present').length,
      absent: employee.attendance.filter((entry) => entry.status === 'absent').length,
      leave: employee.attendance.filter((entry) => entry.status === 'leave').length,
      rest: employee.attendance.filter((entry) => entry.status === 'rest').length,
      unrecorded: 31 - employee.attendance.length,
      absentDates: employee.attendance.filter((entry) => entry.status === 'absent')
        .map((entry) => entry.attendanceDate.toISOString().slice(0, 10)),
    })) }, null, 2));
  }
} finally {
  await db.$disconnect();
}
