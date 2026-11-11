export function ProductRating({ rating }: { rating: string }) {
  const stars = rating.split(' ')[0] ?? '';
  return (
    <div className={'rating text-[11px] text-[#9a7610] [&_span]:text-muted-foreground'}>
      {stars} <span>{rating.slice(stars.length).trim()}</span>
    </div>
  );
}
