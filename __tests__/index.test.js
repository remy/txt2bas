import { parseLine } from '../txt2bas';
import { bas2txtLines } from '../bas2txt';
import { line2bas, line2txt, formatText } from '../index';
import tap from 'tap';

tap.test('root module matches inner libs', (t) => {
  let src;
  src = '10 REM marker';
  t.same(formatText(src), src);
  t.same(line2bas(src).basic, parseLine(src));
  t.same(line2txt(parseLine(src)), bas2txtLines(parseLine(src)));

  t.end();
});
