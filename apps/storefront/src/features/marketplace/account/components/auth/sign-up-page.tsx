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

export function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useCustomerAuth();
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (password !== confirmation) {
      setError('كلمتا المرور غير متطابقتين. راجع الحقلين وحاول مرة أخرى.');
      return;
    }

    submitting.current = true;
    try {
      await signUp.mutateAsync({ name, email, phone, password });
    } catch {
      // Keep non-password fields available for correction and retry.
    } finally {
      setPassword('');
      setConfirmation('');
      submitting.current = false;
    }
  }

  return (
    <AuthPageShell
      eyebrow="إنشاء حساب"
      title="خلّي تجربتك أسهل"
      description="أنشئ حسابك بالبريد الإلكتروني ورقم الموبايل وكلمة المرور."
    >
      <form className="grid gap-3" onSubmit={submit} aria-busy={signUp.isPending}>
        <fieldset disabled={signUp.isPending} className="m-0 grid min-w-0 gap-3 border-0 p-0">
          <AuthInput
            autoComplete="name"
            maxLength={120}
            label="الاسم بالكامل"
            onChange={(event) => {
              setName(event.target.value);
              signUp.reset();
            }}
            placeholder="اكتب اسمك"
            required
            type="text"
            value={name}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <AuthInput
              autoComplete="email"
              maxLength={254}
              label="البريد الإلكتروني"
              onChange={(event) => {
                setEmail(event.target.value);
                signUp.reset();
              }}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
            <AuthInput
              autoComplete="tel"
              inputMode="tel"
              label="رقم الهاتف"
              maxLength={32}
              onChange={(event) => {
                setPhone(normalizeAuthDigits(event.target.value));
                signUp.reset();
              }}
              placeholder="01xxxxxxxxx"
              required
              type="tel"
              value={phone}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AuthInput
              autoComplete="new-password"
              label="كلمة المرور"
              action={
                <PasswordVisibilityButton
                  visible={passwordVisible}
                  onToggle={() => setPasswordVisible((value) => !value)}
                />
              }
              minLength={8}
              maxLength={128}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
                signUp.reset();
              }}
              placeholder="8 أحرف على الأقل"
              required
              type={passwordVisible ? 'text' : 'password'}
              value={password}
            />
            <AuthInput
              autoComplete="new-password"
              label="تأكيد كلمة المرور"
              minLength={8}
              maxLength={128}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError('');
                signUp.reset();
              }}
              placeholder="أعد كتابة كلمة المرور"
              required
              type={passwordVisible ? 'text' : 'password'}
              value={confirmation}
            />
          </div>
          <p className="m-0 text-[12px] leading-5 text-muted-foreground">كلمة المرور من 8 إلى 128 حرفًا. استخدم كلمة يصعب تخمينها.</p>
          {(error || signUp.isError) && (
            <p
              className="m-0 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-800"
              role="alert"
            >
              {error || customerAuthError(signUp.error)}
            </p>
          )}
          <MarketplaceButton
            type="submit"
            disabled={signUp.isPending}
            className="min-h-11 w-full rounded-xl bg-waffarly-gold px-5 text-sm font-medium text-primary transition-colors hover:bg-[#ffd353]"
          >
            {signUp.isPending ? 'جارٍ إنشاء الحساب…' : 'إنشاء حساب'}
          </MarketplaceButton>
          <p className="m-0 text-center text-[11px] leading-5 text-muted-foreground">
            سيتم إنشاء حساب فعلي. تأكيد البريد والموبايل واستعادة كلمة المرور غير متاحين حاليًا.
          </p>
        </fieldset>
      </form>
      <p className="mb-0 mt-4 border-t border-border pt-3 text-center text-sm text-muted-foreground">
        عندك حساب؟{' '}
        <Link
          href="/account/sign-in"
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          سجّل الدخول
        </Link>
      </p>
    </AuthPageShell>
  );
}
