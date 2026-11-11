export function ProductRating({ rating, demo = false }: { rating: string; demo?: boolean }) {
  if (demo) {
    return <div className="rating text-[11px] text-muted-foreground">التقييم غير متاح للمثال</div>;
  }
  const stars = rating.split(' ')[0] ?? '';
  return (
    <div className={'rating text-[11px] text-[#9a7610] [&_span]:text-muted-foreground'}>
      {stars} <span>{rating.slice(stars.length).trim()}</span>
    </div>
  );
}
