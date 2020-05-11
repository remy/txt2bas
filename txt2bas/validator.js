import { opTable } from './op-table';
import tests from '../chr-tests.js';
import codes, { intFunctions } from '../codes';

import {
  COMMENT,
  PARAM_SEP,
  BINARY,
  IDENTIFIER,
  KEYWORD,
  PRINT,
  HEX,
  DEFFN,
  WHITE_SPACE,
  DEFFN_SIG,
  IF,
  STATEMENT_SEP,
  SYMBOL,
  OPERATION,
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
    this.resetExpression();
    this.allowHanging = false;
    this.position = -1;
    this.length = 0;
  }

  popTo(type) {
    while (this.last !== type) this.pop();
    this.pop();
  }

  resetExpression() {
    this.inFloatExpression = false;
    this.inIntExpression = false;
  }

  get hasTokens() {
    return this.tokens.length;
  }

  get last() {
    return this[this.length - 1];
  }
}

export function validateStatement(tokens, debug = {}) {
  if (!Array.isArray(tokens)) {
    throw new Error('validateStatement expects tokens to be an array');
  }

  if (tokens.length === 1 && tokens[0].name === WHITE_SPACE) {
    throw new Error('Empty line');
  }

  const scope = new BasicScope(tokens);
  debug.scope = scope; // allows testing to pull up the scope state
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

      if (scope.includes(IF) && value === opTable.THEN) {
        scope.popTo(IF);
      }

      if (value === opTable.ELSE && !scope.includes(IF)) {
        throw new Error('Statement separator (:) expected before ELSE');
      }

      if (value == opTable.PRINT) {
        scope.push(PRINT);
      }

      if (
        name === KEYWORD &&
        // !scope.includes(IF) &&
        // !scope.includes(PARAM_SEP) &&
        intFunctions.indexOf(codes[value]) === -1
      ) {
        scope.inIntExpression = false;
      }

      if (
        scope.last === DEFFN_SIG &&
        scope.previousToken.value === opTable['DEF FN']
      ) {
        // check the arg
        if (name !== IDENTIFIER) {
          throw new Error('Expected single letter function name');
        }

        if (value.length > 1 && !(value.length === 2 && value[1] === '$')) {
          throw new Error(
            'DEF FN must be followed by a single letter identifier'
          );
        }
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

      // symbols that reset the integer expression state
      if (name == SYMBOL) {
        if (value === ',') {
          if (scope.last !== PARAM_SEP) scope.push(PARAM_SEP);
          scope.resetExpression();
        }

        if (value === '=') {
          scope.push(OPERATION);
          scope.resetExpression();
        }

        if (value === ';') {
          scope.resetExpression();
        }
      }

      validateIdentifier(token, scope);
      validateCharRange(token, scope);
      validateSymbolRange(token, scope);

      expect = null;
      expectError = null;

      // setting expectations
      if (value === opTable['DEF FN']) {
        scope.push(DEFFN);
        scope.push(DEFFN_SIG);
      }

      if (value === opTable.REM) {
        expect = COMMENT;
        expectError = 'Parser error, REM keyword should be followed by COMMENT';
      }
    } catch (e) {
      let message = e.message;
      message += `, "${token.text || value}" at: ${token.pos + 1}:${
        (token.text || value).length + token.pos + 1
      }`;
      throw new Error(message);
    }
  }

  // check if anything is hanging on the scope
  if (scope.includes(IF)) {
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
        throw new Error(`Out of range character "${value[i]}" (${charCode})`);
      }
    }
  }
}

export function validateSymbolRange(token) {
  const { name, value } = token;

  if (name === SYMBOL) {
    for (let i = 0; i < value.length; i++) {
      const charCode = value[i].charCodeAt(0);
      if (charCode < 0x21 || charCode > 0x7f) {
        throw new Error(
          `Out of range symbol character "${value[i]}" (${charCode})`
        );
      }
    }
  }
}
