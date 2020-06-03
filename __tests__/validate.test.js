import test from 'ava';
import { parseBasic } from '../txt2bas';
import { validateStatement } from '../txt2bas/validator';
import { promises as fsPromises } from 'fs';
import { validateTxt } from '../index';
const { readFile } = fsPromises;

function asBasic(s) {
  const { tokens } = parseBasic(s);
  return tokens;
}

function contains(str) {
  if (!str) return null;
  return {
    message: new RegExp(str.replace(/\(/g, '\\(').replace(/\)/g, '\\)')),
  };
}

test('test bad if', (t) => {
  const src = '10 IF 0';
  const line = asBasic(src);
  t.throws(
    () => {
      validateStatement(line);
    },
    contains('IF statement must have THEN'),
    src
  );
});

test('validator works with autoline', async (t) => {
  const fixture = await readFile(__dirname + '/fixtures/autoline.txt');
  const res = validateTxt(fixture);

  t.is(res.length, 0, 'no validation errors');
});

test('validator errors without autoline', async (t) => {
  let fixture = await readFile(__dirname + '/fixtures/autoline.txt', 'utf8');
  fixture = fixture.split('\n').slice(2).join('\n');
  const res = validateTxt(fixture);

  t.is(res.length, 6, '6 line number');
});

test('test bad int expression', (t) => {
  t.plan(2);
  let line;
  let debug = {};

  t.throws(
    () => {
      line = asBasic('10 %4 << %1');
      validateStatement(line, debug);
    },
    contains('Expected to assign an integer value to an identifier'),
    '10 %4 << %1'
  );

  line = asBasic('10 a = %4 << 1');
  t.notThrows(() => {
    validateStatement(line, debug);
  }, '10 a = %4 << 1');
});

test('hex looking like dec', (t) => {
  t.plan(1);
  const line = asBasic('740 let %a=$10');
  t.throws(() => {
    validateStatement(line);
  });
});

function throws(src, expect, { debug, message } = {}) {
  test(src, (t) => {
    t.throws(
      () => {
        const line = asBasic(src);
        validateStatement(line, debug);
      },
      contains(expect),
      message
    );
  });
}

function notThrows(src, { debug, message } = {}) {
  test(src, (t) => {
    const line = asBasic(src);
    t.notThrows(() => validateStatement(line, debug), message);
  });
}

// const debug = {};
notThrows('374 IF %p=0 THEN TILE 1,HEIGHT AT %x+15,%p TO %r,%p');
notThrows('945 IF %i = 20 THEN PRINT %i', {
  message: 'IF comparison is fine and is able to print',
});
notThrows('590 PRINT AT 0,0;%x;":";%y;"(";ctr;")  "');
notThrows('760 IF sgn{(e-a) < 0} THEN %g=%a: ELSE %g=%e');
notThrows('945 %i = %20:; remark', { message: '; is fine for remarks' });
notThrows('10 FOR %i=%0 TO %3');
notThrows('10 %a = % sprite over (1,2)');
notThrows('10 sprite pause 1 to 2');
notThrows('10 sprite pause 1 to %2');
notThrows('10 sprite pause %1 to 2');
notThrows('10 sprite pause %1 to %2');
notThrows('10 a = % sprite continue s');
notThrows('10 a = % bank 1 usr 5000');
notThrows('10 bank %a copy to %c');
notThrows('10 bank a copy to %c');
notThrows('10 %k=% ABS SGN {f}=1');
notThrows('10 ENDPROC =%i,%i+1');
notThrows('10 INPUT "New project name? ";f$');
notThrows('945; remark', { message: '; is fine for remarks' });
notThrows('945 PRINT AT 0,1;"Remy":;remark', {
  message: '; is fine for remarks',
});
notThrows('1198  ;PRINT AT 10,0;%o;"--";%o & @1000;"   "', {
  message: 'comments with leading white space are allowed',
});
notThrows('430 LAYER PALETTE %0 BANK %b,%256', {
  message: 'keyword resets int expression',
});
notThrows('360 BANK %b COPY %( SGN {n}+7)*7+512,%7 TO %b,%c-1*7+258', {
  message: 'keyword resets int expression #2',
});
notThrows('10 LET %a=% RND 16384:PRINT %a,% PEEK a', {
  message: 'int functions do not reset int expression',
});
notThrows('10 LET %a = % IN 254', {
  message: 'int functions do not reset int expression #2',
});
notThrows('10 PRINT %REG 7 & BIN 00000011', {
  message: 'int functions do not reset int expression #3',
});
notThrows('10 PRINT %@00000011', {
  message: 'bin shorthand requires int expression',
});
notThrows('10 PRINT BIN 00000011', { message: 'use of bin is allowed' });

notThrows('10 LOAD "feet.map" BANK 15:; for the feet', {
  message: 'no space allowed before semicolon',
});
notThrows('10 LOAD "feet.map" BANK 15:    ; for the feet', {
  message: 'more than one space allowed before semicolon',
});

notThrows('342 LET kID=% INT {kID}+1', { message: 'float cast to int' });

notThrows('90 DRAW INK c;x2-x1,y2-y1');
notThrows('90 DRAW PAPER c;x2-x1,y2-y1');
notThrows('90 DRAW BRIGHT c;x2-x1,y2-y1');
notThrows('90 DRAW INVERSE c;x2-x1,y2-y1');
notThrows('90 DRAW OVER c;x2-x1,y2-y1');

/********************************************/

throws('10 %a = % sprite over (%1,2)', 'Cannot redeclare integer');
throws('10 IF %f=0 OR (%f=b) THEN ENDPROC =%0', 'Cannot redeclare integer');
throws('10 %j=% SPRITE OVER (b+1,1 TO %c,8,8)', 'Cannot redeclare integer');
throws('945 IF %i = %20 THEN PRINT %i', 'Cannot redeclare integer');

throws('10 PROC _foo()', 'Function names can only contain letters');
throws('10 DEFPROC _foo()', 'Function names can only contain letters');
throws('10 DEFPROC 5foo()', 'Function names can only contain letters');

throws('760 ', 'Empty line');
throws('945 IF %i = 20 ENDPROC', 'IF statement must have THEN');
throws('10 % sprite continue %', 'Expected to assign');
throws('10 IF %b=%c THEN ENDPROC', 'Cannot redeclare integer expression', {
  message: 'integer expression function on either side of IF comparator',
});
throws(
  '760 IF sgn{(e-a) < 0} THEN %g=%a ELSE %g=%e',
  'Statement separator (:) expected before ELSE'
);
throws('760       ', 'Empty line', {
  message: 'Line with only white space should fail',
});
throws(
  '945 %i = %20; ENDPROC',
  'Semicolons are either used at start of statement',
  { message: 'Only semicolon should be used in PRINT context' }
);

throws('10 let a(0 = 10', 'Expected to see closing');
throws('10 let a[0 = 10', 'Expected to see closing');
throws('10 let a{0 = 10', 'Expected to see closing');
throws('10 LET %A[i*j=% RND 192: ; 0 = x', 'Expected to see ');

// throws('10 BANK 14 POKE 0,188+%P+k', null, {
//   message: 'int expression must be at the start',
// });

// throws(
//   '10 IF %i AND B(i+4) THEN %B(i+4)=0:%B(i+5)|@1000000: PROC takeLife()',
//   null,
//   { message: 'nonsense' }
// );
