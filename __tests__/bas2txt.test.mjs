import test from 'ava';
import { line2txt, file2txt } from '../index.mjs';
import { parseLineWithData } from '../txt2bas/index.mjs';
import { promises as fsPromises } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { readFile } = fsPromises;

test('strings protected', (t) => {
  const src = [0x00, 0x0a, 0x05, 0x00, 0xf5, 0x22, 0x90, 0x22, 0x0d];
  const line = line2txt(src);
  t.is(line.includes('\\A'), true);
});

test('vars', async (t) => {
  const src = await readFile(__dirname + '/fixtures/tyvarian.bas');
  const line = file2txt(src);
  t.is(line.includes('100 SAVE'), true);
});

test('UDG char encoding', async (t) => {
  t.plan(2);

  const src = await readFile(__dirname + '/fixtures/udg-test.bas');
  const line = file2txt(src);

  t.is(line, '10 PRINT "\\A"\n');
  t.is(src[src.length - 3], 0x90);
});

test('BANKed code', async (t) => {
  const src = await readFile(__dirname + '/fixtures/bank.p20');
  const lines = file2txt(src);

  const expect = '10 PRINT "Hello, World!"\n20 GO TO 10\n';

  t.is(lines, expect, 'BANK code extracted');
});

test('shapes mapped to utf8', async (t) => {
  t.plan(1);

  const src = await readFile(__dirname + '/fixtures/shapes.bas');
  const line = file2txt(src);

  t.truthy(line.includes('▛'));
});

test('comments are parsed as plain text', (t) => {
  let text, src, res;
  text = '220 ; IF %b<3 THEN GO TO 10';
  src = parseLineWithData(text);
  res = line2txt(src.basic);
  t.is(res, text, 'comments are untouched with ;');

  text = '220 IF b="rem:;" THEN LET %b<3';
  src = parseLineWithData(text);
  res = line2txt(src.basic);
  t.is(
    res,
    '220 IF b="rem:;" THEN LET %b < 3',
    'ignores comment looking strings'
  );

  text = '220 REM IF %b<3 THEN GO TO 10';
  src = parseLineWithData(text);
  res = line2txt(src.basic);
  t.is(res, text, 'comments are untouched with REM');
});

test('else if (2.08)', (t) => {
  let text, src, res;
  text = '20 ELSE IF 1 < 2 PRINT "ELSE"';
  src = parseLineWithData(text); // to binary
  res = line2txt(src.basic); // to text
  t.is(res, text, 'new IF correctly rendered');
});

test('lines are not being clipped', async (t) => {
  const src = await readFile(__dirname + '/fixtures/clipped-lines.bnk');
  const lines = file2txt(src).split('\n').filter(Boolean);

  t.is(lines.length, 4);
});
