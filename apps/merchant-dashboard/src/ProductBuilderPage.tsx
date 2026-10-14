import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import { Icon } from './Icons.js';

type Choice = {
  id: string;
  name: string;
  price: number;
};

type OptionGroup = {
  id: string;
  name: string;
  description: string;
  kind: 'required' | 'optional';
  icon: 'box' | 'tag' | 'gift';
  choices: Choice[];
  enabled: boolean;
};

const burgerIllustration =
  'data:image/svg+xml,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="#f7c26b"/><stop offset=".55" stop-color="#c55418"/><stop offset="1" stop-color="#54220f"/>
        </linearGradient>
        <linearGradient id="bun" x1="0" x2="0" y1="0" y2="1">
          <stop stop-color="#f4a740"/><stop offset="1" stop-color="#a94d15"/>
        </linearGradient>
        <filter id="shadow"><feGaussianBlur stdDeviation="12"/></filter>
      </defs>
      <rect width="800" height="520" fill="url(#bg)"/>
      <circle cx="690" cy="120" r="180" fill="#ffdd92" opacity=".18"/>
      <ellipse cx="400" cy="432" rx="282" ry="32" fill="#28140e" opacity=".48" filter="url(#shadow)"/>
      <path d="M148 252c18-66 118-105 252-105s234 39 252 105v25H148Z" fill="url(#bun)"/>
      <path d="M168 244c70-18 112-9 161-2 74 11 156-21 303 2l-14-31c-32-54-104-81-218-81s-186 27-218 81Z" fill="#f8b853"/>
      <g fill="#fff1bf" opacity=".85">
        <ellipse cx="252" cy="184" rx="10" ry="4" transform="rotate(18 252 184)"/><ellipse cx="317" cy="163" rx="11" ry="4" transform="rotate(-8 317 163)"/><ellipse cx="390" cy="178" rx="10" ry="4" transform="rotate(12 390 178)"/><ellipse cx="470" cy="158" rx="10" ry="4" transform="rotate(-15 470 158)"/><ellipse cx="536" cy="188" rx="11" ry="4" transform="rotate(21 536 188)"/>
      </g>
      <path d="M159 275h482l-19 37H177Z" fill="#5e1c10"/>
      <path d="M175 313c49-17 87-4 131 2 62 8 119-17 178-6 34 6 67 5 139-4l-17 43H193Z" fill="#e9bd31"/>
      <path d="M172 349c52-21 93-4 132 0 63 7 118-12 176-3 41 6 75 4 140-10l-18 45H190Z" fill="#5c9f38"/>
      <path d="M191 372c67-24 104-6 154 1 51 7 94-13 157-7 35 3 68 6 105-5l-24 50H217Z" fill="#5b2414"/>
      <path d="M210 414h379l-28 43H239Z" fill="#dda02f"/>
      <path d="M205 414c43-13 75-6 108-1 67 10 113-11 173-4 36 4 74 6 107-1l-13 20H218Z" fill="#efdf80"/>
    </svg>
  `);

const initialGroups: OptionGroup[] = [
  {
    id: 'sizes',
    name: 'الحجم',
    description: 'حدد الحجم المناسب لمنتجك',
    kind: 'required',
    icon: 'box',
    enabled: true,
    choices: [
      { id: 'small', name: 'صغير', price: 0 },
      { id: 'medium', name: 'متوسط', price: 25 },
      { id: 'large', name: 'كبير', price: 40 },
    ],
  },
  {
    id: 'additions',
    name: 'الإضافات',
    description: 'أضف المزيد من النكهات إلى وجبتك',
    kind: 'optional',
    icon: 'box',
    enabled: true,
    choices: [
      { id: 'extra-cheese', name: 'جبن إضافي', price: 15 },
      { id: 'fried-egg', name: 'بيض مقلي', price: 12 },
      { id: 'extra-meat', name: 'لحم إضافي', price: 18 },
    ],
  },
  {
    id: 'sauces',
    name: 'الصلصات',
    description: 'اختر الصوص المفضل لديك',
    kind: 'optional',
    icon: 'tag',
    enabled: true,
    choices: [
      { id: 'mayo', name: 'مايونيز', price: 0 },
      { id: 'ketchup', name: 'كاتشب', price: 0 },
      { id: 'bbq', name: 'باربيكيو', price: 0 },
    ],
  },
];

const initialSelected = new Set(['medium', 'extra-cheese', 'fried-egg']);

export function ProductBuilderPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const [groups, setGroups] = useState<OptionGroup[]>(initialGroups);
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [saved, setSaved] = useState(false);

  const text = (english: string, arabic: string) => (isArabic ? arabic : english);
  const basePrice = 145;
  const total = useMemo(
    () =>
      basePrice +
      groups.flatMap((group) => group.choices).reduce((sum, choice) => sum + (selected.has(choice.id) ? choice.price : 0), 0),
    [groups, selected],
  );

  function updateGroup(id: string, update: Partial<OptionGroup>) {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...update } : group)));
    setSaved(false);
  }

  function updateChoice(groupId: string, choiceId: string, update: Partial<Choice>) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              choices: group.choices.map((choice) =>
                choice.id === choiceId ? { ...choice, ...update } : choice,
              ),
            }
          : group,
      ),
    );
    setSaved(false);
  }

  function toggleChoice(group: OptionGroup, choiceId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (group.kind === 'required') {
        group.choices.forEach((choice) => next.delete(choice.id));
        next.add(choiceId);
      } else if (next.has(choiceId)) {
        next.delete(choiceId);
      } else {
        next.add(choiceId);
      }
      return next;
    });
  }

  function addGroup() {
    const id = `group-${Date.now()}`;
    setGroups((current) => [
      ...current,
      {
        id,
        name: text('New option group', 'مجموعة خيارات جديدة'),
        description: text('Add a short description for customers', 'أضف وصفاً قصيراً يظهر للعملاء'),
        kind: 'optional',
        icon: 'gift',
        enabled: true,
        choices: [{ id: `${id}-choice`, name: text('New choice', 'خيار جديد'), price: 0 }],
      },
    ]);
    setSaved(false);
  }

  function removeGroup(id: string) {
    setGroups((current) => current.filter((group) => group.id !== id));
    setSaved(false);
  }

  function addChoice(group: OptionGroup) {
    const id = `${group.id}-choice-${Date.now()}`;
    updateGroup(group.id, {
      choices: [...group.choices, { id, name: text('New choice', 'خيار جديد'), price: 0 }],
    });
  }

  function removeChoice(group: OptionGroup, choiceId: string) {
    updateGroup(group.id, { choices: group.choices.filter((choice) => choice.id !== choiceId) });
    setSelected((current) => {
      const next = new Set(current);
      next.delete(choiceId);
      return next;
    });
  }

  return (
    <div className="product-builder-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="product-builder-topbar">
        <div>
          <div className="product-builder-breadcrumb">
            <Link to="/products">{text('Products', 'المنتجات')}</Link>
            <span>/</span>
            <span>{text('Product builder', 'منشئ المنتج')}</span>
          </div>
          <div className="product-builder-title-row">
            <div>
              <h1>{text('Product builder', 'منشئ المنتج')}</h1>
              <p>
                {text(
                  'Build a product that fits your catalog and gives customers the right choices.',
                  'قم ببناء منتج يناسب كتالوجك ويمنح العملاء الخيارات المناسبة.',
                )}
              </p>
            </div>
            <div className="product-builder-actions">
              <Link className="builder-button ghost" to="/products">
                {text('Cancel', 'إلغاء')}
              </Link>
              <button type="button" className="builder-button primary" onClick={() => setSaved(true)}>
                <Icon name="check" />
                {text('Save product', 'حفظ المنتج')}
              </button>
            </div>
          </div>
        </div>
        {saved && (
          <p className="builder-save-notice" role="status">
            {text('Draft saved locally.', 'تم حفظ المسودة محلياً.')}
          </p>
        )}
      </div>

      <div className="builder-steps" aria-label={text('Product setup steps', 'خطوات إعداد المنتج')}>
        {[
          [text('Basic information', 'المعلومات الأساسية'), '1'],
          [text('Product details', 'تفاصيل المنتج'), '2'],
          [text('Options', 'الخيارات'), '3'],
          [text('Preview and publish', 'المعاينة والنشر'), '4'],
        ].map(([label, number], index) => (
          <div className={`builder-step ${index === 2 ? 'active' : index < 2 ? 'done' : ''}`} key={label}>
            <span>{index < 2 ? '✓' : number}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>

      <div className="product-builder-layout">
        <aside className="product-preview-card">
          <div className="preview-card-heading">
            <span>{text('Product preview', 'معاينة المنتج')}</span>
            <Icon name="eye" />
          </div>
          <div className="preview-image-wrap">
            <img src={burgerIllustration} alt={text('Classic Burger', 'برجر كلاسيك')} />
            <span className="preview-category">{text('Burgers', 'برجر')}</span>
          </div>
          <div className="preview-copy">
            <h2>{text('Classic Burger', 'برجر كلاسيك')}</h2>
            <p>{text('Juicy beef patty with fresh lettuce, tomato, and our special sauce.', 'برجر لحم طازج مع الخس والطماطم والصوص الخاص بنا.')}</p>
            <strong className="preview-base-price">EGP {basePrice.toFixed(2)}</strong>
          </div>
          <div className="preview-selected-options">
            <h3>{text('Selected options', 'اختياراتك')}</h3>
            {groups.filter((group) => group.enabled).map((group) => {
              const picked = group.choices.filter((choice) => selected.has(choice.id));
              if (!picked.length) return null;
              return (
                <div className="preview-option-row" key={group.id}>
                  <span>{group.name}</span>
                  <span>
                    {picked.map((choice) => choice.name).join('، ')}
                    {picked.some((choice) => choice.price > 0) && (
                      <small> + EGP {picked.reduce((sum, choice) => sum + choice.price, 0).toFixed(2)}</small>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="preview-total">
            <span>{text('Total price', 'السعر الإجمالي')}</span>
            <strong>EGP {total.toFixed(2)}</strong>
          </div>
          <button type="button" className="preview-cart-button">
            <Icon name="bag" />
            {text('Add to cart (preview)', 'أضف إلى السلة (معاينة)')}
          </button>
        </aside>

        <main className="product-options-workspace">
          <div className="options-heading">
            <div>
              <h2>{text('Product options', 'خيارات المنتج')}</h2>
              <p>{text('Add groups of choices customers can select when ordering.', 'أضف مجموعات من الاختيارات التي يمكن للعملاء تحديدها عند الطلب.')}</p>
            </div>
            <button type="button" className="builder-button add-group-button" onClick={addGroup}>
              <Icon name="plus" />
              {text('Add option group', 'إضافة مجموعة خيارات')}
            </button>
          </div>

          <div className="builder-info-banner">
            <span className="builder-info-icon">i</span>
            <p>
              {text(
                'Use required groups for choices like size. Optional groups let customers add extras or skip them.',
                'استخدم المجموعات المطلوبة للاختيارات مثل الحجم، والمجموعات الاختيارية للإضافات التي يمكن للعميل تخطيها.',
              )}
            </p>
          </div>

          <div className="option-groups-list">
            {groups.map((group, groupIndex) => (
              <section className={`option-group-card ${group.enabled ? '' : 'is-disabled'}`} key={group.id}>
                <header className="option-group-header">
                  <span className="drag-handle" aria-hidden="true">⋮⋮</span>
                  <div className="option-group-heading-copy">
                    <span className={`option-group-icon ${group.icon}`}><Icon name={group.icon} /></span>
                    <div>
                      <h3>{group.name}</h3>
                      <p>{group.description}</p>
                    </div>
                  </div>
                  <div className="option-group-tools">
                    <label className="builder-switch-label">
                      <span>{group.kind === 'required' ? text('Required', 'مطلوب') : text('Optional', 'اختياري')}</span>
                      <button
                        type="button"
                        className={`builder-switch ${group.enabled ? 'on' : ''}`}
                        aria-pressed={group.enabled}
                        aria-label={text(`Toggle ${group.name}`, `تفعيل ${group.name}`)}
                        onClick={() => updateGroup(group.id, { enabled: !group.enabled })}
                      >
                        <span />
                      </button>
                    </label>
                    <button
                      type="button"
                      className="builder-icon-button"
                      aria-label={text(`Edit ${group.name}`, `تعديل ${group.name}`)}
                      onClick={() => updateGroup(group.id, { kind: group.kind === 'required' ? 'optional' : 'required' })}
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="builder-icon-button danger"
                      aria-label={text(`Delete ${group.name}`, `حذف ${group.name}`)}
                      onClick={() => removeGroup(group.id)}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </header>
                <div className="option-group-body">
                  {group.choices.map((choice) => (
                    <div className="choice-row" key={choice.id}>
                      <span className="drag-handle choice-drag" aria-hidden="true">⋮⋮</span>
                      <button
                        type="button"
                        className={`choice-select ${selected.has(choice.id) && group.enabled ? 'selected' : ''}`}
                        aria-pressed={selected.has(choice.id)}
                        aria-label={text(`Preview ${choice.name}`, `معاينة ${choice.name}`)}
                        onClick={() => toggleChoice(group, choice.id)}
                      >
                        <span />
                      </button>
                      <input
                        aria-label={text(`${group.name} option name`, `اسم اختيار ${group.name}`)}
                        value={choice.name}
                        onChange={(event) => updateChoice(group.id, choice.id, { name: event.target.value })}
                      />
                      <label className="choice-price-field">
                        <span>EGP</span>
                        <input
                          aria-label={text(`${choice.name} price`, `سعر ${choice.name}`)}
                          type="number"
                          min="0"
                          step="0.01"
                          value={choice.price}
                          onChange={(event) => updateChoice(group.id, choice.id, { price: Number(event.target.value) || 0 })}
                        />
                      </label>
                      <button
                        type="button"
                        className="builder-icon-button delete-choice"
                        aria-label={text(`Delete ${choice.name}`, `حذف ${choice.name}`)}
                        onClick={() => removeChoice(group, choice.id)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="add-choice-button" onClick={() => addChoice(group)}>
                    <Icon name="plus" />
                    {text('Add another option', 'إضافة خيار آخر')}
                  </button>
                </div>
                <footer className="option-group-footer">
                  <span>{groupIndex + 1}</span>
                  {text(`${group.choices.length} choices`, `${group.choices.length} اختيارات`)}
                  <span>•</span>
                  {group.kind === 'required' ? text('Customer picks one', 'يختار العميل واحداً') : text('Customer can pick multiple', 'يمكن للعميل اختيار أكثر من خيار')}
                </footer>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
