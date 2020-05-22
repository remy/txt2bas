import { parseBasic } from '../txt2bas';
import { validateStatement } from '../txt2bas/validator';
import { promises as fsPromises } from 'fs';
import { validateTxt } from '../index';
const { readFile } = fsPromises;

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

tap.test('validator works with autoline', async (t) => {
  const fixture = await readFile(__dirname + '/fixtures/autoline.txt');
  const res = validateTxt(fixture);

  t.same(res.length, 0, 'no validation errors');
  t.end();
});

tap.test('validator errors without autoline', async (t) => {
  let fixture = await readFile(__dirname + '/fixtures/autoline.txt', 'utf8');
  fixture = fixture.split('\n').slice(2).join('\n');
  const res = validateTxt(fixture);

  t.same(res.length, 6, '6 line number');
  t.end();
});

tap.test('test bad int expression', (t) => {
  t.plan(2);
  let line = asBasic('10 %4 << %1');
  let debug = {};
  t.throws(() => {
    validateStatement(line, debug);
  }, /Cannot redeclare integer expression whilst already inside one/);

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
  t.throws(
    () => {
      validateStatement(line);
    },
    (e) => e.message.includes('Statement separator (:) expected before ELSE'),
    'ELSE should be a separate statement'
  );

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
  t.throws(
    () => {
      validateStatement(line);
    },
    (e) => e.message.includes('IF statement must have THEN'),
    'Incomplete IF statement'
  );

  line = asBasic('945 %i = %20; ENDPROC');
  t.throws(
    () => {
      validateStatement(line);
    },
    (e) =>
      e.message.includes('Semicolons are either used at start of statement'),
    'Only semicolon should be used in PRINT context'
  );

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

  // line = asBasic('10 BANK 14 POKE 0,188+%P+k');
  // t.throws(() => {
  //   validateStatement(line, debug);
  // }, 'int expression must be at the start');

  t.end();
});
