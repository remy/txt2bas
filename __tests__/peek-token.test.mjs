import test from 'ava';
import { Statement } from '../txt2bas/index.mjs';

/**
 * @param {require("~/index.d.ts").Token} token string
 * @returns {string}
 */
function text(token) {
  return token.text || token.value;
}

test('multi statement peek', (t) => {
  let src,
    token,
    peek,
    pos = 0;
  src = '10 IF %z THEN: ELSE IF %z=34 THEN: ELSE PRINT "3"';

  const statement = new Statement(src);

  token = statement.nextToken(); // move to IF
  t.is(text(token), 'IF');
  pos = statement.pos;
  peek = statement.peekToken(pos);
  t.is(text(peek), '%');
  pos = peek.pos;
  peek = statement.peekToken(pos);
  t.is(text(peek), 'z');
  pos = peek.pos;
  peek = statement.peekToken(pos);
  t.is(text(peek), 'THEN');
  pos = peek.pos;
  peek = statement.peekToken(pos);
  t.is(peek.name, 'STATEMENT_SEP'); // should be nothing
});

test.only('multi statement peek with preview', (t) => {
  let src, token, hasThen, statement;

  src = '10 IF %z THEN: ELSE IF %z=34 THEN: ELSE PRINT "3"';
  statement = new Statement(src);
  token = statement.nextToken(); // move to IF
  t.is(text(token), 'IF');
  hasThen = statement.peekStatementContains('THEN');

  t.is(hasThen, true, 'first IF contains THEN');

  src = '10 ELSE IF %z=34 THEN: ELSE PRINT "3"';
  statement = new Statement(src);
  token = statement.nextToken(); // move to ELSE
  t.is(text(token), 'ELSE');
  hasThen = statement.peekStatementContains('THEN');
  t.is(hasThen, true, 'first IF contains THEN');

  src = '20 ELSE IF 1 < 2 PRINT "ELSE"';
  statement = new Statement(src);
  token = statement.nextToken(); // move to ELSE
  t.is(text(token), 'ELSE');
  hasThen = statement.peekStatementContains('THEN');
  t.is(hasThen, false, 'first IF does not contain THEN');
});
