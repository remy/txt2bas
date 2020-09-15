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
