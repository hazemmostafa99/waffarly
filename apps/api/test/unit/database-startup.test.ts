import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { waitForDatabase } from '../../src/infrastructure/database/database-startup.js';
import { parseEnvironment } from '../../src/config/environment.js';

describe('database startup', () => {
  it('recovers after an outage with capped backoff and stops probing after success', async () => {
    let probes = 0;
    const delays: number[] = [];
    await waitForDatabase(
      async () => {
        if (++probes < 5) throw new Error('unavailable');
      },
      { attempts: 5, retryDelayMs: 1_000 },
      () => {},
      async (delay) => {
        delays.push(delay);
      },
    );
    assert.equal(probes, 5);
    assert.deepEqual(delays, [1_000, 2_000, 4_000, 5_000]);
  });

  it('fails after the configured attempts without leaking connection details', async () => {
    let probes = 0;
    const delays: number[] = [];
    await assert.rejects(
      waitForDatabase(
        async () => {
          probes++;
          throw new Error('postgresql://private-user:private-password@host/db');
        },
        { attempts: 3, retryDelayMs: 100 },
        () => {},
        async (delay) => {
          delays.push(delay);
        },
      ),
      { message: 'Database startup check failed after 3 attempts.' },
    );
    assert.equal(probes, 3);
    assert.deepEqual(delays, [100, 200]);
  });

  it('connects immediately without retrying a healthy database', async () => {
    await waitForDatabase(
      async () => [],
      { attempts: 5, retryDelayMs: 100 },
      () => assert.fail('must not retry'),
      async () => assert.fail('must not sleep'),
    );
  });

  it('validates pool and retry settings and supplies bounded defaults', () => {
    const env = { DATABASE_URL: 'postgresql://test:test@localhost/test' };
    const config = parseEnvironment(env);
    assert.equal(config.DATABASE_POOL_MAX, 10);
    assert.equal(config.DATABASE_CONNECTION_TIMEOUT_MS, 3_000);
    assert.equal(config.DATABASE_IDLE_TIMEOUT_MS, 30_000);
    assert.equal(config.DATABASE_STARTUP_ATTEMPTS, 5);
    for (const overrides of [
      { DATABASE_POOL_MAX: '0' },
      { DATABASE_CONNECTION_TIMEOUT_MS: '0' },
      { DATABASE_IDLE_TIMEOUT_MS: '-1' },
      { DATABASE_STARTUP_ATTEMPTS: '0' },
      { DATABASE_STARTUP_RETRY_DELAY_MS: 'NaN' },
    ])
      assert.throws(() => parseEnvironment({ ...env, ...overrides }));
    assert.equal(parseEnvironment({ ...env, DATABASE_POOL_MAX: '15' }).DATABASE_POOL_MAX, 15);
  });
});
