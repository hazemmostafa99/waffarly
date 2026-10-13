import { Button } from '@waffarly/ui';
import { apiBaseUrl } from './lib/api-client.js';

export function App() {
  return (
    <main className="shell">
      <span className="eyebrow">Waffarly · Foundation</span>
      <h1>Super Admin</h1>
      <p>This application shell is ready for approved platform administration requirements.</p>
      <Button type="button" onClick={() => window.location.assign(apiBaseUrl())}>
        Open API base URL
      </Button>
    </main>
  );
}
