export type ImportedProduct = { name: string; basePrice: string; availability: string };

/** Supports quoted commas, escaped quotes, CRLF, and UTF-8 BOMs. */
export function parseProductCsv(source: string): ImportedProduct[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(field.trim());
      field = '';
      if (char !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === '\r' && input[i + 1] === '\n') i++;
      }
    } else field += char;
  }
  if (quoted) throw new Error('Invalid CSV');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift() ?? [];
  const nameIndex = headers.indexOf('name');
  const priceIndex = headers.indexOf('basePrice');
  const statusIndex = headers.indexOf('availability');
  if (nameIndex < 0 || priceIndex < 0 || !rows.length || rows.length > 500)
    throw new Error('Invalid CSV');
  return rows.map((cells) => {
    const name = cells[nameIndex] ?? '';
    const basePrice = cells[priceIndex] ?? '';
    const availability = (statusIndex < 0 ? '' : cells[statusIndex]) || 'available';
    if (
      cells.length !== headers.length ||
      !name ||
      name.length > 160 ||
      !/^\d+(\.\d{1,2})?$/.test(basePrice) ||
      Number(basePrice) <= 0 ||
      !['available', 'unavailable'].includes(availability)
    )
      throw new Error('Invalid CSV');
    return { name, basePrice, availability };
  });
}
