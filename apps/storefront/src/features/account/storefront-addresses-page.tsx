'use client';

import { useRef, useState, type FormEvent } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { Button, Input, Textarea, useLocale } from '@waffarly/ui';
import { accountCopy } from './account-copy';
import { AccountPreviewShell } from './account-preview-shell';

export function StorefrontAddressesPreviewPage() {
  const { locale } = useLocale();
  const t = accountCopy(locale);
  const formRef = useRef<HTMLFormElement>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  function closeForm() {
    formRef.current?.reset();
    setIsFormOpen(false);
    setFeedback('');
  }

  function previewAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.currentTarget.reset();
    setFeedback(t.addressCleared);
  }

  return (
    <AccountPreviewShell active="addresses" title={t.addresses} description={t.addressesIntro}>
      <section className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-store-cream text-store-primary">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
              {t.noAddressesTitle}
            </h2>
          </div>
          {!isFormOpen && (
            <Button
              className="min-h-11 bg-store-primary text-white hover:bg-store-primary-dark"
              onClick={() => {
                setFeedback('');
                setIsFormOpen(true);
              }}
              type="button"
            >
              <Plus className="me-2 size-4" aria-hidden="true" />
              {t.addAddress}
            </Button>
          )}
        </div>

        <p className="max-w-2xl text-storefront-support leading-5 text-store-secondary">
          {t.noAddressesDescription}
        </p>

        {isFormOpen && (
          <form
            className="grid gap-4 rounded-2xl border border-store-border bg-store-page p-4 sm:p-5"
            onSubmit={previewAddress}
            ref={formRef}
          >
            <p className="rounded-xl border border-store-gold/40 bg-store-cream px-4 py-3 text-storefront-support leading-5 text-store-secondary">
              {t.addressFieldsNotice}
            </p>
            <label
              className="grid gap-1.5 text-storefront-support font-bold text-store-ink"
              htmlFor="preview-address-street"
            >
              {t.street}
              <Input
                autoComplete="off"
                className="h-11 rounded-xl border-store-border bg-white text-start"
                id="preview-address-street"
                name="previewAddressStreet"
              />
            </label>
            <label
              className="grid gap-1.5 text-storefront-support font-bold text-store-ink"
              htmlFor="preview-address-area"
            >
              {t.area}
              <Input
                autoComplete="off"
                className="h-11 rounded-xl border-store-border bg-white text-start"
                id="preview-address-area"
                name="previewAddressArea"
              />
            </label>
            <label
              className="grid gap-1.5 text-storefront-support font-bold text-store-ink"
              htmlFor="preview-address-notes"
            >
              <span>
                {t.addressNotes}{' '}
                <span className="font-normal text-store-muted">({t.optional})</span>
              </span>
              <Textarea
                autoComplete="off"
                className="min-h-24 rounded-xl border-store-border bg-white text-start"
                id="preview-address-notes"
                name="previewAddressNotes"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button className="min-h-11" onClick={closeForm} type="button" variant="outline">
                <X className="me-2 size-4" aria-hidden="true" />
                {t.closeForm}
              </Button>
              <Button
                className="min-h-11 bg-store-primary text-white hover:bg-store-primary-dark"
                type="submit"
              >
                {t.reviewAddress}
              </Button>
            </div>
            {feedback && (
              <p
                aria-live="polite"
                className="rounded-xl bg-store-info px-4 py-3 text-storefront-support text-store-primary-deep"
                role="status"
              >
                {feedback}
              </p>
            )}
          </form>
        )}
      </section>
    </AccountPreviewShell>
  );
}
