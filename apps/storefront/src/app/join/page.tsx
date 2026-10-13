import type { Metadata } from 'next';
import { MerchantApplicationForm } from './merchant-application-form';

export const metadata: Metadata = {
  title: 'Apply to join Waffarly',
  description: 'Apply to set up your restaurant with Waffarly.',
};

export default function JoinPage() {
  return (
    <main className="join-shell">
      <a className="join-back" href="/">
        Waffarly
      </a>
      <section className="join-card">
        <p className="eyebrow">For restaurant owners</p>
        <h1>Apply to join Waffarly</h1>
        <p className="join-intro">
          Share your restaurant and contact details. Our team will review your application.
        </p>
        <MerchantApplicationForm />
      </section>
    </main>
  );
}
