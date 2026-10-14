import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, Input, cn } from '@waffarly/ui';
import { Icon } from './Icons.js';

const colorTokens = [
  { name: 'Cream', value: '#FFF8F0', color: 'bg-waffarly-cream' },
  { name: 'Muted Gold', value: '#DBA13D', color: 'bg-waffarly-gold-muted' },
  { name: 'Gold', value: '#F5B544', color: 'bg-waffarly-gold' },
  { name: 'Deep Green', value: '#063D31', color: 'bg-waffarly-primary-deep' },
  { name: 'Primary Dark', value: '#0A5645', color: 'bg-waffarly-primary-dark' },
  { name: 'Primary Green', value: '#0F705A', color: 'bg-waffarly-primary' },
  { name: 'Border', value: '#EAE6DE', color: 'bg-waffarly-border' },
  { name: 'Muted Text', value: '#8A93A6', color: 'bg-waffarly-muted' },
  { name: 'Body Text', value: '#5C667A', color: 'bg-store-secondary' },
  { name: 'Heading', value: '#172330', color: 'bg-waffarly-ink' },
  { name: 'Surface', value: '#FFFFFF', color: 'bg-waffarly-surface' },
  { name: 'Background', value: '#FAF8F4', color: 'bg-waffarly-background' },
  { name: 'Error', value: '#FCE7E7', color: 'bg-waffarly-danger-bg' },
  { name: 'Info', value: '#EAF3FF', color: 'bg-waffarly-info-bg' },
  { name: 'Success', value: '#DDF5E8', color: 'bg-waffarly-success-bg' },
] as const;

const buttonExamples = [
  { label: 'Outline Button', variant: 'outline' },
  { label: 'Accent Button', variant: 'accent' },
  { label: 'Primary Button', variant: 'default' },
] as const;

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('min-w-0 rounded-card border-border bg-waffarly-surface p-5 shadow-card sm:p-6', className)}>
      <h2 className="m-0 mb-6 font-heading text-2xl font-extrabold leading-tight text-waffarly-ink sm:text-3xl">
        {title}
      </h2>
      {children}
    </Card>
  );
}

export function DesignSystem() {
  const [selectedButton, setSelectedButton] = useState('Primary Button');

  return (
    <main dir="rtl" className="min-h-screen bg-waffarly-background px-4 py-8 text-waffarly-ink sm:px-8">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 sm:gap-10">
        <section aria-labelledby="color-tokens-heading">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h1 id="color-tokens-heading" className="m-0 font-heading text-3xl font-extrabold sm:text-4xl">
              Color Tokens
            </h1>
            <a className="text-sm font-bold text-waffarly-primary hover:text-waffarly-primary-dark" href="/">
              عرض الكل ←
            </a>
          </div>

          <div dir="ltr" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {colorTokens.map((token) => (
              <div key={token.name} dir="rtl" className="overflow-hidden rounded-xl border border-waffarly-border bg-waffarly-surface">
                <div aria-hidden="true" className={cn('h-24 sm:h-[106px]', token.color)} />
                <div className="grid min-h-[68px] grid-cols-[1fr_auto] items-center gap-x-2 px-3 py-2">
                  <strong className="text-sm font-bold">{token.name}</strong>
                  <span className="col-start-1 font-mono text-xs text-waffarly-muted" dir="ltr">{token.value}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          <Section title="Buttons & Chips" className="min-h-[330px]">
            <div dir="ltr" className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {buttonExamples.map((button) => {
                const selected = selectedButton === button.label;
                return (
                  <Button
                    key={button.label}
                    type="button"
                    variant={button.variant}
                    aria-pressed={selected}
                    onClick={() => setSelectedButton(button.label)}
                    className={cn('min-w-[132px]', selected && button.variant === 'outline' && 'ring-2 ring-primary/20')}
                  >
                    {button.label}
                  </Button>
                );
              })}
            </div>

            <div className="my-6 border-t border-waffarly-border" />

            <div dir="ltr" className="flex flex-wrap items-center gap-2">
              <Badge variant="info">معلومات</Badge>
              <Badge variant="destructive">غير متاح</Badge>
              <Badge variant="warning">مميز</Badge>
              <Badge variant="success">نجاح</Badge>
            </div>
          </Section>

          <Section title="Typography" className="min-h-[330px]">
            <div className="grid min-h-[215px] content-between text-end">
              <p className="m-0 text-sm text-waffarly-muted">Headings: Cairo Bold / ExtraBold</p>
              <p className="m-0 font-heading text-3xl font-extrabold leading-tight sm:text-4xl">وجبتك المفضلة</p>
              <p className="m-0 font-heading text-3xl font-extrabold leading-tight sm:text-4xl">أشهى الوجبات</p>
              <p className="m-0 text-sm text-waffarly-muted">Body: Tajawal Regular / Medium مع بديل Noto Sans Arabic.</p>
            </div>
          </Section>

          <Section title="Product Card" className="min-h-[480px]">
            <Card className="mx-auto w-full max-w-[280px] overflow-hidden rounded-card border-waffarly-border bg-waffarly-surface p-3 shadow-card">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-waffarly-cream">
                <img
                  src="/storefront-assets/burger.webp"
                  alt="برجر بالجبنة"
                  className="size-full object-cover"
                />
                <span className="absolute start-3 top-3 rounded-full bg-waffarly-gold-light px-3 py-1.5 text-xs font-bold text-waffarly-gold-ink">
                  الأكثر طلبًا
                </span>
              </div>

              <div className="grid gap-2 px-1 pt-3 text-end">
                <h3 className="m-0 font-heading text-lg font-extrabold">برجر سيبشال</h3>
                <p className="m-0 text-sm leading-5 text-store-secondary">لحم بقري مشوي، جبنة شيدر وصوص المطعم المميز</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <bdi className="font-heading text-lg font-extrabold text-waffarly-primary-deep" dir="auto">165 ج.م</bdi>
                  <Button type="button" variant="accent" size="icon" aria-label="إضافة إلى السلة" className="size-11 rounded-full">
                    <Icon name="plus" />
                  </Button>
                </div>
              </div>
            </Card>
          </Section>

          <Section title="Inputs" className="min-h-[480px]">
            <div className="grid content-start gap-4 text-end">
              <label className="grid gap-2 text-sm font-bold" htmlFor="design-system-search">
                بحث
                <Input id="design-system-search" type="search" placeholder="ابحث عن وجبتك..." className="h-12 rounded-xl bg-waffarly-surface" />
              </label>
              <label className="grid gap-2 text-sm font-bold" htmlFor="design-system-select">
                اختيار
                <select id="design-system-select" className="h-12 w-full rounded-xl border border-waffarly-border bg-waffarly-surface px-3 text-base font-normal text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">اختر من القائمة</option>
                  <option value="popular">الأكثر طلبًا</option>
                </select>
              </label>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
