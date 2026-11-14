import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findModuleCycle, readApiModuleGraph } from '../support/module-graph.js';

test('API business modules have no circular runtime imports', () => {
  const graph = readApiModuleGraph(fileURLToPath(new URL('../../src/modules/', import.meta.url)));
  const cycle = findModuleCycle(graph);
  assert.equal(cycle, null, `Circular module imports: ${cycle?.join(' -> ')}`);
});

test('the module graph detects a cycle while accepting shared one-way dependencies', () => {
  assert.equal(
    findModuleCycle(
      new Map([
        ['orders', ['catalog', 'auth']],
        ['catalog', ['auth']],
        ['auth', []],
      ]),
    ),
    null,
  );
  assert.deepEqual(
    findModuleCycle(
      new Map([
        ['orders', ['catalog']],
        ['catalog', ['orders']],
      ]),
    ),
    ['orders', 'catalog', 'orders'],
  );
});
