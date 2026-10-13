import { Button } from '@waffarly/ui';
import { apiBaseUrl } from './lib/api-client.js';

export function App() {
  return (
    <main className="shell">
      <span className="eyebrow">Waffarly · Foundation</span>
      <h1>POS Workspace</h1>
      <p>This online-first application shell is ready for approved POS requirements.</p>
      <Button type="button" onClick={() => window.location.assign(apiBaseUrl())}>
        Open API base URL
      </Button>
    </main>
  );
}
