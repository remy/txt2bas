const tests = {
  _isDirective(c) {
    return c === '#';
  },

  _isHexSymbol(c) {
    return c === '@' || c === '$';
  },

  _isBinarySymbol(c) {
    return c === '@';
  },

  _isCmpOperatorStart(c) {
    return c === '<' || c === '>';
  },

  _isCmpOperator(c) {
    return c === '<' || c === '=' || c === '>';
  },

  _isIntExpression(c) {
    return c === '%';
  },

  _isBinary(c) {
    return c === '1' || c === '0';
  },

  _isNewLine(c) {
    return c === '\r' || c === '\n';
  },

  _isDigit(c) {
    return c >= '0' && c <= '9';
  },

  _isStartOfFloat(c) {
    return c == '.';
  },

  _isHex(c) {
    c = c.toUpperCase();
    return c === '$' || (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F');
  },

  _isStatementSep(c) {
    return c === ':';
  },

  _isSpace(c) {
    return c === ' ';
  },

  _isLiteralReset(c) {
    return c === '=' || c === ',' || c === ';' || c === ':';
  },

  _isSymbol(c) {
    return '=~!,;-+/*()<>#%${}[]|&^'.includes(c);
  },

  _isAlpha(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  },

  _isDefine(c) {
    return tests._isAlpha(c) || c === '_';
  },

  _isDollar(c) {
    return c === '$';
  },

  _isString(c) {
    return c === '"';
  },

  _isStartOfComment(c) {
    return c === ';';
  },

  _isAlphaNum(c) {
    return (
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c === '_' ||
      c === '$'
    );
  },

  _isDotCommand(c) {
    return c === '.';
  },
};

export default tests;
