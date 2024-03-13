import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'index.js',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
    },
    plugins: [json()],
    external: ['@remy/unpack'], // <-- suppresses the warning
  },
  {
    plugins: [json(), nodeResolve()],
    input: 'cli/txt2bas.js',
    output: {
      file: 'dist/cli/txt2bas.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['@remy/unpack'],
  },
  {
    plugins: [json(), nodeResolve()],
    input: 'cli/bas2txt.js',
    output: {
      file: 'dist/cli/bas2txt.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['@remy/unpack'],
  },
];
