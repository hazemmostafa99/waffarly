import type { ReactNode } from 'react';
import { useLocale } from '@waffarly/ui';
import './hr.css';

export function HrPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  return (
    <div className="hr-page">
      <header className="hr-workspace-toolbar">
        <div className="hr-workspace-heading">
          <h1>{locale === 'ar' ? translateTitle(title) : title}</h1>
          <p>{locale === 'ar' ? translateDescription(description) : description}</p>
        </div>
        {actions && <div className="hr-page-actions">{actions}</div>}
      </header>
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

function translateDescription(value: string): string {
  const labels: Record<string, string> = {
    'Manage employee records, branch assignments and pay rates.':
      'تابع بيانات الموظفين وفروعهم ومعدلات أجورهم.',
    'Record daily attendance for all branches, then approve the month when it is complete.':
      'سجّل الحضور اليومي لكل الفروع، وبعد انتهاء الشهر راجعه واعتمده.',
    'Keep branch expenses, receipts and cash payments together.':
      'تابع مصروفات الفروع وإيصالاتها والدفعات المصروفة عليها.',

    'Review approved attendance, prepare payroll and track salary payments.':
      'راجع الحضور المعتمد، وجهّز المرتبات وتابع صرفها.',
    'Record staff advances and follow their monthly payroll installments.':
      'سجّل سلف الموظفين وتابع أقساطها الشهرية من المرتبات.',
  };
  return labels[value] ?? value;
}
