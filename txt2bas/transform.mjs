/**
 * @typedef { import("../index.d.ts").Statement } Statement
 * @typedef { import("../index.d.ts").Token } Token
 * @typedef { import("../index.d.ts").Autoline } Autoline
 * @typedef { import("../index.d.ts").Define } Define
 */

import { opTable } from './op-table.mjs';
import * as types from './types.mjs';
import { basicToBytes, parseBasic } from './index.mjs';
import { bas2txtLines } from '../bas2txt.mjs';

/**
 * Convert all LOAD statement to inline DATA lines and respective pokes
 *
 * @param {Statement[]} statements
 * @returns {Statement[]}
 */
export function inlineLoad(statements) {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const cwd = process.cwd();
  let index;

  /** @type {Statement} */
  let st;

  const getLengthAndOffset = () => {
    let offset = null;
    let length = null;
    let peeked = peek();
    if (peeked.name === types.NUMBER) {
      offset = peeked.numeric;
      next();
    }
    if (peeked.name === types.LITERAL_NUMBER) {
      offset = peeked.numeric;
      next(); // symbol
      next();
    }

    peeked = peek();
    if (peeked.name === types.NUMBER) {
      length = peeked.numeric;
      next();
    }
    if (peeked.name === types.LITERAL_NUMBER) {
      length = peeked.numeric;
      next(); // symbol
      next();
    }

    return { length, offset };
  };

  const next = () => {
    if (!st.tokens[index + 1]) return null;
    if (st.tokens[index + 1].name === types.WHITE_SPACE) index++;
    index++;
    return st.tokens[index];
  };

  const peek = (ignoreSymbols = true) => {
    let offset = 1;
    if (!st.tokens[index + offset]) return {};
    if (st.tokens[index + offset].name === types.WHITE_SPACE) offset = 2;
    if (ignoreSymbols) {
      if (!st.tokens[index + offset]) return {};
      if (st.tokens[index + offset].name === types.SYMBOL) offset = 3;
    }
    if (!st.tokens[index + offset]) return {};
    return st.tokens[index + offset];
  };

  for (let i = 0; i < statements.length; i++) {
    st = statements[i];

    index = 0;

    for (; index < st.tokens.length; index++) {
      if (st.tokens[index].text !== 'LOAD') continue;
      const start = index;

      const fileSpec = next();
      // ignore drive switches
      if (fileSpec.length === 2 && fileSpec.endsWith(':')) continue;
      const modifier = next();

      if (!modifier || modifier.name === types.STATEMENT_SEP) {
        continue;
      }

      const filename = JSON.parse(fileSpec.value);
      let file;
      try {
        file = readFileSync(join(cwd, filename));
      } catch (e) {
        let error = e;
        if (error.code === 'ENOENT') {
          error.message = `Cannot find or read "${join(cwd, filename)}".`;
        }
        throw error;
      }

      const loader = [];
      let length = file.length;
      let offset = 0;

      if (modifier.text === 'BANK') {
        let m = next();
        if (m.value === '%') m = next();

        loader.push(
          { name: types.KEYWORD, text: 'BANK', value: opTable.BANK },
          { name: types.SYMBOL, value: '%' },
          {
            name: types.LITERAL_NUMBER,
            value: m.numeric.toString(),
            integer: true,
            numeric: m.numeric,
          }
        );
      }

      if (modifier.text !== 'BANK' && modifier.text !== 'CODE') continue;

      const offsetRes = getLengthAndOffset();
      if (offsetRes.length !== null) length = offsetRes.length;
      if (offsetRes.offset !== null) offset = offsetRes.offset;

      // TODO chunk the poke into blocks with no more than 1280 character 😱
      const chunks = [];
      const blockSize = 256;

      for (let j = 0; j < length; j += blockSize) {
        chunks.push(file.slice(j, j + blockSize));
      }

      for (let k = 0; k < chunks.length; k += 1) {
        const tokens = Array.from(loader);

        tokens.push(
          { name: types.KEYWORD, text: 'POKE', value: opTable.POKE },
          { name: types.SYMBOL, value: '%' },
          {
            name: types.LITERAL_NUMBER,
            value: offset.toString(),
            integer: true,
            numeric: offset,
          }
        );

        let j = 0;
        for (; j < chunks[k].length; j++) {
          const value = chunks[k][j];
          tokens.push(
            { name: types.SYMBOL, value: ',' },
            { name: types.SYMBOL, value: '%' },
            {
              name: types.LITERAL_NUMBER,
              value: value.toString(),
              integer: true,
              numeric: value,
            }
          );
        }

        offset += blockSize;

        if (k === 0) {
          const header = st.tokens.slice(0, start);
          const trailer = st.tokens.slice(index + 1);
          const res = header.concat(tokens, trailer);
          st.tokens = res;
          index = res.length;
        } else {
          // brittle, but we hope it's okay
          const statement = {
            lineNumber: st.lineNumber + k,
            tokens,
          };

          statements.splice(i + 1, 0, statement);
          i++;
        }
      }
    }
  }

  return statements;
}

/**
 * Converts defined identifiers with their definitions
 * Mutates `statements`
 *
 * @param {Statement[]} statements
 * @param {Define[]} defines
 * @returns {Statement[]}
 */
export function replaceDefines(statements, defines) {
  const res = [];

  for (let i = 0; i < statements.length; i++) {
    let st = statements[i];
    const tokens = st.tokens;
    const updated = [];
    let modified = false;
    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];

      if (token.name === types.DEFINE && token.value !== '#') {
        modified = true;
        if (!defines[token.value.substring(1)]) {
          throw new Error(
            `${token.value} is unknown and not in a #define statement`
          );
        }

        updated.push(...defines[token.value.substring(1)].tokens);
        continue;
      }
      updated.push(token);
    }

    st.tokens = updated;
    if (modified) {
      const bytes = basicToBytes(st.lineNumber, st.tokens);
      const text = bas2txtLines(bytes); // ?
      st.tokens = parseBasic(text, null).tokens;
    }

    res.push(st);
  }

  return res;
}

/**
 * Checks for trailing whitespace and removes it from the tokens.
 * Mutates `tokens`
 *
 * @param {Token[]} tokens
 */
function removeTrailingWhiteSpace(tokens) {
  if (
    tokens[tokens.length - 1] &&
    tokens[tokens.length - 1].name === types.WHITE_SPACE
  ) {
    tokens.pop();
  }
}

/**
 * Remove comments from statements
 *
 * @param {Statement[]} statements
 * @returns {Statement[]}
 */
export function stripComments(statements) {
  /** @type {Statement[]} */
  const res = [];
  for (let i = 0; i < statements.length; i++) {
    const st = statements[i];
    // comments exist at the end of a line
    if (st.tokens[st.tokens.length - 1].name === types.COMMENT) {
      st.tokens.pop();
      removeTrailingWhiteSpace(st.tokens);
      st.tokens.pop(); // remove the command too
      removeTrailingWhiteSpace(st.tokens);
      if (
        st.tokens.length &&
        st.tokens[st.tokens.length - 1].name === types.STATEMENT_SEP
      ) {
        st.tokens.pop();
        removeTrailingWhiteSpace(st.tokens);
      }
    }

    if (st.tokens.length) {
      res.push(st);
    }
  }

  return res;
}
