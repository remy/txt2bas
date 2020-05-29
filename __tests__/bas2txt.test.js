import test from 'ava';
import { line2txt, file2txt } from '../index';
import { parseLineWithData } from '../txt2bas';
import { promises as fsPromises } from 'fs';
const { readFile } = fsPromises;

test('strings protected', (t) => {
  const src = [0x00, 0x0a, 0x05, 0x00, 0xf5, 0x22, 0x90, 0x22, 0x0d];
  const line = line2txt(src);
  t.is(line.slice(-2, -1).charCodeAt(0), 144);
});

test('UDG char encoding', async (t) => {
  t.plan(1);

  const src = await readFile(__dirname + '/fixtures/udg.bas');
  const line = file2txt(src);
  const res = Uint8Array.from({ length: line.length }, (_, i) => {
    return line.charCodeAt(i);
  });

  t.deepEqual(
    res.slice(-5),
    new Uint8Array([0x9e, 0x80, 0x9f, 0x22, 0x0a]),
    'udg encoding matches'
  );
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
