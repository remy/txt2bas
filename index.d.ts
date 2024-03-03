type Token = {
  name: string;
  value: number | string;
  text: string;
  numeric: number;
  integer: boolean;
};

type ParsedBasic = {
  basic: Uint8Array;
  line: string;
  length: number;
  lineNumber: number;
  tokens: Token[];
};
