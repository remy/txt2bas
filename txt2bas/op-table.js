import codes from '../codes';

export const opTable = Object.entries(codes).reduce(
  (acc, [code, str]) => {
    acc[str] = parseInt(code);
    return acc;
  },
  {
    // aliases
    GOTO: 0xec,
    GOSUB: 0xed,
  }
);
