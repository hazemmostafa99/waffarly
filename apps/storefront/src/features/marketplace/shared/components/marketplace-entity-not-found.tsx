import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';

export function MarketplaceEntityNotFound({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <main id="marketplace-main" tabIndex={-1} className="min-h-[60vh] py-20 text-center">
      <MarketplaceContainer>
        <h1 className="mb-3 mt-0 text-[28px]">{title}</h1>
        <p className="mb-6 mt-0 leading-[1.8] text-muted-foreground">{description}</p>
        <Link
          href={href}
          className="inline-block rounded-[11px] bg-waffarly-gold px-5 py-[13px] font-extrabold text-[#2d1038] no-underline"
        >
          {linkLabel}
        </Link>
      </MarketplaceContainer>
    </main>
  );
}
