'use client';

import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { MarketplaceInput as Input } from '@/components/marketplace/marketplace-form-controls';

import { useState, type FormEvent } from 'react';
import {
  marketplaceCategories,
  parseCategoryId,
  type MarketplaceSearchState,
} from '@/features/marketplace/search/model/search-state';

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
    <form
      className={cn(
        'search h-12.5 bg-white rounded-[12px] grid grid-cols-[115px_1fr_55px] overflow-hidden [box-shadow:0_0_0_3px_transparent]',
        '[transition:0.2s] focus-within:[box-shadow:0_0_0_3px_var(--gold)] [&_select]:border-0 [&_select]:bg-[#f5f2f6] [&_select]:text-[#554b5a] [&_select]:py-0 [&_select]:px-3 [&_select]:[outline:0]',
        '[&_input]:border-0 [&_input]:py-0 [&_input]:px-4.5 [&_input]:[outline:0] [&_input]:min-w-0 [&_input]:text-[15px] [&_button]:border-0 [&_button]:bg-waffarly-gold',
        '[&_button]:text-[21px] max-[1100px]:[grid-column:1/-1] max-[1100px]:mb-3.5 max-[700px]:grid-cols-[85px_1fr_48px] max-[700px]:h-[45px] max-[700px]:[&_input]:py-0 max-[700px]:[&_input]:px-2.5 max-[700px]:[&_input]:text-[12px]',
      )}
      id="searchForm"
      role="search"
      onSubmit={submit}
    >
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
      <Input
        id="searchInput"
        type="search"
        value={draft.term}
        onChange={(event) => setDraft({ ...draft, term: event.target.value })}
        placeholder="ابحث عن منتج، ماركة أو متجر..."
        aria-label="ابحث في وفّرلي"
      />
      <Button
        type="submit"
        aria-label="بحث"
        className={'disabled:cursor-not-allowed disabled:opacity-[0.5]'}
      >
        ⌕
      </Button>
    </form>
  );
}
