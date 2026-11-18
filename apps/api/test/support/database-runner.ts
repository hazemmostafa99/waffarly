/** Runs explicit database suites or applies migrations to the guarded test database only. */
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTestDatabaseUrl } from './test-database-environment.js';
import { selectDatabaseTestFiles } from './database-test-suites.js';

function prepareDatabase(databaseUrl: string): number {
  const directory = fileURLToPath(new URL('../../../../packages/database/', import.meta.url));
  const require = createRequire(
    new URL('../../../../packages/database/package.json', import.meta.url),
  );
  console.log('Applying pending migrations to the dedicated test database. No reset is performed.');
  const result = spawnSync(
    process.execPath,
    [
      join(dirname(require.resolve('prisma/package.json')), 'build/index.js'),
      'migrate',
      'deploy',
      '--config',
      './prisma.config.ts',
    ],
    {
      cwd: directory,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    },
  );
  if (result.error)
    throw new Error(
      'Could not start the installed Prisma CLI. Install workspace dependencies first.',
    );
  return result.status ?? 1;
}

async function main(): Promise<number> {
  const [suite = 'all', ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Pass a single database suite name.');
  const databaseUrl = getTestDatabaseUrl();
  if (suite === '--prepare') return prepareDatabase(databaseUrl);
  const available = (await readdir(new URL('../database/', import.meta.url))).filter((name) =>
    name.endsWith('.database.test.ts'),
  );
  const files = selectDatabaseTestFiles(suite, available).map((name) => `test/database/${name}`);
  console.log(`Running database suite: ${suite} (${files.length} files).`);
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test', '--test-isolation=none', '--test-concurrency=1', ...files],
    {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: process.env,
      stdio: 'inherit',
    },
  );
  if (result.error)
    throw new Error('Could not start database tests. Install workspace dependencies first.');
  return result.status ?? 1;
}

void main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Database test setup failed.');
    process.exitCode = 1;
  });
