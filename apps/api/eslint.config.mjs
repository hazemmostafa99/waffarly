import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rootConfig from '../../eslint.config.mjs';

const sourceRoot = fileURLToPath(new URL('./src/', import.meta.url));
const dependencies = {
  auth: ['subscriptions'],
  subscriptions: [],
  health: [],
  merchants: ['auth', 'subscriptions'],
  plans: ['auth', 'subscriptions'],
  activities: ['auth'],
  catalog: ['auth', 'inventory'],
  inventory: ['auth'],
  purchasing: ['auth', 'inventory'],
  storefront: ['auth', 'catalog'],
  orders: ['auth', 'catalog', 'inventory', 'shifts', 'payments', 'subscriptions'],
  media: ['auth'],
  reports: ['auth'],
  shifts: ['auth'],
  payments: ['auth', 'shifts'],
};

const boundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      privateImport: 'Import {{feature}} through its index.js public entry point.',
      dependency:
        '{{feature}} must not depend on {{target}}. Update the architecture deliberately before adding this dependency.',
      shared: 'Shared technical code must not import business feature modules.',
      controller: 'Controllers must call application services rather than importing database code.',
    },
  },
  create(context) {
    const filename = context.filename;
    const relativeFile = path.relative(sourceRoot, filename).replaceAll('\\', '/');
    const sourceFeature = /^modules\/([^/]+)\//.exec(relativeFile)?.[1];
    function check(node, value) {
      if (typeof value !== 'string') return;
      const resolved = value.startsWith('.')
        ? path
            .relative(sourceRoot, path.resolve(path.dirname(filename), value))
            .replaceAll('\\', '/')
        : value;
      const targetFeature = /^modules\/([^/]+)\//.exec(resolved)?.[1];
      if (/^(common|infrastructure|config)\//.test(relativeFile) && targetFeature) {
        context.report({ node, messageId: 'shared' });
      }
      if (
        filename.endsWith('.controller.ts') &&
        (value === '@waffarly/database' || resolved.startsWith('infrastructure/database/'))
      ) {
        context.report({ node, messageId: 'controller' });
      }
      if (!sourceFeature || !targetFeature || sourceFeature === targetFeature) return;
      if (resolved !== `modules/${targetFeature}/index.js`) {
        context.report({ node, messageId: 'privateImport', data: { feature: targetFeature } });
      }
      if (!(dependencies[sourceFeature] ?? []).includes(targetFeature)) {
        context.report({
          node,
          messageId: 'dependency',
          data: { feature: sourceFeature, target: targetFeature },
        });
      }
    }
    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
    };
  },
};

export default [
  ...rootConfig,
  {
    files: ['src/**/*.ts'],
    plugins: { architecture: { rules: { boundaries } } },
    rules: { 'architecture/boundaries': 'error' },
  },
];
