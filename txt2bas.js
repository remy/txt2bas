import codes from './codes';
import { floatToZX } from './to';
import { pack as _pack } from '@remy/unpack';
import { TEXT } from './unicode';

const pack = _pack.default;

export const encode = (a) => new TextEncoder().encode(a);

export const calculateXORChecksum = (array) =>
  Uint8Array.of(array.reduce((checksum, item) => checksum ^ item, 0))[0];

const opTable = Object.entries(codes).reduce(
  (acc, [code, str]) => {
    acc[str] = parseInt(code);
    return acc;
  },
  {
    GOTO: 0xec,
  }
);

const intFunctions = [
  'IN',
  'REG',
  'PEEK',
  'DPEEK',
  'USR',
  'BIN',
  'RND',
  'MOD',
  'AND',
  'OR',
];

/*
header unpack template:
<S$headerLength
C$flagByte
C$type
A10$filename
S$length
S$autostart
S$varStart
C$checksum

S$nextBlockLength

C$blockType
C……$data
C$blockChecksum
*/

export const tapHeader = (basic, filename = 'BASIC') => {
  // FIXME is this autostart actually correct?
  const autostart = new DataView(basic.buffer).getUint16(0, false);
  const res = pack(
    '<S$headerLength C$flagByte C$type A10$filename S$length S$p1 S$p2 C$checksum',
    {
      headerLength: 19,
      flagByte: 0x0, // header
      type: 0x00, // program
      filename: filename.slice(0, 10), // 10 chrs max
      length: basic.length,
      p1: autostart,
      p2: basic.length,
      checksum: 0, // solved later
    }
  );

  const checksum = calculateXORChecksum(res.slice(2, 20));

  res[res.length - 1] = checksum;

  return res;
};

export const asTap = (basic, filename = 'tap dot js') => {
  const header = tapHeader(basic, filename);
  const dataType = 0xff;
  const checksum = calculateXORChecksum(Array.from([dataType, ...basic]));
  const tapData = new Uint8Array(header.length + basic.length + 2 + 2); // ? [header.length, basic.length]
  tapData.set(header, 0); // put header in tap
  new DataView(tapData.buffer).setUint16(header.length, basic.length + 2, true); // set follow block length (plus 2 for flag + checksum)

  tapData[header.length + 2] = dataType; // data follows
  tapData.set(basic, header.length + 3); // put basic binary in tap
  tapData[tapData.length - 1] = checksum; // finish with 8bit checksum

  return tapData;
};

export const plus3DOSHeader = (basic, opts = { autostart: 128 }) => {
  let { hType = 0, hOffset = basic.length - 128, autostart } = opts;
  const hFileLength = hOffset;
  autostart = new DataView(Uint16Array.of(autostart).buffer).getUint16(
    0,
    false
  );
  const res = pack(
    '< A8$sig C$eof C$issue C$version I$length C$hType S$hFileLength n$autostart S$hOffset',
    {
      sig: 'PLUS3DOS',
      eof: 26,
      issue: 1,
      version: 0,
      length: basic.length,
      hType,
      hFileLength,
      autostart,
      hOffset,
    }
  );

  const checksum = Array.from(res).reduce((acc, curr) => (acc += curr), 0);

  const result = new Uint8Array(128);
  result.set(res, 0);
  result[127] = checksum;

  return result;
};

// Based on (with huge mods) https://eli.thegreenplace.net/2013/07/16/hand-written-lexer-in-javascript-compared-to-the-regex-based-ones
export default class Lexer {
  constructor() {
    this.pos = 0;
    this.buf = null;
    this.bufLen = 0;
    this.opTable = opTable;
  }

  // Operator table, mapping operator -> token name

  // Initialize the Lexer's buffer. This resets the lexer's internal
  // state and subsequent tokens will be returned starting with the
  // beginning of the new buffer.
  input(buf) {
    for (let [key, value] of Object.entries(TEXT)) {
      buf = buf.replace(key, value);
    }
    this.pos = 0;
    this.buf = buf;
    this.bufLen = buf.length;
  }

  lines(lines) {
    const data = lines.split('\n').map((line) => this.line(line).basic);
    const len = data.reduce((acc, curr) => (acc += curr.length), 0);
    const res = new Uint8Array(len);
    let offset = 0;
    data.forEach((line) => {
      res.set(line, offset);
      offset += line.length;
    });
    return res;
  }

  line(line) {
    this.input(line);
    this.inIntExpression = false;
    let lineNumber = null;
    let tokens = [];
    let length = 0;

    let token = null;
    while ((token = this.token())) {
      const { name, value } = token;
      if (!lineNumber && name === 'NUMBER') {
        lineNumber = parseInt(value, 10);
        this.startOfStatement = true;
        continue;
      }

      if (name !== 'STATEMENT_SEP') {
        this.startOfStatement = false;
      }

      // ast
      if (name === 'KEYWORD') {
        length++;
        tokens.push(token);
        if (codes[value] === 'REM') {
          token = this._processComment();
          length += token.value.length;
          tokens.push(token);
          this.startOfStatement = true;
        }
      } else if (name === 'NUMBER') {
        length += value.toString().length;
        const { numeric } = token;
        tokens.push(token);

        if (
          (numeric | 0) === numeric &&
          numeric >= -65535 &&
          numeric <= 65535
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
      } else if (name === 'DIRECTIVE') {
        // IMPORTANT there's only ever a single directive on a line
        return {
          basic: [],
          token,
          directive: token.directive,
          value,
          length: 0,
        };
      } else {
        length += value.toString().length;
        tokens.push(token);
      }
    }

    if (tokens.length === 0) {
      return {
        basic: new Uint8Array(),
        lineNumber: null,
        tokens: [],
        length,
      };
    }

    // add the end of carriage to the line
    tokens.push({ name: 'KEYWORD', value: 0x0d });
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
        const v = value.toString();
        const view = new Uint8Array(buffer.buffer);
        view.set(encode(v), offset);
        offset += v.length;
      }
    });

    return {
      basic: new Uint8Array(buffer.buffer),
      lineNumber,
      tokens,
      length,
    };
  }

  // Get the next token from the current buffer. A token is an object with
  // the following properties:
  // - name: name of the pattern that this token matched (taken from rules).
  // - value: actual string value of the token.
  // - pos: offset in the current buffer where the token starts.
  //
  // If there are no more tokens in the buffer, returns null. In case of
  // an error throws Error.
  token() {
    this._skipNonTokens();

    if (this.pos >= this.bufLen) {
      return null;
    }

    // The char at this.pos is part of a real token. Figure out which.
    var c = this.buf.charAt(this.pos);
    const _next = this.buf.charAt(this.pos + 1);

    // comments are slurped elsewhere

    // Look it up in the table of operators
    var op = this.opTable[c];
    if (op !== undefined) {
      return { name: 'KEYWORD', value: op, pos: this.pos++ };
    } else {
      // Not an operator - so it's the beginning of another token.
      // if alpha or starts with 0 (which can only be binary)
      if (Lexer._isDirective(c) && this.pos === 0) {
        return this._processDirective();
      } else if (Lexer._isDotCommand(c)) {
        return this._processDotCommand();
      } else if (
        Lexer._isAlpha(c) ||
        c === '' ||
        (c === '.' && Lexer._isAlpha(_next))
      ) {
        const res = this._processIdentifier();
        if (res.name === 'KEYWORD') {
          if (res.keyword === 'IF') {
            this.inIf = true;
          } else if (res.keyword === 'THEN') {
            this.inIf = false;
          }

          if (!intFunctions.includes(res.keyword)) {
            this.inIntExpression = false;
          }
        }
        return res;
      } else if (Lexer._isStartOfComment(c) && this.startOfStatement) {
        return this._processComment();
      } else if (Lexer._isLiteralNumeric(c)) {
        this.inIntExpression = true;
        return { name: 'SYMBOL', value: c, pos: this.pos++ };
      } else if (c === '.' && Lexer._isDigit(_next)) {
        return this._processNumber();
      } else if (Lexer._isDigit(c)) {
        const res = this._processNumber();
        this.inBinary = false;
        return res;
      } else if (Lexer._isLiteralReset(c) || Lexer._isStatementSep(c)) {
        if (!this.inIf) {
          this.inIntExpression = false;
        }
        this.startOfStatement = true;
        return { name: 'STATEMENT_SEP', value: c, pos: this.pos++ };
      } else if (Lexer._isSymbol(c)) {
        if (c === '<' || c === '>') {
          // check if the next is a symbol
          const value = this.opTable[
            Object.keys(opTable).find((_) => _ === c + _next)
          ];
          if (value) {
            return {
              name: 'KEYWORD',
              value,
              pos: (this.pos += 2),
            };
          }
        }
        return { name: 'SYMBOL', value: c, pos: this.pos++ };
      } else if (c === '"') {
        return this._processQuote();
      } else if (Lexer._isNumericSymbol(c)) {
        return { name: 'SYMBOL', value: c, pos: this.pos++ };
      } else {
        throw Error(`Token error at ${this.pos} (${c})\n${this.buf}`);
      }
    }
  }

  static _isDirective(c) {
    return c === '#';
  }

  static _isHexSymbol(c) {
    return c === '$';
  }

  static _isLiteralNumeric(c) {
    return c === '%';
  }

  static _isBinary(c) {
    return c === '1' || c === '0';
  }

  static _isNewLine(c) {
    return c === '\r' || c === '\n';
  }

  static _isDigit(c) {
    return c >= '0' && c <= '9';
  }

  static _isStatementSep(c) {
    return c === ':';
  }

  static _isSpace(c) {
    return c === ' ';
  }

  static _isLiteralReset(c) {
    return c === '=' || c === ',';
  }

  static _isSymbol(c) {
    return '!,;-+/*()<>#%${}[]|&^'.includes(c);
  }

  static _isAlpha(c) {
    return (
      (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$'
    );
  }

  static _isStartOfComment(c) {
    return c === ';';
  }

  static _isAlphaNum(c) {
    return (
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c === '_'
    );
  }

  static _isDotCommand(c) {
    return c === '.';
  }

  _processDirective() {
    this.pos++;
    let endPos = this.pos + 1;
    while (endPos < this.bufLen && Lexer._isAlphaNum(this.buf.charAt(endPos))) {
      endPos++;
    }

    const directive = this.buf.substring(this.pos, endPos);
    this.pos = endPos;
    this._skipNonTokens();

    while (endPos < this.bufLen && Lexer._isAlphaNum(this.buf.charAt(endPos))) {
      endPos++;
    }

    const value = parseInt(this.buf.substring(this.pos, endPos), 10);
    this.pos = endPos;

    return {
      name: 'DIRECTIVE',
      value,
      directive,
    };
  }

  _processDotCommand() {
    var start = this.pos;
    this.pos++;
    this._skipToEndOfStatement();
    const value = this.buf.substring(start, this.pos);
    return {
      name: 'DOT_COMMAND',
      value,
    };
  }

  _processLiteralNumber() {
    var endPos = this.pos + 1;
    let needsClose = false;
    while (
      (endPos < this.bufLen &&
        (Lexer._isDigit(this.buf.charAt(endPos)) ||
          this.buf.charAt(endPos) === '(' ||
          this.buf.charAt(endPos) === '!')) ||
      (needsClose && this.buf.charAt(endPos) === ')')
    ) {
      if (this.buf.charAt(endPos) === '(') {
        needsClose = true; // only allow this once
      }
      endPos++;
    }

    const value = this.buf.substring(this.pos, endPos);

    var tok = {
      name: 'LITERAL_NUMBER',
      value,
      pos: this.pos,
    };
    this.pos = endPos;
    return tok;
  }

  _processNumber() {
    var endPos = this.pos + 1;
    let exp = false;
    while (
      (endPos < this.bufLen &&
        (Lexer._isDigit(this.buf.charAt(endPos)) ||
          this.buf.charAt(endPos) === '.' ||
          this.buf.charAt(endPos) === 'e')) ||
      (exp && this.buf.charAt(endPos) === '-')
    ) {
      if (this.buf.charAt(endPos) === 'e') {
        exp = true; // only allow this once
      } else {
        exp = false;
      }
      endPos++;
    }

    const value = this.buf.substring(this.pos, endPos);
    let numeric = 0;

    if (value.includes('.')) {
      numeric = parseFloat(value);
    } else {
      numeric = parseInt(value, 10);
    }

    let name = 'NUMBER';
    if (this.inIntExpression) {
      name = 'LITERAL_NUMBER';
    }

    if (this.inBinary) {
      numeric = parseInt(value, 2);
    }

    var tok = {
      name,
      value,
      numeric,
      pos: this.pos,
    };
    this.pos = endPos;
    return tok;
  }

  _processComment() {
    var endPos = this.pos;
    // Skip until the end of the line
    while (endPos < this.bufLen && !Lexer._isNewLine(this.buf.charAt(endPos))) {
      endPos++;
    }

    var tok = {
      name: 'COMMENT',
      value: this.buf.substring(this.pos, endPos).trim(),
      pos: this.pos,
    };
    this.pos = endPos + 1;
    return tok;
  }

  _isOpCode(endPos) {
    let curr = this.buf.substring(this.pos, endPos).toUpperCase();

    const _next = this.buf.charAt(endPos, endPos + 1);

    let ignorePeek = false;
    if (_next == ' ') {
      if (curr === 'GO') {
        // check if the next is "SUB" or "TO"
        const next = this._peekToken(1).toUpperCase(); // ?
        if (next === 'SUB' || next === 'TO') {
          endPos = endPos + 1 + next.length;
          curr = curr + ' ' + next;
          ignorePeek = true;
        }
      }

      if (curr === 'DEF') {
        // check if the next is "FN"
        const next = this._peekToken(2).toUpperCase(); //?
        if (next === 'FN') {
          endPos = endPos + 1 + next.length;
          curr = curr + ' ' + next;
          ignorePeek = true;
        }
      }
    }

    if (_next === '$' && this.opTable[curr + _next]) {
      curr = curr + _next;
      endPos = endPos + 1 + _next.length;
      ignorePeek = true;
    }

    if (this.opTable[curr] !== undefined) {
      const peeked = this._peekToken(-1).toUpperCase(); // ?
      if (ignorePeek === false && curr !== peeked) {
        return false;
      }

      if (curr == 'BIN') {
        this.inBinary = true;
      }
      this.pos = endPos;

      return {
        name: 'KEYWORD',
        value: this.opTable[curr],
        pos: this.pos,
        keyword: curr,
      };
    }
    return false;
  }

  _peekToken(offset = 0) {
    const tmp = this.pos;
    this.pos += offset + 1;
    this._skipNonTokens();
    let endPos = this.pos + 1;
    while (endPos < this.bufLen && Lexer._isAlphaNum(this.buf.charAt(endPos))) {
      endPos++;
    }

    const value = this.buf.substring(this.pos, endPos); // ?

    this.pos = tmp;

    return value;
  }

  _processIdentifier() {
    var endPos = this.pos + 1;
    while (endPos < this.bufLen && Lexer._isAlphaNum(this.buf.charAt(endPos))) {
      let tok = this._isOpCode(endPos);

      if (tok) {
        return tok;
      }
      endPos++;
    }

    let tok = this._isOpCode(endPos); // ?

    if (tok) {
      return tok;
    }

    // special case for GO<space>[TO|SUB]
    let value = this.buf.substring(this.pos, endPos); // ?

    tok = {
      name: 'IDENTIFIER',
      value,
      pos: this.pos,
    };
    this.pos = endPos;
    return tok;
  }

  _processQuote() {
    // this.pos points at the opening quote. Find the ending quote.
    var end_index = this.buf.indexOf('"', this.pos + 1);

    if (end_index === -1) {
      throw Error('Unterminated quote at ' + this.pos);
    } else {
      var tok = {
        name: 'QUOTE',
        value: this.buf.substring(this.pos, end_index + 1),
        pos: this.pos,
      };
      this.pos = end_index + 1;
      return tok;
    }
  }

  _skipToEndOfStatement() {
    while (this.pos < this.bufLen) {
      var c = this.buf.charAt(this.pos);
      if (c == ':' || c == '\n') {
        break;
      } else {
        this.pos++;
      }
    }
  }

  _skipNonTokens() {
    while (this.pos < this.bufLen) {
      var c = this.buf.charAt(this.pos);
      if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
        this.pos++;
      } else {
        break;
      }
    }
  }
}
