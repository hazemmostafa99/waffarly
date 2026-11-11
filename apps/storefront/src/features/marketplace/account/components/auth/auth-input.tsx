'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Input } from '@waffarly/ui';

type AuthInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'autoComplete'
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
    <div className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold text-primary">
          {label}
        </label>
        {action}
      </div>
      <Input
        {...props}
        id={id}
        className="min-h-11 rounded-xl border-border bg-white px-3.5 text-sm text-primary placeholder:text-muted-foreground focus-visible:ring-accent"
      />
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
      className="rounded-md px-1 py-0.5 text-xs font-bold text-accent hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      aria-pressed={visible}
      onClick={onToggle}
    >
      {visible ? 'إخفاء' : 'إظهار'}
    </button>
  );
}
