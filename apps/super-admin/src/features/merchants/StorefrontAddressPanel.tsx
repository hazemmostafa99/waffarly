import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatPosSignInName,
  isStorefrontHandle,
  type MerchantSummary,
} from '@waffarly/contracts';
import { Button, Card, useLocale } from '@waffarly/ui';
import { apiRequest } from '../../lib/api-client.js';
import { storefrontUrl } from '../../lib/storefront-url.js';
import { adminQueryKeys } from '../../app/query-keys.js';
import { StorefrontHandleField } from './StorefrontHandleField.js';

/** Shows a merchant's subdomain and lets Super Admin change it after a clear warning. */
export function StorefrontAddressPanel({ merchant }: { merchant: MerchantSummary }) {
  const { locale, errorText } = useLocale();
  const ar = locale === 'ar';
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<string | null>(null);
  const handle = saved ?? merchant.storefrontHandle;
  const [draft, setDraft] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [copy, setCopy] = useState('');
  const url = storefrontUrl(handle);
  const changing = isStorefrontHandle(draft) && draft !== handle;
  const save = useMutation({
    mutationFn: (value: string) =>
      apiRequest<MerchantSummary>(`/admin/merchants/${merchant.id}/storefront-handle`, {
        method: 'PUT',
        body: JSON.stringify({ handle: value }),
      }),
    onSuccess: (result) => {
      setSaved(result.storefrontHandle);
      setDraft('');
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.merchants });
    },
  });
  return (
    <Card className="admin-panel grid admin-stack xl:col-span-2">
      <h2 className="m-0 text-sm font-bold">
        {ar ? 'السب دومين وعنوان المتجر' : 'Subdomain and storefront address'}
      </h2>
      <p className="m-0 text-xs text-waffarly-muted">
        {ar
          ? 'الكاشير يدخل نقاط البيع باسم السب دومين ثم نقطة ثم اسم المستخدم.'
          : 'Cashiers sign in to POS with the subdomain, a dot, then their username.'}
      </p>
      <div className="grid gap-3">
        <p dir={ar ? 'rtl' : 'ltr'} className="m-0 break-all text-start text-sm">
          <bdi dir="ltr">{url ?? handle}</bdi>
        </p>
        <p className="m-0 text-xs text-waffarly-muted">
          {ar ? 'مثال لدخول الكاشير: ' : 'Example cashier sign-in: '}
          <bdi dir="ltr" className="font-mono">
            {formatPosSignInName(handle, 'ali')}
          </bdi>
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
      <form
        className="grid max-w-xl gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!save.isPending && changing && confirmed) save.mutate(draft);
        }}
      >
        <StorefrontHandleField
          id="storefront-handle-change"
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setConfirmed(false);
            save.reset();
          }}
          disabled={save.isPending}
        />
        {changing && (
          <div role="alert" className="grid gap-2 rounded-xl border border-waffarly-danger p-3 text-xs">
            <strong>{ar ? 'تحذير: تغيير السب دومين' : 'Warning: changing the subdomain'}</strong>
            <p className="m-0 leading-5">
              {ar
                ? 'كل أسماء دخول الكاشير على نقاط البيع هتتغير، مثلًا '
                : 'Every POS cashier sign-in name changes, for example '}
              <bdi dir="ltr" className="font-mono">
                {formatPosSignInName(handle, 'ali')}
              </bdi>
              {ar ? ' هيبقى ' : ' becomes '}
              <bdi dir="ltr" className="font-mono">
                {formatPosSignInName(draft, 'ali')}
              </bdi>
              {ar
                ? '. الرابط القديم للمتجر هيبطل يشتغل. لازم تبلّغ التاجر والكاشيرية.'
                : '. The old storefront link stops working. Tell the merchant and the cashiers.'}
            </p>
            <label className="inline-flex items-center gap-2 whitespace-nowrap">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {ar ? 'فاهم، غيّر السب دومين' : 'I understand, change the subdomain'}
            </label>
          </div>
        )}
        <Button type="submit" disabled={save.isPending || !changing || !confirmed}>
          {save.isPending
            ? ar
              ? 'جارٍ الحفظ…'
              : 'Saving…'
            : ar
              ? 'تغيير السب دومين'
              : 'Change subdomain'}
        </Button>
        {save.isError && (
          <p role="alert" className="m-0 text-sm text-waffarly-danger">
            {errorText(save.error.message)}
          </p>
        )}
      </form>
    </Card>
  );
}
