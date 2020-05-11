import { parseBasic } from '../txt2bas';
import { validateStatement } from '../txt2bas/validator';
import tap from 'tap';

function asBasic(s) {
  const [, line] = parseBasic(s);
  return line;
}

tap.test('test bad if', (t) => {
  t.plan(1);
  const line = asBasic('10 IF 0');
  t.throws(() => {
    validateStatement(line);
  }, 'threw');
});

tap.test('test bad int expression', (t) => {
  t.plan(1);
  const line = asBasic('10 %4 << %1');
  try {
    validateStatement(line);
    t.fail('should have thrown');
  } catch (e) {
    t.pass();
  }
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

  t.end();
});
