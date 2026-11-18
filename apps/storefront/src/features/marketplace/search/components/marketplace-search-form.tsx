'use client';

import { cn } from '@waffarly/ui';
import { Search } from 'lucide-react';

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
        'search min-w-0 h-11.5 bg-white rounded-[12px] grid grid-cols-[115px_1fr_55px] overflow-hidden [box-shadow:0_0_0_3px_transparent]',
        '[transition:0.2s] focus-within:[box-shadow:0_0_0_3px_var(--gold)] [&_select]:text-[13px] [&_select]:border-0 [&_select]:bg-[#f5f2f6] [&_select]:text-[#554b5a] [&_select]:py-0 [&_select]:px-3 [&_select]:[outline:0]',
        '[&_input]:border-0 [&_input]:py-0 [&_input]:px-4.5 [&_input]:[outline:0] [&_input]:min-w-0 [&_input]:text-[14px] [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input]:[color-scheme:light] [&_button]:border-0 [&_button]:bg-waffarly-gold [&_button]:text-primary',
        '[&_button]:text-[21px] [&_button]:transition-colors [&_button:hover]:bg-[#ffd353] [&_button:hover]:text-primary [&_button:focus-visible]:bg-[#ffd353] [&_button:focus-visible]:text-primary max-[1100px]:[grid-column:1/-1] max-[1100px]:row-start-2 max-[700px]:grid-cols-[85px_1fr_48px] max-[700px]:h-[45px] max-[700px]:[&_input]:py-0 max-[700px]:[&_input]:px-2.5 max-[700px]:[&_input]:text-[12px]',
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
        <Search size={18} strokeWidth={1.75} aria-hidden="true" className="mx-auto" />
      </Button>
    </form>
  );
}
