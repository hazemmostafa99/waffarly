import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, ...props }: ButtonProps) {
  const classes = ['waffarly-button', className].filter(Boolean).join(' ');
  return <button className={classes} {...props} />;
}
