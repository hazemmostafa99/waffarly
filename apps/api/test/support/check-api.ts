/** Runs the normal API checks in a predictable order, stopping at the first failure. */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cwd = fileURLToPath(new URL('../../', import.meta.url));
const cli = (name: string, relative: string) =>
  join(dirname(require.resolve(`${name}/package.json`)), relative);
const tests = ['http', 'unit'].flatMap((directory) =>
  readdirSync(join(cwd, 'test', directory))
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
    .map((name) => `test/${directory}/${name}`),
);
const steps: Array<{ name: string; args: string[] }> = [
  {
    name: 'Formatting',
    args: [
      cli('prettier', 'bin/prettier.cjs'),
      '--check',
      'src',
      'test',
      'package.json',
      'eslint.config.mjs',
    ],
  },
  { name: 'Typecheck', args: [cli('typescript', 'bin/tsc'), '-p', 'tsconfig.json', '--noEmit'] },
  { name: 'Lint', args: [cli('eslint', 'bin/eslint.js'), 'src', 'test'] },
  { name: 'HTTP/unit tests', args: ['--import', 'tsx', '--test', ...tests] },
  { name: 'Build', args: [cli('typescript', 'bin/tsc'), '-p', 'tsconfig.json'] },
];
for (const step of steps) {
  console.log(`\nAPI check: ${step.name}`);
  const result = spawnSync(process.execPath, step.args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    console.error(`API check stopped at: ${step.name}`);
    process.exitCode = result.status || 1;
    break;
  }
}
