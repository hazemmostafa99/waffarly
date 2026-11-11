export function SectionHeading({
  title,
  subtitle,
  more,
}: {
  title: string;
  subtitle: string;
  more: string;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <a className="more" href="#">
        {more} ←
      </a>
    </div>
  );
}
