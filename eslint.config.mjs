import base from '@waffarly/eslint-config/base';
import next from '@waffarly/eslint-config/next';
import react from '@waffarly/eslint-config/react';

export default [{ ignores: ['**/.next-ui-tests/**'] }, ...base, ...react, ...next];
