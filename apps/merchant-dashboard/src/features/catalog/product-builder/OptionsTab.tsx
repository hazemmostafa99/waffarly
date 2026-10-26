import { useModifierStockItems } from './use-modifier-stock-items.js';
import { useEffect, useRef, useState } from 'react';
import { VariantComposer } from './VariantComposer.js';
import { ChoiceGroupComposer, type ChoiceTemplate } from './ChoiceGroupComposer.js';
import {
  ChoiceConfigurationOverview,
  type ChoiceEditorView,
} from './ChoiceConfigurationOverview.js';
import type { CatalogModifierGroupSummary } from '@waffarly/contracts';
import { Icon } from '../../../Icons.js';
import type { ChoiceGroupDraft, GroupDraft, VariantDraft } from './product-builder.types.js';

export function OptionsTab({
  groups,
  recipe,
  productMode,
  modifierLibrary,
  libraryLoading,
  basePrice,
  onAddGroupFromLibrary,
  onCreateAndAddGroup,
  onSaveGroup,
  onPendingEditsChange,
  creatingGroup,
  onGroupsChange,
  onMoveGroup,
  variants,
  onVariantsChange,
  text,
}: {
  groups: GroupDraft[];
  recipe: boolean;
  productMode: 'simple' | 'variants';
  modifierLibrary: CatalogModifierGroupSummary[];
  libraryLoading: boolean;
  basePrice: string;
  onAddGroupFromLibrary: (groupId: string) => void;
  onCreateAndAddGroup: (draft: ChoiceGroupDraft) => Promise<string | null>;
  onSaveGroup: (group: GroupDraft) => Promise<string | null>;
  onPendingEditsChange: (pending: boolean) => void;
  creatingGroup: boolean;
  onGroupsChange: (groups: GroupDraft[]) => void;
  onMoveGroup: (index: number, direction: -1 | 1) => void;
  variants: VariantDraft[];
  onVariantsChange: (variants: VariantDraft[]) => void;
  text: (english: string, arabic: string) => string;
}) {
  const availableLibraryGroups = modifierLibrary.filter(
    (group) => !groups.some((assigned) => assigned.modifierGroupId === group.id),
  );
  const [composerTemplate, setComposerTemplate] = useState<ChoiceTemplate | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const matchingLibraryGroups = availableLibraryGroups.filter((group) =>
    `${group.name} ${group.options.map((option) => option.name).join(' ')}`
      .toLowerCase()
      .includes(librarySearch.trim().toLowerCase()),
  );
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variantDraft, setVariantDraft] = useState<VariantDraft[] | null>(null);
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editingView, setEditingView] = useState<ChoiceEditorView>({ section: 'overview' });
  const stock = useModifierStockItems(recipe ? groups : []);
  const [choiceDrafts, setChoiceDrafts] = useState<Record<string, GroupDraft>>({});
  const [feedback, setFeedback] = useState<{ message: string; target: string } | null>(null);
  const summaryRefs = useRef(new Map<string, HTMLElement>());
  const activeChoiceKey = editingGroupId
    ? `group:${editingGroupId}`
    : `template:${composerTemplate}`;
  useEffect(() => {
    onPendingEditsChange(variantDraft !== null || Object.keys(choiceDrafts).length > 0);
  }, [variantDraft, choiceDrafts, onPendingEditsChange]);
  useEffect(() => {
    if (!feedback) return;
    summaryRefs.current.get(feedback.target)?.scrollIntoView({ block: 'nearest' });
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);
  function openNew(template: ChoiceTemplate) {
    setEditingView({ section: 'choices' });
    setEditingGroupId('');
    setComposerTemplate(template);
  }
  function openExisting(id: string, view: ChoiceEditorView = { section: 'overview' }) {
    setEditingView(view);
    setEditingGroupId(id);
    setComposerTemplate('custom');
  }
  function discardChoiceDraft(key: string) {
    setChoiceDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  function closeChoice(draft?: GroupDraft) {
    if (draft) setChoiceDrafts((current) => ({ ...current, [activeChoiceKey]: draft }));
    else discardChoiceDraft(activeChoiceKey);
    setComposerTemplate(null);
    setEditingGroupId('');
  }
  async function addChoice(draft: ChoiceGroupDraft) {
    const error = await onCreateAndAddGroup(draft);
    if (!error)
      setFeedback({
        message: text('Choices added to the product.', 'تمت إضافة الخيارات للمنتج.'),
        target: 'choices',
      });
    return error;
  }
  async function saveChoice(draft: GroupDraft) {
    const error = await onSaveGroup(draft);
    if (!error)
      setFeedback({
        message: text('Choices and prices updated.', 'تم تحديث الخيارات والأسعار.'),
        target: `group:${draft.id}`,
      });
    return error;
  }
  function applyVariants(next: VariantDraft[]) {
    onVariantsChange(next);
    setFeedback({
      message: text('Sizes and prices updated.', 'تم تحديث الأحجام والأسعار.'),
      target: 'variants',
    });
  }
  return (
    <div className="builder-fields">
      <div className="builder-section-heading">
        <span>03</span>
        <div>
          <h2>{text('Customer choices', 'خيارات العميل')}</h2>
          <p>
            {text(
              'Start with one price. Add sizes or extras only when customers need them.',
              'ابدأ بسعر واحد. أضف أحجامًا أو إضافات فقط إذا احتاج العميل إليها.',
            )}
          </p>
        </div>
      </div>
      <div className="composer-feedback" role="status" aria-live="polite" aria-atomic="true">
        {feedback && (
          <>
            <Icon name="check" />
            <span>{feedback.message}</span>
          </>
        )}
      </div>
      {(variantDraft || Object.keys(choiceDrafts).length > 0) && (
        <section
          className="composer-retained-drafts"
          aria-label={text('Unfinished edits', 'تعديلات غير مكتملة')}
        >
          <strong>{text('You have unfinished edits', 'لديك تعديلات غير مكتملة')}</strong>
          <p>
            {text(
              'Resume editing, or discard a draft. Changes apply only when you confirm them.',
              'تابع التعديل أو تجاهل المسودة. تُطبّق التغييرات عند تأكيدها فقط.',
            )}
          </p>
          {variantDraft && (
            <div>
              <span>{text('Sizes and types', 'الأحجام والأنواع')}</span>
              <button
                type="button"
                className="builder-text-button"
                onClick={() => setVariantsOpen(true)}
              >
                {text('Continue editing', 'متابعة التعديل')}
              </button>
              <button
                type="button"
                className="builder-text-button"
                onClick={() => setVariantDraft(null)}
              >
                {text('Discard draft', 'تجاهل المسودة')}
              </button>
            </div>
          )}
          {Object.entries(choiceDrafts).map(([key, draft]) => (
            <div key={key}>
              <span>{draft.name || text('Customer choices', 'خيارات العميل')}</span>
              <button
                type="button"
                className="builder-text-button"
                onClick={() =>
                  key.startsWith('group:')
                    ? openExisting(key.slice(6))
                    : openNew(key.slice(9) as ChoiceTemplate)
                }
              >
                {text('Continue editing', 'متابعة التعديل')}
              </button>
              <button
                type="button"
                className="builder-text-button"
                onClick={() => discardChoiceDraft(key)}
              >
                {text('Discard draft', 'تجاهل المسودة')}
              </button>
            </div>
          ))}
        </section>
      )}
      <section className="builder-options-start">
        <div className="builder-options-intro">
          <div>
            <h3>{text('What can your customer choose?', 'ماذا يمكن للعميل اختياره؟')}</h3>
            <p>
              {text(
                'Choose a starting point. You can edit all names and prices.',
                'اختر نقطة بداية، ثم عدّل الأسماء والأسعار حسب منتجك.',
              )}
            </p>
          </div>
          {productMode === 'simple' && !groups.length && (
            <span className="builder-options-optional">
              {text('Optional step', 'خطوة اختيارية')}
            </span>
          )}
        </div>
        <div className="builder-choice-templates">
          <button type="button" disabled={creatingGroup} onClick={() => setVariantsOpen(true)}>
            <span className="builder-template-icon">
              <Icon name="layers" />
            </span>
            <strong>{text('Sizes or types', 'أحجام أو أنواع')}</strong>
            <small>
              {text(
                'Small, medium, large — each with its own price.',
                'صغير، وسط، كبير — لكل حجم سعره.',
              )}
            </small>
            <span className="builder-template-action">
              <Icon name="plus" />
              {variants.length
                ? text('Edit sizes', 'تعديل الأحجام')
                : text('Add sizes', 'إضافة أحجام')}
            </span>
          </button>
          <button
            type="button"
            disabled={groups.length >= 30 || creatingGroup}
            onClick={() => openNew('extras')}
          >
            <span className="builder-template-icon">
              <Icon name="plus" />
            </span>
            <strong>{text('Extras', 'إضافات')}</strong>
            <small>
              {text(
                'Extra cheese, sauce — free or for an extra charge.',
                'جبنة إضافية، صوص — مجانًا أو بسعر إضافي.',
              )}
            </small>
            <span className="builder-template-action">
              <Icon name="plus" />
              {text('Add extras', 'إضافة اختيارات')}
            </span>
          </button>
          <button
            type="button"
            disabled={groups.length >= 30 || creatingGroup}
            onClick={() => openNew('preparation')}
          >
            <span className="builder-template-icon">
              <Icon name="check" />
            </span>
            <strong>{text('Preparation preferences', 'تفضيلات التحضير')}</strong>
            <small>
              {text(
                'Regular or no salt — choose how it is prepared.',
                'عادي أو بدون ملح — طريقة التحضير التي يفضلها العميل.',
              )}
            </small>
            <span className="builder-template-action">
              <Icon name="plus" />
              {text('Add preferences', 'إضافة تفضيلات')}
            </span>
          </button>
        </div>
        <button
          type="button"
          className="builder-text-button"
          disabled={groups.length >= 30 || creatingGroup}
          onClick={() => openNew('custom')}
        >
          <Icon name="plus" />
          {text('Add custom choices', 'إضافة خيارات مخصصة')}
        </button>
        <details className="builder-saved-choices">
          <summary>
            <Icon name="layers" />
            {text('Reuse saved choices', 'استخدام خيارات محفوظة')}
            <Icon name="chevron" />
          </summary>
          <div className="builder-saved-choices-content">
            <label className="builder-field">
              <span>{text('Find saved choices', 'ابحث عن خيارات محفوظة')}</span>
              <input
                type="search"
                value={librarySearch}
                onChange={(event) => setLibrarySearch(event.target.value)}
                placeholder={text('Search by name or choice…', 'ابحث بالاسم أو بأحد الاختيارات…')}
              />
            </label>
            <div className="builder-saved-choices-list">
              {libraryLoading ? (
                <p role="status">
                  {text('Loading saved choices…', 'جارٍ تحميل الخيارات المحفوظة…')}
                </p>
              ) : matchingLibraryGroups.length ? (
                matchingLibraryGroups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    disabled={groups.length >= 30 || creatingGroup}
                    onClick={() => {
                      onAddGroupFromLibrary(group.id);
                      setFeedback({
                        message: text(
                          'Choices added to the product.',
                          'تمت إضافة الخيارات للمنتج.',
                        ),
                        target: 'choices',
                      });
                    }}
                  >
                    <span>
                      <strong>{group.name}</strong>
                      <small>
                        {group.options
                          .map((option) => option.name)
                          .slice(0, 4)
                          .join('، ')}
                      </small>
                    </span>
                    <span className="builder-template-action">
                      <Icon name="plus" />
                      {text('Add', 'إضافة')}
                    </span>
                  </button>
                ))
              ) : (
                <p role="status">
                  {librarySearch
                    ? text('No matching saved choices.', 'لا توجد خيارات محفوظة مطابقة.')
                    : text(
                        'No unused saved choices. Start with a template above.',
                        'لا توجد خيارات محفوظة متاحة. ابدأ بأحد القوالب أعلاه.',
                      )}
                </p>
              )}
            </div>
          </div>
        </details>
        {groups.length >= 30 && (
          <small role="status">
            {text(
              'This product has the maximum of 30 choice groups.',
              'وصل المنتج إلى الحد الأقصى: 30 مجموعة خيارات.',
            )}
          </small>
        )}
      </section>
      {variants.length > 0 && (
        <button
          type="button"
          className={`builder-variant-summary${feedback?.target === 'variants' ? ' composer-summary-updated' : ''}`}
          ref={(element) => {
            if (element) summaryRefs.current.set('variants', element);
            else summaryRefs.current.delete('variants');
          }}
          onClick={() => setVariantsOpen(true)}
        >
          <span className="builder-template-icon">
            <Icon name="layers" />
          </span>
          <span className="builder-choice-summary-copy">
            <strong>{text('Sizes and types', 'الأحجام والأنواع')}</strong>
            <small>
              {text(
                `${variants.length} sizes or types · each has its own selling price`,
                `${variants.length} أحجام أو أنواع · لكل منها سعر بيع مستقل`,
              )}
            </small>
            <span className="builder-choice-summary-options">
              {variants.slice(0, 4).map((variant) => (
                <span key={variant.id}>
                  {variant.name} · {variant.price} {text('EGP', 'ج.م')}
                </span>
              ))}
              {variants.length > 4 && <span>+{variants.length - 4}</span>}
            </span>
          </span>
          <span className="builder-choice-edit">
            {text('Edit', 'تعديل')}
            <Icon name="edit" />
          </span>
        </button>
      )}
      {groups.length > 0 && (
        <div className="builder-subsection-heading">
          <div>
            <h3>{text('Choices on this product', 'الخيارات على هذا المنتج')}</h3>
            <p>
              {text(
                'Review all configured choices below. These are product draft settings; save the product to keep changes.',
                'راجع كل الخيارات المعدّة أدناه. هذه إعدادات مسودة المنتج؛ احفظ المنتج لحفظ التغييرات.',
              )}
            </p>
          </div>
          <span className="builder-count-badge">{groups.length}</span>
        </div>
      )}
      <div
        className={`builder-groups-list${feedback?.target === 'choices' ? ' composer-summary-updated' : ''}`}
        ref={(element) => {
          if (element) summaryRefs.current.set('choices', element);
          else summaryRefs.current.delete('choices');
        }}
      >
        {groups.map((group, index) => (
          <article
            className={`builder-choice-card${feedback?.target === `group:${group.id}` ? ' composer-summary-updated' : ''}`}
            key={group.id}
            ref={(element) => {
              if (element) summaryRefs.current.set(`group:${group.id}`, element);
              else summaryRefs.current.delete(`group:${group.id}`);
            }}
          >
            <button
              type="button"
              className="builder-choice-summary"
              aria-haspopup="dialog"
              onClick={() => openExisting(group.id)}
            >
              <span className="builder-template-icon">
                <Icon name="grid" />
              </span>
              <span className="builder-choice-summary-copy">
                <strong>{group.name}</strong>
                <small>
                  {group.minSelections ? text('Required', 'مطلوب') : text('Optional', 'اختياري')}
                  {' · '}
                  {group.selectionMode === 'single'
                    ? text('One choice', 'اختيار واحد')
                    : text(
                        `Up to ${group.maxSelections} choices`,
                        `حتى ${group.maxSelections} اختيارات`,
                      )}
                </small>
                <span className="choice-config-badge">
                  {text(
                    `${group.options.length} choices · product draft`,
                    `${group.options.length} خيارات · مسودة المنتج`,
                  )}
                </span>
              </span>
              <span className="builder-choice-edit">
                {choiceDrafts[`group:${group.id}`]
                  ? text('Continue editing', 'متابعة التعديل')
                  : text('Edit', 'تعديل')}
                <Icon name="edit" />
              </span>
            </button>
            <ChoiceConfigurationOverview
              group={group}
              variants={variants}
              recipe={recipe}
              items={stock.items}
              failed={stock.failed}
              onEdit={(view) => openExisting(group.id, view)}
              text={text}
            />
            <div className="builder-choice-card-actions">
              <div className="builder-order-buttons">
                <button
                  type="button"
                  aria-label={text(`Move ${group.name} up`, `تحريك ${group.name} لأعلى`)}
                  disabled={index === 0}
                  onClick={() => onMoveGroup(index, -1)}
                >
                  <Icon name="arrow-up" />
                </button>
                <button
                  type="button"
                  aria-label={text(`Move ${group.name} down`, `تحريك ${group.name} لأسفل`)}
                  disabled={index === groups.length - 1}
                  onClick={() => onMoveGroup(index, 1)}
                >
                  <Icon name="arrow-down" />
                </button>
              </div>
              <button
                type="button"
                className="builder-text-button composer-delete-action"
                onClick={() => {
                  onGroupsChange(groups.filter((item) => item.id !== group.id));
                  discardChoiceDraft(`group:${group.id}`);
                }}
              >
                <Icon name="trash" />
                {text('Remove', 'حذف')}
              </button>
            </div>
          </article>
        ))}
      </div>
      {stock.failed.length > 0 && (
        <button type="button" className="builder-text-button" onClick={stock.retry}>
          {text('Retry loading ingredients', 'إعادة تحميل المكوّنات')}
        </button>
      )}
      {variantsOpen && (
        <VariantComposer
          variants={variants}
          basePrice={basePrice}
          initialDraft={variantDraft ?? undefined}
          onApply={applyVariants}
          onClose={(draft) => {
            setVariantDraft(draft ?? null);
            setVariantsOpen(false);
          }}
          text={text}
        />
      )}
      {composerTemplate && (
        <ChoiceGroupComposer
          template={composerTemplate}
          basePrice={basePrice}
          creating={creatingGroup}
          initialGroup={groups.find((group) => group.id === editingGroupId)}
          initialDraft={choiceDrafts[activeChoiceKey]}
          initialView={editingView}
          onClose={closeChoice}
          onSave={saveChoice}
          variants={variants}
          recipe={recipe}
          onAdd={addChoice}
          text={text}
        />
      )}
    </div>
  );
}
