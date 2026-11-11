import { cn } from '@waffarly/ui';
export function SectionHeading({
  title,
  subtitle,
  more,
}: {
  title: string;
  subtitle: string;
  more: string;
}) {
  return (
    <div
      className={cn(
        'section-head flex items-end justify-between gap-[15px] mb-3.5 [&_h2]:text-[24px] [&_h2]:m-0',
        '[&_p]:text-muted-foreground [&_p]:text-[13px] [&_p]:mt-1.5 [&_p]:mx-0 [&_p]:mb-0',
      )}
    >
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <a className={'more text-accent font-extrabold no-underline text-[13px]'} href="#">
        {more} ←
      </a>
    </div>
  );
}
