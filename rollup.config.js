import json from '@rollup/plugin-json';
export default [
  {
    input: 'index.js',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
    },
    external: ['@remy/unpack'], // <-- suppresses the warning
  },
  {
    plugins: [json()],
    input: 'cli/index.js',
    output: {
      file: 'dist/cli/index.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: ['@remy/unpack'], // <-- suppresses the warning
  },
];
