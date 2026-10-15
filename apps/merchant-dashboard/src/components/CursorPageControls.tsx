import { Button } from '@waffarly/ui';
export type CursorPageState = { cursor?: string };

export function CursorPageControls({
  page,
  history,
  next,
  loading,
  onChange,
  onHistoryChange,
  copy,
}: {
  page: CursorPageState;
  history: CursorPageState[];
  next: string | null;
  loading: boolean;
  onChange: (page: CursorPageState) => void;
  onHistoryChange: (history: CursorPageState[]) => void;
  copy: (value: string) => string;
}) {
  return (
    <div className="inventory-pagination">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading || history.length === 0}
        onClick={() => {
          onHistoryChange(history.slice(0, -1));
          onChange(history.at(-1) ?? {});
        }}
      >
        {copy('Previous')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading || !next}
        onClick={() => {
          if (!next) return;
          onHistoryChange([...history, page]);
          onChange({ cursor: next });
        }}
      >
        {copy('Next')}
      </Button>
    </div>
  );
}
