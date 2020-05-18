import { parseLine } from '../txt2bas';
import { bas2txtLines } from '../bas2txt';
import { line2bas, line2txt, formatText, validateTxt } from '../index';
import tap from 'tap';

tap.test('root module matches inner libs', (t) => {
  let src;
  src = '10 REM marker';
  t.same(formatText(src), src);
  t.same(line2bas(src).basic, parseLine(src));
  t.same(line2txt(parseLine(src)), bas2txtLines(parseLine(src)));

  t.end();
});

tap.test('formatText', (t) => {
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
    t.same(res, expect[i]);
  });
  t.end();
});

tap.test('white space formatting', (t) => {
  let src, res;
  src = '70 PRINT "Hello, world!"';
  res = formatText(src);
  t.same(res, src, 'pre-formatted text remains the same');

  src = '70  PRINT "Hello, world!"';
  res = formatText(src);
  t.same(res, src, 'pre-formatted text remains the same');
  t.end();
});

tap.test('validateTxt', (t) => {
  const src = '10 print "Hello, world!"';
  const res = validateTxt(src);
  t.same(res.length, 0, 'no errors');
  t.end();
});
