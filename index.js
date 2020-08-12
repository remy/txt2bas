import { asTap, plus3DOSHeader } from './headers';
import {
  parseLines,
  validate,
  parseLineWithData,
  statementsToBytes,
} from './txt2bas/index';
import * as transform from './txt2bas/transform';
import { tap2txt, bas2txt, bas2txtLines } from './bas2txt';
export { plus3DOSHeader, tapHeader } from './headers';
export { default as codes } from './codes';
export { renumber, shift } from './renumber';
export const line2bas = parseLineWithData;
export const line2txt = bas2txtLines;

/**
 * Reformats string into visually valid NextBASIC
 *
 * @param {string} line
 * @param {number|null} [autoline=null] Whether to use autoline, must be > 0 if a number is passed
 * @returns {string}
 */
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

/**
 * Validates multiple lines of NextBASIC
 *
 * @param {string|Buffer} text multiline NextBASIC
 * @param {object} [debug]
 * @returns {string[]} Any errors found
 */
export const validateTxt = (text, debug) => {
  if (typeof text !== 'string') {
    text = text.toString('binary');
  }

  return validate(text, debug);
};

/** @typedef { import("./txt2bas/").ParseOptions } ParseOptions */
/** @typedef { import("./txt2bas/").Statement } Statement */
/** @typedef { import("./txt2bas/").ParseLineResult } ParseLineResult */

/**
 * Get the statement objects for source code
 *
 * @param {string} source NextBASIC text
 * @param {ParseOptions} options
 * @returns {Statement[]}
 */
export const statements = (source, options) => {
  return parseLines(source, options).statements;
};

/**
 * Tokenises source text into statements
 *
 * @param {string} src
 * @param {ParseOptions} options
 * @param {boolean} options.stripComments removes all comments from the result
 * @returns {ParseLineResult}
 */
export const tokens = (src, { stripComments, inlineLoad, ...options }) => {
  if (typeof src !== 'string') {
    src = src.toString('binary');
  }

  let { statements, ...rest } = parseLines(src, options);

  if (stripComments) {
    statements = transform.stripComments(statements, rest.autoline);
  }

  if (inlineLoad) {
    statements = transform.inlineLoad(statements);
  }

  return { statements, ...rest };
};

/**
 * Converts plain text to NextBASIC binary
 *
 * @param {string} src plain text source of NextBASIC
 * @param {object} [options]
 * @param {string} [options.format=3dos]
 * @param {boolean} [options.includeHeader=true]
 * @param {boolean} [options.bank=false]
 * @param {string} [options.filename='untitled']
 * @param {number|null} [options.autostart=0x8000]
 * @param {boolean} [options.stripComments=false]
 * @param {boolean} [options.validate=false]
 * @returns {Uint8Array}
 */
export const file2bas = (src, options = {}) => {
  if (!src.toString) {
    throw new Error('Source must be string or string-able');
  }

  const {
    format = '3dos',
    binary = false, // used if source has UDGs
    includeHeader = true,
    ...parseOptions
  } = options;

  const bank = parseOptions.bank;

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

  let { statements, ...rest } = tokens(src, parseOptions);

  const bytes = statementsToBytes(statements);
  const length = bytes.length;

  if (rest.autostart && rest.autostart !== 0x8000) {
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
    let fileLength = length + 128;
    let offset = 128;
    if (bank) {
      fileLength = 0x4000 + 128;
      directives.hType = 3;
      directives.hOffset = 0x8000;
      directives.autostart = 0xc000; // unsure why, but autostart doesn't make sense in a BANK
      offset = 130;
    }
    const file = new Uint8Array(fileLength);
    file.fill(0x80);

    file.set(plus3DOSHeader(file, directives)); // set the header (128)
    if (bank) {
      file[128] = 'B'.charCodeAt(0);
      file[129] = 'C'.charCodeAt(0);
    }
    file.set(bytes, offset);

    return file;
  } else if (format === 'tap') {
    return asTap(bytes, directives);
  }
};

/**
 * Converts byte data to plain text
 *
 * @param {Uint8Array} src byte data buffer
 * @param {object} [options]
 * @param {string} [options.format=3dos] format type: "3dos", "tap"
 * @param {boolean} [options.includeHeader=true]
 * @returns {Uint8Array}
 */
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
