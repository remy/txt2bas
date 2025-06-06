/**
 * @typedef { import("..").Token } Token
 * @typedef { import("..").Expect } Expect
 */

import { opTable } from './op-table.mjs';
import {
  intFunctions,
  functions,
  printModifiers,
  operators,
} from '../codes.mjs';
import * as parser from '../parser-version.mjs';

import {
  COMMENT,
  PARAM_SEP,
  BINARY,
  IDENTIFIER,
  KEYWORD,
  SEMI_COLON_ALLOWED,
  LITERAL_NUMBER,
  HEX,
  DEFFN,
  NUMBER,
  WHITE_SPACE,
  DEFFN_SIG,
  IF,
  FOR,
  OPEN_PARENS,
  OPEN_BRACKETS,
  OPEN_BRACES,
  INT_PARENS,
  OUTER_IF,
  STATEMENT_SEP,
  DOT_COMMAND,
  SYMBOL,
  PRINT,
  ASSIGNMENT,
  COMPARATOR,
  OPERATOR,
  OPERATION,
  UNTIL,
  STRING,
  FLOAT_EXPRESSION,
  INT_EXPRESSION,
} from './types.mjs';

/**
 * Validates that line numbers increase
 *
 * @param {number} current Current line number
 * @param {number} prev Previous
 */
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
 *
 * @class
 */
class Scope {
  /**
   * @param {Token[]} tokens
   */
  constructor(tokens) {
    this.reset();

    /** @type {Token[]} - original list of tokens */
    this.source = Array.from(tokens);
    /** @type {Token[]} - remaining tokens to process */
    this.tokens = Array.from(tokens);
    this.position = 0;

    /** @type {string} */
    this.lastKeyword = null;

    /** @type {Token} - the token currently being processed */
    this.currentToken = {};
    /** @type {Token} - the previously processed token */
    this.previousToken = {};

    /** @type {Token[]} - list of all tokens excluding spaces */
    this.statementStack = [];
  }

  /**
   * @returns {Token} Processes and validates the next token in the statement
   */
  next() {
    let token = this.currentToken;

    this.previousToken = token;
    token = this.tokens.shift();

    if (!this.previousToken.name && token.name === WHITE_SPACE) {
      // skip the first token
      return this.next();
    }

    if (token && token.name) {
      if (token.name === KEYWORD) {
        this.lastKeyword = token;

        if (this.statementKeyword === null) {
          this.statementKeyword = token;
        }
      }

      if (token.name !== WHITE_SPACE) {
        this.statementStack.push(token);
      }

      if ([opTable.ELSE, opTable.THEN].includes(token.value)) {
        this.statementStack = [];
      }
    }

    this.currentToken = token;
    this.position++;
    if (token.name === STATEMENT_SEP) {
      validateEndOfStatement(this);
      this.reset();
    }

    return token;
  }

  /**
   * @returns {Token|null}
   */
  peekNext() {
    let next = this.tokens[0];
    if (!next) return null;
    if (next.name === WHITE_SPACE) next = this.tokens[1];
    return next;
  }

  /**
   * @returns {Token}
   */
  peekPrev() {
    return this.statementStack[this.statementStack.length - 1];
  }

  reset() {
    this.resetExpression();
    this.statementStack = [];
    this.argumentExpression = [];
    this.statementKeyword = null;
    this.lastKeyword = null;
    this.expressionKeyword = null; // FIXME not sure we need this
    this.allowHanging = false;
    this.position = -1;
    this.stack = [];
  }

  findIndex(...args) {
    return this.stack.findIndex(...args);
  }

  /**
   * @param {string} value
   */
  push(value) {
    this.stack.push(value);
  }

  /** @returns {string} */
  pop() {
    return this.stack.pop();
  }

  /**
   * @param {string} value
   * @returns {boolean}
   */
  includes(value) {
    return this.stack.includes(value);
  }

  /**
   * @param {string} value
   * @param {string} before
   * @returns {boolean}
   */
  stateIsAfter(value, before) {
    const beforeIndex = this.stack.lastIndexOf(before);
    const valueIndex = this.stack.lastIndexOf(value);

    return valueIndex > beforeIndex;
  }

  /**
   * @param {string} type
   * @returns {boolean}
   */
  popTo(type) {
    while (this.stack.length && this.last !== type) this.pop();
    if (this.stack.length === 0) {
      return false;
    }
    const last = this.pop();
    return type === last;
  }

  restartIntExpression() {
    if (this.includes(INT_EXPRESSION)) {
      // check what's after the INT_EXPRESSION
      let i = this.stack.length - 1;
      while (i > -1) {
        if (this.stack[i - 1] === INT_EXPRESSION) {
          break;
        }
        i--;
      }

      let next = null;
      if (i > -1) {
        next = this.stack[i];
        if (![OPEN_BRACES, OPEN_BRACKETS, OPEN_PARENS].includes(next)) {
          next = null;
        }
      }

      this.popTo(INT_EXPRESSION);
      this.push(INT_EXPRESSION);
      this.intExpression = true;

      if (next) this.push(next);
    }
  }

  resetExpression() {
    // this.inIntExpression = false;
    this.intNext = false;
    this.intExpression = false;
    this.expression = [];
    this.argumentExpression = [];
  }

  get isFullIntExpression() {
    if (!this.intExpression) return false;
    if (this.expression.length === 0) return false;
    if (this.expression[0].value !== '%') return false;
    return true;
  }

  get hasTokens() {
    return !!this.tokens.length;
  }

  /** @type {Token} */
  get last() {
    return this.stack[this.stack.length - 1];
  }
}

/**
 * Validate a collection of tokens from a statement
 *
 * @param {Token[]} tokens
 * @param {object} debug Debug reference object which will contain scope if validation fails
 * @param {Scope} debug.scope
 */
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

  const scope = new Scope(tokens);
  debug.scope = scope; // allows testing to pull up the scope state
  const expect = { name: null, error: null, value: null };

  while (scope.hasTokens) {
    const token = scope.next();
    const { name, value } = token;
    scope.expression.push(token);
    try {
      if (name === KEYWORD) {
        scope.push(OPERATION);

        // start to read the arguments
        scope.argumentExpression = [];

        if (!scope.expressionKeyword) {
          scope.expressionKeyword = token;
        }
      } else if (name !== STATEMENT_SEP) {
        scope.argumentExpression.push(token);
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
        scope.argumentExpression = [];
        if (scope.intExpression) {
          scope.push(INT_PARENS);
        }
      }

      if (value === '{') {
        scope.push(OPEN_BRACES);
        scope.argumentExpression = [];
      }

      if (value === '[') {
        scope.push(OPEN_BRACKETS);
        scope.argumentExpression = [];
      }

      if (value === '}') {
        if (!scope.popTo(OPEN_BRACES)) {
          throw new Error('Missing opening `{` brace');
        }

        // we were inside an INT function

        if (scope.last === FLOAT_EXPRESSION) {
          scope.pop();
          // pop to INT_EXPRESSION and then set intExpression to true
          if (scope.includes(INT_EXPRESSION)) {
            scope.restartIntExpression();
          }
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

        // should I look ahead for a THEN to detect the type of IF?
      }

      if (value === opTable.UNTIL) {
        scope.push(UNTIL);
      }

      if (value === opTable.FOR) {
        scope.push(FOR);
      }

      if (scope.includes(IF) && value === opTable.THEN) {
        scope.popTo(IF);
        scope.resetExpression();
      }

      if (value === opTable.ELSE) {
        const next = scope.peekNext();

        if (next && next.text === IF) {
          // change the token to ELSEIF and drop the IF
        } else if (scope.includes(OUTER_IF)) {
          if (scope.previousToken.value !== opTable.THEN) {
            throw new Error('Statement separator (:) expected before ELSE');
          }
        }
      }

      if (
        value == opTable.PRINT ||
        value == opTable.INPUT ||
        value == opTable.PLOT ||
        value === opTable.DRAW ||
        value === opTable.CIRCLE
      ) {
        scope.push(PRINT);
        scope.push(SEMI_COLON_ALLOWED);
      }

      if (
        scope.last === DEFFN_SIG &&
        scope.previousToken.value === opTable['DEF FN']
      ) {
        // check the arg
        if (name !== IDENTIFIER) {
          if (parser.getParser() === parser.v207) {
            throw new Error('Expected single letter function name');
          } else {
            throw new Error('Expected function name');
          }
        }

        if (value.length > 1 && !(value.length === 2 && value[1] === '$')) {
          if (parser.getParser() === parser.v207) {
            throw new Error(
              'DEF FN must be followed by a single letter identifier'
            );
          }
        }
      }

      if (parser.getParser() === parser.v207) {
        if (
          name === BINARY &&
          scope.previousToken.value === '@' &&
          !token.integer
        ) {
          throw new Error('Binary values only allowed in integer expressions');
        }

        if (name === HEX && !token.integer) {
          throw new Error('Hex values only allowed in integer expressions');
        }
      }

      if (value === opTable.BIN) {
        expect.name = BINARY;
      }

      if (
        name == SYMBOL &&
        value === ';' &&
        !scope.includes(SEMI_COLON_ALLOWED)
      ) {
        // check if the semicolon is the only thing on the stack
        const length = scope.statementStack
          .slice(0, -1)
          .filter((_) => _.name !== WHITE_SPACE).length;
        if (length > 0) {
          throw new Error(
            'Semicolons are either used at start of statement as a remark or as separator for PRINT, INPUT, PLOT and DRAW statements'
          );
        }
      }

      // symbols that reset the integer expression state
      if (name == SYMBOL) {
        if (value === ',') {
          if (scope.stateIsAfter(SEMI_COLON_ALLOWED, OPEN_PARENS)) {
            scope.resetExpression();
          } else {
            scope.argumentExpression = [];
            if (scope.last !== PARAM_SEP) scope.push(PARAM_SEP);
            if (!scope.includes(INT_PARENS)) {
              if (!scope.isFullIntExpression) {
                scope.intExpression = false;
              }
            }
          }
        }

        if (value === '%') {
          scope.push(INT_EXPRESSION);
        }

        if (value === '=') {
          scope.push(OPERATOR);
          scope.argumentExpression = [];
          if (scope.includes(IF) || scope.includes(UNTIL)) {
            scope.push(COMPARATOR);
          } else if (
            scope.includes(FOR) ||
            scope.previousToken.text === 'ENDPROC'
          ) {
            scope.push(ASSIGNMENT);
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
      validateNumberTypes(token, scope, expect);
      validateExpressionState(token, scope, expect);
      validateStatementStarters(token, scope, expect);
      validateExpressionPosition(token, scope, expect);
      validateIntKeyword(token, scope, expect);
      validateComment(token, scope);
      validatePrintStatement(token, scope);

      // setting expectations
      if (value === opTable['DEF FN']) {
        scope.push(DEFFN);
        scope.push(DEFFN_SIG);
      }
    } catch (e) {
      e.message += `, "${token.text || value}" at: ${token.pos + 1}:${
        (token.text || value).length + token.pos + 1
      }`;
      throw e;
    }
  }

  // check if anything is hanging on the scope
  validateEndOfStatement(scope);
}

/**
 * @param {Token} token
 * @param {Scope} scope
 */
export function validatePrintStatement(token, scope) {
  if (token.name !== KEYWORD) {
    return;
  }

  if (!scope.statementStack.length) {
    return;
  }

  if (token.pos === scope.statementStack[0].pos) {
    return;
  }

  if (scope.stack[1] !== PRINT) {
    // PRINT covers PRINT, CIRCLE, DRAW, PLOT, etc
    return;
  }

  const op = token.text;

  if (functions[op]) {
    return;
  }

  if (printModifiers[op]) {
    return;
  }

  if (operators.includes(op)) {
    return;
  }

  if (scope.expression[0].value === '%') {
    return;
  }

  if (scope.stateIsAfter(OPEN_PARENS, PRINT)) {
    return;
  }

  if (scope.stateIsAfter(INT_EXPRESSION, PRINT)) {
    return;
  }

  throw new Error(
    `Unexpected ${op} in ${scope.statementStack[0].text} statement`
  );
}

/**
 * @param {Token} token
 * @param {Scope} scope
 */
export function validateComment(token, scope) {
  if (token.text !== 'REM') return;

  const next = scope.peekNext();
  if (next.name !== COMMENT) {
    throw new Error('Parser error, REM keyword should be followed by COMMENT');
  }
}

/**
 * @param {Token} token
 * @param {Scope} scope
 * @param {Expect} expect
 */
export function validateIntKeyword(token, scope, expect) {
  if (token.text !== 'INT') return;

  if (!scope.intExpression) return;

  scope.push(FLOAT_EXPRESSION);
  scope.intExpression = false;

  expect.value = '{';
  expect.name = SYMBOL;
  expect.error =
    'Using INT in an integer expression requires the expression to be wrapped {braces}';
}

/**
 * @param {Token} token
 * @param {Scope} scope
 */
export function validateExpressionPosition(token, scope) {
  if (token.value !== '%') return;

  const prev = scope.peekPrev();

  // last part of a statement
  if (!prev) return;

  if (scope.argumentExpression.length) {
    if (scope.argumentExpression.length > 1) {
      throw new Error('Integer expression should be the start of an argument');
    }
  }

  if (prev.name === STRING) {
    throw new Error(
      'Did not expect an integer expression to directly follow a string'
    );
  }
}

/**
 * @param {Token} token
 * @param {Scope} scope
 */
export function validateExpressionState(token, scope) {
  if (token.name === SYMBOL && token.value === '%') {
    if (scope.intExpression) {
      throw new Error(
        'Cannot redeclare integer expression whilst already inside one'
      );
    }
    if (scope.expression.length === 1) {
      scope.intExpression = true;
    } else {
      scope.intNext = true;
    }
    return;
  }

  if (token.name === KEYWORD) {
    if (intFunctions[token.text]) {
      if (scope.previousToken.value === '%') {
        scope.intExpression = true;
        return;
      }
    } else if (
      scope.intExpression &&
      intFunctions[scope.previousToken.text] &&
      intFunctions[scope.previousToken.text].includes(token.text)
    ) {
      return;
    } else if (
      [opTable.IF, opTable.THEN, opTable.UNTIL].includes(token.value)
    ) {
      scope.resetExpression();
    } else {
      if (scope.intExpression) {
        if (functions[token.text]) {
          throw new Error(
            'Only integer functions are allowed in integer expressions'
          );
        }
      }
    }
  }

  if (scope.intNext) {
    // scope.intNext = false;
    return;
  }

  if (token.name === KEYWORD) {
    if ([opTable.IF, opTable.THEN, opTable.UNTIL].includes(token.value)) {
      scope.resetExpression();
    }
  }
}

/**
 * @param {Token} token
 * @param {Scope} scope
 */
export function validateNumberTypes(token, scope) {
  if (token.name !== LITERAL_NUMBER) return;

  if (!scope.intExpression && !scope.intNext) {
    throw new Error('Parsing error, did not expect an integer number');
  }
}

/**
 * @param {Token} token
 * @param {Scope} scope
 */
export function validateStatementStarters(token, scope) {
  if (token.name !== KEYWORD) return;

  if (token.value === opTable.DEFPROC) {
    const index = scope.source.indexOf(token);
    if (index !== 0) {
      if (scope.source[0].name === WHITE_SPACE && index === 1) {
        return;
      }

      throw new Error('DEFPROC must be first token in a statement');
    }
  }
}

/**
 * @param {Scope} scope
 */
export function validateEndOfStatement(scope) {
  if (scope.includes(IF)) {
    if (parser.getParser() === parser.v207) {
      throw new Error('IF statement must have THEN');
    } else {
      // we need to stack up an open IF statement
    }
  }

  const open = scope.findIndex((_) => _.startsWith('OPEN_'));
  if (open > -1) {
    let what = '';
    if (scope.stack[open] === OPEN_BRACES) {
      what = '`}` brace';
    }
    if (scope.stack[open] === OPEN_BRACKETS) {
      what = '`]` bracket';
    }
    if (scope.stack[open] === OPEN_PARENS) {
      what = '`)` parenthesis';
    }
    throw new Error('Expected to see closing ' + what);
  }

  if (scope.currentToken.name === IDENTIFIER && scope.position === 0) {
    throw new Error('Unexpected token at end of statement');
  }
}

/**
 * @param {Token} token
 * @param {Scope} scope
 */
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

    if (scope.intExpression && !scope.includes(FLOAT_EXPRESSION)) {
      // check if this is a define value - a custom tweak for txt2bas
      if (scope.statementStack.slice(-2)[0].value === '#') {
        return;
      }
      throw new Error(
        'Only integer variables (single character vars) are allowed in integer expressions'
      );
    }

    if (isString) return;

    if (parser.getParser() === parser.v207) {
      if (value.endsWith('$') && value.length > 2) {
        throw new Error('String variables are only allowed 1 character long');
      }

      if (scope.last === DEFFN_SIG && value.length > 1 && !isString) {
        throw new Error('Only single character names allowed for DEF FN');
      }
    }
  }
}

/**
 * @param {Token} token
 */
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

/**
 * @param {Token} token
 * @param {Scope} scope
 * @param {Expect} expect
 */
export function validateOpeningStatement(token, scope, expect) {
  /*
        Allowed starting commands other than a keyword
        DOT_COMMAND
        WHITE_SPACE
        SYMBOL(%)
        IDENTIFIER followed by ASSIGNMENT

        */

  if (scope.stack.length > 0) {
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

/**
 * @param {Token} token
 */
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

/**
 * @param {Token} token
 * @param {Scope} scope
 * @param {Expect} expect
 */
export function validateIdentifierDeclaration(token, scope, expect) {
  const { name, text } = token;
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
