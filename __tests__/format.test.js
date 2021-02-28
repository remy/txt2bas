import test from 'ava';
import { formatText } from '../index';

test('retains spaces (with autoline true)', (t) => {
  let src = `10 ; Thanks Remy for your extension!`;
  const res = formatText(src, true);
  t.is(res, src);
});

test('does not shunt', (t) => {
  let src = `20 .cd "\\PML\\EMPTY": REM shunted left`;
  const res = formatText(src, true);
  t.is(res, src);
});

// test('retain leading spaces', (t) => {
//   const src = `
//   #autoline
//   100 ON ERROR GO TO 120: ; if uninstall fails, just jump over
//   110 .uninstall /nextos/espat.drv
//   120 ON ERROR GO TO 140: ; if we error, it's possible it's already installed
//   130 .install /nextzxos/espat.drv
//   #autoline 150,1`;

//   const res = formatText(src, src.includes('#autoline'));

//   console.log('>>>' + res);
//   t.fail(true);
// });
