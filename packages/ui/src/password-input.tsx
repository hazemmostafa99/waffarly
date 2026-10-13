'use client';
import { useState, type ComponentProps } from 'react';
import { Input } from './input.js';
import { Button } from './button.js';
import { useLocale } from './i18n.js';
import { cn } from './utils.js';

export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const { t } = useLocale();
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        dir="ltr"
        className={cn('pe-24', className)}
      />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="absolute inset-y-1 end-1 h-9 px-2"
        aria-label={t(visible ? 'Hide password' : 'Show password')}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {t(visible ? 'Hide' : 'Show')}
      </Button>
    </div>
  );
}
