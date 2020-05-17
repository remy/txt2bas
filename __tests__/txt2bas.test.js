import { parseLine, parseLines } from '../txt2bas';
import { toHex } from '../to.js';
import { line2txt, formatText, file2bas, file2txt, statements } from '../index';
import tap from 'tap';
import { promises as fsPromises } from 'fs';
const { readFile } = fsPromises;

// eslint-disable-next-line no-unused-vars
function asHex(s) {
  return s.split('').map((_) => toHex(_.charCodeAt(0)));
}

tap.test('source = output', (t) => {
  let src = '10 REM marker';
  t.same(line2txt(parseLine(src)), src);
  src = '5 LET b=%@01111100';
  t.same(line2txt(parseLine(src)), src);
  src = '10 LET b=%$ea';
  t.same(line2txt(parseLine(src)), src);

  t.end();
});

tap.test('#autoline feature', async (t) => {
  let fixture = await readFile(__dirname + '/fixtures/autoline.txt', 'utf8');
  let res = statements(file2txt(file2bas(fixture)));

  t.same(res.length, 6, 'expecting 6 statements');
  t.same(res[5].line, '110 DEFPROC playGame()', 'step worked');

  // remove auto step
  fixture = fixture.replace(/#autoline 10,20/, '#autoline 10');
  res = statements(file2txt(file2bas(fixture)));

  t.same(res[5].line, '60 DEFPROC playGame()', 'auto step defaulted to 10');

  t.end();
});

tap.test('binary', (t) => {
  let src = '10 LET %a= BIN 1';
  let expect = [0xc4, 0x31, 0x0e, 0x00, 0x00, 0x01, 0x00, 0x00, 0x0d];
  let res = Array.from(parseLine(src)).slice(-expect.length);
  t.same(res, expect);

  src = '10 LET %b=%@10';
  expect = [0x25, 0x40, 0x31, 0x30, 0x0d];
  res = Array.from(parseLine(src)).slice(-expect.length);
  t.same(res, expect);

  t.end();
});

tap.test('comments', (t) => {
  let src, expect, res;
  src = '10; one';
  expect = [0x06, 0x00, 0x3b, 0x20, 0x6f, 0x6e, 0x65, 0x0d];
  res = Array.from(parseLine(src));
  t.same(res.slice(-expect.length), expect);

  src = '10 REM one';
  expect = [0xea, 0x6f, 0x6e, 0x65, 0x0d];
  res = Array.from(parseLine(src));
  t.same(res.slice(-expect.length), expect);

  t.end();
});

tap.test('end with $', (t) => {
  let src = '202 IF INKEY$="s"';
  let expect = [
    0x00,
    0xca,
    0x07,
    0x00,
    0xfa,
    0xa6,
    0x3d,
    0x22,
    0x73,
    0x22,
    0x0d,
  ];

  const res = Array.from(parseLine(src));
  t.same(res.slice(-expect.length), expect);

  t.end();
});

tap.test('line', (t) => {
  const src = `10 PRINT 10: ; This is a comment`;
  const res = formatText(src);
  t.same(res, src);
  t.end();
});

tap.test('pound', (t) => {
  const src = `10 PRINT "£"`;
  const res = parseLine(src);
  const line = line2txt(res);

  t.same(line, src);
  t.end();
});

tap.test('int expression reset on keyword', (t) => {
  const src = '10 %x STEP 2 RUN';
  const res = parseLine(src);

  t.ok(res.includes(0x0e), 'has 5 byte number');

  t.end();
});

tap.test('preserve white space', (t) => {
  const src = '10     IF 1 THEN %x=1';
  const res = parseLine(src);

  t.same(
    res.slice(4, 7),
    new Uint8Array([0x20, 0x20, 0x20]),
    'contains leading white space'
  );

  t.end();
});

tap.test('shortcut on goto', (t) => {
  const src = '10 goto 20';
  const res = formatText(src);

  t.same(res, '10 GO TO 20');

  t.end();
});

tap.test('def fn and others with spaces work', (t) => {
  let src, res;

  src = '10 DEF FN'; // s(x)=x*x: REM square of x';
  res = parseLine(src);

  t.same(line2txt(res), src);
  t.same(res.slice(4, 5)[0], 0xce);

  t.end();
});

tap.test('comment only lines', (t) => {
  const src = '10 ;';
  const res = parseLine(src);

  t.same(line2txt(res), src);
  t.end();
});

tap.test('dot commands', (t) => {
  let src, res;
  src = '1040 .ls';
  res = parseLine(src);
  t.same(line2txt(res), src);

  src = '1050 .bas2txt "this.bas" "this.txt"';
  res = parseLine(src);
  t.same(line2txt(res), src);
  t.end();
});

tap.test('handles DOS CR', async (t) => {
  t.plan(2);

  const fixture = await readFile(__dirname + '/fixtures/from-next-bas2txt.txt');

  const res = parseLines(fixture.toString());

  t.same(res.tokens.length, 1, 'one line of code');
  t.same(res.filename, 'test', 'correct program name');
});

tap.test('def fn args', async (t) => {
  t.plan(1);

  const fixture = await readFile(
    __dirname + '/fixtures/def-fn-bytes.txt',
    'utf-8'
  );
  const expect = await readFile(__dirname + '/fixtures/def-fn-bytes.bas');

  const res = parseLines(fixture.toString());

  t.same(
    res.bytes.length + 128,
    Uint8Array.from(expect).length,
    'same length bytes'
  );
});

tap.test('tight lines', (t) => {
  t.plan(1);
  let src, res;
  src = '20 plot0,0:draw f,175:plot 255,0:draw -f,175';
  res = line2txt(parseLines(src).bytes);

  t.same(res, '20 PLOT 0,0: DRAW f,175: PLOT 255,0: DRAW -f,175');
});

tap.test('UDG char encoding', async (t) => {
  t.plan(1);

  const src = (await readFile(__dirname + '/fixtures/udg.txt')).toString(
    'binary'
  );
  const res = parseLines(src);
  t.same(res.bytes.slice(-5), new Uint8Array([0x9e, 0x80, 0x9f, 0x22, 0x0d]));
});

tap.test('throwing shapes', (t) => {
  const src = `10 print "▛▜"'"▙▟"`;
  const res = parseLines(src);
  t.same(res.bytes.length, 15, 'expecting 16 bytes');
  t.end();
});

tap.test('directives and comments', async (t) => {
  const src = `# this is ignored\n#program hello\n10 print "ok"\n#autostart 10\n20 goto 10`;

  let res = parseLines(src);

  t.same(res.filename, 'hello', 'found filename');
  t.same(res.autostart, 10, 'autostart correct');
  t.same(res.statements.length, 2, 'has two lines');

  res = parseLine('# this is ignored');
  t.same(res.length, 0, 'comments are stripped');
});
