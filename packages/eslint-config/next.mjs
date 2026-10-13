import nextPlugin from '@next/eslint-plugin-next';

export default [
  {
    files: ['apps/storefront/**/*.{js,jsx,ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: nextPlugin.configs.recommended.rules,
  },
];
