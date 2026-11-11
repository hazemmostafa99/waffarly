export function ProductRating({ rating }: { rating: string }) {
  const stars = rating.split(' ')[0] ?? '';
  return (
    <div className="rating">
      {stars} <span>{rating.slice(stars.length).trim()}</span>
    </div>
  );
}
