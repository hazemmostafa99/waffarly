export function MarketplaceFooter() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <img className="footer-logo" src="/marketplace-assets/wafarly-logo.png" alt="وفّرلي" />
            <p>
              سوق إلكتروني يجمع أفضل المتاجر والبائعين في مكان واحد، لتجد ما تحتاجه بأفضل سعر وأسرع
              توصيل.
            </p>
          </div>
          {[
            ['اعرف أكثر', 'عن وفّرلي', 'بيع على وفّرلي', 'الشروط والأحكام'],
            ['مساعدة', 'تواصل معنا', 'الإرجاع والاستبدال', 'تتبّع طلبك'],
            ['حسابك', 'تسجيل الدخول', 'طلباتك', 'المفضلة'],
          ].map(([title, ...links]) => (
            <div key={title}>
              <h4>{title}</h4>
              {links.map((label) => (
                <a key={label} href="#">
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="copyright">© 2026 وفّرلي — جميع الحقوق محفوظة</div>
      </div>
    </footer>
  );
}
