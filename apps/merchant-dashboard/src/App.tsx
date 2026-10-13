import { Button } from '@waffarly/ui';
import { apiBaseUrl } from './lib/api-client.js';

export function App() {
  return (
    <main className="shell">
      <span className="eyebrow">Waffarly · Foundation</span>
      <h1>Merchant Dashboard</h1>
      <p>This dashboard shell is ready for approved merchant requirements.</p>
      <Button type="button" onClick={() => window.location.assign(apiBaseUrl())}>
        Open API base URL
      </Button>
    </main>
  );
}
