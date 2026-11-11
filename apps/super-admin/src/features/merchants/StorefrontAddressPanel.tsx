import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isStorefrontHandle, type MerchantSummary } from '@waffarly/contracts';
import { Button, Card, useLocale } from '@waffarly/ui';
import { apiRequest } from '../../lib/api-client.js';
import { storefrontUrl } from '../../lib/storefront-url.js';
import { adminQueryKeys } from '../../app/query-keys.js';
import { StorefrontHandleField } from './StorefrontHandleField.js';

export function StorefrontAddressPanel({ merchant }: { merchant: MerchantSummary }) {
  const { locale, errorText } = useLocale();
  const ar = locale === 'ar';
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [copy, setCopy] = useState('');
  const handle = merchant.storefrontHandle ?? saved;
  const url = handle ? storefrontUrl(handle) : null;
  const save = useMutation({
    mutationFn: (value: string) =>
      apiRequest<MerchantSummary>(`/admin/merchants/${merchant.id}/storefront-handle`, {
        method: 'PUT',
        body: JSON.stringify({ handle: value }),
      }),
    onSuccess: (result) => {
      setSaved(result.storefrontHandle ?? null);
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.merchants });
    },
  });
  return (
    <Card className="admin-panel grid admin-stack xl:col-span-2">
      <h2 className="m-0 text-sm font-bold">
        {ar ? 'عنوان المتجر المباشر' : 'Direct storefront address'}
      </h2>
      <p className="m-0 text-xs text-waffarly-muted">
        {ar
          ? 'اسم رابط مستقل عن كود النشاط المستخدم في نقاط البيع. حفظ الاسم لا يغيّر الكود.'
          : 'The public address is separate from the POS business code. Saving it does not change that code.'}
      </p>
      {handle ? (
        <div className="grid gap-3">
          <p dir={ar ? 'rtl' : 'ltr'} className="m-0 break-all text-start text-sm">
            <bdi dir="ltr">{url ?? handle}</bdi>
          </p>
          <p className="m-0 text-xs text-waffarly-muted">
            {ar
              ? 'العنوان محفوظ. تغيير الاسم غير متاح حاليًا.'
              : 'Address saved. Renaming is not currently available.'}
          </p>
          {url && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={url} target="_blank" rel="noreferrer">
                  {ar ? 'فتح المتجر' : 'Open storefront'}
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopy(ar ? 'تم نسخ الرابط' : 'Link copied');
                  } catch {
                    setCopy(
                      ar
                        ? 'تعذر النسخ؛ يمكنك تحديد الرابط ونسخه.'
                        : 'Could not copy. Select the link to copy it.',
                    );
                  }
                }}
              >
                {ar ? 'نسخ الرابط' : 'Copy link'}
              </Button>
            </div>
          )}
          {copy && (
            <p role="status" className="m-0 text-xs">
              {copy}
            </p>
          )}
        </div>
      ) : (
        <form
          className="grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending && isStorefrontHandle(draft)) save.mutate(draft);
          }}
        >
          <StorefrontHandleField
            value={draft}
            onChange={(value) => {
              setDraft(value);
              save.reset();
            }}
            disabled={save.isPending}
          />
          <p className="m-0 text-xs text-waffarly-muted">
            {ar
              ? 'المعاينة لا تعني أن الاسم متاح؛ يتم تأكيد الحجز عند الحفظ.'
              : 'The preview does not reserve the name. Availability is confirmed when saving.'}
          </p>
          <Button type="submit" disabled={save.isPending || !isStorefrontHandle(draft)}>
            {save.isPending
              ? ar
                ? 'جارٍ الحفظ…'
                : 'Saving…'
              : ar
                ? 'حفظ عنوان المتجر'
                : 'Save storefront address'}
          </Button>
          {save.isError && (
            <p role="alert" className="m-0 text-sm text-waffarly-danger">
              {errorText(save.error.message)}
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
