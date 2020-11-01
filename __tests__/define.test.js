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

test('basic define with int transform', (t) => {
  let src = `#autoline 10
#define POINTER=127
% SPRITE AT (#POINTER,1)`;

  const res = file2bas(src, { defines: true, includeHeader: false });

  t.is(res.includes(0x0e), false);
});

test('keep directives', (t) => {
  const src = `#define X=0
#program foo

10 run AT 3
20 PROC loadAssets()`;

  const res = formatText(src);
  t.is(src.replace(/run/, 'RUN'), res);
});

test('mixed case', (t) => {
  const src = `#autoline 10
#define spriteNumber=1
PRINT %#spriteNumber`;

  const res = file2bas(src, { defines: true });

  const txt = file2txt(res);
  t.is(txt.includes('PRINT %1'), true);
  t.is(res.slice(-2)[0], 0x31);
  t.not(res.slice(-2)[0], 0x00);
});
