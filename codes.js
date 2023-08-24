// https://en.wikipedia.org/wiki/ZX_Spectrum_character_set
export default {
  0x3a: ':',
  0x3b: ';',
  0x3c: '<',
  0x3e: '>',
  // 0x2a: '*',

  // new in 2.08
  0x81: 'TIME',
  0x82: 'PRIVATE',
  0x83: 'ELSEIF',
  0x84: 'ENDIF', // internal use only: displays as IF, but indicates ELSE is present on same line
  0x85: 'EXIT',
  0x86: 'REF',

  0x87: 'PEEK$',
  0x88: 'REG',
  0x89: 'DPOKE',
  0x8a: 'DPEEK',
  0x8b: 'MOD',
  0x8c: '<<',
  0x8d: '>>',
  0x8e: 'UNTIL',
  0x8f: 'ERROR',
  0x90: 'ON',
  0x91: 'DEFPROC',
  0x92: 'ENDPROC',
  0x93: 'PROC',
  0x94: 'LOCAL',
  0x95: 'DRIVER',
  0x96: 'WHILE',
  0x97: 'REPEAT',
  0x98: 'ELSE',
  0x99: 'REMOUNT',
  0x9a: 'BANK',
  0x9b: 'TILE',
  0x9c: 'LAYER',
  0x9d: 'PALETTE',
  0x9e: 'SPRITE',
  0x9f: 'PWD',
  0xa0: 'CD',
  0xa1: 'MKDIR',
  0xa2: 'RMDIR',
  0xa3: 'SPECTRUM',
  0xa4: 'PLAY',
  0xa5: 'RND',
  0xa6: 'INKEY$',
  0xa7: 'PI',
  0xa8: 'FN',
  0xa9: 'POINT',
  0xaa: 'SCREEN$',
  0xab: 'ATTR',
  0xac: 'AT',
  0xad: 'TAB',
  0xae: 'VAL$',
  0xaf: 'CODE',
  0xb0: 'VAL',
  0xb1: 'LEN',
  0xb2: 'SIN',
  0xb3: 'COS',
  0xb4: 'TAN',
  0xb5: 'ASN',
  0xb6: 'ACS',
  0xb7: 'ATN',
  0xb8: 'LN',
  0xb9: 'EXP',
  0xba: 'INT',
  0xbb: 'SQR',
  0xbc: 'SGN',
  0xbd: 'ABS',
  0xbe: 'PEEK',
  0xbf: 'IN',
  0xc0: 'USR',
  0xc1: 'STR$',
  0xc2: 'CHR$',
  0xc3: 'NOT',
  0xc4: 'BIN',
  0xc5: 'OR',
  0xc6: 'AND',
  0xc7: '<=',
  0xc8: '>=',
  0xc9: '<>',
  0xca: 'LINE',
  0xcb: 'THEN',
  0xcc: 'TO',
  0xcd: 'STEP',
  0xce: 'DEF FN',
  0xcf: 'CAT',
  0xd0: 'FORMAT',
  0xd1: 'MOVE',
  0xd2: 'ERASE',
  0xd3: 'OPEN #',
  0xd4: 'CLOSE #',
  0xd5: 'MERGE',
  0xd6: 'VERIFY',
  0xd7: 'BEEP',
  0xd8: 'CIRCLE',
  0xd9: 'INK',
  0xda: 'PAPER',
  0xdb: 'FLASH',
  0xdc: 'BRIGHT',
  0xdd: 'INVERSE',
  0xde: 'OVER',
  0xdf: 'OUT',
  0xe0: 'LPRINT',
  0xe1: 'LLIST',
  0xe2: 'STOP',
  0xe3: 'READ',
  0xe4: 'DATA',
  0xe5: 'RESTORE',
  0xe6: 'NEW',
  0xe7: 'BORDER',
  0xe8: 'CONTINUE',
  0xe9: 'DIM',
  0xea: 'REM',
  0xeb: 'FOR',
  0xec: 'GO TO',
  0xed: 'GO SUB',
  0xee: 'INPUT',
  0xef: 'LOAD',
  0xf0: 'LIST',
  0xf1: 'LET',
  0xf2: 'PAUSE',
  0xf3: 'NEXT',
  0xf4: 'POKE',
  0xf5: 'PRINT',
  0xf6: 'PLOT',
  0xf7: 'RUN',
  0xf8: 'SAVE',
  0xf9: 'RANDOMIZE',
  0xfa: 'IF',
  0xfb: 'CLS',
  0xfc: 'DRAW',
  0xfd: 'CLEAR',
  0xfe: 'RETURN',
  0xff: 'COPY',
};

export const usesLineNumbers = [
  'GO SUB',
  'GO TO',
  'LIST',
  'LINE',
  'LLIST',
  'RESTORE',
  'RUN',
  'CODE',
  'EXIT',
];

export const bitWiseOperators = ['&', '|', '^', '!', '>>', '<<'];

export const operators = [
  'AND', // logic
  'OR',
  'NOT',
  'MOD',
  '-', // math
  '*',
  '/',
  '<', // compare
  '>',
  '<=',
  '>=',
  '<>',
  ...bitWiseOperators,
  'INT', // misc?
];

export const intFunctions = [
  'IN',
  'REG',
  'PEEK',
  'DPEEK',
  'USR',
  'BIN',
  'RND',
  'BANK',
  'SPRITE',
  'INT',
  'ABS',
  'SGN',
  ...operators,
].reduce((acc, curr) => {
  acc[curr] = true;
  return acc;
}, {});

intFunctions.SPRITE = ['CONTINUE', 'AT', 'OVER'];
intFunctions.BANK = ['USR', 'PEEK', 'DPEEK'];
intFunctions.ABS = ['*'];

export const functions = [
  'ABS',
  'ACS',
  'ASN',
  'ATN',
  'ATTR',
  'CHR$',
  'CODE',
  'COS',
  'EXP',
  'FN',
  'IN',
  'INKEY$',
  'INT',
  'LEN',
  'PEEK',
  'PEEK$',
  'PI',
  'POINTER',
  'REG',
  'RND',
  'SCREEN$',
  'SGN',
  'SIN',
  'SQR',
  'STR$',
  'TAN',
  'USR',
  'VAL',
  'VAL$',
].reduce((acc, curr) => {
  acc[curr] = true;
  return acc;
}, {});

// FIXME - unused and I'm not sure it's complete
// RS 2023-07-06
export const keywords = [
  'BANK',
  'BEEP',
  'BORDER',
  'BRIGHT',
  'CAT',
  'CD',
  'CIRCLE',
  'CLEAR',
  'CLOSE',
  'CLS',
  'CONTINUE',
  'COPY',
  'DATA',
  'DEF',
  'DEFPROC',
  'DIM',
  'DRAW',
  'DRIVER',
  'ELSE',
  'ENDPROC',
  'ERASE',
  'ERROR',
  'FLASH',
  'FOR',
  'GO',
  'GOSUB',
  'IF',
  'INK',
  'INPUT',
  'INVERSE',
  'LAYER',
  'LET',
  'LINE',
  'LIST',
  'LLIST',
  'LOAD',
  'LOCAL',
  'LPRINT',
  'MERGE',
  'MKDIR',
  'MOVE',
  'NEW',
  'NEXT',
  'ON',
  'OPEN',
  'OUT',
  'OVER',
  'PALETTE',
  'PAPER',
  'PAUSE',
  'PLAY',
  'POINT',
  'PLOT',
  'POKE',
  'DPOKE',
  'PRINT',
  'PROC',
  'PWD',
  'RANDOMIZE',
  'READ',
  'REG',
  'REM',
  'REMOUNT',
  'REPEAT',
  'RESTORE',
  'RETURN',
  'RMDIR',
  'RUN',
  'SAVE',
  'SPECTRUM',
  'SPRITE',
  'STOP',
  'TILE',
  'VERIFY',
];

export const printModifiers = [
  'INK',
  'PAPER',
  'FLASH',
  'INVERSE',
  'OVER',
  'BRIGHT',
  'POINT',
  'AT',
  'LINE',
  'TO',
  'BIN',
  'TAB',
  'TIME',
].reduce((acc, curr) => {
  acc[curr] = true;
  return acc;
}, {});
