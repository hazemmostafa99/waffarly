'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import {
  AuthInput,
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
  const [message, setMessage] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('كلمتا المرور غير متطابقتين. راجع الحقلين وحاول مرة أخرى.');
      return;
    }

    setMessage('تم التحقق من الحقول محليًا. إنشاء الحساب الفعلي غير متصل في هذه الواجهة.');
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmation('');
  }

  return (
    <AuthPageShell
      eyebrow="إنشاء حساب"
      title="خلّي تجربتك أسهل"
      description="أنشئ حسابك عشان تجمع طلباتك ومفضلاتك في مكان واحد."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <AuthInput
          autoComplete="name"
          label="الاسم بالكامل"
          onChange={(event) => {
            setName(event.target.value);
            setMessage('');
          }}
          placeholder="اكتب اسمك"
          required
          type="text"
          value={name}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthInput
            autoComplete="email"
            label="البريد الإلكتروني"
            onChange={(event) => {
              setEmail(event.target.value);
              setMessage('');
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
              setPhone(event.target.value);
              setMessage('');
            }}
            placeholder="01xxxxxxxxx"
            required
            type="tel"
            value={phone}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
              setMessage('');
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
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError('');
              setMessage('');
            }}
            placeholder="أعد كتابة كلمة المرور"
            required
            type={passwordVisible ? 'text' : 'password'}
            value={confirmation}
          />
        </div>
        {error && (
          <p
            className="m-0 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}
        <MarketplaceButton
          type="submit"
          className="min-h-12 w-full rounded-xl bg-waffarly-gold px-5 text-sm font-black text-primary transition-colors hover:bg-[#ffd353]"
        >
          إنشاء حساب
        </MarketplaceButton>
        {message && (
          <p
            className="m-0 rounded-xl border border-border bg-secondary/60 px-3.5 py-3 text-xs leading-5 text-primary"
            role="status"
          >
            {message}
          </p>
        )}
        <p className="m-0 text-center text-[11px] leading-5 text-muted-foreground">
          هذه واجهة تجريبية. بياناتك لا تُرسل أو تُحفظ، وكلمة المرور تُمسح بعد الإرسال.
        </p>
      </form>
      <p className="mb-0 mt-5 border-t border-border pt-4 text-center text-sm text-muted-foreground">
        عندك حساب؟{' '}
        <Link
          href="/marketplace/account/sign-in"
          className="font-extrabold text-accent underline-offset-4 hover:underline"
        >
          سجّل الدخول
        </Link>
      </p>
    </AuthPageShell>
  );
}
