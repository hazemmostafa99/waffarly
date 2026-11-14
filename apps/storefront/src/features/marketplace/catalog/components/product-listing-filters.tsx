'use client';

import type { FormEvent } from 'react';
import {
  marketplaceCategories,
  type CategoryId,
} from '@/features/marketplace/search/model/search-state';
import type {
  ProductListingState,
  ProductSort,
} from '@/features/marketplace/catalog/model/product-listing';

export function ProductListingFilters({
  state,
  draftTerm,
  searchLabel,
  onSearch,
  onDraftTermChange,
  onCategoryChange,
  onSortChange,
}: {
  state: ProductListingState;
  draftTerm: string;
  searchLabel: string;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onDraftTermChange: (term: string) => void;
  onCategoryChange: (category: CategoryId) => void;
  onSortChange: (sort: ProductSort) => void;
}) {
  return (
    <form
      className="mb-4 grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow)] sm:grid-cols-2 sm:items-end lg:grid-cols-[minmax(220px,1fr)_190px_205px_auto]"
      role="search"
      onSubmit={onSearch}
    >
      <label className="grid gap-1.5 text-xs font-bold text-primary">
        {searchLabel}
        <input
          name="q"
          type="search"
          value={draftTerm}
          onChange={(event) => onDraftTermChange(event.target.value)}
          placeholder="اسم المنتج أو وصفه"
          className="min-h-10 min-w-0 rounded-xl border border-border bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-accent"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-bold text-primary">
        القسم
        <select
          value={state.category}
          onChange={(event) => onCategoryChange(event.target.value as CategoryId)}
          className="min-h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-accent"
        >
          {marketplaceCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-bold text-primary">
        ترتيب النتائج
        <select
          value={state.sort}
          onChange={(event) => onSortChange(event.target.value as ProductSort)}
          className="min-h-10 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-accent"
        >
          <option value="recommended">الترتيب المقترح</option>
          <option value="price-ascending">السعر: الأقل أولًا</option>
          <option value="price-descending">السعر: الأعلى أولًا</option>
          <option value="discount-descending">نسبة الخصم: الأعلى أولًا</option>
        </select>
      </label>
      <button
        type="submit"
        className="min-h-10 rounded-xl bg-waffarly-gold px-5 text-sm font-black text-primary transition-colors hover:bg-[#ffd353] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        بحث
      </button>
    </form>
  );
}
