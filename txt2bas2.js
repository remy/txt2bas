import codes, { usesLineNumbers, intFunctions } from './codes';
import { floatToZX } from './to';
import tests from './chr-tests';
import { TEXT } from './unicode';

const COMMENT = 'COMMENT';
const LINE_NUMBER = 'LINE_NUMBER';
const BINARY = 'BINARY';

export const encode = (a) => new TextEncoder().encode(a);

export const calculateXORChecksum = (array) =>
  Uint8Array.of(array.reduce((checksum, item) => checksum ^ item, 0))[0];

const opTable = Object.entries(codes).reduce(
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

function validateLine(current, prev) {
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

export function validate(text) {
  const lines = text.split('\n');
  let lastLine = -1;
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line) {
      if (line.startsWith('#')) {
        // skip
      } else {
        let lineNumber;

        try {
          [lineNumber] = parseBasic(line);
          validateLine(lineNumber, lastLine);
        } catch (e) {
          errors.push(`${i + 1}:${e.message}\n> ${line}\n`);
        }

        lastLine = lineNumber;
      }
    }
  }

  return errors;
}

export function parseLine(line) {
  const [lineNumber, tokens] = parseBasic(line);
  return basicToBytes(lineNumber, tokens);
}

export function parseLines(text) {
  const lines = text.split(text.includes('\r') ? '\r' : '\n');
  const res = [];
  let autostart = 0x8000;
  let lastLine = -1;
  let filename = null;
  let length = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    console.log({ line });

    if (line) {
      if (line.startsWith('#')) {
        // comment and directives
        if (line.startsWith('#program ')) {
          filename = line.split(' ')[1];
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
      } else {
        if (autostart === -1) {
          const [lineNumber] = parseLineNumber(line);
          autostart = lineNumber;
        }
        let lineNumber;
        let tokens;

        const errorTail = ` at #${i + 1}\n> ${line}`;

        try {
          [lineNumber, tokens] = parseBasic(line);
        } catch (e) {
          throw new Error(e.message + errorTail);
        }

        try {
          validateLine(lineNumber, lastLine);
        } catch (e) {
          throw new Error(e.message + errorTail);
        }

        lastLine = lineNumber;

        const bytes = basicToBytes(lineNumber, tokens);
        length += bytes.length;
        res.push({ lineNumber, tokens, bytes });
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
    tokens: res.map((_) => _.tokens),
    autostart,
    filename,
  };
}

export function parseLineNumber(line) {
  const match = line.match(/^\s*(\d{1,4})\s?(.*)$/);
  if (match !== null) {
    return [parseInt(match[1], 10), match[2]];
  }

  throw new Error('Line number is missing');
}

export class Statement {
  constructor(line) {
    this.line = line;
    this.pos = 0;
    this.inIntExpression = false;
    this.next = null;
    this.lastToken = {};
    this.inIf = false;
  }

  nextToken() {
    const token = this.token();

    if (!token) return;

    if (token.name !== 'WHITE_SPACE') {
      this.next = null; // always reset
      if (this.peek(this.pos) === ' ') {
        // eat following space
        this.pos++;
      }
    }

    if (token) {
      if (token.name === 'KEYWORD') {
        // FIXME I don't full understand the logic of what comes out of an int expression
        if (!this.inIf && intFunctions.indexOf(codes[token.value]) === -1) {
          this.inIntExpression = false;
        }

        if (token.value === opTable.IF) {
          this.inIf = true;
        }

        if (token.value === opTable.THEN) {
          this.inIf = false;
        }

        if (token.value === opTable.BIN) {
          this.next = BINARY;
        }

        // special handling for keywords
        if (token.value === opTable.REM) {
          this.next = COMMENT;
        }

        // if (token.value === opTable[';']) {
        //   // undo the space eater…not sure why though, but it's consistent
        //   this.pos--;
        //   this.next = COMMENT;
        // }

        if (usesLineNumbers.includes(token.text)) {
          // this is just a hint
          this.next = LINE_NUMBER;
        }
      }
    }

    this.lastToken = token;

    return token;
  }

  token() {
    const c = this.line.charAt(this.pos);

    if (this.next === COMMENT) {
      this.next = false;
      return { name: 'COMMENT', ...this.processToEnd() };
    }

    if (c == '') {
      // EOL
      return null;
    }

    if (tests._isLiteralReset(c) && !this.inIf) {
      this.inIntExpression = false;
    }

    if (tests._isIntExpression(c)) {
      if (this.inIntExpression) {
        throw new Error(
          'Cannot redeclare integer expression whilst already inside one'
        );
      }
      this.inIntExpression = true;
    }

    if (tests._isDirective(c)) {
      return this.processDirective();
    }

    if (tests._isStartOfComment(c)) {
      return { ...this.processToEnd(), name: 'COMMENT' };
    }

    if (tests._isDotCommand(c)) {
      // FIXME this is wrong
      return { ...this.processToEndOfStatement(), name: 'DOT_COMMAND' };
    }

    if (tests._isSpace(c)) {
      return this.processWhitespace();
    }

    if (tests._isStatementSep(c)) {
      return { ...this.processSingle(), name: 'STATEMENT_SEP' };
    }

    if (tests._isCmpOperatorStart(c)) {
      // special handling for operator keywords, such as <=
      return this.processCmpOperator();
    }

    if (tests._isAlpha(c)) {
      return this.processIdentifier();
    }

    if (tests._isBinarySymbol(c)) {
      if (!this.inIntExpression) {
        throw new Error('Binary values only allowed in integer expressions');
      }

      return this.processBinary();
    }

    if (tests._isHexSymbol(c)) {
      if (!this.inIntExpression) {
        throw new Error('Hex values only allowed in integer expressions');
      }

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
      const next = this.peekToken(endPos + 1);
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
        name: 'KEYWORD',
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
      c = this.line.charAt(endPos);
      endPos++;
    }

    let tok = this.findOpCode(endPos);

    if (tok) {
      return tok;
    }

    const value = this.line.substring(this.pos, endPos);

    // this is a generic identifier
    if (value.length > 1) {
      if (this.inIntExpression) {
        throw new Error(
          'Only integer variables (single character vars) are allowed in integer expressions'
        );
      }

      if (value.endsWith('$') && value.length > 2) {
        throw new Error('String variables are only allowed 1 character long');
      }
    }

    // special case for GO<space>[TO|SUB]

    tok = {
      name: 'IDENTIFIER',
      value,
      pos: this.pos,
    };
    this.pos = endPos;
    return tok;
  }

  processSingle() {
    const token = {
      name: 'SYMBOL',
      value: this.line.charAt(this.pos, this.pos + 1),
      pos: this.pos,
    };
    this.pos++;
    return token;
  }

  processBinary() {
    const tok = this.simpleSlurp(tests._isBinary, 'BINARY');

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
    const tok = this.simpleSlurp(tests._isHex, 'HEX');

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

    let name = 'NUMBER';
    if (this.inIntExpression) {
      name = 'LITERAL_NUMBER';
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
        name: 'DIRECTIVE',
        autostart: parseInt(arg, 10),
        value: 'autostart',
        pos: start,
        skip: true,
      };
    }

    if (directive === 'program') {
      return {
        name: 'DIRECTIVE',
        autostart: arg,
        value: 'program',
        pos: start,
        skip: true,
      };
    }

    return {
      name: 'COMMENT',
      value: this.line.substring(start, this.pos),
      pos: start,
      skip: true,
    };
  }

  processQuote() {
    // this.pos points at the opening quote. Find the ending quote.
    const end = this.line.indexOf('"', this.pos + 1);

    if (end === -1) {
      throw Error('Unterminated quote at chr ' + this.pos);
    } else {
      const tok = {
        name: 'STRING',
        value: this.line.substring(this.pos, end + 1),
        pos: this.pos,
      };
      this.pos = end + 1;
      return tok;
    }
  }

  processCmpOperator() {
    const tok = this.simpleSlurp(tests._isCmpOperator, 'KEYWORD');
    const value = opTable[tok.value];
    tok.text = tok.value;
    tok.value = value;

    // you can >= but you can't =<
    if (this.lastToken.name === 'SYMBOL' && this.lastToken.value === '=') {
      throw new Error('Invalid use of relation symbols');
    }

    return tok;
  }

  processWhitespace() {
    return this.simpleSlurp(tests._isSpace, 'WHITE_SPACE');
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

export function parseBasic(line) {
  if (typeof line !== 'string') {
    throw new Error(
      `ParseError: parseBasic expected a line, got ${typeof line}`
    );
  }

  const tokens = [];
  let [lineNumber, lineText] = parseLineNumber(line);
  lineText = processChars(lineText);

  const statement = new Statement(lineText);

  let token = null;
  while ((token = statement.nextToken())) {
    tokens.push(token);
  }

  return [lineNumber, tokens]; //{ tokens, basic }];
}

export function basicToBytes(lineNumber, basic) {
  let length = 0;
  const tokens = [];

  for (let i = 0; i < basic.length; i++) {
    const token = basic[i];
    const { name, value } = token;
    if (name === 'KEYWORD') {
      length++;
      tokens.push(token);
    } else if (name === 'NUMBER') {
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
          name: 'NUMBER_DATA',
          value: new Uint8Array(view.buffer),
        });
        length += 6;
      } else {
        const value = new Uint8Array(6);
        value[0] = 0x0e;
        value.set(floatToZX(numeric), 1);
        tokens.push({
          name: 'NUMBER_DATA',
          value,
        });
        length += 6;
      }
    } else if (!token.skip) {
      length += value.length;
      tokens.push(token);
    }
  }

  tokens.push({ name: 'KEYWORD', value: 0x0d }); // EOL
  length++;

  const buffer = new DataView(new ArrayBuffer(length + 4));

  buffer.setUint16(0, lineNumber, false); // line number is stored as big endian
  buffer.setUint16(2, length, true);

  let offset = 4;

  tokens.forEach(({ name, value }) => {
    if (name === 'KEYWORD') {
      buffer.setUint8(offset, value);
      offset++;
    } else if (name === 'NUMBER_DATA') {
      const view = new Uint8Array(buffer.buffer);
      view.set(value, offset);
      offset += value.length;
    } else {
      const view = new Uint8Array(buffer.buffer);
      view.set(encode(value), offset);
      offset += value.length;
    }
  });

  return new Uint8Array(buffer.buffer);
}

export function processChars(line) {
  for (let [key, value] of Object.entries(TEXT)) {
    line = line.replace(key, value);
  }

  return line;
}

const a = parseBasic('10 IF %(x-32 MOD 48) OR (y-48 MOD 40) THEN ENDPROC'); //?
