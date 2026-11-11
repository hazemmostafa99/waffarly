'use client';

import {
  BUSINESS_ACTIVITY_KEYS,
  BUSINESS_ACTIVITY_LABELS,
  type BusinessActivityKey,
} from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { useState, type FormEvent } from 'react';

type MerchantApplication = {
  name: string;
  activity: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
};

const EMPTY_APPLICATION: MerchantApplication = {
  name: '',
  activity: 'restaurant',
  contactPhone: '',
  ownerName: '',
  ownerMobile: '',
};

const FIELDS: ReadonlyArray<{
  key: keyof MerchantApplication;
  label: string;
  autocomplete: string;
}> = [
  { key: 'name', label: 'Business name', autocomplete: 'organization' },
  { key: 'contactPhone', label: 'Business contact number', autocomplete: 'tel' },
  { key: 'ownerName', label: 'Owner name', autocomplete: 'name' },
  { key: 'ownerMobile', label: 'Owner mobile number', autocomplete: 'tel' },
];

export function MerchantApplicationForm() {
  const { t, locale } = useLocale();
  const [application, setApplication] = useState(EMPTY_APPLICATION);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isArabic = locale === 'ar';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setApplication(EMPTY_APPLICATION);
  }

  if (hasSubmitted) {
    return (
      <div className="grid gap-3 rounded-2xl border border-[rgba(22,132,91,0.2)] bg-[rgba(22,132,91,0.06)] p-5" role="status">
        <div className="grid size-12 place-items-center rounded-full bg-success text-xl font-black text-white" aria-hidden="true">✓</div>
        <h3 className="m-0 text-xl font-black text-primary">
          {isArabic ? 'تم استكمال الطلب التجريبي' : 'Demo application complete'}
        </h3>
        <p className="m-0 text-sm leading-6 text-muted-foreground">
          {isArabic ? 'تم التحقق من البيانات داخل المتصفح فقط.' : 'Your information was checked in this browser only.'}
        </p>
        <p className="m-0 text-sm font-bold text-accent">
          {isArabic ? 'لم يتم إرسال البيانات أو حفظها، وربط الإرسال بالـBackend مؤجل.' : 'Nothing was sent or saved. Backend submission is deferred.'}
        </p>
        <Button
          type="button"
          className="mt-2 min-h-11 justify-self-start rounded-xl border border-border bg-white px-4 font-bold text-primary hover:bg-secondary"
          onClick={() => setHasSubmitted(false)}
        >
          {isArabic ? 'إرسال طلب تجريبي آخر' : 'Start another demo application'}
        </Button>
      </div>
    );
  }

  return (
    <form className="grid gap-3.5 sm:gap-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-bold text-primary">
        {t('Business activity')}
        <select
          aria-label={t('Business activity')}
          value={application.activity}
          className="min-h-12 w-full rounded-xl border border-border bg-white px-3 text-primary outline-none focus:border-accent"
          onChange={(event) =>
            setApplication((current) => ({
              ...current,
              activity: event.target.value as BusinessActivityKey,
            }))
          }
        >
          {BUSINESS_ACTIVITY_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(BUSINESS_ACTIVITY_LABELS[key])}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
        {FIELDS.map(({ key, label, autocomplete }) => {
          const isPhone = key.endsWith('Phone') || key.endsWith('Mobile');
          return (
            <label key={key} className="grid gap-2 text-sm font-bold text-primary">
              {t(label)}
              <Input
                autoComplete={autocomplete}
                className="min-h-11 rounded-lg border-border bg-white px-3 text-sm text-primary placeholder:text-muted-foreground"
                inputMode={isPhone ? 'tel' : undefined}
                maxLength={isPhone ? 32 : 160}
                minLength={isPhone ? 3 : 1}
                onChange={(event) =>
                  setApplication((current) => ({ ...current, [key]: event.target.value }))
                }
                required
                type={isPhone ? 'tel' : 'text'}
                value={application[key]}
              />
            </label>
          );
        })}
      </div>

      <div className="grid gap-2.5 border-t border-border pt-4">
        <Button type="submit" className="min-h-11 w-full rounded-lg bg-waffarly-gold px-5 font-black text-primary hover:bg-[#ffd353] sm:w-auto sm:min-w-48">
          {t('Submit application')}
        </Button>
        <p className="m-0 text-xs leading-6 text-muted-foreground">
          {isArabic
            ? 'للتجربة فقط: لن يتم إرسال بياناتك أو حفظها، ولن يتم إنشاء حساب تاجر.'
            : 'Demo only: your information will not be sent or saved, and no seller account will be created.'}
        </p>
      </div>
    </form>
  );
}
