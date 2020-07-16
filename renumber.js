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
 * Renumbers a string of NextBASIC lines.
 *
 * @param {string} text NextBASIC source
 * @param {object} [options] Renumber options
 * @param {number} [options.start=first line] The line number to affect
 * @param {number} [options.step=10] Increment by step
 * @param {number} [options.end=last line] The line number to end renumbering
 * @param {boolean} [options.relocate=false] Moves lines to a new location
 * @param {number} [options.limit] Only used with relocate, the number of lines to work with if options.end is not specified
 * @param {number} [options.base=options.start] Used with relocate to specify where the lines should be moved _to_
 * @returns {string} The updated NextBASIC source code
 */
export function renumber(text, options = {}) {
  // LINE start, step|m,n TO mm, nn;
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

  if (relocate) {
    throw new Error('Line number relocate is not supported yet');
  }

  if (relocate === false) {
    limit = null;
  }

  let res = parseLines(text, { validate: false }).statements;

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

  res.forEach((st) => {
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
    res
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

    return bas2txtLines(statementsToBytes(res));
  }

  // // shift from the base location up to where current is
  const newMap = {};
  text = renumber(bas2txtLines(statementsToBytes(res)), {
    start: base,
    base: base + step * count,
    inc,
    step,
    mapping: newMap,
  });

  res = parseLines(text, { validate: false }).statements;

  text = renumber(bas2txtLines(statementsToBytes(res)), {
    start: newMap[start],
    end: newMap[end],
    base,
    step,
    limit,
  });

  return text;
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
