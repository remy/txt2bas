import { readFileSync, writeFileSync } from 'fs';
import * as cli from '../index';
import { version } from '../package.json';

const cmd = process.argv[1].split('/').pop();

async function main(type) {
  const mapping = {
    i: 'input',
    o: 'output',
    f: 'format',
    t: 'test',
    b: 'bank',
    d: 'debug',
    udg: 'udg',
    H: 'headerless',
    tokens: 'tokens',
    h: 'help',
  };
  const bools = [
    'bank',
    'test',
    'debug',
    'tokens',
    'udg',
    'headerless',
    'help',
  ];
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

  if (options.help) {
    return help();
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
      const debug = {};
      res = cli.validateTxt(src.toString(), debug);
      signal = res.length > 0 ? 1 : 0;
      if (options.debug) {
        res = JSON.stringify({ scope: debug.scope, errors: res });
      } else {
        res =
          res
            .map((res) => {
              const pos = parseInt(res.split('at: ').pop().split(':')[0], 10);
              return res + `\n${' '.repeat(pos + 1)}^`;
            })
            .join('\n\n') + '\n';
      }
    } else {
      if (options.tokens) {
        res = JSON.stringify(cli.tokens(src, { validate: false }));
      } else {
        res = cli['file2' + type](src, {
          ...options,
          includeHeader: !options.headerless,
          validate: false,
          binary: options.udg,
          bank: options.bank,
        });
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

  let outputType = 'binary';
  if (type === 'txt' && !options.udg) {
    outputType = 'utf8';
  }

  if (options.output) {
    writeFileSync(options.output, res, outputType);
  } else {
    if (typeof res === 'string' && options.udg) {
      const data = [];
      for (let i = 0; i < res.length; i++) {
        data.push(res.charCodeAt(i));
      }
      const buffer = Buffer.from(data);
      process.stdout.write(buffer, outputType);
    } else {
      process.stdout.write(res, outputType);
    }
  }
  process.exit(signal);
}

function help() {
  console.log(`  Usage: ${cmd} [-i input-file] [-o output-file]`);
  console.log('');
  console.log(`  Options:`);
  console.log('');
  if (cmd.endsWith('txt2bas')) {
    console.log('  -f 3dos|tap ... set the output format');
    console.log('  -t ............ parse and validate the NextBASIC');
    console.log('  -H ............ omit the file header');
    console.log('  -bank.......... output LOAD "file" BANK format');
  }
  console.log('  -udg .......... UDGs are used so encode with binary not utf8');
  console.log('  -v ............ Show current version');

  console.log('');
  console.log(`  Note that ${cmd} can also read and write on STDIN and STDOUT`);

  console.log('');

  console.log(`  v${version}`);
  console.log(
    '  \x1B[1mAny issues should be filed at \x1B[4mhttps://github.com/remy/txt2bas\x1B[0m'
  );
  console.log('');
}

if (!process.argv[2] && process.stdin.isTTY) {
  help();
  process.exit(1);
}

if (process.argv[2] === '-v') {
  console.log(version);
  process.exit(0);
}

main(cmd.endsWith('bas2txt') ? 'txt' : 'bas').catch((e) => {
  console.log(e);
});
