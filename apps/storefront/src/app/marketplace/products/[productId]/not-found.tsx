import Link from 'next/link';
export default function ProductNotFound() {
  return (
    <main id="marketplace-main" tabIndex={-1} className="container detail-not-found">
      <h1>المنتج غير موجود</h1>
      <p>الرابط ده مش لمنتج موجود في البيانات المحلية الحالية.</p>
      <Link href="/marketplace" className="btn btn-gold">
        العودة للتصفح
      </Link>
    </main>
  );
}
