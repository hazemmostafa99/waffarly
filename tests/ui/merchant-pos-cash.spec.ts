import { expect, test } from '@playwright/test';

const merchantId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const shiftId = '33333333-3333-4333-8333-333333333333';
const safeId = '44444444-4444-4444-8444-444444444444';
const transferId = '55555555-5555-4555-8555-555555555555';
const drawer = {
  id: shiftId,
  branchId,
  branchName: 'Central branch',
  registerId: 'register',
  registerName: 'Front drawer',
  cashierName: 'Amira Hassan',
  status: 'closed',
  openedAt: '2026-10-27T07:00:00Z',
  closedAt: '2026-10-27T15:00:00Z',
  expectedCash: '3500.00',
  countedCash: '3500.00',
  variance: '0.00',
  remainingCash: '500.00',
  pendingAmount: '3000.00',
  receivedInSafe: '0.00',
  carriedForward: '0.00',
  legacyDropAmount: '0.00',
};
const safe = {
  id: safeId,
  branchId,
  branchName: 'Central branch',
  name: 'Main safe',
  balance: '1000.00',
  pendingAmount: '3000.00',
};
const transfer = {
  id: transferId,
  sourceShiftId: shiftId,
  registerName: 'Front drawer',
  branchId,
  destinationName: 'Main safe',
  kind: 'safe',
  amount: '3000.00',
  receivedAmount: null,
  difference: null,
  status: 'pending',
  reference: 'BAG-1042',
  reason: 'End of shift',
  createdBy: 'pos:cashier',
  createdByName: 'Amira Hassan',
  createdAt: '2026-10-27T15:05:00Z',
  receivedBy: null,
  receivedAt: null,
  receiptNote: null,
  resolutionNote: null,
  resolvedBy: null,
};

for (const locale of ['en', 'ar']) {
  test(`owner follows custody and receives a safe handoff (${locale})`, async ({
    page,
  }, testInfo) => {
    const label = (en: string, ar: string) => (locale === 'ar' ? ar : en);
    let received = false;
    let submitted: Record<string, unknown> | null = null;
    await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
    await page.route('**/auth/owner/me', (route) =>
      route.fulfill({
        json: {
          username: 'owner',
          merchantId,
          merchantName: 'Restaurant',
          activity: 'restaurant',
          ownerName: 'Owner',
          ownerMobile: '01000000000',
          contactPhone: '01000000000',
          firstMonthActivatedAt: '2026-10-01T00:00:00Z',
        },
      }),
    );
    await page.route('**/owner/inventory/branches**', (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith(branchId)
          ? { id: branchId, name: 'Central branch' }
          : { items: [{ id: branchId, name: 'Central branch' }], nextCursor: null },
      }),
    );
    await page.route('**/owner/pos/cash/**', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'POST') {
        submitted = route.request().postDataJSON() as Record<string, unknown>;
        received = true;
        return route.fulfill({
          json: { ...transfer, status: 'received', receivedAmount: '3000.00' },
        });
      }
      const items = url.pathname.endsWith('/drawers')
        ? [drawer]
        : url.pathname.endsWith('/safes')
          ? [
              {
                ...safe,
                balance: received ? '4000.00' : '1000.00',
                pendingAmount: received ? '0.00' : '3000.00',
              },
            ]
          : url.pathname.endsWith('/transfers')
            ? [
                {
                  ...transfer,
                  status: received ? 'received' : 'pending',
                  receivedAmount: received ? '3000.00' : null,
                  receivedByName: received ? 'Owner' : null,
                },
              ]
            : [
                {
                  id: 'ledger-row',
                  kind: 'receipt',
                  amount: '3000.00',
                  balanceAfter: '4000.00',
                  reason: 'BAG-1042',
                  createdBy: 'Owner',
                  createdAt: '2026-10-27T15:10:00Z',
                  transferId,
                },
              ];
      return route.fulfill({ json: { items, nextCursor: null } });
    });
    await page.goto('/pos-cash');
    await expect(
      page.getByRole('heading', {
        name: label('Cash drawers & safes', 'النقدية والخزنة'),
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('Amira Hassan', { exact: false })).toBeVisible();
    await expect(
      page.getByText(label('Remaining custody', 'المتبقي بالعهدة'), { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.cash-drawer-meta')).toContainText(label('Cashier', 'الكاشير'));
    await expect(page.locator('.cash-drawer-meta')).toContainText(
      label('Closed at', 'وقت التقفيل'),
    );
    await page.screenshot({
      path: testInfo.outputPath(`cash-drawers-${locale}.png`),
      fullPage: true,
    });
    await page
      .getByRole('button', {
        name: label('Transfers & receipts', 'التوريدات والاستلام'),
        exact: true,
      })
      .click();
    await expect(page.getByText('BAG-1042', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: label('Count & receive', 'عدّ واستلام التوريد'), exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel(label('Physically received (EGP)', 'المبلغ المستلم فعليًا (جنيه)'))
      .fill('3000.00');
    await dialog.getByRole('button', { name: label('Confirm', 'تأكيد'), exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(submitted).toMatchObject({ receivedAmount: '3000.00', note: '' });
    await expect(
      page.locator('.cash-status').getByText(label('Received', 'تم الاستلام'), { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: label('Safes', 'الخزن'), exact: true }).click();
    await expect(
      page.getByText(label('Confirmed safe balance', 'رصيد الخزنة المؤكد')),
    ).toBeVisible();
    await expect(page.locator('.cash-primary strong')).toContainText('4,000');
    await page.screenshot({
      path: testInfo.outputPath(`cash-safes-${locale}.png`),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: label('Movement statement', 'كشف الحركة'), exact: true })
      .click();
    await expect(page.getByRole('dialog').getByText('BAG-1042')).toBeVisible();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('columnheader', { name: label('Balance after', 'الرصيد بعدها') }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: label('Close', 'إغلاق'), exact: true })
      .click();
    await page
      .getByRole('button', { name: label('Create safe', 'إضافة خزنة'), exact: true })
      .click();
    const createDialog = page.getByRole('dialog');
    await expect(
      createDialog.getByRole('button', { name: label('Create safe', 'إضافة خزنة'), exact: true }),
    ).toBeDisabled();
    await createDialog
      .getByRole('combobox', { name: label('Branch', 'الفرع'), exact: true })
      .click();
    await createDialog.getByRole('option', { name: 'Central branch', exact: true }).click();
    await createDialog
      .getByLabel(label('Safe name', 'اسم الخزنة'), { exact: true })
      .fill('Branch cash safe');
    await page.screenshot({
      path: testInfo.outputPath(`cash-create-safe-${locale}.png`),
      fullPage: true,
    });
    await createDialog
      .getByRole('button', { name: label('Create safe', 'إضافة خزنة'), exact: true })
      .click();
    await expect(createDialog).not.toBeVisible();
    expect(submitted).toMatchObject({ branchId, name: 'Branch cash safe', openingBalance: '0.00' });
  });

  test(`closed-shift handoff keeps the exact request after a lost response (${locale})`, async ({
    page,
  }) => {
    const label = (en: string, ar: string) => (locale === 'ar' ? ar : en);
    const commands: unknown[] = [];
    await page.addInitScript((value) => localStorage.setItem('waffarly-locale', value), locale);
    await page.route('**/auth/owner/me', (route) =>
      route.fulfill({
        json: {
          username: 'owner',
          merchantId,
          merchantName: 'Restaurant',
          activity: 'restaurant',
          ownerName: 'Owner',
          ownerMobile: '01000000000',
          contactPhone: '01000000000',
          firstMonthActivatedAt: '2026-10-01T00:00:00Z',
        },
      }),
    );
    await page.route('**/owner/inventory/branches**', (route) =>
      route.fulfill({ json: { items: [], nextCursor: null } }),
    );
    await page.route('**/owner/pos/cash/**', (route) => {
      if (route.request().method() === 'POST') {
        commands.push(route.request().postDataJSON());
        return commands.length === 1 ? route.abort('failed') : route.fulfill({ json: transfer });
      }
      return route.fulfill({
        json: {
          items: route.request().url().includes('/drawers') ? [drawer] : [safe],
          nextCursor: null,
        },
      });
    });
    await page.goto('/pos-cash');
    await page
      .getByRole('button', { name: label('Transfer to safe', 'توريد للخزنة'), exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: label('Receiving safe', 'الخزنة المستلمة') })
      .click();
    await dialog.getByRole('option', { name: 'Main safe', exact: true }).click();
    await dialog
      .getByLabel(label('Handoff / bag reference', 'مرجع التسليم / الكيس'))
      .fill('BAG-NEW');
    await dialog.getByLabel(label('Reason', 'السبب'), { exact: true }).fill('Remaining custody');
    await dialog.getByRole('button', { name: label('Confirm', 'تأكيد'), exact: true }).click();
    await expect.poll(() => commands.length).toBe(1);
    await page.reload();
    await page
      .getByRole('button', {
        name: label('Retry saved request', 'إعادة إرسال الطلب المحفوظ'),
        exact: true,
      })
      .click();
    await expect.poll(() => commands.length).toBe(2);
    expect(commands[0]).toEqual(commands[1]);
    expect(commands[0]).toMatchObject({ amount: '500.00', safeId, reference: 'BAG-NEW' });
    await expect(page.getByText(label('Cash record saved.', 'تم تسجيل الحركة.'))).toBeVisible();
  });
}
