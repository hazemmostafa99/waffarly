'use client';

import { useState, type FormEvent } from 'react';
import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';

export function MarketplaceHeader({
  onSearch,
  onTermChange,
}: {
  onSearch: (category: string, term: string) => void;
  onTermChange: (term: string) => void;
}) {
  const [category, setCategory] = useState('all');
  const [term, setTerm] = useState('');
  const cartCount = useMarketplaceStore((s) => s.cart.length);
  const setCartOpen = useMarketplaceStore((s) => s.setCartOpen);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(category, term);
  }
  return (
    <>
      <div className="promo">
        خصومات افتتاح وفّرلي <b>حتى 50%</b> من بائعين موثوقين
      </div>
      <header className="top">
        <div className="container top-main">
          <div className="brand">
            <button type="button" className="menu-btn" aria-label="القائمة">
              ☰
            </button>
            <img className="logo" src="/marketplace-assets/wafarly-logo.png" alt="وفّرلي" />
            <div className="deliver">
              <span>📍</span>
              <div>
                <small>التوصيل إلى</small>
                <strong>دمياط الجديدة</strong>
              </div>
            </div>
          </div>
          <form className="search" id="searchForm" onSubmit={submit}>
            <select
              aria-label="القسم"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">كل الأقسام</option>
              <option value="electronics">إلكترونيات</option>
              <option value="fashion">موضة</option>
              <option value="home">المنزل</option>
              <option value="food">مطاعم</option>
            </select>
            <input
              id="searchInput"
              type="search"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                onTermChange(e.target.value);
              }}
              placeholder="ابحث عن منتج، ماركة أو متجر..."
              aria-label="ابحث في وفّرلي"
            />
            <button aria-label="بحث">⌕</button>
          </form>
          <div className="actions">
            <a className="action account" href="#stores">
              <small>مرحبًا، سجل دخولك</small>
              <strong>حسابي وقوائمي⌄</strong>
            </a>
            <a className="action" href="#deals">
              <strong>طلباتي</strong>
            </a>
            <a
              className="action cart"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setCartOpen(true);
              }}
              aria-label="السلة"
            >
              🛒<em>{cartCount}</em>
            </a>
          </div>
        </div>
      </header>
      <nav className="nav" aria-label="التنقل الرئيسي">
        <div className="container nav-row">
          {[
            ['الرئيسية', '#'],
            ['عروض اليوم', '#deals'],
            ['الأقسام', '#categories'],
            ['المتاجر', '#stores'],
            ['الأجهزة', '#'],
            ['الموبايلات', '#'],
            ['الموضة', '#'],
            ['المنزل والمطبخ', '#'],
            ['السوبر ماركت', '#'],
            ['المطاعم', '#'],
            ['بيع على وفّرلي', '#'],
          ].map(([label, href], i) => (
            <a className={i === 0 ? 'active' : undefined} href={href} key={label}>
              {label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
