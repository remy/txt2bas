import test from 'ava';
import {
  parseLineWithData,
  parseLine,
  parseLines,
  parseBasic,
} from '../txt2bas/index.mjs';
import {
  line2txt,
  formatText,
  file2bas,
  file2txt,
  statements,
} from '../index.mjs';
import * as parser from '../parser-version.mjs';
import { promises as fsPromises } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { readFile } = fsPromises;

test('source = output', (t) => {
  let src = '10 REM marker';
  t.is(line2txt(parseLine(src)), src, src);
  src = '5 LET b=%@01111100';
  t.is(line2txt(parseLine(src)), src, src);
  src = '10 LET b=%$ea';
  t.is(line2txt(parseLine(src)), src, src);
});

test('beep and encoded numbers', (t) => {
  let src = '10 BEEP .01,2';
  const res = parseLine(src);
  t.is(res.length, 23);
});

test('generates BANK code', async (t) => {
  let src = '10 PRINT "Hello, World!"\n20 GO TO 10';
  parser.setParser(parser.v207);
  const res = file2bas(src, { bank: true });
  parser.setParser(parser.v208);
  const expect = Uint8Array.from(
    await readFile(__dirname + '/fixtures/bank.p20')
  );
  t.deepEqual(res, expect, 'BANK code');
});

test('PEEK$', (t) => {
  let src = '10 m$=PEEK$(%f, ~10)';
  const res = parseLineWithData(src).tokens;

  t.is(res[2].text, 'PEEK$', 'PEEK$ is a distinct token');
  t.is(res[2].value, 0x87, 'PEEK$ is a distinct token');
});

test('#autoline feature', async (t) => {
  let fixture = await readFile(__dirname + '/fixtures/autoline.txt', 'utf8');
  let res = statements(file2txt(file2bas(fixture)));

  t.is(res.length, 6, 'expecting 6 statements');
  t.is(res[5].line, '110 DEFPROC playGame()', 'step worked');

  // remove auto step
  fixture = fixture.replace(/#autoline 10,20/, '#autoline 10');
  res = statements(file2txt(file2bas(fixture)));

  t.is(res[5].line, '60 DEFPROC playGame()', 'auto step defaulted to 10');

  res = formatText('run at 2', true);
  t.is(res, 'RUN AT 2', 'format supports autoline');
});

test('#autoline stop', async (t) => {
  let fixture = await readFile(
    __dirname + '/fixtures/autoline-stop.txt',
    'utf8'
  );
  let res = statements(file2txt(file2bas(fixture)));

  t.is(res.length, 6, 'expecting 6 statements');
  t.is(res[5].line, '100 DEFPROC playGame()', 'step worked');
});

test('binary', (t) => {
  let src = '10 LET %a= BIN 1';
  let expect = [0xc4, 0x31, 0x0e, 0x00, 0x00, 0x01, 0x00, 0x00, 0x0d];
  let res = Array.from(parseLine(src)).slice(-expect.length);
  t.deepEqual(res, expect, 'non int BIN was parsed');

  src = '10 LET %b=%@10';
  expect = [0x25, 0x40, 0x31, 0x30, 0x0d];
  res = Array.from(parseLine(src)).slice(-expect.length);
  t.deepEqual(res, expect, 'integer binary was parsed');
});

test('comments', (t) => {
  let src, expect, res;
  src = '10; one';
  expect = [0x06, 0x00, 0x3b, 0x20, 0x6f, 0x6e, 0x65, 0x0d];
  res = Array.from(parseLine(src));
  t.deepEqual(res.slice(-expect.length), expect);

  src = '10 REM one';
  expect = [0xea, 0x6f, 0x6e, 0x65, 0x0d];
  res = Array.from(parseLine(src));
  t.deepEqual(res.slice(-expect.length), expect);

  src = '220 ; IF %b<3 THEN GO TO 10';
  res = statements(src);

  t.is(res[0].tokens.length, 3, 'comment token, space, comment');
  t.is(res[0].tokens[2].name, 'COMMENT', 'a single comment statement is found');
});

test('end with $', (t) => {
  let src = '202 IF INKEY$="s" THEN';
  let expect = [
    0x00, 0xca, 0x08, 0x00, 0xfa, 0xa6, 0x3d, 0x22, 0x73, 0x22, 0xcb, 0x0d,
  ];

  const res = Array.from(parseLine(src));
  t.deepEqual(res.slice(-expect.length), expect);
});

test('line', (t) => {
  const src = `10 PRINT 10: ; This is a comment`;
  const res = formatText(src);
  t.is(res, src);
});

test('pound', (t) => {
  const src = `10 PRINT "£"`;
  const res = parseLine(src);
  const line = line2txt(res);

  t.is(line, src);
});

test('preserve white space', (t) => {
  const src = '10     IF 1 THEN %x=1';
  const res = parseLine(src);

  t.deepEqual(
    res.slice(4, 7),
    new Uint8Array([0x20, 0x20, 0x20]),
    'contains leading white space'
  );
});

test('shortcut on goto', (t) => {
  const src = '10 goto 20';
  const res = formatText(src);

  t.is(res, '10 GO TO 20');
});

test('def fn and others with spaces work', (t) => {
  let src, res;

  src = '10 DEF FN'; // s(x)=x*x: REM square of x';
  res = parseLine(src);

  t.is(line2txt(res), src);
  t.is(res.slice(4, 5)[0], 0xce);
});

test('comment only lines', (t) => {
  const src = '10 ;';
  const res = parseLine(src);

  t.is(line2txt(res), src);
});

test('dot commands', (t) => {
  let src, res;
  src = '1040 .ls';
  res = parseLine(src);
  t.is(line2txt(res), src);

  src = '1050 .bas2txt "this.bas" "this.txt"';
  res = parseLine(src);
  t.is(line2txt(res), src);

  src = '10 ON ERROR .uninstall ndrplayer.drv: STOP';
  res = parseLine(src);
  t.is(line2txt(res), src);
});

test('handles DOS CR', async (t) => {
  t.plan(2);

  const fixture = await readFile(__dirname + '/fixtures/from-next-bas2txt.txt');

  const res = parseLines(fixture.toString());

  t.is(res.tokens.length, 1, 'one line of code');
  t.is(res.filename, 'test', 'correct program name');
});

test('def fn args', async (t) => {
  t.plan(1);

  const fixture = await readFile(
    __dirname + '/fixtures/def-fn-bytes.txt',
    'utf-8'
  );
  const expect = await readFile(__dirname + '/fixtures/def-fn-bytes.bas');

  const res = parseLines(fixture.toString());

  t.is(
    res.bytes.length + 128,
    Uint8Array.from(expect).length,
    'same length bytes'
  );
});

test('tight lines', (t) => {
  t.plan(1);
  let src, res;
  src = '20 plot0,0:draw f,175:plot 255,0:draw -f,175';
  res = line2txt(parseLines(src).bytes);

  t.is(res, '20 PLOT 0,0: DRAW f,175: PLOT 255,0: DRAW -f,175');
});

test('UDG char encoding', async (t) => {
  t.plan(1);

  const src = (await readFile(__dirname + '/fixtures/udg.txt')).toString(
    'binary'
  );
  const res = parseLines(src);
  t.deepEqual(
    res.bytes.slice(-5),
    new Uint8Array([0x9e, 0x80, 0x9f, 0x22, 0x0d])
  );
});

test('throwing shapes', (t) => {
  const src = `10 print "▛▜"'"▙▟"`;
  const res = parseLines(src);
  t.is(res.bytes.length, 15, 'expecting 16 bytes');
});

test('directives and comments', async (t) => {
  const src = `# this is ignored\n#program hello\n10 print "ok"\n#autostart 10\n20 goto 10`;

  let res = parseLines(src);

  t.is(res.filename, 'hello', 'found filename');
  t.is(res.autostart, 10, 'autostart correct');
  t.is(res.statements.length, 2, 'has two lines');

  res = parseLine('# this is ignored');
  t.is(res.length, 0, 'comments are stripped');
});

test('bank limits', (t) => {
  const src = `20 PRINT "remyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremyremy yremyremyremyremyremyremyremy yremy 1234567"`;

  t.notThrows(() => parseLines(src, { bank: true }), '256 bytes');
  t.throws(
    () => parseLines(src + '8', { bank: true }),
    {
      message: /exceed/i,
    },
    '257 bytes throws'
  );
});

test('int expression encoding', (t) => {
  let src = '10 sprite pause %1 to 2';
  let res = statements(src, { validate: false });
  let last = res[0].tokens.pop();
  t.is(last.name, 'NUMBER');

  src = '10 print % reg 7 & BIN 11';
  res = statements(src, { validate: false })[0].tokens;
  res.shift(); // print
  res.shift(); // %
  res.shift(); // reg
  let token = res.shift(); // 7
  t.is(token.integer, true);
  t.is(token.numeric, 7);
  res.shift(); // &
  res.shift(); // bin
  token = res.shift(); // 0b11
  t.is(token.integer, true);
  t.is(token.numeric, 3);

  src = '10 LET %j=% INT { CODE INKEY$ }-$30';
  res = statements(src, { validate: false })[0].tokens;
  token = res.pop();
  t.is(token.integer, true);
  t.is(token.numeric, 48);
});

test('INT function', (t) => {
  let src, res, token;
  src = '10 LET a=% INT {1}';
  res = statements(src, { validate: false })[0].tokens;
  res.pop(); // }
  token = res.pop();
  t.is(token.name, 'NUMBER');
});

test('ELSE IF (2.08)', (t) => {
  let src, res;

  src = '20 ELSE IF 1 < 2 PRINT "ELSE"';
  res = parseLines(src).statements[0];

  t.is(res.tokens[0].text, 'ELSE', 'has else');
  t.is(res.tokens[1].text, 'IF', 'then "special" if');
  t.is(res.tokens[1].value, 0x83, 'correct IF value for following ELSE');
});

test('IF with THEN (2.08)', (t) => {
  let src, res;

  src = '10 IF %z THEN: ELSE IF %z=34 THEN: ELSE PRINT "3"';

  res = parseLines(src).statements[0].tokens;
  t.is(res[6].value, 0xfa, 'correct IF value when THEN is used');
});

test('PRIVATE pads', (t) => {
  let src, res;

  src = '10 PRIVATE t=0';

  res = parseLines(src).bytes;
  t.is(res[5], 0x0e, 'start of 6 byte buffer');
});

test('String modifiers', (t) => {
  let src, res;

  src = '10 PRINT a$[<+->]';
  res = parseLines(src)
    .tokens.flat()
    .find((_) => (_.value || _.text) === '<');
  t.is(res.name, 'SYMBOL', 'modifier is correct');

  src = '10 PRINT a$[<+->][<]';
  res = parseLines(src)
    .tokens.flat()
    .find((_) => (_.value || _.text) === '<');
  t.is(res.name, 'SYMBOL', 'following modifier is correct');

  src = '10 PRINT a$(5)[-](3 TO 7)[<]';
  res = parseLines(src)
    .tokens.flat()
    .find((_) => (_.value || _.text) === '<');
  t.is(res.name, 'SYMBOL', 'modifier after string var is correct');
});

const tests = [
  (src, res, t) => {
    src = '10 IF %(12/8) MOD 2 THEN BANK 14 POKE 0,%188';
    res = statements(src);

    const index = res[0].tokens.findIndex((_) => _.text === 'BANK');
    t.is(res[0].tokens[index + 1].integer, false, 'bank 14 is a float type');
  },
  (src, res, t) => {
    src = '40 OPEN #4,"w>4,0,16,20,5"';
    res = parseLines(src).statements[0];

    t.is(res.tokens[0].name, 'KEYWORD', 'leading keywords');
    t.is(res.tokens[1].value, '4', 'then channel number');
  },
  (src, res, t) => {
    src = '10 .install "t:/nextdaw.drv"';
    res = parseLines(src).statements[0].tokens.pop();
    t.is(res.name, 'DOT_COMMAND');
  },
  (src, res, t) => {
    src = '10 REPEAT UNTIL %n=200';
    res = parseLines(src).statements[0].tokens.pop();
    t.is(res.integer, true, src);
  },
  (src, res, t) => {
    src = '370 SPRITE -2,16,0,1,1, BIN 110';
    res = parseLines(src).statements[0].tokens.pop();
    t.is(res.numeric, 6, 'binary interpreted as 6 and not 110');
  },
  (src, res, t) => {
    src = '370 SPRITE -2,16,0,1,1, %@110';
    res = parseLines(src).statements[0].tokens.pop();
    t.is(res.numeric, 6, 'shorthand binary interpreted as 6 and not 110');
  },
  (src, res, t) => {
    src = '10 %k=% ABS SGN {f}=1';
    t.notThrows(() => {
      res = parseLines(src);
    }, src);
  },
  (src, res, t) => {
    src = '10 %k=%x MOD 48 <> 0';
    res = parseLines(src).statements[0].tokens.pop();
    t.is(res.integer, true, '10 %k=%x MOD 48 <> 0');
  },
  (src, res, t) => {
    src = '10 IF %g > 20 THEN %g=20';
    res = parseBasic(src).tokens.pop();

    t.is(res.integer, false, 'IF %g > 20 THEN %g=20');
  },
  (src, res, t) => {
    src = '10 ENDPROC';
    res = parseLines(src).statements[0].tokens.pop();
    t.is(res.name, 'KEYWORD', 'ENDPROC is a keyword');
  },
  (src, res, t) => {
    src = '55 PRINT AT %0,%0;"0"(1)';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    res.pop();
    res = res.pop();
    t.is(res.name, 'NUMBER', 'float number found');
  },
  (src, res, t) => {
    src = '10 %a=% SPRITE OVER (0,35,1,1)';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    res.pop(); // ')'
    res = res.pop();
    t.is(res.name, 'LITERAL_NUMBER', 'int number found');
  },
  (src, res, t) => {
    src = '10 PRINT 1e6';
    res = parseLines(src, { validate: false }).statements[0].tokens;

    res = res.pop(); // 'number'
    t.is(res.name, 'NUMBER', 'number found');
    t.is(res.value, '1e6', 'original source found');
    t.is(res.numeric, 1e6, 'has correct value');
  },
  (src, res, t) => {
    src = '10 LAYER PALETTE %0 BANK 32,%0';
    res = parseLines(src, { validate: false }).statements[0].tokens;

    res = res.filter((_) => _.name === 'NUMBER')[0]; // first 'number'
    t.truthy(!!res, 'number tokens found');
    t.is(res.name, 'NUMBER', 'number found');
    t.is(res.value, '32', 'original source found');
    t.is(res.integer, false, 'integer mode was reset');
  },
  (src, res, t) => {
    src = '30 PRINT POINT %i<<3,%i;s$(%i,1 TO 10)';
    res = parseLines(src, { validate: false }).statements[0].tokens;

    res = res.filter((_) => _.name === 'NUMBER').pop(); // last 'number'
    t.is(res.name, 'NUMBER', 'number found');
    t.is(res.value, '10', 'original source found');
    t.is(res.integer, false, 'integer mode was reset');
  },
  (src, res, t) => {
    src = '10 PRINT AT %1,%29;%840/PEEK 23672';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      0,
      'PRINT ; % - no numbers found'
    );
    t.is(
      res.filter((_) => _.name === 'LITERAL_NUMBER').length,
      4,
      '4 literal numbers found'
    );
  },
  (src, res, t) => {
    src = '40 %d=%d-(IN 57342 &1)';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      0,
      '%IN() - no numbers found'
    );
    t.is(
      res.filter((_) => _.name === 'LITERAL_NUMBER').length,
      2,
      '2 literal numbers found'
    );
  },
  (src, res, t) => {
    src = '120 %r=%1+ DPEEK 23730';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(res.pop().integer, true, '%1 + DPEEK n - is an int');
  },
  (src, res, t) => {
    src = '10 @ here';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name.includes('NUMBER')).length,
      0,
      '@ label not misread as number'
    );
  },
  (src, res, t) => {
    src = '10 @here';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name.includes('NUMBER')).length,
      0,
      '@ label with no space not misread as number'
    );
  },
  (src, res, t) => {
    src = '10 %x=%SGN{RND0}';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      0,
      'No numbers found in %SGN{RND0}'
    );
    t.is(
      res.filter((_) => _.name === 'LITERAL_NUMBER').length,
      1,
      'Int 0 found in %SGN{RND0}'
    );
  },
  (src, res, t) => {
    src = '270 %CODE = %CODE | @10: REM Disable BREAK';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      0,
      'No numbers found in %CODE = %CODE | @10'
    );
  },
  (src, res, t) => {
    src = '10 BANK %27 DPOKE %y<<1,%BANK 27 DPEEK (319-n<<1)';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      0,
      'No numbers found in BANK %27 DPOKE %y<<1 (all ints)'
    );
  },
  (src, res, t) => {
    src = '10 IF %ABS SPRITE AT (36,3)<6 THEN';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      0,
      'No numbers found in IF %ABS SPRITE AT (36,3)<6'
    );
  },
  (src, res, t) => {
    src = '100 SPRITE CONTINUE %n+1,%n<8128 TO %n<8128+127 STEP 1 RUN';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      1,
      'Found literally at end'
    );
  },
  (src, res, t) => {
    src = '10 FOR %n=%0 TO %255 STEP 4';
    res = parseLines(src, { validate: false }).statements[0].tokens;
    t.is(
      res.filter((_) => _.name === 'NUMBER').length,
      1,
      'Found number at end of FOR'
    );
  },
];

tests.forEach((fn, i) => {
  test(`in the wild ${i}`, (t) => {
    fn('', '', t);
  });
});
