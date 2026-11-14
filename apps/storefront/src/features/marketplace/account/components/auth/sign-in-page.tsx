'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useCustomerAuth } from '@/features/marketplace/account/hooks/use-customer-auth';
import { customerAuthError } from '@/features/account/data/customer-auth-api';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import {
  AuthInput,
  normalizeAuthDigits,
  PasswordVisibilityButton,
} from '@/features/marketplace/account/components/auth/auth-input';
import { AuthPageShell } from '@/features/marketplace/account/components/auth/auth-page-shell';

export function SignInPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { signIn } = useCustomerAuth();
  const submitting = useRef(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    try {
      await signIn.mutateAsync({ identifier, password });
    } catch {
      // Render the translated error below; keep the identifier for retry.
    } finally {
      setPassword('');
      submitting.current = false;
    }
  }

  return (
    <AuthPageShell
      eyebrow="تسجيل الدخول"
      title="أهلاً بعودتك"
      description="ادخل لحسابك بالبريد الإلكتروني أو رقم الموبايل وكلمة المرور."
    >
      <form className="grid gap-3" onSubmit={submit} aria-busy={signIn.isPending}>
        <AuthInput
          autoComplete="username"
          label="البريد الإلكتروني أو رقم الهاتف"
          onChange={(event) => {
            setIdentifier(normalizeAuthDigits(event.target.value));
            signIn.reset();
          }}
          placeholder="اكتب بريدك أو رقم هاتفك"
          required
          disabled={signIn.isPending}
          maxLength={254}
          type="text"
          value={identifier}
        />
        <AuthInput
          autoComplete="current-password"
          label="كلمة المرور"
          action={
            <PasswordVisibilityButton
              visible={passwordVisible}
              onToggle={() => setPasswordVisible((value) => !value)}
            />
          }
          minLength={1}
          maxLength={128}
          disabled={signIn.isPending}
          onChange={(event) => {
            setPassword(event.target.value);
            signIn.reset();
          }}
          placeholder="اكتب كلمة المرور"
          required
          type={passwordVisible ? 'text' : 'password'}
          value={password}
        />
        <div className="flex justify-start">
          <button
            type="button"
            className="text-xs font-bold text-accent underline-offset-4 hover:underline"
            aria-expanded={forgotPasswordMessage}
            onClick={() => setForgotPasswordMessage((value) => !value)}
          >
            نسيت كلمة المرور؟
          </button>
        </div>
        {forgotPasswordMessage && (
          <p
            className="m-0 rounded-xl bg-secondary px-3.5 py-3 text-xs leading-5 text-primary"
            role="status"
          >
            استعادة كلمة المرور غير متاحة حاليًا. خدمة إرسال رسائل الاستعادة لم تُفعّل بعد.
          </p>
        )}
        <MarketplaceButton
          type="submit"
          disabled={signIn.isPending}
          className="min-h-11 w-full rounded-xl bg-waffarly-gold px-5 text-sm font-medium text-primary transition-colors hover:bg-[#ffd353]"
        >
          {signIn.isPending ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
        </MarketplaceButton>
        {signIn.isError && (
          <p
            className="m-0 rounded-xl border border-border bg-secondary/60 px-3.5 py-3 text-xs leading-5 text-primary"
            role="alert"
          >
            {customerAuthError(signIn.error)}
          </p>
        )}
      </form>
      <p className="mb-0 mt-4 border-t border-border pt-3 text-center text-sm text-muted-foreground">
        معندكش حساب؟{' '}
        <Link
          href="/account/sign-up"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          أنشئ حساب جديد
        </Link>
      </p>
    </AuthPageShell>
  );
}
