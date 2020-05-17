import { renumber, shift } from '../index';
import tap from 'tap';

const src = `
10 PRINT "ok"
15 LET %x = 512
30 GO TO 10
31 GO SUB %10
32 LIST %$0a
100 RUN 32
`.trim();

let res;
let lines;

tap.test('simple renumber', (t) => {
  res = renumber(src, { start: 10 });
  lines = res.split('\n');
  t.same(lines.pop(), '60 RUN 50', 'renumbered on 10s');

  res = renumber(src, { start: 10, step: 20 });
  lines = res.split('\n');
  t.ok(lines[1].startsWith('30'), 'renumber with specific step');

  res = renumber(src, { inc: 100 });
  lines = res.split('\n');
  t.same(lines[2], '130 GO TO 110');
  t.same(lines[3], '131 GO SUB %110');
  t.same(lines[4], '132 LIST %110'); // note: hex is lost

  res = renumber(src, { start: 90, base: 50 });
  lines = res.split('\n');
  t.same(lines[0], '10 PRINT "ok"');
  t.same(lines.pop(), '50 RUN 32');

  t.end();
});

tap.test('renumber with end', (t) => {
  const src = `5 LAYER 2,1: CLS
20 LOAD "8x8.spr" BANK 16
30 TILE BANK 16
40 BANK 17 POKE 0,0,0,0,0,0,0,0,0,0
50 TILE DIM 17,0,10,8
60 TILE 1,1
70 PAUSE 0
80  ; STOP
9998 SAVE "8x8.bas"
9999 GO TO 10

`;
  t.throws(() => {
    res = renumber(src, { start: 9998, end: 9999 });
  }, 'no room for line');

  res = renumber(src, { start: 9998, end: 9999, step: 1 });

  t.ok(res.includes('GO TO 20'), 'the last line still exists (but realigned)');
  t.end();
});

tap.test(
  'relocate',
  (t) => {
    res = renumber(src, { relocate: true, start: 30, limit: 3, base: 10 });
    lines = res.split('\n');

    const expect = `
  10 GO TO 40
  20 GO SUB %40
  30 LIST %40
  40 PRINT "ok"
  50 LET %x = 512
  60 RUN 30
  `
      .split('\n')
      .map((_) => _.trim())
      .filter(Boolean);

    lines.forEach((line, i) => {
      t.same(line, expect[i]);
    });
    t.end();
  },
  { skip: true }
);

tap.test('shift', (t) => {
  res = shift(src, 10, true);
  lines = res.split('\n');

  t.same(lines[0], '10 LET %x=512', 'shifted forward');
  t.same(lines[2], '30 GO TO 15', 'shifted lines updated gotos');

  res = shift(src, 15, false);
  lines = res.split('\n');

  t.same(lines[0], '10 LET %x=512', 'shifted backwards');
  t.end();
});
