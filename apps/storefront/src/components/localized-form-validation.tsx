'use client';

import { useEffect } from 'react';
import { useLocale } from '@waffarly/ui';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isFormControl(target: EventTarget | null): target is FormControl {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function validationMessage(control: FormControl, locale: 'ar' | 'en'): string | null {
  const { validity } = control;
  const ar = locale === 'ar';
  if (validity.valueMissing)
    return ar ? 'املأ هذا الحقل قبل المتابعة.' : 'Fill in this field before continuing.';
  if (
    (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) &&
    validity.tooShort
  ) {
    return ar
      ? `اكتب ${control.minLength} أحرف على الأقل.`
      : `Enter at least ${control.minLength} characters.`;
  }
  if (
    (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) &&
    validity.tooLong
  ) {
    return ar
      ? `اكتب ${control.maxLength} أحرف بحد أقصى.`
      : `Enter no more than ${control.maxLength} characters.`;
  }
  if (validity.typeMismatch)
    return ar ? 'أدخل قيمة بصيغة صحيحة.' : 'Enter a value in the correct format.';
  if (validity.patternMismatch)
    return ar ? 'راجع صيغة هذا الحقل.' : 'Check the format of this field.';
  if (control instanceof HTMLInputElement && validity.rangeUnderflow)
    return ar ? `القيمة لازم تكون ${control.min} أو أكبر.` : `Enter ${control.min} or more.`;
  if (control instanceof HTMLInputElement && validity.rangeOverflow)
    return ar ? `القيمة لازم تكون ${control.max} أو أقل.` : `Enter ${control.max} or less.`;
  if (validity.stepMismatch || validity.badInput)
    return ar ? 'أدخل رقماً صحيحاً.' : 'Enter a valid number.';
  return null;
}

export function LocalizedFormValidation() {
  const { locale } = useLocale();

  useEffect(() => {
    const localizedControls = new Set<FormControl>();

    function onInvalid(event: Event) {
      if (!isFormControl(event.target) || event.target.validity.customError) return;
      const message = validationMessage(event.target, locale);
      if (message) {
        event.target.setCustomValidity(message);
        localizedControls.add(event.target);
      }
    }

    function onInput(event: Event) {
      if (isFormControl(event.target) && localizedControls.has(event.target)) {
        event.target.setCustomValidity('');
        localizedControls.delete(event.target);
      }
    }

    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onInput, true);
      for (const control of localizedControls) control.setCustomValidity('');
    };
  }, [locale]);

  return null;
}
