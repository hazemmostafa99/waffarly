/** Static SVG paths from the supplied report reference. */
const paths: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chart: '<path d="M3 3v18h18M7 16l4-5 4 3 5-7"/>',
  shop: '<path d="M4 10l2-6h12l2 6v10H4zM4 10c0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0 0 3 4 3 4 0"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4M17 2v4M3 10h18"/>',
  return: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12"/>',
  wallet: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M17 15h2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 9a8 8 0 0 1 14-2M5 17a8 8 0 0 0 14-2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  arrow: '<path d="m15 18-6-6 6-6"/>',
  alert: '<path d="M10 4 2 19h20L14 4a2 2 0 0 0-4 0zM12 9v5M12 17h.01"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4V7ZM3 7l9 4 9-4M12 11v10"/>',
};
export function ReportIcon({ name }: { name: string }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: paths[name] ?? paths.info! }}
    />
  );
}
