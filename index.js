import Lexer, { asTap, plus3DOSHeader } from './txt2bas';
// export { default as codes } from './codes';

import { tap2txt, bas2txt, bas2txtLines } from './bas2txt';

export const line2bas = (line) => {
  const l = new Lexer();
  const res = l.line(line.trim());

  return res;
};

export const line2txt = (data) => {
  return bas2txtLines(data);
};

export const formatText = (line) => {
  return line2txt(line2bas(line).basic);
};

export const file2bas = (src, format = '3dos', filename = 'UNTITLED') => {
  src = src.toString();
  const lines = [];
  let length = 0;
  const lexer = new Lexer();
  src.split('\n').forEach((text) => {
    if (text.trim().length > 0) {
      const data = lexer.line(text);
      lines.push(data);
      length += data.basic.length;
    }
  });

  lines.sort((a, b) => {
    return a.lineNumber < b.lineNumber ? -1 : 1;
  });

  let offset = 0;
  const basic = new Uint8Array(length);
  lines.forEach((line) => {
    basic.set(line.basic, offset);
    offset += line.basic.length;
  });

  if (format === '3dos') {
    const file = new Uint8Array(length + 128);
    file.set(plus3DOSHeader(file)); // set the header (128)
    file.set(basic, 128);

    return file;
  } else if (format === 'tap') {
    return asTap(basic, filename);
  }
};

export const file2txt = (src, format = '3dos') => {
  if (format === '3dos') {
    return bas2txt(new Uint8Array(src)) + '\n';
  } else if (format === 'tap') {
    return tap2txt(new Uint8Array(src)) + '\n';
  }
};
