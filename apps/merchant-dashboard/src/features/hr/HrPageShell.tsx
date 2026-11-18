import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@waffarly/ui';
import './hr.css';

export function HrPageShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById('merchant-page-actions')); }, []);
  return (
    <div className="hr-page" onSubmitCapture={(event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      let invalid = false;
      for (const field of Array.from(form.elements)) {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) continue;
        field.setCustomValidity('');
        if (field.required && !field.value.trim()) {
          field.setCustomValidity(locale === 'ar' ? 'اكتب قيمة صحيحة.' : 'Enter a valid value.');
        }
        if (!field.checkValidity()) invalid = true;
      }
      if (invalid) {
        event.preventDefault();
        event.stopPropagation();
        form.reportValidity();
      }
    }} onInputCapture={(event) => {
      const field = event.target;
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.setCustomValidity('');
    }}>
      <span className="sr-only">{locale === 'ar' ? translateTitle(title) : title}</span>
      {actions && (host ? createPortal(<div className="hr-page-actions">{actions}</div>, host) : <div className="hr-page-actions">{actions}</div>)}
      {children}
    </div>
  );
}

function translateTitle(value: string): string {
  const labels: Record<string, string> = {
    Employees: 'الموظفون',
    Attendance: 'الحضور والانصراف',
    Payroll: 'المرتبات',
    'Staff advances': 'سلف الموظفين',
    Expenses: 'المصروفات',
  };
  return labels[value] ?? value;
}
