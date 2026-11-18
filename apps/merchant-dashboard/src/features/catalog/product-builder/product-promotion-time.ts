const cairoDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function cairoParts(date: Date) {
  return Object.fromEntries(cairoDateTime.formatToParts(date).map(({ type, value }) => [type, value]));
}

export function toCairoDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const parts = cairoParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function cairoOffsetAt(instant: number): number {
  const parts = cairoParts(new Date(instant));
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return representedAsUtc - instant;
}

export function fromCairoDateTimeInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const wallTime = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let instant = wallTime;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = wallTime - cairoOffsetAt(instant);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant).toISOString();
}
