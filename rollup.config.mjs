import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'index.mjs',
    output: {
      file: 'dist/index.mjs',
      format: 'esm',
    },
    plugins: [json()],
    external: ['@remy/unpack'], // <-- suppresses the warning
  },
  {
    input: 'index.mjs',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
    },
    plugins: [json()],
    external: ['@remy/unpack'], // <-- suppresses the warning
  },
  {
    plugins: [json(), nodeResolve()],
    input: 'cli/txt2bas.mjs',
    output: {
      file: 'dist/cli/txt2bas.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['@remy/unpack'],
  },
  {
    plugins: [json(), nodeResolve()],
    input: 'cli/bas2txt.mjs',
    output: {
      file: 'dist/cli/bas2txt.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['@remy/unpack'],
  },
];
