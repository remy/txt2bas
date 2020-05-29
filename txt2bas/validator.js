import { opTable } from './op-table';
import tests from '../chr-tests.js';
import { intFunctions, bitWiseOperators } from '../codes';

import {
  COMMENT,
  PARAM_SEP,
  BINARY,
  IDENTIFIER,
  KEYWORD,
  PRINT,
  HEX,
  DEFFN,
  NUMBER,
  WHITE_SPACE,
  DEFFN_SIG,
  IF,
  OPEN_PARENS,
  OPEN_BRACKETS,
  OPEN_BRACES,
  INT_PARENS,
  OUTER_IF,
  STATEMENT_SEP,
  DOT_COMMAND,
  SYMBOL,
  ASSIGNMENT,
  COMPARATOR,
  OPERATOR,
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

/**
 * Represents the scope state for a single statement
 * @class
 */
class BasicScope extends Array {
  constructor(tokens) {
    super();
    this.reset();
    this.source = Array.from(tokens);
    this.tokens = Array.from(tokens); // ensure this is a copy
    this.position = 0;
    this.lastKeyword = null;
    this.currentToken = {};
    this.previousToken = {};
  }

  next() {
    this.previousToken = this.currentToken;

    if (this.previousToken) {
      if (this.previousToken.name === KEYWORD) {
        this.lastKeyword = this.previousToken;
      }
      if (this.previousToken.name !== WHITE_SPACE) {
        this.statementStack.push(this.previousToken);
      }
    }

    const token = this.tokens.shift();
    this.currentToken = token;
    this.position++;
    if (token.name === STATEMENT_SEP) {
      validateEndOfStatement(this);
      this.reset();
    }

    return token;
  }

  reset() {
    this.resetExpression();
    this.statementStack = [];
    this.lastKeyword = null;
    this.allowHanging = false;
    this.position = -1;
    this.length = 0;
  }

  popTo(type) {
    while (this.length && this.last !== type) this.pop();
    if (this.length === 0) {
      return false;
    }
    const last = this.pop();
    return type === last;
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

  if (typeof tokens[0].name === 'undefined') {
    throw new Error('Bad token argument');
  }

  if (tokens.length === 1 && tokens[0].name === WHITE_SPACE) {
    throw new Error('Empty line (or only white space)');
  }

  const scope = new BasicScope(tokens);
  debug.scope = scope; // allows testing to pull up the scope state
  const expect = { name: null, error: null, value: null };

  while (scope.hasTokens) {
    const token = scope.next();
    const { name, value } = token;
    try {
      if (name === KEYWORD) {
        scope.push(OPERATION);
      }

      // check expectations
      if (expect.name && name !== expect.name) {
        if (expect.error) {
          throw new Error(expect.error);
        }
      }

      expect.name = null;
      expect.value = null;
      expect.error = null;

      if (value === '(') {
        scope.push(OPEN_PARENS);
        if (scope.inIntExpression) {
          scope.push(INT_PARENS);
        }
      }

      if (value === '{') {
        scope.push(OPEN_BRACES);
      }

      if (value === '[') {
        scope.push(OPEN_BRACKETS);
      }

      if (value === '}') {
        if (!scope.popTo(OPEN_BRACES)) {
          throw new Error('Missing opening `{` brace');
        }
      }

      if (value === ']') {
        if (!scope.popTo(OPEN_BRACKETS)) {
          throw new Error('Missing opening `[` bracket');
        }
      }

      if (value === ')') {
        if (!scope.popTo(OPEN_PARENS)) {
          throw new Error('Missing opening `(` parenthesis');
        }
      }

      if (value === opTable.IF) {
        // scope state
        scope.push(OUTER_IF);
        scope.push(IF);
      }

      if (scope.includes(IF) && value === opTable.THEN) {
        scope.popTo(IF);
      }

      if (value === opTable.ELSE && scope.includes(OUTER_IF)) {
        throw new Error('Statement separator (:) expected before ELSE');
      }

      if (value == opTable.PRINT || value == opTable.INPUT) {
        scope.push(PRINT);
      }

      // reset int expression on keywords
      if (name === KEYWORD && scope.inIntExpression) {
        keywordIntCheckBreak: {
          if (bitWiseOperators.includes(token.text)) {
            break keywordIntCheckBreak;
          }

          // int functions are only available to assignment operators
          if (scope.includes(ASSIGNMENT)) {
            if (intFunctions[token.text]) {
              break keywordIntCheckBreak;
            }

            // now check the last keyword isn't a multi keyword function
            if (scope.lastKeyword) {
              const lastKeyword = intFunctions[scope.lastKeyword.text];
              if (Array.isArray(lastKeyword)) {
                if (lastKeyword.includes(token.text)) {
                  break keywordIntCheckBreak;
                }
              }
            }
          }

          if (scope.includes(INT_PARENS)) {
            break keywordIntCheckBreak;
          }
          scope.inIntExpression = false;
        }
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
        scope; //?
        if (scope.inIntExpression) {
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

      if (name === BINARY && value.startsWith('@') && !token.integer) {
        throw new Error('Binary values only allowed in integer expressions');
      }

      if (name === HEX && !token.integer) {
        throw new Error('Hex values only allowed in integer expressions');
      }

      if (value === opTable.BIN) {
        expect.name = BINARY;
      }

      if (name == SYMBOL && value === ';' && !scope.includes(PRINT)) {
        // check if the semicolon is the only thing on the stack
        const length = scope.statementStack
          .slice(0, -1)
          .filter((_) => _.name !== WHITE_SPACE).length;
        if (length > 0) {
          throw new Error(
            'Semicolons are either used at start of statement as a remark or as separator for PRINT statements'
          );
        }
      }

      // symbols that reset the integer expression state
      if (name == SYMBOL) {
        if (value === ',') {
          if (scope.last !== PARAM_SEP) scope.push(PARAM_SEP);
          if (!scope.includes(INT_PARENS)) {
            scope.resetExpression();
          }
        }

        if (value === '=') {
          scope.push(OPERATOR);
          if (scope.includes(IF)) {
            scope.push(COMPARATOR);
          } else {
            scope.push(ASSIGNMENT);
            scope.resetExpression();
          }
        }

        if (value === ';') {
          scope.resetExpression();
        }
      }

      validateOpeningStatement(token, scope, expect);
      validateIdentifierDeclaration(token, scope, expect);
      validateIdentifier(token, scope, expect);
      validateCharRange(token, scope, expect);
      validateSymbolRange(token, scope, expect);

      // setting expectations
      if (value === opTable['DEF FN']) {
        scope.push(DEFFN);
        scope.push(DEFFN_SIG);
      }

      if (value === opTable.REM) {
        expect.name = COMMENT;
        expect.error =
          'Parser error, REM keyword should be followed by COMMENT';
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
  validateEndOfStatement(scope);
}

export function validateEndOfStatement(scope) {
  if (scope.includes(IF)) {
    throw new Error('IF statement must have THEN');
  }

  const open = scope.findIndex((_) => _.startsWith('OPEN_'));
  if (open > -1) {
    let what = '';
    if (scope[open] === OPEN_BRACES) {
      what = '`}` brace';
    }
    if (scope[open] === OPEN_BRACKETS) {
      what = '`]` bracket';
    }
    if (scope[open] === OPEN_PARENS) {
      what = '`)` parenthesis';
    }
    throw new Error('Expected to see closing ' + what);
  }

  if (scope.currentToken.name === IDENTIFIER && scope.position === 0) {
    throw new Error('Unexpected token at end of statement');
  }
}

export function validateIdentifier({ value, name }, scope = { last: null }) {
  if (name !== IDENTIFIER) {
    return;
  }

  if (/^([a-z][0-9a-z]*(?:\$)?)$/i.test(value) === false) {
    throw new Error(
      'Identifiers can only contain letters and numbers and must start with a letter'
    );
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

export function validateOpeningStatement(token, scope, expect) {
  /*
        Allowed starting commands other than a keyword
        DOT_COMMAND
        WHITE_SPACE
        SYMBOL(%)
        IDENTIFIER followed by ASSIGNMENT

        */

  if (scope.length > 0) {
    return;
  }

  if ([DOT_COMMAND, WHITE_SPACE].includes(token.name)) {
    return;
  }

  if (token.name === SYMBOL && token.value === '%') {
    // expect an IDENTIFIER
    expect.name = IDENTIFIER;
    expect.error = 'Expected to assign an integer value to an identifier';
  }

  if (token.name === IDENTIFIER) {
    expect.name = SYMBOL;
    expect.value = '=';
    expect.error = 'Expected to assign a value to an identifier';
  }

  if (token.name === NUMBER) {
    throw new Error(
      'A line cannot start with a number, a keyword or assignment must open a statement'
    );
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

export function validateIdentifierDeclaration({ name, text }, scope, expect) {
  if (name !== KEYWORD) return;
  if (
    text !== 'PROC' &&
    text !== 'DEFPROC' &&
    text !== 'DEF FN' &&
    text !== 'FN'
  )
    return;

  expect.name = IDENTIFIER;
  expect.error =
    'Function names can only contain letters and numbers and must start with a letter';
}
