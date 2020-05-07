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
  t.plan(2);
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
});
