import codes from '../codes.mjs';

export const opTable = Object.entries(codes).reduce(
  (acc, [code, str]) => {
    acc[str] = parseInt(code);
    return acc;
  },
  {
    // aliases
    GOTO: 0xec,
    GOSUB: 0xed,
    RAND: 0xf9,
    CONT: 0xe8,
    'ELSE IF': 0x83,
  }
);
