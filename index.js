import { asTap, plus3DOSHeader } from './headers';
import { parseLines, validate, parseLineWithData } from './txt2bas/index';
import { tap2txt, bas2txt, bas2txtLines } from './bas2txt';
export { plus3DOSHeader, tapHeader } from './headers';
export { default as codes } from './codes';
export { renumber, shift } from './renumber';
export const line2bas = parseLineWithData;
export const line2txt = bas2txtLines;

export const formatText = (line, autoline = null) => {
  if (line.startsWith('#')) {
    // this is a directive or blank line - give it back
    return line;
  }
  const res = parseLineWithData(line, autoline);
  let text = bas2txtLines(res.basic);
  if (autoline) {
    // manually remove the line
    text = text.split(' ').slice(1).join(' ');
  }

  return text;
};

export const validateTxt = (src, debug) => {
  if (typeof src !== 'string') {
    src = src.toString('binary');
  }

  return validate(src, debug);
};

export const statements = (source, options) => {
  return parseLines(source, options).statements;
};

export const tokens = (src, options) => {
  if (typeof src !== 'string') {
    src = src.toString('binary');
  }

  const res = parseLines(src, options);
  return res.tokens;
};

export const file2bas = (src, options = {}) => {
  if (!src.toString) {
    throw new Error('Source must be string or string-able');
  }

  const {
    format = '3dos',
    binary = false, // used if source has UDGs
    includeHeader = true,
    validate = false,
  } = options;

  let { filename = 'untitled', autostart = 0x8000 } = options;

  if (typeof src !== 'string') {
    if (binary) {
      src = src.toString('binary');
    } else {
      src = src.toString();
    }
  }

  const directives = {
    filename,
    autostart,
  };

  const { bytes, length, ...rest } = parseLines(src, {
    validate,
  });

  if (rest.autostart) {
    directives.autostart = rest.autostart;
  }

  if (rest.filename) {
    directives.filename = rest.filename;
    filename = rest.filename;
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

export const file2txt = (src, options = {}) => {
  const { format = '3dos' } = options;
  if (!src || !src.length) {
    throw new Error('Source must be an array of byte data');
  }
  if (options.includeHeader === false) {
    return bas2txtLines(new Uint8Array(src)) + '\n';
  } else if (format === '3dos') {
    return bas2txt(new Uint8Array(src)) + '\n';
  } else if (format === 'tap') {
    return tap2txt(new Uint8Array(src)) + '\n';
  }
};
