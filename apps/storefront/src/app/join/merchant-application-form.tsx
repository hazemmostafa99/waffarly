'use client';

import { useState, type FormEvent } from 'react';
import type { SubmitMerchantApplicationRequest } from '@waffarly/contracts';
import { ApiError, apiPost } from '../../lib/api-client';

const EMPTY_APPLICATION: SubmitMerchantApplicationRequest = {
  name: '',
  contactPhone: '',
  ownerName: '',
  ownerMobile: '',
};

const FIELDS: ReadonlyArray<{
  key: keyof SubmitMerchantApplicationRequest;
  label: string;
  autocomplete: string;
}> = [
  { key: 'name', label: 'Restaurant name', autocomplete: 'organization' },
  { key: 'contactPhone', label: 'Restaurant contact number', autocomplete: 'tel' },
  { key: 'ownerName', label: 'Owner name', autocomplete: 'name' },
  { key: 'ownerMobile', label: 'Owner mobile number', autocomplete: 'tel' },
];

export function MerchantApplicationForm() {
  const [application, setApplication] = useState(EMPTY_APPLICATION);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await apiPost<{ received: true }>('/merchant-applications', application);
      setHasSubmitted(true);
      setApplication(EMPTY_APPLICATION);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'We could not send your application. Try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasSubmitted) {
    return (
      <div className="join-success" role="status">
        <h2>Your application has been received</h2>
        <p>Our Super Admin team will review the information you shared.</p>
        <p>
          Your owner account will be set up only after approval. You cannot access the Merchant
          Dashboard before then.
        </p>
      </div>
    );
  }

  return (
    <form className="join-form" onSubmit={(event) => void submit(event)}>
      {FIELDS.map(({ key, label, autocomplete }) => (
        <label key={key}>
          {label}
          <input
            autoComplete={autocomplete}
            maxLength={key.endsWith('Phone') || key.endsWith('Mobile') ? 32 : 160}
            minLength={key.endsWith('Phone') || key.endsWith('Mobile') ? 3 : 1}
            onChange={(event) =>
              setApplication((current) => ({ ...current, [key]: event.target.value }))
            }
            required
            type={key.endsWith('Phone') || key.endsWith('Mobile') ? 'tel' : 'text'}
            value={application[key]}
          />
        </label>
      ))}
      {error && (
        <p className="join-error" role="alert">
          {error}
        </p>
      )}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Sending application…' : 'Submit application'}
      </button>
      <p className="join-note">
        Applying does not create an account or grant dashboard access. Your owner account is set up
        after approval.
      </p>
    </form>
  );
}
