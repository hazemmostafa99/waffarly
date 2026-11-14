export function customerName(displayName?: string | null) {
  const full = displayName?.trim() || 'عميل وفّرلي';
  const parts = full.split(/\s+/);
  return { full, first: parts[0], initials: parts.slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase() };
}
