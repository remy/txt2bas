import test from 'ava';
import { parseLines } from '../txt2bas';
import { file2bas, file2txt, formatText } from '../index';
import { replaceDefines } from '../txt2bas/transform';

const getSource = () => `#autoline 10
#define LAND=%129
print at 0,0;#LAND`;

test('basic define', (t) => {
  let src = getSource();

  const res = parseLines(src);
  const res2 = replaceDefines(res.statements, res.defines);

  t.is(res2.pop().tokens.pop().name, 'LITERAL_NUMBER');
});

test('basic define with transform', (t) => {
  let src = getSource();

  const res = file2bas(src, { defines: true });

  const txt = file2txt(res);
  t.is(txt.includes('%129'), true);
});

test('keep directives', (t) => {
  const src = `#define X=0
#program foo

10 run AT 3
20 PROC loadAssets()`;

  const res = formatText(src);
  t.is(src.replace(/run/, 'RUN'), res);
});
