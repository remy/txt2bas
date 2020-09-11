import test from 'ava';
import { parseLine } from '../txt2bas';
import { bas2txtLines } from '../bas2txt';
import {
  line2bas,
  line2txt,
  formatText,
  validateTxt,
  file2bas,
  file2txt,
} from '../index';

test('root module matches inner libs', (t) => {
  let src;
  src = '10 REM marker';
  t.is(formatText(src), src);
  t.deepEqual(line2bas(src).basic, parseLine(src));
  t.is(line2txt(parseLine(src)), bas2txtLines(parseLine(src)));
});

test('tap', (t) => {
  let src = '#autostart 10\n10 REM marker\n20 PAUSE 0\n';
  const bytes = file2bas(src, { format: 'tap' });

  const txt = file2txt(bytes, { format: 'tap' });

  t.is(src, txt, 'tap convert matches');
});

test('strip comments', (t) => {
  let src = '#autostart 10\n10 PAUSE 0\n20 REM marker\n';
  const bytes = file2bas(src, { stripComments: true });

  const txt = file2txt(bytes);

  t.is(txt, '#autostart 10\n10 PAUSE 0\n', 'matches');
});

test('strip comments and autoline works', (t) => {
  let src = '#autostart\n#autoline 1,1\nREM marker\nPAUSE 0\n';
  const bytes = file2bas(src, { stripComments: true });

  const txt = file2txt(bytes);

  t.is(txt, '#autostart 1\n1 PAUSE 0\n', 'matches');
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

test('format dot command', (t) => {
  const src = `10 .install file`;
  const expect = '10 .install file';
  let res = formatText(src, true);
  t.is(res, expect);
  res = formatText(res);
  t.is(res, expect);
});

test('format without let', (t) => {
  const src = '9996 e$= STR$ err';
  const res = formatText(src);
  t.is(res, src);
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
