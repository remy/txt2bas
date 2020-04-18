import { readFileSync, writeFileSync } from 'fs';
import * as cli from '../index';

const cmd = process.argv[1].split('/').pop();

async function main(type) {
  const mapping = {
    i: 'input',
    o: 'output',
    f: 'format',
  };
  const options = {};
  const args = process.argv.slice(2).map((_) => _.trim());

  for (let i = 0; i < args.length; i += 2) {
    options[mapping[args[i].substring(1)]] = args[i + 1];
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
    src = await new Promise((resolve) => {
      let data = '';

      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => (data += chunk));
      process.stdin.on('end', () => resolve(data));
    });
  } else {
    src = readFileSync(options.input);
  }

  const res = cli['file2' + type](src, options.format, options.filename);

  if (options.output) {
    writeFileSync(options.output, res);
  } else {
    process.stdout.write(res);
  }
}

if (!process.argv[2] && process.stdin.isTTY) {
  console.log(`Usage: ${cmd} -i input-file -o output-file [-f 3dos|tap]`);
  process.exit(1);
}

main(cmd.endsWith('bas2txt') ? 'txt' : 'bas').catch((e) => {
  console.log(e);
});
