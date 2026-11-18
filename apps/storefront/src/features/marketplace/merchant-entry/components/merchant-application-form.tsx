'use client';

import {
  BUSINESS_ACTIVITY_KEYS,
  BUSINESS_ACTIVITY_LABELS,
  type BusinessActivityKey,
} from '@waffarly/contracts';
import Link from 'next/link';
import { ArrowLeft, CircleCheck, Phone } from 'lucide-react';
import { useLocale } from '@waffarly/ui';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceInput as Input } from '@/components/marketplace/marketplace-form-controls';
import { submitMerchantApplication } from '../data/merchant-application-api';
import { ApiError } from '@/lib/api-client';
import { useRef, useState, type FormEvent } from 'react';

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

export function MerchantApplicationForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { t, locale } = useLocale();
  const [application, setApplication] = useState(EMPTY_APPLICATION);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState('');
  const isArabic = locale === 'ar';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await submitMerchantApplication({
        ...application,
        name: application.name.trim(),
        contactPhone: application.contactPhone.trim(),
        ownerName: application.ownerName.trim(),
        ownerMobile: application.ownerMobile.trim(),
      });
      setSubmittedPhone(application.ownerMobile.trim());
      setHasSubmitted(true);
      onSubmitted?.();
      setApplication(EMPTY_APPLICATION);
    } catch (failure) {
      setError(
        isArabic
          ? failure instanceof ApiError && failure.statusCode === 400
            ? 'راجع البيانات وأرقام التواصل وحاول مرة أخرى.'
            : 'تعذر تأكيد استلام الطلب. تحقق مع فريق وفّرلي قبل إعادة الإرسال لتجنب تكراره.'
          : 'We could not confirm receipt. Check with Waffarly before resubmitting to avoid a duplicate.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (hasSubmitted) {
    return (
      <section
        aria-labelledby="application-success"
        className="mx-auto grid max-w-[480px] justify-items-center gap-3 px-2 py-4 text-center"
        role="status"
      >
        <span
          className="grid size-14 place-items-center rounded-full bg-success/10 text-success"
          aria-hidden="true"
        >
          <CircleCheck size={30} strokeWidth={1.7} />
        </span>
        <div>
          <h2 id="application-success" className="m-0 text-[22px] font-bold leading-9 text-primary">
            {isArabic ? 'وصلنا طلب انضمامك' : 'We received your application'}
          </h2>
          <p className="mb-0 mt-1 text-[13px] leading-6 text-muted-foreground">
            {isArabic
              ? 'فريق وفّرلي هيراجع بيانات نشاطك ويتواصل معاك.'
              : 'The Waffarly team will review your business details and contact you.'}
          </p>
        </div>
        <div className="mt-1 w-full rounded-2xl border border-border bg-[var(--purple-50)] p-4 text-start">
          <div className="flex items-center gap-2 text-[13px] font-medium text-primary">
            <Phone size={16} aria-hidden="true" />
            {isArabic ? 'التواصل على رقم المالك' : 'Owner contact number'}
          </div>
          <bdi
            dir="ltr"
            className="mt-2 block select-all text-left text-[18px] font-medium text-primary"
          >
            {submittedPhone}
          </bdi>
          <p className="mb-0 mt-2 text-[12px] leading-6 text-muted-foreground">
            {isArabic
              ? 'هنتواصل معاك باتصال أو عبر واتساب على الرقم ده بعد مراجعة الطلب.'
              : 'We will contact you by phone or WhatsApp on this number after reviewing your application.'}
          </p>
        </div>
        <p className="m-0 text-[12px] leading-6 text-muted-foreground">
          {isArabic
            ? 'طلبك قيد المراجعة، ومش محتاج تبعته تاني.'
            : 'Your application is under review. No need to submit it again.'}
        </p>
        <Link
          href="/"
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-waffarly-gold px-6 py-2 text-[14px] font-medium text-primary no-underline hover:bg-[#ffd353]"
        >
          {isArabic ? 'العودة للسوق' : 'Back to marketplace'}
          <ArrowLeft size={16} className={isArabic ? '' : 'rotate-180'} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <form className="grid gap-3" onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending} className="m-0 grid min-w-0 gap-3 border-0 p-0">
        <label className="grid gap-1.5 text-[13px] font-medium text-primary">
          {t('Business activity')}
          <select
            aria-label={t('Business activity')}
            value={application.activity}
            className="h-11 w-full rounded-xl border border-border bg-white px-3 text-primary outline-none focus:border-accent"
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

        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ key, label, autocomplete }) => {
            const isPhone = key.endsWith('Phone') || key.endsWith('Mobile');
            return (
              <label key={key} className="grid gap-1.5 text-[13px] font-medium text-primary">
                {t(label)}
                <Input
                  autoComplete={autocomplete}
                  className="h-11 rounded-lg border border-border bg-white px-3 py-2 text-[14px] text-primary placeholder:text-muted-foreground"
                  dir={isPhone ? 'ltr' : 'auto'}
                  inputMode={isPhone ? 'tel' : undefined}
                  maxLength={isPhone ? 32 : 160}
                  minLength={isPhone ? 3 : 1}
                  onChange={(event) =>
                    setApplication((current) => ({
                      ...current,
                      [key]: isPhone
                        ? event.target.value.replace(/[٠-٩۰-۹]/g, (digit) =>
                            String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
                          )
                        : event.target.value,
                    }))
                  }
                  required
                  type={isPhone ? 'tel' : 'text'}
                  value={application[key]}
                />
              </label>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="m-0 rounded-lg bg-red-50 p-3 text-[12px] leading-6 text-destructive"
          >
            {error}
          </p>
        )}
        <div className="grid gap-2 border-t border-border pt-3">
          <Button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-waffarly-gold px-5 font-medium text-primary hover:bg-[#ffd353] sm:w-auto sm:min-w-48"
          >
            {pending ? (isArabic ? 'جارٍ الإرسال…' : 'Submitting…') : t('Submit application')}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
