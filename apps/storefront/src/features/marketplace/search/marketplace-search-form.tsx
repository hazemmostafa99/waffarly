'use client';

import { useState, type FormEvent } from 'react';
import {
  marketplaceCategories,
  parseCategoryId,
  type MarketplaceSearchState,
} from './search-state';

export function MarketplaceSearchForm({
  initialState,
  onSearch,
}: {
  initialState: MarketplaceSearchState;
  onSearch: (state: MarketplaceSearchState) => void;
}) {
  const [draft, setDraft] = useState(initialState);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(draft);
  }
  return (
    <form className="search" id="searchForm" role="search" onSubmit={submit}>
      <select
        aria-label="القسم"
        value={draft.category}
        onChange={(event) => setDraft({ ...draft, category: parseCategoryId(event.target.value) })}
      >
        {marketplaceCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.id === 'all' ? 'كل الأقسام' : category.name}
          </option>
        ))}
      </select>
      <input
        id="searchInput"
        type="search"
        value={draft.term}
        onChange={(event) => setDraft({ ...draft, term: event.target.value })}
        placeholder="ابحث عن منتج، ماركة أو متجر..."
        aria-label="ابحث في وفّرلي"
      />
      <button type="submit" aria-label="بحث">
        ⌕
      </button>
    </form>
  );
}
