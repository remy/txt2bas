/**
 * A complete object representation of NextBASIC code
 */
export type ParsedBasic = {
  /** NextBASIC encoded data */
  basic: Uint8Array;
  line: string;
  /** byte length */
  length: number;
  lineNumber: number;
  tokens: Token[];
};

export type Token = {
  /** The token type name */
  name: string;
  /** Token byte value */
  value: number | string;
  /** Source text content */
  text: string;
  /** Numerical value */
  numeric: number;
  /** Flag (only used on number types) */
  integer: boolean;
};

/**
 * A simple definition pragma set as: #define KEY=VALUE
 */
export type Define = {
  key: string;
  value: Statement;
};

/** Where a bank starts */
export type BankSplit = {
  /** the filename */
  bankFile: string;
  /** the starting line in the Statement array */
  line: number;
};

/**
 * Represents the result of parsing a line of code.
 */
export type ParseLineResult = {
  /** The encoded bytes */
  bytes: Uint8Array;
  /** The length of the line */
  length: number;
  /** The tokens in the line */
  tokens: Token[][];
  /** The statements in the line */
  statements: Statement[];
  /** The autostart value */
  autostart: number;
  /** The filename */
  filename: string;
  /** The autoline value */
  autoline: Autoline;
  /** The defines */
  defines: Define[];
  /** The bank splits */
  bankSplits: BankSplit[];
};

/**
 * Represents the options for parsing.
 */
export type ParseOptions = {
  /** Whether to throw on validation failures */
  validate?: boolean;
  /** Whether to keep lines starting with "#" */
  keepDirectives?: boolean;
  /** Whether the target will be a bank */
  bank?: boolean;
};

export type Expect = {
  /** The token name value to expect, such as KEYWORD, etc */
  name: string;
  /** The error message to throw if expectation isn't met */
  error: string;
  /** Narrows specification of expectation */
  value?: string;
};

import {
  Statement as StatementClass,
  Autoline as AutolineClass,
} from './txt2bas/index';

export type Statement = InstanceType<typeof StatementClass>;
export type Autoline = InstanceType<typeof AutolineClass>;

export type RenumberOptions = {
  /** The line number to affect */
  start?: number;
  /** Increment by step */
  step?: number;
  /** The line number to end renumbering */
  end?: number;
  /** Moves lines to a new location */
  relocate?: boolean;
  /** Only used with relocate, the number of lines to work with if  end is not specified */
  limit?: number;
  /** Used with relocate to specify where the lines should be moved _to_ */
  base?: number;
};
