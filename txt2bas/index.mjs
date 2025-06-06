/**
 * @typedef {import('../index.d.ts').Token} Token
 * @typedef {import('../index.d.ts').ParsedBasic} ParsedBasic
 * @typedef {import('../index.d.ts').ParseOptions} ParseOptions
 * @typedef {import('../index.d.ts').ParseLineResult} ParseLineResult
 */

import { opTable } from './op-table.mjs';
import codes, {
  usesLineNumbers,
  intFunctions,
  stringAltFunctions,
  operators,
} from '../codes.mjs';
import { floatToZX } from '../to.mjs';
import tests from '../chr-tests.mjs';
import { TEXT } from '../unicode.mjs';

import { validateLineNumber, validateStatement } from './validator.mjs';
import * as parser from '../parser-version.mjs';

import {
  DEFINE,
  COMMENT,
  DIRECTIVE,
  LINE_NUMBER,
  INT_EXPRESSION,
  BINARY,
  NUMBER,
  UNTIL,
  HEX,
  STRING,
  UNKNOWN,
  LITERAL_NUMBER,
  DOT_COMMAND,
  IDENTIFIER,
  DEFFN,
  DEFFN_SIG,
  DEF_FN_ARG,
  IF,
  ELSEIF,
  DEFFN_ARGS,
  NUMBER_DATA,
  KEYWORD,
  SYMBOL,
  WHITE_SPACE,
  INT_PARENS,
  STATEMENT_SEP,
  OPEN_PARENS,
  OPEN_BRACES,
  OPEN_BRACKETS,
  MODIFIER,
  STRING_EXPRESSION,
  SGN_EXPRESSION,
  ELSE,
} from './types.mjs';

/**
 * Auto increment line
 *
 * @class
 */
export class Autoline {
  constructor(number = '10', step = '10') {
    this.number = parseInt(number, 10);
    this.step = parseInt(step, 10);
    this.active = false;
    this.last = null;
    this.start = this.number;
  }

  next(from = this.number) {
    if (!this.active) return null;
    this.last = from;
    const res = from;
    this.number = from + this.step;
    return res;
  }

  prev() {
    if (this.last === null) return;
    this.number = this.last;
    this.last = null;
  }

  reset() {
    if (!this.active) return;
    this.number = this.start;
    this.last = null;
  }

  parse(line) {
    if (!line.startsWith('#autoline')) {
      throw new Error('#autoline expected');
    }
    const args = line.match(/#autoline\s+(\d+)(?:\s*,\s*(\d+))?/);
    this.active = !!args;
    if (args) {
      args.shift();
      this.number = parseInt(args.shift(), 10);
      this.start = this.number;
      this.step = parseInt(args.shift() || '10', 10);
    }
  }
}

/**
 * @param {string | number} a
 * @returns {Uint8Array}
 */
const encode = (a) => {
  a = a.toString();
  const res = [];
  for (let i = 0; i < a.length; i++) {
    res.push(a.charCodeAt(i));
  }
  return Uint8Array.from(res);
};

/**
 * Validates a block of NextBASIC and returns any validation errors
 *
 * @param {string} text multiline NextBASIC
 * @param {object} [debug]
 * @returns {string[]} Any errors found
 */
export function validate(text, debug = {}) {
  const lines = text.split('\n');
  let lastLine = -1;
  const errors = [];
  const autoline = new Autoline();

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line) {
      if (line.startsWith('#')) {
        if (line.startsWith('#autoline')) {
          autoline.parse(line);
        }

        if (line.startsWith('#bank')) {
          autoline.reset();
          lastLine = -1;
        }
        // skip
      } else {
        let ln;
        try {
          let { lineNumber, tokens } = parseBasic(line, autoline.next());
          validateLineNumber(lineNumber, lastLine);
          validateStatement(tokens, debug);
          ln = lineNumber;
        } catch (e) {
          const errorTail = `#${i + 1}\n> ${line}`;
          errors.push(`${e.message}${errorTail}`);
        }

        lastLine = ln;
      }
    }
  }

  return errors;
}

/**
 * Converts a string to bytes
 *
 * @param {string} line Single NextBASIC line
 * @returns {Uint8Array} bytes of encoded NextBASIC
 */
export function parseLine(line) {
  if (line.startsWith('#')) {
    return new Uint8Array([]);
  }
  const { lineNumber, tokens } = parseBasic(line);
  return basicToBytes(lineNumber, tokens);
}

/**
 * @param {string} line A single line of NextBASIC
 * @param {number|null} autoline Flag to ignore line numbers
 * @returns {ParsedBasic} fully parsed object
 */
export function parseLineWithData(line, autoline = null) {
  const { lineNumber, tokens } = parseBasic(line, autoline);
  const basic = basicToBytes(autoline ? 10 : lineNumber, tokens);
  const length = basic.length;
  return { basic, line, length, lineNumber, tokens };
}

/**
 * Converts plain text to fully parsed NextBASIC with AST
 *
 * @param {string} text plain text NextBASIC
 * @param {ParseOptions} [options]
 * @returns {ParseLineResult} result
 */
export function parseLines(
  text,
  { validate = true, keepDirectives = false, bank = false } = {}
) {
  const lines = text.split(text.includes('\r') ? '\r' : '\n');
  const programStatements = [];
  let statements = programStatements;
  let autostart = 0x8000;
  let lastLine = -1;
  let filename = null;
  const defines = [];

  const bankSplits = [];

  let autoline = new Autoline();

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line) {
      const likeDirective = line.startsWith('#');
      if (likeDirective) {
        // comment and directives
        if (line.startsWith('#program ')) {
          filename = line.split(' ')[1];
        }

        if (line.startsWith('#bankfile ') || line.startsWith('#bank ')) {
          let bankFile = line.split(' ')[1];
          if (line.startsWith('#bank ')) {
            bankFile = `${filename || 'untitled'}-${bankFile}.bnk`;
          }
          autoline.reset();
          lastLine = -1;
          const bank = {
            filename: bankFile,
            line: statements.length,
            statements: [],
          };
          statements = bank.statements;
          bankSplits.push(bank);
        }

        if (line.startsWith('#autoline')) {
          autoline.parse(line);
        }

        if (line.startsWith('#autostart')) {
          // check if there's an arg, otherwise look at next line
          const n = parseInt(line.split(' ')[1], 10);
          if (isNaN(n)) {
            autostart = -1;
          } else {
            autostart = n;
          }
        }

        if (line.toLowerCase().startsWith('#define ')) {
          let [key, ...value] = line.replace(/^#define /i, '').split('=');
          defines[key] = parseBasic(value.join('=').trim(), 0);
        }
      }

      if ((keepDirectives && likeDirective) || !likeDirective) {
        if (autostart === -1) {
          if (!autoline.active) {
            const [lineNumber] = Statement.parseLineNumber(line);
            autostart = lineNumber;
          } else {
            autostart = autoline.number;
          }
        }
        let statement;

        const errorTail = `#${i + 1}\n> ${line}`;

        try {
          statement = parseBasic(line, autoline.next());
          if (validate) {
            validateStatement(statement.tokens);
          }
        } catch (e) {
          throw new Error(e.message + errorTail);
        }

        if (!likeDirective) {
          if (validate) {
            try {
              validateLineNumber(statement.lineNumber, lastLine);
            } catch (e) {
              throw new Error(e.message + errorTail);
            }
          }
          lastLine = statement.lineNumber;

          statements.push(statement);
        } else {
          statements.push(statement);
        }
      }
    }
  }

  const bytes = statementsToBytes(programStatements, { bank });

  if (bankSplits.length) {
    bankSplits.forEach((split) => {
      split.bytes = statementsToBytes(split.statements, { bank: true });
    });
  }

  return {
    bytes,
    length: bytes.length,
    tokens: programStatements.map((_) => _.tokens),
    statements: programStatements,
    autostart,
    filename,
    autoline,
    defines,
    bankSplits,
  };
}

/**
 * Convert statements to bytes
 *
 * @param {Statement[]} statements
 * @param {object} options
 * @param {boolean} [options.bank=false] Run validation for banked lines
 * @returns {Uint8Array}
 */
export function statementsToBytes(statements, { bank = false } = {}) {
  let length = 0;
  const res = statements.map((statement) => {
    const bytes = basicToBytes(statement.lineNumber, statement.tokens);

    if (bank) {
      // if the tokenised length is greater than 256, then it won't work in a bank
      if (bytes.length > 256) {
        throw new Error(
          'Tokenised line length of 256 bytes exceeded for banked code on line #' +
            statement.lineNumber
        );
      }
    }
    length += bytes.length;
    return bytes;
  });

  const data = new Uint8Array(length);

  let offset = 0;
  res.forEach((bytes) => {
    data.set(bytes, offset);
    offset += bytes.length;
  });

  return data;
}

/**
 * A NextBASIC statement
 *
 * @class
 */
export class Statement {
  /**
   * @param {string} line Source NextBASIC line
   * @param {null|number} [lineNumber=null]
   */
  constructor(line, lineNumber = null) {
    /** @type {string} Original BASIC line */
    this.line = Statement.processChars(line);
    this.pos = 0;
    this.inIntExpression = false;
    this.next = null;
    /** @type {Token|object} */
    this.lastToken = {};
    this.inIf = false;
    this.in = [];
    /** @type {Token[]} */
    this.tokens = [];

    // this is switched if the entire statement starts with %
    this.intSubStatement = false;

    let lineText;

    if (lineNumber === null) {
      [lineNumber, lineText] = Statement.parseLineNumber(line);
      this.pos = line.indexOf(lineText);
      this.lineNumber = lineNumber;
    } else {
      this.pos = 0;
      this.lineNumber = typeof lineNumber === 'number' ? lineNumber : null;
    }
  }

  /**
   * @param {string} line
   * @returns {string}
   */
  static processChars(line) {
    for (let code in TEXT) {
      if (line.includes(code)) {
        let re = new RegExp(code, 'g');
        if (code.startsWith('\\')) {
          re = new RegExp(code.replace('\\', '\\\\'), 'g');
        }
        line = line.replace(re, TEXT[code]);
      }
    }

    return line;
  }

  /**
   *
   * @param {string} line line with line number at lead
   * @returns {[lineNumber: number, line: string]}
   */
  static parseLineNumber(line) {
    if (line.startsWith('#')) return [null, line];
    const match = line.match(/^\s*(\d{1,4})\s?(.*)$/);

    if (match !== null) {
      if (match[2].length === 0) {
        throw new Error('Empty line');
      }
      return [parseInt(match[1], 10), match[2]];
    }

    throw new Error('Line number is missing');
  }

  get nowIn() {
    return this.in[this.in.length - 1];
  }

  get startOfStatement() {
    // aka: findLastIndex
    let i = Array.from(this.tokens)
      .reverse()
      .findIndex((_) => _.name === STATEMENT_SEP);
    if (i > -1) i = this.tokens.length - i - 1;

    return (
      (this.lastToken.name === KEYWORD && this.lastToken.text === 'ERROR') ||
      this.lastToken.name === STATEMENT_SEP ||
      this.tokens.slice(i + 1).filter((_) => _.name !== WHITE_SPACE).length ===
        0
    );
  }

  get startOfIntStatement() {
    if (this.startOfStatement) {
      return true;
    }

    const sep = (/** @type {Token} */ _) => {
      if (_.name === STATEMENT_SEP) {
        return true;
      }

      if (_.name === SYMBOL) {
        if (_.value === '=') {
          return true;
        }
      }
    };

    let i = Array.from(this.tokens).reverse().findIndex(sep);
    if (i > -1) i = this.tokens.length - i - 1;

    const starter = this.tokens[i + 1];

    if (!starter || starter.name !== KEYWORD) {
      // peek the next token, and only if it's an int function
      const peek = this.peekToken(this.pos + 1); // since we stopped on the %
      // debugger;
      return peek && peek.name === KEYWORD && intFunctions[peek.text];
    }

    const starters = [IF, ELSEIF, ELSE, UNTIL, DEFFN, DEFFN_SIG, DEFFN_ARGS];

    return starters.includes(starter.text);
  }

  popTo(type) {
    const state = this.in;
    let last = null;
    while (state.length && last !== type) {
      last = state.pop();
    }

    if (state.length === 0) {
      return false;
    }

    return type === last;
  }

  get lastKeyword() {
    return this.tokens
      .slice()
      .reverse()
      .find((_) => _.name === KEYWORD);
  }

  isIn(test) {
    return this.in.includes(test);
  }

  pBIN() {
    // go forward, skip one space, collect spaces, then get a number
    const token = this.processBinary();
    if (token.name !== 'BINARY') {
      throw new Error('BIN expects binary to follow');
    }

    if (isNaN(token.numeric)) {
      throw new Error('BIN expects binary to follow');
    }

    // check it's followed by a symbols
    if (tests._isDigit(this.peek(this.pos))) {
      throw new Error('BIN expects binary to follow');
    }

    return this.captureToken(token);
  }

  pINT() {
    if (this.peek(this.pos) === '{') {
      const currentIntState = this.inIntExpression;
      const currentIntSubStatement = this.intSubStatement;
      // turn of any int expression state
      this.resetIntExpression();

      while (this.nextToken()) {
        if (this.lastToken.value === '}') {
          this.inIntExpression = currentIntState;
          this.intSubStatement = currentIntSubStatement;
          break;
        }
      }

      return;
    }
  }

  /**
   * @returns {Token|undefined}
   */
  nextToken() {
    const token = this.manageTokenState(this.token());

    if (!token) return;

    if (token.name !== KEYWORD) {
      return token;
    }

    // decide what to do next

    const { text } = token;

    // if there's a following space, then try to slurp space
    if (this.peek(this.pos) === ' ') {
      this.captureToken(this.processWhitespace());
    }

    switch (text) {
      case 'INT':
        this.pINT();
        break;
      case 'BIN':
        this.pBIN();
        break;
      case 'REM':
      case ';':
        this.captureToken(this.processComment());
        break;
      default:
        break;
    }

    return token;
  }

  captureToken(token) {
    if (!token) return;

    this.lastToken = token;

    this.tokens.push(token);
    return token;
  }

  /**
   *
   * @param {Token} token
   * @returns {Token|undefined}
   */
  manageTokenState(token) {
    // if !token, it could be that it wasn't recognised
    if (!token) {
      // console log the state?
      return;
    }

    // if the token isn't recognised, try to get the DEF FN or other
    if (token.value === 'DEF') {
      // this is more likely to be a DEF FN - so let's peek the next token
      const peek = this.peekToken(this.pos);
      if (peek.text === 'FN') {
        token = {
          name: KEYWORD,
          text: 'DEF FN',
          value: opTable['DEF FN'],
          pos: this.pos,
        };
        this.pos = peek.pos; // move to the end of DEF FN
      }
    }

    if (token.value === 'OPEN' || token.value === 'CLOSE') {
      // this is more likely to be a OPEN # or CLOSE #
      const peek = this.peek();

      if (peek === '#') {
        token = {
          name: KEYWORD,
          text: `${token.value} ${peek}`,
          value: opTable[`${token.value} ${peek}`],
          pos: this.pos,
        };
        this.pos += 2; // allow for the space
      }
    }

    if (token.value === 'GO') {
      // this is more likely to be a GO TO or GO SUB
      const peek = this.peekToken(this.pos);
      // note: peek.value when it's an identify
      // peek.text when it's a keyword
      if (peek.value === 'SUB' || peek.text === 'TO') {
        token = {
          name: KEYWORD,
          text: `GO ${peek.text || peek.value}`,
          value: opTable[`GO ${peek.text || peek.value}`],
          pos: this.pos,
        };
        this.pos = peek.pos; // move to the end of DEF FN
      }
    }

    if (parser.getParser() >= parser.v208 && token.text === 'IF') {
      // look for ELSE before hand
      const hasThen = this.peekStatementContains('THEN');
      if (!hasThen) {
        token = {
          name: KEYWORD,
          text: codes[opTable[ELSEIF]],
          value: opTable[ELSEIF],
          pos: this.pos,
        };
      }
    }

    if (token.name !== WHITE_SPACE) {
      if (token.value !== '%') this.next = null; // always reset

      // one exception is when we're a semicolon for a comment, we don't slurp
      if (this.peek(this.pos) === ' ') {
        if (token.name === KEYWORD && token.text === ';') {
          // do nothing
        } else {
          // eat following space
          this.pos++;
        }
      }
    }

    if (token.value === '(') {
      this.in.push(OPEN_PARENS);
      if (this.in.includes(DEFFN_SIG)) {
        this.in.push(DEFFN_ARGS);
      }
      if (this.isIn(INT_EXPRESSION)) {
        this.in.push(INT_PARENS);
      }
    }
    if (token.value === '{') {
      if (this.lastToken.text === 'SGN') {
        this.in.push(SGN_EXPRESSION);
      }
      this.in.push(OPEN_BRACES);
    }
    if (token.value === '[') {
      this.in.push(OPEN_BRACKETS);

      if (this.isIn(STRING_EXPRESSION)) {
        this.in.push(MODIFIER);
      }
    }

    if (token.value === ')') {
      this.popTo(OPEN_PARENS);
    }
    if (token.value === '}') {
      this.popTo(OPEN_BRACES);
      if (this.isIn(SGN_EXPRESSION)) {
        this.popTo(SGN_EXPRESSION);
      }
    }
    if (token.value === ']') {
      this.popTo(OPEN_BRACKETS);
    }
    if (token.value === ';' && token.name === SYMBOL) {
      if (this.isIn(INT_EXPRESSION)) {
        this.popTo(INT_EXPRESSION);
      }
      this.resetIntExpression();
    }

    if (this.in.length && token.name === STATEMENT_SEP) {
      this.in = [];
    }

    if (token.value === '=' && this.nowIn === DEFFN_SIG) {
      this.popTo(DEFFN_SIG);
    }

    if (token.name === KEYWORD) {
      const lastKeyword = this.lastKeyword;

      // debugger;

      if (
        this.inIntExpression &&
        (this.isIn(OPEN_PARENS) || this.isIn(SGN_EXPRESSION))
      ) {
        // nop
      } else if (this.intSubStatement) {
        // nop
      } else if (
        this.inIntExpression &&
        intFunctions[token.text] &&
        this.lastToken.name === SYMBOL &&
        (operators.includes(this.lastToken.value) ||
          this.lastToken.value === '%')
      ) {
        // nop
      } else if (
        lastKeyword &&
        this.inIntExpression &&
        Array.isArray(intFunctions[lastKeyword.text]) &&
        intFunctions[lastKeyword.text].includes(token.text)
      ) {
        // nop
      } else if (this.inIntExpression && operators.includes(token.text)) {
        // nop
      } else {
        this.resetIntExpression();
      }

      // needed to track DEF FN args and to pad them properly
      if (token.value === opTable['DEF FN']) {
        this.in.push(DEFFN);
        this.in.push(DEFFN_SIG);
      }

      if (token.value === opTable.IF) {
        this.in.push(IF);
      }

      if (token.value === opTable.ELSEIF) {
        this.in.push(ELSEIF);
      }

      if (token.value === opTable.UNTIL) {
        this.in.push(UNTIL);
      }

      if (token.value === opTable.THEN) {
        this.popTo(IF);
        this.resetIntExpression();
      }

      if (token.value === opTable.ENDIF) {
        this.popTo(ELSEIF);
        this.resetIntExpression();
      }

      if (token.value === opTable.BIN) {
        this.next = BINARY;
      }

      // special handling for keywords
      if (token.value === opTable.REM) {
        this.next = COMMENT;
      }

      if (usesLineNumbers.includes(token.text)) {
        // this is just a hint
        this.next = LINE_NUMBER;
      }
    }

    if (token.value === '=') {
      if (!this.isIn(IF) && !this.isIn(ELSEIF) && !this.isIn(UNTIL)) {
        this.resetIntExpression();
      }
    }

    this.captureToken(token);
    return token;
  }

  resetIntExpression() {
    this.inIntExpression = false;
    this.intSubStatement = false;
  }

  token(peeking = false) {
    const c = this.line.charAt(this.pos);

    if (this.next === COMMENT) {
      this.next = false;
      this.processComment();
    }

    if (c == '') {
      // EOL
      return null;
    }

    if (
      tests._isLiteralReset(c) &&
      !this.isIn(INT_PARENS) &&
      !this.isIn(IF) &&
      !this.isIn(UNTIL)
    ) {
      if (this.isIn(INT_EXPRESSION)) {
        this.popTo(INT_EXPRESSION);
      }
      this.resetIntExpression();
    }

    if (tests._isIntExpression(c)) {
      this.in.push(INT_EXPRESSION);
      this.inIntExpression = true;
      if (peeking === false && this.startOfIntStatement) {
        this.intSubStatement = true;
      }
    }

    if (this.startOfStatement) {
      // this should rarely happen as directives are pre-parsed
      if (tests._isDirective(c)) {
        return this.processDirective();
      }

      if (tests._isStartOfComment(c)) {
        return this.processSingleKeyword();
      }

      if (tests._isDotCommand(c)) {
        return this.processDotCommand();
      }
    }

    if (tests._isSpace(c)) {
      return this.processWhitespace();
    }

    if (tests._isStatementSep(c)) {
      return { ...this.processSingle(), name: STATEMENT_SEP };
    }

    if (!this.isIn(MODIFIER) && tests._isCmpOperatorStart(c)) {
      // special handling for operator keywords, such as <=
      return this.processCmpOperator();
    }

    if (tests._isAlpha(c)) {
      return this.processIdentifier();
    }

    if (tests._isBinarySymbol(c)) {
      this.captureToken(this.processSingle());
      const peek = this.peekToken();

      if (peek.name === 'IDENTIFIER') {
        if (this.peek(this.pos) === ' ') {
          this.captureToken(this.processWhitespace());
        }
        return this.processIdentifier();
      }
      return this.processBinary();
    }

    if (tests._isHexSymbol(c)) {
      // now check if the last token was in the string functions
      // if it was, then we're in a string, not a hex value
      if (
        this.lastToken.name === KEYWORD &&
        stringAltFunctions.includes(this.lastToken.text)
      ) {
        return this.processSingle();
      }
      return this.processHex();
    }

    if (tests._isDigit(c) || tests._isStartOfFloat(c)) {
      return this.processNumber();
    }

    if (tests._isString(c)) {
      return this.processQuote();
    }

    if (tests._isStartOfComment(c) && this.startOfStatement) {
      return this.processSingleKeyword();
    }

    if (!this.startOfStatement) {
      // this should rarely happen as directives are pre-parsed
      if (tests._isDirective(c)) {
        return this.processDefine();
      }
    }

    if (tests._isSymbol(c)) {
      return this.processSingle();
    }

    return { ...this.processSingle(), name: UNKNOWN };
  }

  peek(at = this.pos + 1) {
    return this.line.charAt(at);
  }

  /**
   * @param {number} [at]
   * @returns {Token} Token
   */
  peekToken(at = this.pos) {
    // cache state
    const cache = {
      pos: this.pos,
      inIntExpression: this.inIntExpression,
      intSubStatement: this.intSubStatement,
      lastToken: this.lastToken,
      tokens: Array.from(this.tokens),
    };

    const restore = () => {
      // restore state
      this.pos = cache.pos;
      this.inIntExpression = cache.inIntExpression;
      this.intSubStatement = cache.intSubStatement;
      this.lastToken = cache.lastToken;
      this.tokens = cache.tokens;
    };

    this.pos = at;

    /** @type {Token} */
    let token = this.token(true);

    if (!token) {
      restore();
      return null;
    }

    if (token.name === WHITE_SPACE) {
      token = this.token(true);
    }

    let tokenPosition = this.pos;

    restore();

    return { ...token, pos: tokenPosition };
  }

  // mostly only used to search for THEN
  peekStatementContains(keyword) {
    let frag = this.line.substring(this.pos);

    frag = frag.replace(/".*?"/g, '').trim();
    frag = frag.split(/\b/).map((_) => _.trim().toUpperCase());
    let end = frag.indexOf(':');
    if (end === -1) {
      end = undefined;
    }
    frag = frag.slice(0, end);

    // strip out any quoted strings
    return frag.includes(keyword);
  }

  findOpCode(endPos) {
    const peek = this.peek(endPos);
    const moreToken = tests._isAlpha(peek);
    let curr = this.line.substring(this.pos, endPos).toUpperCase();

    if (moreToken) {
      return false;
    }

    if (peek && opTable[curr + peek]) {
      return false;
    }

    if (opTable[curr] !== undefined) {
      const token = {
        name: KEYWORD,
        text: codes[opTable[curr]],
        value: opTable[curr],
        pos: this.pos,
      };
      this.pos = endPos;
      return token;
    }
  }

  processComment() {
    return { name: COMMENT, ...this.processToEnd() };
  }

  processIdentifier() {
    // TODO walk until we have something that looks like a token
    let endPos = this.pos + 1;
    let c = this.line.charAt(endPos);
    while (tests._isAlphaNum(c) || tests._isDollar(c)) {
      let tok = this.findOpCode(endPos);

      if (tok) {
        return tok;
      }
      endPos++;
      c = this.line.charAt(endPos);
    }

    let tok = this.findOpCode(endPos);

    if (tok) {
      return tok;
    }

    const value = this.line.substring(this.pos, endPos);

    tok = {
      name: IDENTIFIER,
      value,
      pos: this.pos,
    };

    if (this.isIn(STRING_EXPRESSION)) {
      this.popTo(STRING_EXPRESSION);
    }

    if (value.endsWith('$')) {
      this.in.push(STRING_EXPRESSION);
    }

    if (this.in.includes(DEFFN_ARGS)) {
      tok.name = DEF_FN_ARG;
    }

    this.pos = endPos;

    return tok;
  }

  processDefine() {
    let endPos = this.pos + 1;
    let c = this.line.charAt(endPos);
    while (tests._isDefine(c)) {
      endPos++;
      c = this.line.charAt(endPos);
    }

    const value = this.line.substring(this.pos, endPos);

    const tok = {
      name: DEFINE,
      value,
      pos: this.pos,
    };

    if (this.in.includes(DEFFN_ARGS)) {
      tok.name = DEF_FN_ARG;
    }

    this.pos = endPos;

    return tok;
  }

  processSingle() {
    const token = {
      name: SYMBOL,
      value: this.line.charAt(this.pos, this.pos + 1),
      pos: this.pos,
    };
    this.pos++;
    return token;
  }

  processSingleKeyword() {
    const text = this.line.charAt(this.pos, this.pos + 1);
    const token = {
      name: KEYWORD,
      text,
      value: text.charCodeAt(0),
      pos: this.pos,
    };
    this.pos++;
    return token;
  }

  processBinary() {
    const tok = this.simpleSlurp(
      this.inIntExpression
        ? tests._isBinary
        : tests._isFloatOr(tests._isBinary),
      BINARY
    );

    tok.integer = this.inIntExpression;

    const offset = tok.value.startsWith('@') ? 1 : 0;
    const value = tok.value.substring(offset);
    let numeric = 0;

    // if it's an integer, then just store parse
    // the value as binary.
    if (tok.integer) {
      numeric = parseInt(value, 2);
    }

    // if it's a float, then split on the dot, and
    // parse the first part as binary, and the second
    // part as binary, and then join them together.
    if (!tok.integer) {
      const [whole, fraction] = value.split('.');
      numeric = parseInt(whole, 2);
      if (fraction) {
        numeric += parseInt(fraction, 2) / Math.pow(2, fraction.length);
      }
    }

    if (isNaN(numeric)) {
      numeric = 0;
    }

    tok.numeric = numeric;

    // unlikely but we'll keep it
    if (this.next === LINE_NUMBER) {
      tok.lineNumber = true;
    }

    return tok;
  }

  processHex() {
    const tok = this.simpleSlurp(
      this.inIntExpression ? tests._isHex : tests._isFloatOr(tests._isHex),
      HEX
    );

    tok.integer = this.inIntExpression; // should always be true
    const value = tok.value.substring(1);

    let numeric = 0;

    // if it's an integer, then just store parse
    // the value as hex.
    if (tok.integer) {
      numeric = parseInt(value, 16);
    }

    if (!tok.integer) {
      const [whole, fraction] = value.split('.');
      numeric = parseInt(whole, 16);
      if (fraction) {
        numeric += parseInt(fraction, 16) / Math.pow(16, fraction.length);
      }
    }

    if (isNaN(numeric)) {
      numeric = 0;
    }

    tok.numeric = numeric;

    // unlikely but we'll keep it
    if (this.next === LINE_NUMBER) {
      tok.lineNumber = true;
    }

    return tok;
  }

  processNumber() {
    let endPos = this.pos + 1;
    let exp = false;
    while (
      (endPos < this.line.length &&
        (tests._isDigit(this.line.charAt(endPos)) ||
          this.line.charAt(endPos) === '.' ||
          this.line.charAt(endPos) === 'e')) ||
      (exp && this.line.charAt(endPos) === '-')
    ) {
      if (this.line.charAt(endPos) === 'e') {
        exp = true; // only allow this once
      } else {
        exp = false;
      }
      endPos++;
    }

    const value = this.line.substring(this.pos, endPos);
    let numeric = 0;

    if (value.includes('.')) {
      if (this.inIntExpression) {
        throw new Error(`Non integer used in integer expression`);
      }
    }

    numeric = new Number(value) * 1;

    let name = NUMBER;
    if (this.inIntExpression) {
      name = LITERAL_NUMBER;
    }

    var tok = {
      name,
      value,
      numeric,
      integer: this.inIntExpression,
      pos: this.pos,
    };

    if (this.next === LINE_NUMBER) {
      tok.lineNumber = true;
    }

    this.pos = endPos;
    return tok;
  }

  processDirective() {
    const start = this.pos;

    let [directive, ...args] = this.line.substring(this.pos + 1).split(' ', 2);
    let arg = args.join(' ');

    this.pos = this.line.length; // always slurp to the end

    if (directive === 'autostart') {
      return {
        name: DIRECTIVE,
        autostart: parseInt(arg, 10),
        value: 'autostart',
        pos: start,
        skip: true,
      };
    }

    if (directive === 'program') {
      return {
        name: DIRECTIVE,
        value: this.line.substring(start, this.pos),
        pos: start,
        skip: true,
      };
    }

    return {
      name: COMMENT,
      value: this.line.substring(start, this.pos),
      pos: start,
      skip: true,
    };
  }

  processDotCommand() {
    const pos = this.pos;
    while (this.pos < this.line.length) {
      const c = this.line.charAt(this.pos);
      if (c === '"') {
        this.processQuote();
      } else if (c == ':' || c == '\n' || c === '') {
        break;
      } else {
        this.pos++;
      }
    }
    const value = this.line.substring(pos, this.pos);
    return {
      value,
      pos,
      name: DOT_COMMAND,
    };
  }

  processQuote() {
    // this.pos points at the opening quote. Find the ending quote.
    const end = this.line.indexOf('"', this.pos + 1);

    if (end === -1) {
      throw Error(
        `Unterminated quote at: ${this.pos + 1}:${this.line.length + 1}`
      );
    } else {
      const tok = {
        name: STRING,
        value: this.line.substring(this.pos, end + 1),
        pos: this.pos,
      };
      this.pos = end + 1;
      this.popTo(STRING_EXPRESSION);
      this.in.push(STRING_EXPRESSION);
      return tok;
    }
  }

  processCmpOperator() {
    const tok = this.simpleSlurp(tests._isCmpOperator, KEYWORD, 2);
    const value = opTable[tok.value];
    tok.text = tok.value;
    tok.value = value;

    // you can >= but you can't =<
    if (this.lastToken.name === SYMBOL && this.lastToken.value === '=') {
      throw new Error(
        `Invalid use of relation symbols at: ${tok.pos + 1}:${tok.pos + 2}`
      );
    }

    return tok;
  }

  processWhitespace() {
    return this.simpleSlurp(tests._isSpace, WHITE_SPACE);
  }

  simpleSlurp(test, tokenName, maxLength = Infinity) {
    let endPos = this.pos;
    maxLength += endPos;

    while (test(this.line.charAt(endPos)) && endPos < maxLength) {
      endPos++;
    }

    const value = this.line.substring(this.pos, endPos);

    const token = {
      name: tokenName,
      value,
      pos: this.pos,
    };

    this.pos = endPos;
    return token;
  }

  processToEnd() {
    const pos = this.pos;
    const value = this.line.substring(pos);
    this.pos = this.line.length;

    return {
      value,
      pos,
    };
  }

  processToEndOfStatement() {
    const pos = this.pos;
    while (this.pos < this.line.length) {
      const c = this.line.charAt(this.pos);
      if (c == ':' || c == '\n' || c === '') {
        break;
      } else {
        this.pos++;
      }
    }
    const value = this.line.substring(pos, this.pos);
    return {
      value,
      pos,
    };
  }
}

/**
 * Parse NextBASIC text into a lexer a statement object
 *
 * @param {string} line Source NextBASIC line
 * @param {number|null} [lineNumber=null]
 * @returns {Statement} A single statement object
 */
export function parseBasic(line, lineNumber = null) {
  if (typeof line !== 'string') {
    throw new Error(
      `ParseError: parseBasic expected a line, got ${typeof line}`
    );
  }

  const statement = new Statement(line, lineNumber);

  while (statement.nextToken()) {
    // keep going
  }

  return statement;
}

/**
 *
 * @param {number} lineNumber
 * @param {Token[]} tokens
 * @returns {Uint8Array} tokenised bytes
 */
export function basicToBytes(lineNumber, tokens) {
  let length = 0;
  const opTokens = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const { name, value } = token;
    if (name === KEYWORD) {
      length++;
      opTokens.push(token);

      if (value === opTable.PRIVATE) {
        if (tokens[i + 1].value !== opTable.CLEAR) {
          const view = new DataView(new ArrayBuffer(6));
          view.setUint8(0, 0x0e);
          opTokens.push({
            name: NUMBER_DATA,
            value: new Uint8Array(view.buffer),
          });
          length += 6;
        }
      }
    } else if (
      name === NUMBER ||
      (name === BINARY && token.integer === false) ||
      (name === HEX && token.integer === false)
    ) {
      length += value.length;
      const { numeric } = token;

      opTokens.push({ name, value });

      if (
        (numeric | 0) === numeric &&
        numeric >= -65535 &&
        numeric <= 65535 // 0xffff
      ) {
        const view = new DataView(new ArrayBuffer(6));
        view.setUint8(0, 0x0e);
        view.setUint8(1, 0x00);
        view.setUint8(2, numeric < 0 ? 0xff : 0x00);
        view.setUint16(3, numeric, true);
        opTokens.push({
          name: NUMBER_DATA,
          value: new Uint8Array(view.buffer),
        });
        length += 6;
      } else {
        const value = new Uint8Array(6);
        value[0] = 0x0e;
        value.set(floatToZX(numeric), 1);
        opTokens.push({
          name: NUMBER_DATA,
          value,
        });
        length += 6;
      }
    } else if (name === DEF_FN_ARG) {
      opTokens.push({ name, value });
      length += value.length;
      opTokens.push({
        name: NUMBER_DATA,
        value: new Uint8Array([0x0e, 0x00, 0x00, 0x00, 0x00, 0x00]),
      });
      length += 6;
    } else if (!token.skip) {
      length += value.length;
      opTokens.push(token);
    }
  }

  opTokens.push({ name: KEYWORD, value: 0x0d }); // EOL
  length++;

  const buffer = new DataView(new ArrayBuffer(length + 4));

  buffer.setUint16(0, lineNumber, false); // line number is stored as big endian
  buffer.setUint16(2, length, true);

  let offset = 4;

  opTokens.forEach(({ name, value }) => {
    if (name === KEYWORD) {
      buffer.setUint8(offset, value);
      offset++;
    } else if (name === NUMBER_DATA) {
      const view = new Uint8Array(buffer.buffer);
      view.set(value, offset);
      offset += value.length;
    } else {
      const view = new Uint8Array(buffer.buffer);
      [value.length, encode(value).length, offset];
      view.set(encode(value), offset);
      offset += value.length;
    }
  });

  return new Uint8Array(buffer.buffer);
}
