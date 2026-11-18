'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Input } from '@waffarly/ui';
import { Eye, EyeOff } from 'lucide-react';

export function normalizeAuthDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
  );
}

type AuthInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'autoComplete'
  | 'disabled'
  | 'inputMode'
  | 'maxLength'
  | 'minLength'
  | 'onChange'
  | 'placeholder'
  | 'required'
  | 'type'
  | 'value'
> & {
  label: string;
  action?: ReactNode;
};

export function AuthInput({ label, action, ...props }: AuthInputProps) {
  const id = useId();

  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-primary">
          {label}
        </label>
      </div>
      <div className="relative">
        <Input
          {...props}
          id={id}
          dir="ltr"
          className={`h-11 w-full rounded-xl border-border bg-white px-3 text-left text-[14px] text-primary shadow-none placeholder:text-left placeholder:text-[12px] placeholder:text-muted-foreground focus-visible:ring-accent ${action ? 'pr-11' : ''}`}
        />
        {action && <span className="absolute inset-y-0 right-1 flex items-center">{action}</span>}
      </div>
    </div>
  );
}

export function PasswordVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-lg text-accent hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      aria-pressed={visible}
      aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      onClick={onToggle}
    >
      {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
    </button>
  );
}
