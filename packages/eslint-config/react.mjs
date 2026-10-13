import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    files: [
      'apps/{super-admin,merchant-dashboard,pos}/src/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
    ],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
