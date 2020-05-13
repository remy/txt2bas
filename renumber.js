import { parseLines, statementsToBytes } from './txt2bas';
import { bas2txtLines } from './bas2txt';

function findOldLine(n, mapping) {
  const key = Object.keys(mapping).find((key) => key >= n);

  return mapping[key] || n;
}

export default function renumber(text, options = {}) {
  // LINE start, step|m,n TO mm, nn;
  let {
    relocate = false,
    start = null,
    step = 10,
    inc = null,
    end = null,
    base = start || step,
    limit = null,
  } = options;

  let res = parseLines(text, { validate: false }).statements;

  const mapping = {};
  const touched = [];
  let current = base;
  let count = 0;
  if (start === null) {
    start = 0;
  }

  res.forEach((st) => {
    mapping[st.lineNumber] = st.lineNumber;
    if (st.lineNumber < start) return;
    if (end !== null && st.lineNumber > end) return;

    if (limit !== null && count >= limit) return;

    count++;
    const line = inc ? st.lineNumber + inc : current;
    touched.push(line);
    mapping[st.lineNumber] = line;

    if (!relocate) {
      st.lineNumber = line;
    }
    current += step;
  });

  res
    .sort((a, b) => {
      return a.lineNumber < b.lineNumber ? -1 : 1;
    })
    .forEach((st) => {
      st.tokens.forEach((token) => {
        if (token.lineNumber) {
          [st.lineNumber, token]; //?
          token.numeric = findOldLine(token.numeric, mapping);
          token.value = token.numeric.toString();
        }
      });
    });

  if (!relocate) {
    return bas2txtLines(statementsToBytes(res));
  }

  // shift from the base location up to where current is
  text = renumber(bas2txtLines(statementsToBytes(res)), {
    start: base,
    base: current,
    // inc: current - base,
    step,
  });

  res = parseLines(text, { validate: false }).statements;

  text = renumber(bas2txtLines(statementsToBytes(res)), {
    start,
    end,
    base,
    step,
    limit,
  });

  return text;
}

/**
 * To relocate:
 *
 * 1. Count the number of lines we plan to move: $n
 * 2. Renumber the target (base) location by $n
 * 3. Renumber the target
 */
