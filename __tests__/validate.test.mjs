import test from 'ava';
import { promises as fsPromises } from 'fs';
import { parseBasic } from '../txt2bas/index.mjs';
import { validateStatement } from '../txt2bas/validator.mjs';
import { validateTxt } from '../index.mjs';
import * as parser from '../parser-version.mjs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { readFile } = fsPromises;

/**
 * @param {string} s
 * @returns {import("~/index.d.ts").Token[]}
 */
function asBasic(s) {
  const { tokens } = parseBasic(s);
  return tokens;
}

/**
 * @param {string} str
 * @returns {null|{message: RegExp}}
 */
function contains(str) {
  if (!str) return { any: false };
  return {
    message: new RegExp(str.replace(/\(/g, '\\(').replace(/\)/g, '\\)')),
  };
}

// test('test bad if', (t) => {
//   const src = '10 IF 0';
//   const line = asBasic(src);
//   t.throws(
//     () => {
//       validateStatement(line);
//     },
//     contains('IF statement must have THEN'),
//     src
//   );
// });

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

test('hex looking like dec', (t) => {
  t.plan(1);
  const line = asBasic('740 let %a=$10');

  t.throws(() => {
    parser.setParser(parser.v207);
    validateStatement(line);
    parser.setParser(parser.LATEST);
  });
  parser.setParser(parser.LATEST);
});

test('#bank splitting resets line numbers', async (t) => {
  let fixture = await readFile(
    __dirname + '/fixtures/bank-split-numbers.txt',
    'utf8'
  );
  fixture = fixture.split('\n').slice(2).join('\n');
  const res = validateTxt(fixture);

  t.deepEqual(res, [], 'no validation errors');
});

/**
 * @param {string} src
 * @param {string} expect
 * @param {object} [options]
 * @param {string} [options.debug]
 * @param {string} [options.message]
 * @param {string} [options.title=src]
 */
function throws(src, expect, { debug, message, title } = { title: src }) {
  test(title || src, (t) => {
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

/**
 * @param {string} src
 * @param {object} [options]
 * @param {string} [options.debug]
 * @param {string} [options.message]
 * @param {string} [options.title=src]
 */
function notThrows(src, { debug, message, title } = {}) {
  test(title || src, (t) => {
    const line = asBasic(src);
    t.notThrows(() => validateStatement(line, debug), message);
  });
}

// const debug = {};
notThrows('10 a = %4 << 1');
notThrows('10 let %a = % BANK b USR 0');
notThrows('20 LET %a = % IN 254');
notThrows('20 PRINT %REG 7 & BIN 00000011');
notThrows('20 LET %a=% RND 16384:PRINT %a,% PEEK a');
notThrows('10 %g = % RND 5');
notThrows('10 %g = %40 * RND 5');
notThrows('10 %g = % BANK 5');
notThrows('10 LAYER PALETTE %0 BANK %5');
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

notThrows('10 LET %j=% INT { CODE INKEY$ }-$30');
notThrows('10 .install "t:/nextdaw.drv": ; "some stuff"');

notThrows('342 LET kID=% INT {kID}+1', { message: 'float cast to int' });
notThrows('10 IF % SPRITE AT (0,1) > 220 THEN SPRITE 0,,32');
notThrows('90 DRAW INK c;x2-x1,y2-y1');
notThrows('90 DRAW PAPER c;x2-x1,y2-y1');
notThrows('90 DRAW BRIGHT c;x2-x1,y2-y1');
notThrows('90 DRAW INVERSE c;x2-x1,y2-y1');
notThrows('90 DRAW OVER c;x2-x1,y2-y1');
notThrows('10 IF %in 49150 & @1 = 0 THEN PRINT "OK"');
notThrows('20 IF % SPRITE 20=1 THEN SPRITE 20,smx,smy,12,0');
notThrows('10 IF % SGN {f < 0} THEN %g=%a');
notThrows('1340 REG 6,% REG 7&119');
notThrows('950 INK % RND 2+1');
notThrows('10 LET %A[i*j]=%48* RND 6');
notThrows('335 anim=1:   ; Alien Animation Frame Status');
notThrows('4304 IF % ABS PEEK 23672-q < 1 THEN ENDPROC');
notThrows(
  '10 BANK b POKE "A null-terminated string",0,"A bit7-terminated string"~,1000~'
);
notThrows('462 a=5: NEXT n:   ; Column Statuses');
notThrows('10 %A=%1 << RND 4');
notThrows('10 m$=BANK 12 PEEK$(%f,~10)');
notThrows('10 %o=%o+ INT { LEN e$}');
notThrows('55 PRINT AT %2,%13;"000000"(1 TO 6- LEN STR$ hscore)+ STR$ hscore');
notThrows('10     DEFPROC main()');
notThrows('10 %a = INT 5');
notThrows('10 %a = INT { 5 }');
notThrows('10 %a = INT 5 + a');
notThrows('10 REM     comment with space');
notThrows('30 PRINT "ok":%x=255');
notThrows('30 PRINT AT %i,0;%i;" ",%W(i);" "');
notThrows('55 PRINT AT 0,0;%x-1,%y >> 8');
notThrows('55 PLOT INVERSE 1;%x-1,%y >> 8');
notThrows('55 PLOT INVERSE 1;%p(#COORD)-1,%y >> 8');
notThrows('50 PLOT OVER 1;x0,0: PLOT x,0');
notThrows('10 PRINT AT 0,0;% SPRITE AT (1,0)');
notThrows('10 SPRITE PRINT 1');
notThrows('10 PRINT % BANK 15 USR 0');
notThrows('10 PRINT AT 0,0; % BANK 15 USR 0');
notThrows('10 INPUT LINE z$');
notThrows('80 PRINT "Char";TAB (6);"Count"');
notThrows(
  '943 IF a$="HTTP/1.1 200 OK" THEN FOR k=1 TO 10: INPUT #7, LINE a$: NEXT k'
);
notThrows('10   %a = 10');
notThrows('10 PRINT ("TRUE" AND b)+("FALSE" AND NOT b)');
notThrows('100 PROC x(12,,”bob”):STOP');
notThrows('120 PRINT name$');
notThrows('10 DEF FN ian$(REF jenny$(),index)=jenny$(index)');
notThrows('10 LET x,y = y,x');
notThrows('10 a,b,c,d$,e$,f = 1,2,3,"xyz","zzz",g*h');
notThrows('10 y$ *= 2');
notThrows('120 PRINT "Press a key for left":x=INPUT -2');
notThrows('10 " Hello There! "[<+->]');
notThrows('10 a$(5)[-](3 TO 7)[<]');
notThrows('30 PRINT "perftest() took ";TIME;" frames"');
notThrows('20 PRINT %a+1');
notThrows('20 %a=1');
notThrows('10 PRINT TIME$');
notThrows('20 IF %m&12 THEN ELSE %m=%m+1', { message: 'THEN ELSE is allowed' });
notThrows('10 DATA $DEAD');
notThrows('10 PRINT " Hello There!   "[<+->]');
/********************************************/

// throws('20 PRINT (%a)+1');
throws(
  '330 REPEAT UNTIL %(c=13) AND %(j > 8)',
  'Cannot redeclare integer expression'
);
throws('330 PRINT INK 2; AT 19,12; CHR$ 147; PAUSE 6');
notThrows('8810 PRINT BRIGHT M(I)>0');
throws('10 %a = % sprite over (%1,2)', 'Cannot redeclare integer');
throws('10 IF %f=0 OR (%f=b) THEN ENDPROC =%0', 'Cannot redeclare integer');
throws('10 %j=% SPRITE OVER (b+1,1 TO %c,8,8)', 'Cannot redeclare integer');
throws('945 IF %i = %20 THEN PRINT %i', 'Cannot redeclare integer');

throws('10 PROC _foo()', 'Function names can only contain letters');
throws('10 DEFPROC _foo()', 'Function names can only contain letters');
throws('10 DEFPROC 5foo()', 'Function names can only contain letters');

throws('760 ', 'Empty line');
// throws('945 IF %i = 20 ENDPROC', 'IF statement must have THEN');
throws('10 % sprite continue %', 'Cannot redeclare integer expression whilst');
throws('10 IF %b=%c THEN ENDPROC', 'Cannot redeclare integer expression', {
  message: 'integer expression function on either side of IF comparator',
});
throws('10 %4 << %1', 'Cannot redeclare integer expression whilst');
throws(
  '760 IF sgn{(e-a) < 0} THEN %g=%a ELSE %g=%e',
  'Statement separator (:) expected before ELSE'
);
throws('760       ', 'Empty line', {
  title: 'Empty line, lots of white space',
  message: 'Line with only white space should fail',
});
throws(
  '945 %i = %20; ENDPROC',
  'Semicolons are either used at start of statement',
  { message: 'Only semicolon should be used in PRINT context' }
);

// throws('10 PRINT % ATTR(0,0)');
throws('10 let a(0 = 10', 'Expected to see closing');
throws('10 let a[0 = 10', 'Expected to see closing');
throws('10 let a{0 = 10', 'Expected to see closing');
throws('10 LET %A[i*j=% RND 192: ; 0 = x', 'Expected to see ');
// throws('10 LET a=% INT {% 1}'); // doesn't throw
throws('10 .install t:/nextdaw.drv');
throws('10 PRINT AT 1,0;"x"%x;":";%x >> 3+i;"   ";');
throws('10 TILE 4,1 AT 0,24+%o');
throws('10 PAUSE 0: DEFPROC main()');
throws('10 %a = %a + INT 5');
throws('10 %a = INT 5 + %a');
