import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, Input, cn } from '@waffarly/ui';
import { Icon } from './Icons.js';

type SectionProps = {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

function Section({ number, title, description, children, className }: SectionProps) {
  return (
    <Card
      className={cn(
        'min-w-0 rounded-[18px] border-[#e3ebed] bg-white p-4 shadow-[0_10px_30px_rgba(43,72,82,0.06)] sm:p-5',
        className,
      )}
    >
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e2f7ee] text-[11px] font-bold text-[#13745a]">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="m-0 text-[18px] font-extrabold tracking-[-0.03em] text-[#152541]">
              {title}
            </h2>
            <p className="m-0 text-[11px] font-medium text-[#99a7b8]">{description}</p>
          </div>
        </div>
      </header>
      {children}
    </Card>
  );
}

function Glyph({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('grid place-items-center [&_.merchant-icon]:size-5', className)}>
      <Icon name={name} />
    </span>
  );
}

const buttonTokens = [
  {
    name: 'Primary',
    label: 'زر أساسي',
    className: 'bg-[#0d6b50] text-white hover:bg-[#095a43]',
  },
  {
    name: 'Secondary',
    label: 'زر ثانوي',
    className: 'border border-[#bfe9d7] bg-[#eafaf2] text-[#167456] hover:bg-[#dff5e9]',
  },
  {
    name: 'Ghost',
    label: 'زر خفيف',
    className: 'border border-[#e5ecef] bg-white text-[#344a68] hover:bg-[#f5f8f9]',
  },
  {
    name: 'Accent',
    label: 'زر معزز',
    className: 'bg-[#f7b93f] text-[#7d4f03] hover:bg-[#efad2d]',
  },
  {
    name: 'Danger',
    label: 'زر خطر',
    className: 'bg-[#d84f59] text-white hover:bg-[#c9414b]',
  },
] as const;

const statusTokens = [
  { label: 'تم التسليم', name: 'نجاح', hex: '#0EA77A', variant: 'success' },
  { label: 'جاري التحضير', name: 'تحذير', hex: '#F0B24A', variant: 'warning' },
  { label: 'تم الإلغاء', name: 'خطأ', hex: '#D54850', variant: 'destructive' },
  { label: 'قيد التوصيل', name: 'معلومات', hex: '#2168C8', variant: 'info' },
] as const;

const sidebarItems = [
  { label: 'المنتجات', icon: 'box' },
  { label: 'الطلبات', icon: 'calendar' },
  { label: 'العملاء', icon: 'customers' },
] as const;

function FieldShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-11 items-center gap-2 rounded-xl border border-[#e2eaee] bg-white px-3 shadow-[0_2px_7px_rgba(32,59,70,0.02)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DesignSystem() {
  const [activeSidebarItem, setActiveSidebarItem] = useState('المنتجات');
  const [selectedButton, setSelectedButton] = useState('Primary');

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#eef3f4] px-3 py-4 text-[#152541] [font-family:Tahoma,'Segoe_UI',Arial,sans-serif] sm:px-5 sm:py-6"
    >
      <div className="mx-auto max-w-[1280px]">
        <section className="mb-3 rounded-[18px] border border-[#e3ebed] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(43,72,82,0.06)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between border-b border-[#eef2f4] pb-3 sm:border-b-0 sm:border-l sm:pb-0 sm:pl-6">
              <div>
                <p className="m-0 text-[11px] font-medium text-[#8b9bad]">النص الثانوي</p>
                <p className="m-1 text-[15px] font-bold text-[#213453]">مقارنة بالأسبوع الماضي</p>
              </div>
              <span className="text-[11px] text-[#8b9bad]">14 / Regular</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="m-0 text-[11px] font-medium text-[#8b9bad]">النص الصغير</p>
                <p className="m-1 text-[13px] font-bold text-[#213453]">تم التسليم</p>
              </div>
              <span className="text-[11px] text-[#8b9bad]">12 / Regular</span>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.08fr)]">
          <div className="grid min-w-0 gap-3">
            <Section number="07" title="عنصر القائمة الجانبية" description="أنماط عناصر القائمة الجانبية">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_100px] lg:items-start">
                <div className="rounded-xl border border-[#e5ecef] bg-[#fbfcfc] p-2">
                  {sidebarItems.map((item) => {
                    const isActive = activeSidebarItem === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveSidebarItem(item.label)}
                        className={cn(
                          'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-right text-[13px] font-bold transition-colors',
                          isActive
                            ? 'bg-[#e3f9ef] text-[#167456]'
                            : 'text-[#304461] hover:bg-[#f2f6f7]',
                        )}
                      >
                        <Glyph name={item.icon} className="[&_.merchant-icon]:size-[19px]" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-4 py-1 text-[11px] text-[#8b9bad] lg:pt-2">
                  <span>العنصر النشط</span>
                  <span>عنصر غير نشط</span>
                  <span>عنصر غير نشط</span>
                </div>
              </div>
            </Section>

            <Section number="09" title="المسافات و زوايا الحواف" description="قيم المسافات وزوايا النظام">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e7edef] p-3">
                  <h3 className="m-0 text-[12px] font-bold text-[#2a3d59]">(Radius) زوايا الحواف</h3>
                  <div className="mt-4 flex items-end justify-between gap-2 text-center text-[10px] font-bold text-[#5f7187]">
                    {[8, 12, 16, 24].map((radius) => (
                      <div key={radius} className="grid justify-items-center gap-1">
                        <span
                          className="size-6 bg-[#c6f1d9]"
                          style={{ borderRadius: `${radius / 2}px` }}
                        />
                        <span>{radius}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-[#e7edef] p-3">
                  <h3 className="m-0 text-[12px] font-bold text-[#2a3d59]">(Spacing) المسافات</h3>
                  <div className="mt-4 flex items-end justify-between gap-2 text-center text-[10px] font-bold text-[#5f7187]">
                    {[8, 12, 16, 24].map((spacing) => (
                      <div key={spacing} className="grid justify-items-center gap-1">
                        <span
                          className="bg-[#c6f1d9]"
                          style={{ width: `${Math.max(spacing, 8)}px`, height: `${Math.max(spacing, 8)}px` }}
                        />
                        <span>{spacing}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <div className="grid min-w-0 gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Section number="03" title="الأزرار" description="أنماط الأزرار المستخدمة في النظام">
                <div className="grid grid-cols-5 gap-2">
                  {buttonTokens.map((button) => {
                    const isSelected = selectedButton === button.name;
                    return (
                      <div
                        key={button.name}
                        className={cn(
                          'flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-1 text-center transition-transform hover:-translate-y-0.5',
                          isSelected && 'ring-2 ring-[#7ab79d] ring-offset-2',
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedButton(button.name)}
                          className={cn(
                            'h-auto w-full min-w-0 flex-col gap-2 rounded-lg p-1 text-[10px] font-bold sm:px-2 sm:text-[11px]',
                          )}
                        >
                          <span className={cn('flex h-10 w-full items-center justify-center rounded-lg px-1 text-[10px] font-bold sm:px-2 sm:text-[11px]', button.className)}>
                            {button.label}
                          </span>
                          <span className="text-[10px] font-bold text-[#304461]">{button.name}</span>
                          <span className="whitespace-nowrap text-[9px] font-normal text-[#8b9bad]">
                            {button.name === 'Primary' ? 'للإجراءات الأساسية' : 'للإجراءات الثانوية'}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section number="04" title="حقل الإدخال" description="نماذج حقول الإدخال والبحث">
                <div className="grid gap-2">
                  <label className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2 text-[11px] font-bold text-[#8190a3]">
                    <span>حقل بحث</span>
                    <FieldShell>
                      <Glyph name="search" className="text-[#35516f] [&_.merchant-icon]:size-4" />
                      <Input
                        aria-label="البحث عن المنتجات، الطلبات، العملاء"
                        placeholder="البحث عن المنتجات، الطلبات، العملاء..."
                        className="h-9 border-0 bg-transparent px-0 text-[11px] shadow-none focus-visible:ring-0"
                      />
                    </FieldShell>
                  </label>
                  <label className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2 text-[11px] font-bold text-[#8190a3]">
                    <span>قائمة منسدلة</span>
                    <FieldShell>
                      <span className="text-[#365170]">⌄</span>
                      <span className="flex-1 text-[11px] font-normal text-[#8d9bac]">اختر الفرع</span>
                    </FieldShell>
                  </label>
                  <label className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2 text-[11px] font-bold text-[#8190a3]">
                    <span>حقل تاريخ</span>
                    <FieldShell>
                      <Glyph name="calendar" className="text-[#35516f] [&_.merchant-icon]:size-4" />
                      <span className="flex-1 text-[11px] font-normal text-[#8d9bac]">dd / mm / yyyy</span>
                    </FieldShell>
                  </label>
                </div>
              </Section>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Section number="05" title="حالات الحالة (Badges)" description="شارات الحالات المختلفة">
                <div className="grid grid-cols-2 gap-2">
                  {statusTokens.map((status) => (
                    <div key={status.name} className="rounded-xl border border-[#edf1f2] bg-[#fcfdfd] p-2">
                      <Badge variant={status.variant as 'success' | 'warning' | 'destructive' | 'info'} className="w-full rounded-lg text-[11px]">
                        <i className="size-1.5 rounded-full bg-current" />
                        {status.label}
                      </Badge>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-[#465d76]">{status.name}</span>
                        <span className="text-[#8e9dad]">{status.hex}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section number="06" title="بطاقة KPI" description="نموذج بطاقة إحصائية">
                <div className="relative flex min-h-[112px] items-center justify-between overflow-hidden rounded-xl bg-[#e0f8ed] px-3 py-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#09815d] shadow-[0_3px_10px_rgba(12,110,78,0.08)]">
                    <Glyph name="revenue" className="[&_.merchant-icon]:size-6" />
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] font-medium text-[#819688]">إجمالي المبيعات</span>
                    <strong className="mt-1 block text-[18px] font-extrabold tracking-[-0.03em] text-[#19344b]" dir="ltr">
                      EGP 24,320.50
                    </strong>
                    <span className="mt-1 block text-[10px] font-bold text-[#0a9a68]" dir="ltr">
                      ↑ 28%
                    </span>
                    <small className="block text-[9px] text-[#819688]">مقارنة بالأسبوع الماضي</small>
                  </div>
                </div>
              </Section>
            </div>

            <Section number="08" title="صف الجدول" description="مثال صف في جدول البيانات">
              <div className="overflow-x-auto rounded-xl border border-[#edf1f2]">
                <div className="min-w-[650px] text-[11px]">
                  <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_0.9fr_48px] items-center gap-2 bg-[#f4f8f8] px-3 py-2 text-[#8796a7]">
                    <span>المنتج</span>
                    <span>التصنيف</span>
                    <span>السعر</span>
                    <span>الحالة</span>
                    <span>المخزون</span>
                    <span>إجراءات</span>
                  </div>
                  <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_0.9fr_48px] items-center gap-2 px-3 py-2.5 text-[#3f5870]">
                    <div className="flex items-center gap-2 font-bold text-[#1c3852]">
                      <span className="grid size-8 place-items-center rounded-lg bg-[#fff4d8] text-base">🍔</span>
                      <span>
                        <strong className="block">برجر سبيشال</strong>
                        <small className="block text-[9px] font-normal text-[#91a0ae]" dir="ltr">SKU: BRG-001</small>
                      </span>
                    </div>
                    <span>برجر</span>
                    <span dir="ltr">EGP 165.00</span>
                    <span className="w-fit rounded-full bg-[#e4f8ec] px-2.5 py-1 text-[10px] font-bold text-[#0b986a]">منشور</span>
                    <span>45</span>
                    <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg border-[#e4eaed] bg-white text-[#466078]">
                      <Glyph name="more" className="[&_.merchant-icon]:size-4" />
                      <span className="sr-only">إجراءات المنتج</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
