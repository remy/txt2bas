import Lexer, { asTap, plus3DOSHeader } from './txt2bas';
export { plus3DOSHeader, tapHeader } from './txt2bas';
export { default as codes } from './codes';

import { tap2txt, bas2txt, bas2txtLines } from './bas2txt';

const SUPPORTED_DIRECTIVES = ['autostart', 'program'];

export const line2bas = (line) => {
  const l = new Lexer();
  const res = l.line(line.trim());

  return res;
};

export const line2txt = (data) => {
  return bas2txtLines(data);
};

export const formatText = (line) => {
  const res = line2bas(line);
  if (res.length === 0) {
    // this is a directive or blank line - give it back
    return line;
  }
  return line2txt(res.basic);
};

export const file2bas = (
  src,
  format = '3dos',
  filename = 'UNTITLED',
  includeHeader = true
) => {
  src = src.toString();
  const lines = [];
  let length = 0;
  const lexer = new Lexer();
  const directives = {
    filename,
    autostart: 0x8000,
  };
  src
    .split('\n')
    .filter(Boolean)
    .forEach((text) => {
      if (text.trim().length > 0) {
        const data = lexer.line(text);
        if (data.directive) {
          if (SUPPORTED_DIRECTIVES.includes(data.directive)) {
            directives[data.directive] = data.value || 0;
          }
          return;
        }
        if (data.length === 0) {
          // this is a bad line, throw it out
          return;
        }

        if (directives.autostart === 0) {
          directives.autostart = data.lineNumber;
        }
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

  if (!includeHeader) {
    return basic;
  }

  if (format === '3dos') {
    const file = new Uint8Array(length + 128);
    file.set(plus3DOSHeader(file, directives)); // set the header (128)
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
