import { test, expect, type Page } from '@playwright/test';

const merchant = {
  id: 'demo',
  name: 'Nile Kitchen',
  ownerName: 'Mariam',
  contactPhone: '0212345678',
  ownerMobile: '01012345678',
  username: 'mariam',
  firstMonthActivatedAt: '2026-10-12T10:00:00Z',
};
const template = {
  id: 'garden',
  key: 'garden',
  name: 'Garden',
  description: '',
  layout: 'menu',
  accentColor: '#315b43',
  status: 'available',
  activity: 'general',
  revision: 1,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
  updatedBy: 'admin',
};

async function mockApi(
  page: Page,
  signedIn = true,
  initialTemplates: Array<Record<string, unknown>> = [template],
) {
  let templates = initialTemplates;
  await page.route('**/*', async (route) => {
    if (route.request().isNavigationRequest()) return route.continue();
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/admin/templates' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(templates),
      });
    }
    if (path.startsWith('/admin/templates/') && method === 'PATCH') {
      const templateId = path.slice(path.lastIndexOf('/') + 1);
      const body = route.request().postDataJSON() as Record<string, unknown>;
      let saved: Record<string, unknown> | undefined;
      templates = templates.map((current) => {
        if (current.id !== templateId) return current;
        saved = {
          ...current,
          ...body,
          revision: Number(current.revision) + 1,
          updatedBy: 'admin',
        };
        return saved;
      });
      if (!saved) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Template not found.' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(saved),
      });
    }
    const responses: Record<string, unknown> = {
      '/auth/admin/me': { username: 'admin' },
      '/auth/owner/me': {
        username: 'mariam',
        merchantName: merchant.name,
        ownerName: merchant.ownerName,
        ownerMobile: merchant.ownerMobile,
        contactPhone: merchant.contactPhone,
      },
      '/admin/merchants': [merchant],
      '/admin/merchant-applications': [],
      '/admin/plans': [
        {
          id: 'plan',
          name: 'Starter',
          monthlyPrice: '200.00',
          currency: 'EGP',
          description: '',
          updatedAt: '2026-10-12T10:00:00Z',
          revision: 1,
        },
      ],
      '/admin/activities-modules': { activities: [], modules: [] },
      '/owner/catalog/media': [],
      '/owner/catalog/categories': [],
      '/owner/catalog/products': [],
      '/auth/owner/storefront': {
        templateId: 'garden',
        accentColor: '#315b43',
        logoData: null,
        revision: 1,
        templates: [template],
      },
      '/merchant-applications': { received: true },
    };
    if (path.endsWith('/login') || (!signedIn && path.endsWith('/me')))
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials.' }),
      });
    if (path in responses)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responses[path]),
      });
    return route.continue();
  });
}

async function assertFits(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('storefront and application preserve Arabic after navigation and reload', async ({ page }) => {
  await mockApi(page);
  await page.goto('http://127.0.0.1:3100');
  await expect(
    page.getByRole('heading', { name: 'A better home for your business.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'بداية أفضل لمتجرك.' })).toBeVisible();
  await assertFits(page);
  await page.getByRole('link', { name: 'قدّم طلب انضمام متجرك' }).click();
  await expect(page.getByRole('heading', { name: 'انضم إلى وفّرلي' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.getByLabel('نوع النشاط', { exact: true }).selectOption('clothing');
  await page.getByLabel('اسم المتجر', { exact: true }).fill('متجر النيل');
  await page.getByLabel('رقم التواصل مع المتجر', { exact: true }).fill('0212345678');
  await page.getByLabel('اسم المالك', { exact: true }).fill('مريم');
  await page.getByLabel('رقم هاتف المالك', { exact: true }).fill('01012345678');
  await page.getByRole('button', { name: 'تغيير اللغة' }).click();
  await expect(page.getByLabel('Business activity', { exact: true })).toHaveValue('clothing');
  await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('متجر النيل');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your application has been received' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.getByRole('heading', { name: 'تم استلام طلبك' })).toBeVisible();
  await assertFits(page);
});

test('admin translates every section, formats prices, and searches businesses', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('http://127.0.0.1:5273');
  await expect(page.getByRole('heading', { name: 'Nile Kitchen' })).toBeVisible();
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByLabel('البحث في المتاجر').fill('missing');
  await expect(page.getByText('لا توجد متاجر تطابق البحث.')).toBeVisible();
  await page.getByLabel('البحث في المتاجر').fill('Nile');
  await expect(page.getByRole('heading', { name: 'Nile Kitchen' })).toBeVisible();
  await assertFits(page);
  await page.getByRole('link', { name: 'مكتبة التصاميم واجهات المتاجر' }).click();
  await expect(page.getByRole('heading', { name: 'مكتبة التصاميم', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'اختيارات مميزة. كل يوم.' })).toBeVisible();
  await assertFits(page);
  await page.getByRole('link', { name: 'الباقات العروض الشهرية' }).click();
  await expect(page.getByRole('heading', { name: 'الباقات الشهرية', exact: true })).toHaveCount(2);
  await expect(page.locator('.plan-price')).toContainText('٢٠٠');
  await assertFits(page);
  await page.getByRole('link', { name: 'الأنشطة والوحدات الإمكانات' }).click();
  await expect(page.getByRole('heading', { name: 'الأنشطة والإمكانات' })).toBeVisible();
  await assertFits(page);
});

test('admin template details deep link supports revisioned edits and availability changes', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('http://127.0.0.1:5273/templates/garden');

  await expect(page.locator('h1')).toHaveText('Garden');
  await expect(page.getByRole('heading', { name: 'Merchant eligibility' })).toBeVisible();
  await expect(
    page.getByText('Only available designs are offered for new merchant selections.'),
  ).toBeVisible();
  await assertFits(page);

  await page.getByRole('button', { name: 'Edit design' }).click();
  await page.getByLabel('Display name').fill('Garden Updated');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('h1')).toHaveText('Garden Updated');
  await expect(page.getByRole('status')).toContainText('Garden Updated updated.');

  await page.getByRole('button', { name: 'Move to drafts' }).click();
  await expect(page.getByRole('status')).toContainText('Garden Updated moved to drafts.');
  await expect(page.getByRole('button', { name: 'Make available' })).toBeVisible();
  await assertFits(page);

  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'ملاءمة المتاجر' })).toBeVisible();
  await assertFits(page);
});

test('admin template details shows a recoverable state for an unknown template', async ({
  page,
}) => {
  await mockApi(page, true, []);
  await page.goto('http://127.0.0.1:5273/templates/missing');

  await expect(
    page.getByRole('heading', { name: 'This template is no longer in the library.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Garden' })).toHaveCount(0);
  await assertFits(page);
});

test('merchant dashboard translates contact details and design previews', async ({
  page,
}, testInfo) => {
  await mockApi(page);
  await page.goto('http://127.0.0.1:5274/settings');
  await expect(page.getByRole('heading', { name: 'Nile Kitchen' })).toBeVisible();
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.getByRole('heading', { name: 'بيانات التواصل' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تصميم واجهة المتجر' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حفظ التصميم' })).toBeVisible();
  await assertFits(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.screenshot({ path: testInfo.outputPath('merchant-arabic.png'), fullPage: true });
});

test('Arabic application review preserves the draft and translates rejection confirmation', async ({
  page,
}) => {
  await mockApi(page);
  await page.route('**/admin/merchant-applications', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          ...merchant,
          id: 'application',
          createdAt: '2026-10-12T10:00:00Z',
          approvedAt: null,
          rejectedAt: null,
          priorRejectedApplications: [
            {
              ...merchant,
              id: 'previous',
              createdAt: '2026-10-10T10:00:00Z',
              rejectedAt: '2026-10-11T10:00:00Z',
              rejectedBy: 'admin',
              rejectionReason: 'Contact details need updating',
            },
          ],
        },
      ]),
    }),
  );
  await page.goto('http://127.0.0.1:5273');
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByText('طلبات مرفوضة سابقة (1)', { exact: true }).click();
  await expect(page.getByText('Contact details need updating')).toBeVisible();
  await page.getByLabel('سبب الرفض مطلوب').fill('بيانات التواصل غير مكتملة');
  let confirmation = '';
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'رفض الطلب نهائيًا' }).click();
  expect(confirmation).toBe('هل تريد رفض طلب Nile Kitchen نهائيًا؟');
  await expect(page.getByLabel('سبب الرفض مطلوب')).toHaveValue('بيانات التواصل غير مكتملة');
  await assertFits(page);
});

for (const [name, port] of [
  ['admin', 5273],
  ['merchant', 5274],
] as const) {
  test(`${name} login translates errors and preserves credentials when switching language`, async ({
    page,
  }) => {
    await mockApi(page, false);
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByLabel('Username', { exact: true }).fill('mariam');
    await page.getByLabel('Password', { exact: true }).fill('example-password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid credentials.');
    await page.getByRole('button', { name: 'Change language' }).click();
    await expect(page.getByRole('alert')).toHaveText('اسم المستخدم أو كلمة المرور غير صحيحة.');
    await expect(page.getByLabel('اسم المستخدم', { exact: true })).toHaveValue('mariam');
    await page.getByRole('button', { name: 'إخفاء كلمة المرور' }).click();
    await expect(page.getByLabel('كلمة المرور', { exact: true })).toHaveAttribute(
      'type',
      'password',
    );
    await assertFits(page);
  });
}

test('POS supports Arabic and shares language preference with other platforms', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5275');
  await expect(page.getByRole('heading', { name: 'POS Workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Change language' }).click();
  await expect(page.getByRole('heading', { name: 'نقطة البيع', exact: true })).toBeVisible();
  await assertFits(page);
  await mockApi(page, false);
  await page.goto('http://127.0.0.1:5274');
  await expect(page.getByRole('heading', { name: 'لوحة إدارة المتجر' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
