import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="storefront-shell">
      <span className="eyebrow">Waffarly · Foundation</span>
      <h1>Public storefront</h1>
      <p>The Next.js App Router shell is ready for approved storefront requirements.</p>
      <Link className="apply-link" href="/join">
        Apply to set up your restaurant
      </Link>
    </main>
  );
}
