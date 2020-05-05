import { opTable } from './op-table';
import tests from '../chr-tests.js';
import codes, { intFunctions } from '../codes';
const { parseBasic } = require('./index');

import {
  COMMENT,
  PARAM_SEP,
  BINARY,
  IDENTIFIER,
  KEYWORD,
  PRINT,
  HEX,
  DEFFN,
  DEFFN_SIG,
  IF,
  DEFFN_ARGS,
  STATEMENT_SEP,
  SYMBOL,
  OPERATION,
  STRING,
} from './types';

export function validateLineNumber(current, prev) {
  if (current === prev) {
    throw new Error(`Duplicate line number on ${current}`);
  }

  if (current < prev) {
    throw new Error(`Line numbers out of order on ${current}`);
  }

  if (!current) {
    throw new Error('Line number is missing');
  }

  if (current > 9999 || current < 0) {
    throw new Error(`Invalid line number ${current}`);
  }
}

class BasicScope extends Array {
  constructor(tokens) {
    super();
    this.inIntExpression = false;
    this.inFloatExpression = false;
    this.tokens = Array.from(tokens); // ensure this is a copy
    this.position = 0;
    this.lastToken = {};
    this.previousToken = {};
  }

  next() {
    this.previousToken = this.lastToken;
    const token = this.tokens.shift();
    this.lastToken = token;
    this.position++;

    if (token.name === STATEMENT_SEP) {
      this.reset();
    }

    return token;
  }

  peek() {
    return this.tokens[0];
  }

  reset() {
    this.inFloatExpression = false;
    this.inIntExpression = false;
    this.allowHanging = false;
    this.position = -1;
    this.length = 0;
  }

  popTo(type) {
    while (this.last !== type) this.pop();
    this.pop();
  }

  get hasTokens() {
    return this.tokens.length;
  }

  get last() {
    return this[this.length - 1];
  }
}

// validateStatement(parseBasic('10 let a = %4 << a')[1]); // ?
// validateStatement(parseBasic('10 let a = %@1')[1]); // ?
// validateStatement(
//   parseBasic('590 SPRITE CONTINUE 10,%x STEP 2 RUN ,%y STEP 2 RUN ,%s,%d')[1]
// ); // ?

// 590 SPRITE CONTINUE 10,%x STEP 2 RUN ,%y STEP 2 RUN ,%s,%d

export function validateStatement(tokens) {
  if (!Array.isArray(tokens)) {
    throw new Error('validateStatement expects tokens to be an array');
  }
  tokens; // ?
  const scope = new BasicScope(tokens);
  let expect = null;
  let expectError = null;

  while (scope.hasTokens) {
    const token = scope.next();
    const { name, value } = token;
    try {
      // expectation checks
      if (expect && name !== expect) {
        throw new Error(expectError);
      }

      if (value === opTable.IF) {
        // scope state
        scope.push(IF);
      }

      if (scope.last == IF && value === opTable.THEN) {
        scope.popTo(IF);
      }

      if (value == opTable.PRINT) {
        scope.push(PRINT);
      }

      if (
        name === KEYWORD &&
        !scope.includes(IF) &&
        !scope.includes(PARAM_SEP) &&
        intFunctions.indexOf(codes[value]) === -1
      ) {
        [name, token.text]; //?
        scope.inIntExpression = false;
      }

      if (name === SYMBOL && tests._isIntExpression(value)) {
        if (scope.inIntExpression) {
          scope.previousToken; // ?
          throw new Error(
            'Cannot redeclare integer expression whilst already inside one'
          );
        }

        if (scope.inFloatExpression) {
          throw new Error(
            'Cannot use integer expression inside floating point logical expression'
          );
        }

        scope.inIntExpression = true;
      }

      if (name === BINARY && !token.integer) {
        throw new Error('Binary values only allowed in integer expressions');
      }

      if (name === HEX && !token.integer) {
        throw new Error('Hex values only allowed in integer expressions');
      }

      if (value === opTable.BIN) {
        expect = BINARY;
      }

      if (name == SYMBOL) {
        if (value === ',') {
          scope.push(PARAM_SEP);
          scope.inIntExpression = false;
          scope.inFloatExpression = false;
        }

        if (value === '=') {
          scope.push(OPERATION);
          scope.inIntExpression = false;
          scope.inFloatExpression = false;
        }
      }

      validateIdentifier({ name, value }, scope);
      validateCharRange({ name, value }, scope);

      expect = null;
      expectError = null;

      // setting expectations
      if (value === opTable['DEF FN']) {
        scope.push(DEFFN);
        scope.push(DEFFN_SIG);
        expect = IDENTIFIER;
        expectError = 'DEF FN must be followed by a single letter identifier';
      }

      if (value === opTable.REM) {
        expect = COMMENT;
        expectError = 'Parser error, REM keyword should be followed by COMMENT';
      }
    } catch (e) {
      let message = e.message;
      message += `\nToken: ${name}, "${value}" at ${token.pos}`;
      throw new Error(message);
    }
  }

  // check if anything is hanging on the scope
  if (scope.last === IF) {
    throw new Error('IF statement must have THEN');
  }

  if (scope.lastToken.name === IDENTIFIER && scope.position === 0) {
    throw new Error('Unexpected token at end of statement');
  }
}

export function validateIdentifier({ value, name }, scope = { last: null }) {
  if (name !== IDENTIFIER) {
    return;
  }

  // this is a generic identifier
  if (value.length > 1) {
    const dollar = value.endsWith('$');
    const isString = dollar && value.length === 2;

    if (scope.inIntExpression) {
      throw new Error(
        'Only integer variables (single character vars) are allowed in integer expressions'
      );
    }

    if (isString) return;

    if (value.endsWith('$') && value.length > 2) {
      throw new Error('String variables are only allowed 1 character long');
    }

    if (scope.last === DEFFN_SIG && value.length > 1 && !isString) {
      throw new Error('Only single character names allowed for DEF FN');
    }
  }
}

export function validateCharRange(token) {
  const { name, value } = token;

  if (name === IDENTIFIER) {
    for (let i = 0; i < value.length; i++) {
      const charCode = value[i].charCodeAt(0);
      if (charCode > 255 || charCode < 32) {
        throw new Error(
          `Out of range character "${value[i]}" (${charCode}) at ${i}`
        );
      }
    }
  }
}
