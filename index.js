import { asTap, plus3DOSHeader } from './headers';
import {
  parseLines,
  parseLine,
  validate,
  parseLineWithData,
} from './txt2bas/index';
import { tap2txt, bas2txt, bas2txtLines } from './bas2txt';
export { plus3DOSHeader, tapHeader } from './headers';
export { default as codes } from './codes';

export const line2bas = parseLineWithData;
export const line2txt = bas2txtLines;

export const formatText = (line) => {
  const res = parseLine(line);
  if (res.length === 0) {
    // this is a directive or blank line - give it back
    return line;
  }
  return bas2txtLines(res);
};

export const validateTxt = (src) => {
  return validate(src);
};

export const tokens = (src) => {
  if (typeof src !== 'string') {
    src = src.toString('binary');
  }

  const res = parseLines(src);
  return res.tokens;
};

export const file2bas = (
  src,
  format = '3dos',
  filename = null,
  includeHeader = true
) => {
  if (!src.toString) {
    throw new Error('Source must be string or string-able');
  }

  if (typeof src !== 'string') {
    src = src.toString('binary'); // RADAR 'binary' doesn't do anything in the browser
  }

  const directives = {
    filename,
    autostart: 0x8000,
  };

  const { bytes, length, autostart, filename: _filename } = parseLines(src);
  directives.autostart = autostart;
  if (_filename) {
    directives.filename = _filename;
    filename = _filename;
  }

  if (!includeHeader) {
    return bytes;
  }

  if (format === '3dos') {
    const file = new Uint8Array(length + 128);
    file.set(plus3DOSHeader(file, directives)); // set the header (128)
    file.set(bytes, 128);

    return file;
  } else if (format === 'tap') {
    return asTap(bytes, filename, autostart);
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
