import { opTable } from './op-table';
import codes, { usesLineNumbers, intFunctions } from '../codes';
import { floatToZX } from '../to';
import tests from '../chr-tests';
import { TEXT } from '../unicode';

import { validateLineNumber, validateStatement } from './validator';

import {
  COMMENT,
  DIRECTIVE,
  LINE_NUMBER,
  BINARY,
  NUMBER,
  HEX,
  STRING,
  LITERAL_NUMBER,
  DOT_COMMAND,
  IDENTIFIER,
  DEFFN,
  DEFFN_SIG,
  DEF_FN_ARG,
  IF,
  DEFFN_ARGS,
  NUMBER_DATA,
  KEYWORD,
  SYMBOL,
  WHITE_SPACE,
  STATEMENT_SEP,
} from './types';

export class Autoline {
  constructor(number = 10, step = 10) {
    this.number = parseInt(number, 10);
    this.step = parseInt(step, 10);
    this.active = false;
  }

  next() {
    if (!this.active) return null;
    const res = this.number;
    this.number += this.step;
    return res;
  }

  parse(line) {
    const args = line.match(/#autoline\s+(\d+)(?:\s*,\s*(\d+))?/);
    this.active = true;
    if (args.length) {
      args.shift();
      this.number = parseInt(args.shift(), 10);
      this.step = parseInt(args.shift() || '10', 10);
    }
  }
}

// const encode = (a) => new TextEncoder().encode(a);
const encode = (a) => {
  a = a.toString();
  const res = [];
  for (let i = 0; i < a.length; i++) {
    res.push(a.charCodeAt(i));
  }
  return Uint8Array.from(res);
};

export function validate(text) {
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
        // skip
      } else {
        let ln;
        try {
          let { lineNumber, tokens } = parseBasic(line, autoline.next());
          validateLineNumber(lineNumber, lastLine);
          validateStatement(tokens);
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

export function parseLine(line) {
  if (line.startsWith('#')) {
    return new Uint8Array([]);
  }
  const { lineNumber, tokens } = parseBasic(line);
  return basicToBytes(lineNumber, tokens);
}

export function parseLineWithData(line, autoline = null) {
  const { lineNumber, tokens } = parseBasic(line, autoline);
  const basic = basicToBytes(autoline ? 10 : lineNumber, tokens);
  const length = basic.length;
  return { basic, length, lineNumber, tokens };
}

export function parseLines(
  text,
  { validate = true, keepDirectives = false } = {}
) {
  const lines = text.split(text.includes('\r') ? '\r' : '\n');
  const res = [];
  let autostart = 0x8000;
  let lastLine = -1;
  let filename = null;
  let length = 0;

  const autoline = new Autoline();

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line) {
      const likeDirective = line.startsWith('#');
      if (likeDirective) {
        // comment and directives
        if (line.startsWith('#program ')) {
          filename = line.split(' ')[1];
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
          try {
            validateLineNumber(statement.lineNumber, lastLine);
          } catch (e) {
            throw new Error(e.message + errorTail);
          }
          lastLine = statement.lineNumber;

          const bytes = basicToBytes(statement.lineNumber, statement.tokens);
          length += bytes.length;
          res.push({ statement, bytes });
        } else {
          res.push({ statement, bytes: [] });
        }
      }
    }
  }

  const data = new Uint8Array(length);

  let offset = 0;
  res.forEach(({ bytes }) => {
    data.set(bytes, offset);
    offset += bytes.length;
  });

  return {
    bytes: data,
    length,
    tokens: res.map((_) => _.statement.tokens),
    statements: res.map((_) => _.statement),
    autostart,
    filename,
  };
}

export function statementsToBytes(statements) {
  let length = 0;
  const res = statements.map((statement) => {
    const bytes = basicToBytes(statement.lineNumber, statement.tokens);
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

export class Statement {
  constructor(line, lineNumber = null) {
    this.line = Statement.processChars(line);
    this.pos = 0;
    this.inIntExpression = false;
    this.next = null;
    this.lastToken = {};
    this.inIf = false;
    this.in = [];
    this.tokens = [];

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

  static processChars(line) {
    for (let code in TEXT) {
      const re = new RegExp(code, 'g');
      line = line.replace(re, TEXT[code]);
    }

    return line;
  }

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

  isIn(test) {
    return this.in.includes(test);
  }

  nextToken() {
    const token = this.token();

    if (!token) return;

    if (token.name !== WHITE_SPACE) {
      if (token.value !== '%') this.next = null; // always reset
      if (this.peek(this.pos) === ' ') {
        // eat following space
        this.pos++;
      }
    }

    if (this.in.length && token.name === STATEMENT_SEP) {
      this.in = [];
    }

    if (this.nowIn === DEFFN_SIG) {
      if (token.name === SYMBOL) {
        if (token.value === '(') {
          this.in.push(DEFFN_ARGS);
        }

        if (token.value === '=') {
          this.in.pop();
        }
      }
    }

    if (
      this.nowIn === DEFFN_ARGS &&
      token.name === SYMBOL &&
      token.value === ')'
    ) {
      this.in.pop();
    }

    if (token) {
      if (token.name === KEYWORD) {
        // FIXME I don't full understand the logic of what comes out of an int expression
        if (!this.isIn(IF) && intFunctions.indexOf(codes[token.value]) === -1) {
          this.inIntExpression = false;
        }

        // needed to track DEF FN args and to pad them properly
        if (token.value === opTable['DEF FN']) {
          this.in.push(DEFFN);
          this.in.push(DEFFN_SIG);
        }

        if (token.value === opTable.IF) {
          this.in.push(IF);
        }

        if (token.value === opTable.THEN) {
          this.in.pop();
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
    }

    this.lastToken = token;

    this.tokens.push(token);
    return token;
  }

  token() {
    const c = this.line.charAt(this.pos);

    if (this.next === COMMENT) {
      this.next = false;
      return { name: COMMENT, ...this.processToEnd() };
    }

    if (c == '') {
      // EOL
      return null;
    }

    if (tests._isLiteralReset(c) && !this.isIn(IF)) {
      this.inIntExpression = false;
    }

    if (tests._isIntExpression(c)) {
      this.inIntExpression = true;
    }

    // this should rarely happen as directives are pre-parsed
    if (
      tests._isDirective(c) &&
      (!this.lastToken.name || this.lastToken.name === WHITE_SPACE)
    ) {
      return this.processDirective();
    }

    if (
      tests._isStartOfComment(c) &&
      (this.lastToken.name === STATEMENT_SEP ||
        this.tokens.filter((_) => _.name !== WHITE_SPACE).length === 0)
    ) {
      return { ...this.processToEnd(), name: COMMENT };
    }

    if (tests._isDotCommand(c)) {
      return { ...this.processToEndOfStatement(), name: DOT_COMMAND };
    }

    if (tests._isSpace(c)) {
      return this.processWhitespace();
    }

    if (tests._isStatementSep(c)) {
      return { ...this.processSingle(), name: STATEMENT_SEP };
    }

    if (tests._isCmpOperatorStart(c)) {
      // special handling for operator keywords, such as <=
      return this.processCmpOperator();
    }

    if (tests._isAlpha(c)) {
      return this.processIdentifier();
    }

    if (tests._isBinarySymbol(c)) {
      return this.processBinary();
    }

    if (tests._isHexSymbol(c)) {
      return this.processHex();
    }

    if (tests._isDigit(c)) {
      return this.processNumber();
    }

    if (tests._isString(c)) {
      return this.processQuote();
    }

    return this.processSingle();
  }

  peek(at = this.pos + 1) {
    return this.line.charAt(at);
  }

  peekToken(at = this.pos) {
    let pos = at + 1;
    const start = at;
    while (pos < this.line.length && !tests._isSpace(this.line.charAt(pos))) {
      pos++;
    }
    return this.line.substring(start, pos);
  }

  findOpCode(endPos) {
    const peek = this.peek(endPos);
    const moreToken = tests._isAlpha(peek);
    let curr = this.line.substring(this.pos, endPos).toUpperCase();

    if (moreToken) {
      return false;
    }

    // be wary that this could be something like `DEF FN`
    if (peek === ' ' && !opTable[curr]) {
      const next = this.peekToken(endPos + 1).toUpperCase();
      const test = `${curr} ${next}`;

      if (opTable[test]) {
        curr = test;
        endPos = endPos + 1 + next.length;
      } else {
        return false;
      }
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

    if (this.nowIn === DEFFN_ARGS) {
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

  processBinary() {
    const tok = this.simpleSlurp(tests._isBinary, BINARY);

    const numeric = parseInt(tok.value.substring(1), 2);

    tok.numeric = numeric;
    tok.integer = this.inIntExpression;

    // unlikely but we'll keep it
    if (this.next === LINE_NUMBER) {
      tok.lineNumber = true;
    }

    return tok;
  }

  processHex() {
    const tok = this.simpleSlurp(tests._isHex, HEX);

    const numeric = parseInt(`0x${tok.value.substring(1)}`, 16);

    tok.numeric = numeric;
    tok.integer = this.inIntExpression; // should always be true

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
      numeric = parseFloat(value);
    } else {
      numeric = parseInt(value, 10);
    }

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

    const [directive, arg] = this.line.substring(this.pos + 1).split(' ', 2);

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
        autostart: arg,
        value: 'program',
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
      return tok;
    }
  }

  processCmpOperator() {
    const tok = this.simpleSlurp(tests._isCmpOperator, KEYWORD);
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

  simpleSlurp(test, tokenName) {
    let endPos = this.pos;

    while (test(this.line.charAt(endPos))) {
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

  return statement; //[statement.lineNumber, tokens];
}

export function basicToBytes(lineNumber, basic) {
  let length = 0;
  const tokens = [];

  for (let i = 0; i < basic.length; i++) {
    const token = basic[i];
    const { name, value } = token;
    if (name === KEYWORD) {
      length++;
      tokens.push(token);
    } else if (name === NUMBER) {
      length += value.length;
      const { numeric } = token;

      tokens.push({ name, value });

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
        tokens.push({
          name: NUMBER_DATA,
          value: new Uint8Array(view.buffer),
        });
        length += 6;
      } else {
        const value = new Uint8Array(6);
        value[0] = 0x0e;
        value.set(floatToZX(numeric), 1);
        tokens.push({
          name: NUMBER_DATA,
          value,
        });
        length += 6;
      }
    } else if (name === DEF_FN_ARG) {
      tokens.push({ name, value });
      length += value.length;
      tokens.push({
        name: NUMBER_DATA,
        value: new Uint8Array([0x0e, 0x00, 0x00, 0x00, 0x00, 0x00]),
      });
      length += 6;
    } else if (!token.skip) {
      length += value.length;
      tokens.push(token);
      [length, value.length]; //?
    }
  }

  tokens.push({ name: KEYWORD, value: 0x0d }); // EOL
  length++;

  const buffer = new DataView(new ArrayBuffer(length + 4));

  buffer.setUint16(0, lineNumber, false); // line number is stored as big endian
  buffer.setUint16(2, length, true);

  let offset = 4;

  tokens.forEach(({ name, value }) => {
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
