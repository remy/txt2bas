/**
 * @typedef { import(".").Statement } Statement
 * @typedef { import(".").RenumberOptions } RenumberOptions
 */

import { parseLines, statementsToBytes } from './txt2bas/index';
import { bas2txtLines } from './bas2txt';

/**
 * Find original line number for a given new position
 *
 * @param {number} lineNumber Line number
 * @param {object} mapping
 * @returns {number} Original line in mapping
 */
function findOldLine(lineNumber, mapping) {
  const key = Object.keys(mapping).find((key) => key >= lineNumber);

  return mapping[key] || lineNumber;
}

/**
 *
 * @param {Statement[]} statements
 * @param {RenumberOptions} options
 * @returns {Statement[]}
 */
export function renumberStatements(statements, options = {}) {
  let {
    relocate = false,
    start = null,
    step = 10,
    inc = null,
    end = null,
    base = start || step,
    limit = null,
    mapping = {},
  } = options;

  const touched = [];
  let current = relocate ? start : base;
  let count = 0;
  if (start === null) {
    start = 0;
  }

  // manual adjust of the current value as we use it right away
  if (inc === null) {
    current -= step;
  }

  statements.forEach((st) => {
    mapping[st.lineNumber] = st.lineNumber;
    if (st.lineNumber < start) return;
    if (end !== null && st.lineNumber > end) return;
    if (limit !== null && count >= limit) return;

    count++;
    const line = inc ? st.lineNumber + inc : current + step;
    touched.push(line);
    mapping[st.lineNumber] = line;

    if (!relocate) {
      st.lineNumber = line;
      if (line > 9999) {
        throw new Error('No room for line');
      }
    }
    current = line;
  });

  if (!relocate) {
    statements
      .sort((a, b) => {
        return a.lineNumber < b.lineNumber ? -1 : 1;
      })
      .forEach((st) => {
        st.tokens.forEach((token) => {
          if (token.lineNumber) {
            // [st.lineNumber, token]; //?
            token.numeric = findOldLine(token.numeric, mapping);
            token.value = token.numeric.toString();
          }
        });
      });

    return statements;
  }

  // // shift from the base location up to where current is
  const newMap = {};
  statements = renumberStatements(statements, {
    start: base,
    base: base + step * count,
    inc,
    step,
    mapping: newMap,
  });

  statements = renumberStatements(statements, {
    start: newMap[start],
    end: newMap[end],
    base,
    step,
    limit,
  });

  return statements;
}

/**
 * Renumbers a string of NextBASIC lines.
 *
 * @param {string} text NextBASIC source
 * @param {RenumberOptions} options
 * @returns {string} The updated NextBASIC source code
 */
export function renumber(text, options = {}) {
  // LINE start, step|m,n TO mm, nn;
  let { relocate = false } = options;

  if (relocate) {
    throw new Error('Line number relocate is not supported yet');
  }

  let statements = parseLines(text, { validate: false }).statements;

  return bas2txtLines(
    statementsToBytes(renumberStatements(statements, options))
  );
}

/**
 * Shifts a NextBASIC line forward or backward in the source order
 *
 * @param {string} text NextBASIC source
 * @param {number} lineNumber The line number to shift
 * @param {boolean} [forward=true] Direction, set to false to shift upwards
 * @returns {string} The updated NextBASIC source code
 */
export function shift(text, lineNumber, forward = true) {
  let res = parseLines(text, { validate: false }).statements;
  const mapping = {};
  if (lineNumber === null) {
    lineNumber = 0;
  }

  let swapWith = null;
  let match = null;

  res.forEach((st, i) => {
    mapping[st.lineNumber] = st.lineNumber;
    if (st.lineNumber === lineNumber) {
      match = i;
      swapWith = i + (forward ? 1 : -1);
    }
  });

  mapping[res[match].lineNumber] = res[swapWith].lineNumber;
  res[match].lineNumber = res[swapWith].lineNumber;
  mapping[res[swapWith].lineNumber] = lineNumber;
  res[swapWith].lineNumber = lineNumber;

  res
    .sort((a, b) => {
      return a.lineNumber < b.lineNumber ? -1 : 1;
    })
    .forEach((st) => {
      st.tokens.forEach((token) => {
        if (token.lineNumber) {
          token.numeric = findOldLine(token.numeric, mapping);
          token.value = token.numeric.toString();
        }
      });
    });

  return bas2txtLines(statementsToBytes(res));
}
