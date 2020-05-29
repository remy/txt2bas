import test from 'ava';
import { parseLine } from '../txt2bas';
import { bas2txtLines } from '../bas2txt';
import { line2bas, line2txt, formatText, validateTxt } from '../index';

test('root module matches inner libs', (t) => {
  let src;
  src = '10 REM marker';
  t.is(formatText(src), src);
  t.deepEqual(line2bas(src).basic, parseLine(src));
  t.is(line2txt(parseLine(src)), bas2txtLines(parseLine(src)));
});

test('formatText', (t) => {
  const src = `# this is ignored\n#program hello\n10 print "ok"\n#autostart 10\n20 goto 10`;
  const expect = [
    '# this is ignored',
    '#program hello',
    '10 PRINT "ok"',
    '#autostart 10',
    '20 GO TO 10',
  ];
  src.split('\n').forEach((line, i) => {
    const res = formatText(line);
    t.is(res, expect[i]);
  });
});

test('white space formatting', (t) => {
  let src, res;
  src = '70 PRINT "Hello, world!"';
  res = formatText(src);
  t.is(res, src, 'pre-formatted text remains the same');

  src = '70  PRINT "Hello, world!"';
  res = formatText(src);
  t.is(res, src, 'pre-formatted text remains the same');
});

test('validateTxt', (t) => {
  const src = '10 print "Hello, world!"';
  const res = validateTxt(src);
  t.is(res.length, 0, 'no errors');
});
