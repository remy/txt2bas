import { readFileSync, writeFileSync } from 'fs';
const { PassThrough } = require('stream');
import * as cli from '../index';
import { version } from '../package.json';

const cmd = process.argv[1].split('/').pop();

async function main(type) {
  const mapping = {
    i: 'input',
    o: 'output',
    f: 'format',
    t: 'test',
    d: 'debug',
    tokens: 'tokens',
  };
  const bools = ['test', 'debug', 'tokens'];
  const options = {};
  const args = process.argv.slice(2).map((_) => _.trim());

  for (let i = 0; i < args.length; i++) {
    const c = args[i].replace(/^-+/, '');
    const opt = mapping[c] || c;

    if (bools.includes(opt)) {
      options[opt] = true;
    } else {
      options[opt] = args[i + 1];
      i++; // jump twice
    }
  }

  if (type === 'bas') {
    // input is basic, so check the output filename
    if (!options.format && options.output) {
      options.format = options.output.toLowerCase().endsWith('.tap')
        ? 'tap'
        : '3dos';
    }
  } else {
    // input is txt
    // input is basic, so check the output filename
    if (!options.format && options.input && options.input !== '-') {
      options.format = options.input.toLowerCase().endsWith('.tap')
        ? 'tap'
        : '3dos';
    }
  }

  let src = null;
  if (!process.stdin.isTTY && (!options.input || options.input === '-')) {
    // read stdin as buffer
    const result = [];
    let length = 0;
    src = await new Promise((resolve) => {
      const { stdin } = process;
      stdin.on('readable', () => {
        let chunk;

        while ((chunk = stdin.read())) {
          result.push(chunk);
          length += chunk.length;
        }
      });

      stdin.on('end', () => resolve(Buffer.concat(result, length)));
    });
  } else {
    src = readFileSync(options.input);
  }

  let res;
  let signal = 0;

  try {
    if (options.test) {
      res = cli.validateTxt(src.toString());
      signal = res.length > 0 ? 1 : 0;
      res = res.join('\n');
    } else {
      if (options.tokens) {
        res = JSON.stringify(cli.tokens(src));
      } else {
        res = cli['file2' + type](src, options.format, options.filename);
      }
    }
  } catch (e) {
    if (options.debug) {
      console.error(e.stack);
    } else {
      console.error(e.message);
    }
    process.exit(1);
  }

  if (options.output) {
    writeFileSync(options.output, res, 'binary');
  } else {
    if (typeof res === 'string') {
      const data = [];
      for (let i = 0; i < res.length; i++) {
        data.push(res.charCodeAt(i));
      }
      const buffer = Buffer.from(data);
      process.stdout.write(buffer);
    } else {
      process.stdout.write(res);
    }
  }
  process.exit(signal);
}

if (!process.argv[2] && process.stdin.isTTY) {
  console.log(`Usage: ${cmd} -i input-file -o output-file [-f 3dos|tap]`);
  console.log(`       ${cmd} -t -i input-file # test for errors`);
  process.exit(1);
}

if (process.argv[2] === '-v') {
  console.log(version);
  process.exit(0);
}

main(cmd.endsWith('bas2txt') ? 'txt' : 'bas').catch((e) => {
  console.log(e);
});
