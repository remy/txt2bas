import { parseBasic } from '../txt2bas';
import { validateStatement } from '../txt2bas/validator';
import tap from 'tap';

function asBasic(s) {
  const { tokens } = parseBasic(s);
  return tokens;
}

tap.test('test bad if', (t) => {
  t.plan(1);
  const line = asBasic('10 IF 0');
  t.throws(() => {
    validateStatement(line);
  }, 'threw');
});

tap.test('test bad int expression', (t) => {
  t.plan(2);
  let line = asBasic('10 %4 << %1');
  let debug = {};
  t.throws(() => {
    validateStatement(line, debug);
  });

  line = asBasic('10 %4 << 1');
  t.doesNotThrow(() => {
    validateStatement(line);
  });
});

tap.test('hex looking like dec', (t) => {
  t.plan(1);
  const line = asBasic('740 let %a=$10');
  t.throws(() => {
    validateStatement(line);
  }, 'hex needs int expression');
});

tap.test('In the wild', (t) => {
  let line;

  line = asBasic('374 IF %p=0 THEN TILE 1,HEIGHT AT %x+15,%p TO %r,%p');
  const debug = {};
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, 'valid use of ints in TO');

  line = asBasic('590 PRINT AT 0,0;%x;":";%y;"(";ctr;")  "');
  t.doesNotThrow(() => {
    validateStatement(line);
  }, 'print allows for multiple statements');

  line = asBasic('760 IF sgn{(e-a) < 0} THEN %g=%a ELSE %g=%e');
  t.throws(() => {
    validateStatement(line);
  }, 'ELSE should be a separate statement');

  line = asBasic('760 IF sgn{(e-a) < 0} THEN %g=%a: ELSE %g=%e');
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, 'ELSE comes after colon');

  t.throws(() => {
    line = asBasic('760 ');
    validateStatement(line);
  }, 'Line with no content should fail');

  line = asBasic('760       ');
  t.throws(() => {
    validateStatement(line);
  }, 'Line with only white space should fail');

  line = asBasic('945 IF %i = %20 ENDPROC');
  t.throws(() => {
    validateStatement(line);
  }, 'Incomplete IF statement');

  line = asBasic('945 %i = %20; ENDPROC');
  t.throws(() => {
    validateStatement(line);
  }, 'Only semicolon should be used in PRINT context');

  line = asBasic('945 %i = %20:; remark');
  t.doesNotThrow(() => {
    validateStatement(line);
  }, '; is fine for remarks');

  line = asBasic('945; remark');
  t.doesNotThrow(() => {
    validateStatement(line);
  }, '; is fine for remarks');

  line = asBasic('945 PRINT AT 0,1;"Remy":;remark');
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, '; is fine for remarks');

  line = asBasic('1198  ;PRINT AT 10,0;%o;"--";%o & @1000;"   "');
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, 'comments with leading white space are allowed');

  line = asBasic('430 LAYER PALETTE %0 BANK %b,%256');
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, 'keyword resets int expression');

  line = asBasic('360 BANK %b COPY %( SGN {n}+7)*7+512,%7 TO %b,%c-1*7+258');
  t.doesNotThrow(() => {
    validateStatement(line);
  }, 'keyword resets int expression #2');

  line = asBasic('10 LET %a=% RND 16384:PRINT %a,% PEEK a');
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, 'int functions do not reset int expression');

  line = asBasic('10 LET %a = % IN 254');
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, 'int functions do not reset int expression #2');

  line = asBasic('10 PRINT %REG 7 & BIN 00000011');
  t.doesNotThrow(() => {
    validateStatement(line, debug);
  }, 'int functions do not reset int expression #3');

  t.end();
});
