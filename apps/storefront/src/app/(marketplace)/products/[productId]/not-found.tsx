import Link from 'next/link';
export default function ProductNotFound() {
  return (
    <main
      id="marketplace-main"
      tabIndex={-1}
      className={
        'marketplace-container detail-not-found py-20 w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)] text-center [&_a]:inline-block [&_a]:no-underline'
      }
    >
      <h1>المنتج غير موجود</h1>
      <p>الرابط ده مش لمنتج موجود في البيانات المحلية الحالية.</p>
      <Link
        href="/"
        className={
          'btn btn-gold border-0 rounded-[11px] py-[13px] px-5 font-extrabold bg-waffarly-gold text-[#2d1038]'
        }
      >
        العودة للتصفح
      </Link>
    </main>
  );
}
