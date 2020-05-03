import { asTap, plus3DOSHeader } from './headers';
export { plus3DOSHeader, tapHeader } from './headers';
export { default as codes } from './codes';

import { parseLines, parseLine, validate } from './txt2bas2';
import { tap2txt, bas2txt, bas2txtLines } from './bas2txt';

export const line2bas = (line) => {
  return parseLine(line);
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
  return line2txt(res);
};

export const validateTxt = (src) => {
  return validate(src);
};

export const file2bas = (
  src,
  format = '3dos',
  filename = 'UNTITLED',
  includeHeader = true
) => {
  if (!src.toString) {
    throw new Error('Source must be a string');
  }

  src = src.toString();

  const directives = {
    filename,
    autostart: 0x8000,
  };

  const { bytes, length, autostart } = parseLines(src);
  directives.autostart = autostart;

  if (!includeHeader) {
    return bytes;
  }

  if (format === '3dos') {
    const file = new Uint8Array(length + 128);
    file.set(plus3DOSHeader(file, directives)); // set the header (128)
    file.set(bytes, 128);

    return file;
  } else if (format === 'tap') {
    return asTap(bytes, filename);
  }
};

export const file2txt = (src, format = '3dos') => {
  if (!src || !src.length) {
    throw new Error('Source must be an array of byte data');
  }
  if (format === '3dos') {
    return bas2txt(new Uint8Array(src)) + '\n';
  } else if (format === 'tap') {
    return tap2txt(new Uint8Array(src)) + '\n';
  }
};
