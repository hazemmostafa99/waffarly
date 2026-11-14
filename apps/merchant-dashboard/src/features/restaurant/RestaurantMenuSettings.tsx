import { Icon } from '../../Icons.js';
import { useEffect, useRef, useState } from 'react';
import type { CatalogCategorySummary, CatalogProductSummary } from '@waffarly/contracts';
import { Button, Card, Input } from '@waffarly/ui';
import { Link } from 'react-router-dom';
import { ApiError, apiRequest } from '../../lib/api-client.js';
interface CategoryEdit {
  id: string;
  name: string;
  revision: number;
  displayOrder: number;
}
interface ProductEdit {
  id: string;
  name: string;
  revision: number;
  displayOrder: number;
  availability: 'available' | 'unavailable';
  menuSectionId: string | null;
  categories: { id: string; name: string }[];
  image: string;
  price: string;
}
export function RestaurantMenuSettings({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [categories, setCategories] = useState<CategoryEdit[]>([]);
  const [products, setProducts] = useState<ProductEdit[]>([]);
  const original = useRef<{ categories: CategoryEdit[]; products: ProductEdit[] }>({
    categories: [],
    products: [],
  });
  const lock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    setFailed(false);
    try {
      const [categoryRecords, productRecords] = await Promise.all([
        apiRequest<CatalogCategorySummary[]>('/owner/catalog/categories'),
        apiRequest<CatalogProductSummary[]>('/owner/catalog/products'),
      ]);
      const nextCategories = categoryRecords
        .filter((entry) => !entry.archivedAt)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          revision: entry.revision,
          displayOrder: entry.displayOrder ?? 0,
        }));
      const nextProducts = productRecords
        .filter((entry) => !entry.archivedAt)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          revision: entry.revision,
          displayOrder: entry.displayOrder ?? 0,
          availability: entry.availability,
          menuSectionId: entry.menuSectionId ?? null,
          image:
            entry.images.find((image) => image.isPrimary)?.publicUrl ??
            entry.images[0]?.publicUrl ??
            '',
          price: entry.basePrice,
          categories: entry.categories
            .filter((category) => nextCategories.some((entry) => entry.id === category.id))
            .map(({ id, name }) => ({ id, name })),
        }));
      original.current = { categories: nextCategories, products: nextProducts };
      setCategories(nextCategories);
      setProducts(nextProducts);
      setConflict(false);
    } catch (cause) {
      setFailed(true);
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل المنيو.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const dirty =
    JSON.stringify(categories) !== JSON.stringify(original.current.categories) ||
    JSON.stringify(products) !== JSON.stringify(original.current.products);
  useEffect(() => {
    onDirtyChange?.(dirty || busy);
  }, [dirty, busy, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save() {
    if (lock.current) return;
    const changedCategories = categories.filter(
      (entry) =>
        JSON.stringify(entry) !==
        JSON.stringify(original.current.categories.find((item) => item.id === entry.id)),
    );
    const changedProducts = products.filter(
      (entry) =>
        JSON.stringify(entry) !==
        JSON.stringify(original.current.products.find((item) => item.id === entry.id)),
    );
    if (changedCategories.length > 100 || changedProducts.length > 100) {
      setError('احفظ تعديلات على 100 صنف أو قسم بحد أقصى في المرة الواحدة.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/owner/restaurant/menu', {
        method: 'PUT',
        body: JSON.stringify({
          categories: changedCategories.map(({ id, revision, displayOrder }) => ({
            id,
            revision,
            displayOrder,
          })),
          products: changedProducts.map(
            ({ id, revision, displayOrder, availability, menuSectionId }) => ({
              id,
              revision,
              displayOrder,
              availability,
              menuSectionId,
            }),
          ),
        }),
      });
      setNotice('تم حفظ ترتيب المنيو وحالات الأصناف.');
      await load();
    } catch (cause) {
      setConflict(cause instanceof ApiError && cause.statusCode === 409);
      setError(cause instanceof Error ? cause.message : 'تعذر الحفظ.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const orderedCategories = [...categories].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
  );
  const sectionOf = (entry: ProductEdit) => entry.menuSectionId ?? entry.categories[0]?.id ?? '';
  const orderedProducts = [...products].sort(
    (a, b) =>
      (categories.find((entry) => entry.id === sectionOf(a))?.displayOrder ?? 0) -
        (categories.find((entry) => entry.id === sectionOf(b))?.displayOrder ?? 0) ||
      a.displayOrder - b.displayOrder ||
      a.id.localeCompare(b.id),
  );
  const visible = orderedProducts.filter(
    (entry) =>
      (category === 'all' || sectionOf(entry) === category) && entry.name.includes(query.trim()),
  );
  function moveCategory(id: string, direction: number) {
    const next = [...orderedCategories];
    const index = next.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [entry] = next.splice(index, 1);
    next.splice(target, 0, entry!);
    setCategories(next.map((entry, index) => ({ ...entry, displayOrder: index })));
    setNotice('');
  }
  function moveProduct(id: string, direction: number) {
    const current = products.find((entry) => entry.id === id);
    if (!current) return;
    const group = orderedProducts.filter((entry) => sectionOf(entry) === sectionOf(current));
    const index = group.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (target < 0 || target >= group.length) return;
    const [entry] = group.splice(index, 1);
    group.splice(target, 0, entry!);
    setProducts(
      products.map((entry) => {
        const position = group.findIndex((item) => item.id === entry.id);
        return position < 0 ? entry : { ...entry, displayOrder: position };
      }),
    );
    setNotice('');
  }
  const dirtyCount =
    products.filter(
      (entry) =>
        JSON.stringify(entry) !==
        JSON.stringify(original.current.products.find((item) => item.id === entry.id)),
    ).length +
    categories.filter(
      (entry) =>
        JSON.stringify(entry) !==
        JSON.stringify(original.current.categories.find((item) => item.id === entry.id)),
    ).length;
  if (loading)
    return (
      <Card className="rs-panel" role="status">
        جارٍ تحميل المنيو…
      </Card>
    );
  return (
    <Card className="rs-panel">
      <div className="rs-card-heading">
        <span className="rs-section-icon">
          <Icon name="box" />
        </span>
        <div>
          <h3>منيو مرتب، واختيارات أوضح</h3>
          <p>حرّك الأقسام والأصناف بالأسهم، وتحكم في ظهورها كمتاحة للطلب.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rs-info">
          {notice}
        </p>
      )}
      {(failed || conflict) && (
        <Button variant="outline" onClick={() => void load()}>
          {conflict ? 'تحميل النسخة الحالية واستبدال التعديلات' : 'إعادة المحاولة'}
        </Button>
      )}
      {!failed && (
        <fieldset disabled={busy || conflict} className="m-0 min-w-0 space-y-6 border-0 p-0">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="rs-section-title">
                أقسام المنيو <small className="text-muted-foreground">({categories.length})</small>
              </h3>
              <Link to="/categories" className="text-xs text-primary">
                إدارة الأقسام
              </Link>
            </div>
            <div className="rs-section-list">
              {orderedCategories.map((entry, index) => (
                <div key={entry.id} className="rs-section-row">
                  <div className="flex items-center gap-3">
                    <span className="rs-section-icon">
                      <Icon name="layers" />
                    </span>
                    <div>
                      <strong>{entry.name}</strong>
                      <small className="block">
                        {products.filter((product) => sectionOf(product) === entry.id).length} أصناف
                      </small>
                    </div>
                  </div>
                  <div className="rs-order-controls">
                    <Button
                      type="button"
                      variant="outline"
                      className="rs-order-up"
                      aria-label={`تقديم قسم ${entry.name}`}
                      disabled={index === 0}
                      onClick={() => moveCategory(entry.id, -1)}
                    >
                      <Icon name="arrow" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rs-order-down"
                      aria-label={`تأخير قسم ${entry.name}`}
                      disabled={index === orderedCategories.length - 1}
                      onClick={() => moveCategory(entry.id, 1)}
                    >
                      <Icon name="arrow" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {!categories.length && <p className="rs-hint">ابدأ بإضافة قسم من إدارة الأقسام.</p>}
          </section>
          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="rs-section-title">
                الأصناف <small className="text-muted-foreground">({products.length})</small>
              </h3>
              <Link to="/products" className="text-xs text-primary">
                إدارة المنتجات والاختيارات
              </Link>
            </div>
            <div className="rs-menu-toolbar">
              <Input
                value={query}
                placeholder="ابحث عن صنف…"
                aria-label="البحث في المنيو"
                onChange={(event) => setQuery(event.target.value)}
              />
              <label className="flex items-center gap-2">
                القسم
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="all">كل الأقسام</option>
                  {orderedCategories.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="rs-menu-table">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>القسم الأساسي</th>
                    <th>الطلب</th>
                    <th>الترتيب</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry) => {
                    const group = orderedProducts.filter(
                      (product) => sectionOf(product) === sectionOf(entry),
                    );
                    const position = group.findIndex((product) => product.id === entry.id);
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div className="rs-menu-product">
                            {entry.image && <img src={entry.image} alt="" />}
                            <div>
                              <Link to={`/products/${entry.id}/edit`}>{entry.name}</Link>
                              <small>{entry.price} ج.م</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            value={entry.menuSectionId ?? ''}
                            aria-label={`قسم ${entry.name}`}
                            onChange={(event) => {
                              setProducts(
                                products.map((product) =>
                                  product.id === entry.id
                                    ? { ...product, menuSectionId: event.target.value || null }
                                    : product,
                                ),
                              );
                              setNotice('');
                            }}
                          >
                            <option value="">تلقائي من التصنيفات</option>
                            {entry.categories.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <label className="rs-availability">
                            <input
                              type="checkbox"
                              role="switch"
                              checked={entry.availability === 'available'}
                              onChange={(event) => {
                                const availability = event.target.checked
                                  ? 'available'
                                  : 'unavailable';
                                setProducts(
                                  products.map((product) =>
                                    product.id === entry.id
                                      ? { ...product, availability }
                                      : product,
                                  ),
                                );
                                setNotice('');
                              }}
                            />
                            {entry.availability === 'available' ? 'متاح' : 'متوقف'}
                          </label>
                        </td>
                        <td>
                          <div className="rs-order-controls">
                            <Button
                              type="button"
                              variant="outline"
                              className="rs-order-up"
                              disabled={position === 0}
                              aria-label={`تقديم ${entry.name} داخل القسم`}
                              onClick={() => moveProduct(entry.id, -1)}
                            >
                              <Icon name="arrow" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="rs-order-down"
                              disabled={position === group.length - 1}
                              aria-label={`تأخير ${entry.name} داخل القسم`}
                              onClick={() => moveProduct(entry.id, 1)}
                            >
                              <Icon name="arrow" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <div className="py-8 text-center">
                <p className="rs-hint">
                  {products.length
                    ? 'مفيش أصناف مطابقة للبحث.'
                    : 'لسه مفيش أصناف. أضف أول صنف من صفحة المنتجات.'}
                </p>
                {products.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setQuery('');
                      setCategory('all');
                    }}
                  >
                    مسح البحث والفلاتر
                  </Button>
                )}
              </div>
            )}
            <p className="rs-hint mt-3">
              تحريك الصنف بيغير ترتيبه داخل قسمه. إيقافه يفضل ظاهر في المنيو كغير متاح.
            </p>
          </section>
          <footer className="rs-savebar">
            <span role="status">
              <i className={dirty ? 'is-dirty' : ''} />
              {dirty ? `${dirtyCount} تغييرات غير محفوظة` : 'كل التغييرات محفوظة'}
            </span>
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={!dirty || busy}
                onClick={() => {
                  setCategories(original.current.categories);
                  setProducts(original.current.products);
                  setError('');
                  setNotice('');
                }}
              >
                تراجع عن التغييرات
              </Button>
              <Button
                type="button"
                className="rs-primary"
                disabled={!dirty || busy}
                onClick={() => void save()}
              >
                {busy ? 'جارٍ الحفظ…' : 'حفظ المنيو'}
              </Button>
            </div>
          </footer>
        </fieldset>
      )}
    </Card>
  );
}
