'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import {
  AuthInput,
  PasswordVisibilityButton,
} from '@/features/marketplace/account/components/auth/auth-input';
import { AuthPageShell } from '@/features/marketplace/account/components/auth/auth-page-shell';

export function SignInPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('تم التحقق من الحقول محليًا. تسجيل الدخول الفعلي غير متصل في هذه الواجهة.');
    setIdentifier('');
    setPassword('');
  }

  return (
    <AuthPageShell
      eyebrow="تسجيل الدخول"
      title="أهلاً بعودتك"
      description="سجّل دخولك لمتابعة طلباتك والمنتجات اللي حفظتها."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <AuthInput
          autoComplete="username"
          label="البريد الإلكتروني أو رقم الهاتف"
          onChange={(event) => {
            setIdentifier(event.target.value);
            setMessage('');
          }}
          placeholder="اكتب بريدك أو رقم هاتفك"
          required
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
          minLength={6}
          onChange={(event) => {
            setPassword(event.target.value);
            setMessage('');
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
            استعادة كلمة المرور ستتوفر بعد ربط خدمة الحسابات.
          </p>
        )}
        <MarketplaceButton
          type="submit"
          className="min-h-12 w-full rounded-xl bg-waffarly-gold px-5 text-sm font-black text-primary transition-colors hover:bg-[#ffd353]"
        >
          تسجيل الدخول
        </MarketplaceButton>
        {message && (
          <p
            className="m-0 rounded-xl border border-border bg-secondary/60 px-3.5 py-3 text-xs leading-5 text-primary"
            role="status"
          >
            {message}
          </p>
        )}
      </form>
      <p className="mb-0 mt-5 border-t border-border pt-4 text-center text-sm text-muted-foreground">
        معندكش حساب؟{' '}
        <Link
          href="/account/sign-up"
          className="font-extrabold text-accent underline-offset-4 hover:underline"
        >
          أنشئ حساب جديد
        </Link>
      </p>
    </AuthPageShell>
  );
}
