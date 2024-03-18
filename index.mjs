/**
 * @typedef { import(".").ParseOptions } ParseOptions
 * @typedef { import(".").Statement } Statement
 * @typedef { import(".").ParseLineResult } ParseLineResult
 */

import { asTap, plus3DOSHeader } from './headers.mjs';
import {
  parseLines,
  validate,
  parseLineWithData,
  statementsToBytes,
} from './txt2bas/index.mjs';
import * as transform from './txt2bas/transform.mjs';
import { tap2txt, bas2txt, bas2txtLines } from './bas2txt.mjs';
import * as parser from './parser-version.mjs';
export { plus3DOSHeader, tapHeader } from './headers.mjs';
export { default as codes } from './codes.mjs';
export { renumber, shift } from './renumber.mjs';
import pkg from './package.json' assert { type: 'json' };

export const version = pkg.version;

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
  let lineNumber = '';
  if (autoline === true) {
    // test if the line actually has a line number in it
    const match = line.match(/^(\d+)\s+(.*)$/); //?
    if (match && match.length === 3) {
      autoline = match[1];
      lineNumber = autoline;
      line = match[2];
    }
  }

  if (line.includes('\n')) {
    return line
      .split('\n')
      .map((line) => formatText(line, autoline))
      .join('\n');
  }
  if (line.startsWith('#') || line.trim() === '') {
    // this is a directive or blank line - give it back
    return line;
  }
  const res = parseLineWithData(line, autoline);
  let text = bas2txtLines(res.basic);
  if (autoline) {
    // manually remove the line number
    text = text
      .split(' ')
      .filter((_, i) => {
        if (i === 0) {
          return false;
        }
        return true;
      })
      .join(' ');

    if (lineNumber !== '') {
      text = lineNumber + ' ' + text;
    }
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
 * @param {boolean} options.defines convert #define to inline
 * @returns {ParseLineResult}
 */
export const tokens = (
  src,
  { stripComments, defines, inlineLoad, ...options }
) => {
  if (typeof src !== 'string') {
    src = src.toString('binary');
  }

  let { statements, ...rest } = parseLines(src, options);

  if (defines) {
    statements = transform.replaceDefines(statements, rest.defines);
  }

  if (stripComments) {
    statements = transform.stripComments(statements);
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
 * @param {boolean} [options.defines=false]
 * @param {boolean} [options.bankOutputDir=process.cwd()] directory to save banks to, if this is empty or false, it doesn't write banks when split
 * @param {string} [options.parser] parser version to use
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
    bankOutputDir = false,
    ...parseOptions
  } = options;

  if (parseOptions.parser) {
    parser.setParser(parseOptions.parser);
  }

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
    if (!bank) {
      return bytes;
    }

    const file = new Uint8Array(length + 2);
    file[0] = 'B'.charCodeAt(0);
    file[1] = 'C'.charCodeAt(0);
    file.set(bytes, 2);
    return file;
  }

  if (format === 'tap') {
    return asTap(bytes, directives);
  }

  if (rest.bankSplits.length === 0) {
    return generateFile({ bytes, bank, directives });
  }

  const file = generateFile({ bytes, bank, directives });

  if (bankOutputDir) {
    rest.bankSplits.forEach((bank) => {
      const file = generateFile({
        bytes: bank.bytes,
        bank: true,
        directives: { ...directives, filename: bank.filename },
      });
      // save the bank as a file
      const { join } = require('path');

      require('fs').writeFileSync(
        join(bankOutputDir, bank.filename),
        Buffer.from(file)
      );
    });
  }
  // generate the file, but also save the actual banks as files
  return file;
};

/**
 * Generates a file based on the provided bytes, bank flag, and directives.
 *
 * @param {object} options - The options object.
 * @param {Uint8Array} options.bytes - The bytes to generate the file from.
 * @param {boolean} [options.bank] - Indicates if the file is a bank.
 * @param {object} options.directives - The directives for the file.
 * @returns {Uint8Array} The generated file.
 */
function generateFile({ bytes, bank, directives }) {
  // Function implementation goes here

  const length = bytes.length;
  let fileLength = length + 128;
  let offset = 128;
  if (bank) {
    if (parser.getParser() < parser.v208) {
      fileLength = 0x4000 + 128;
      directives.hOffset = 0x8000;
    } else {
      fileLength += 3;
      directives.hOffset = 0x005a;
    }
    directives.hType = 3;
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

  try {
    file.set(bytes, offset);
  } catch (e) {
    if (bank) {
      throw new Error('Too large for bank');
    } else {
      throw e;
    }
  }

  if (bank && parser.getParser() >= parser.v208) {
    file[fileLength] = 0x80;
  }

  return file;
}

/**
 * Converts byte data to plain text
 *
 * @param {Uint8Array} src byte data buffer
 * @param {object} [options]
 * @param {string} [options.format=3dos] format type: "3dos", "tap"
 * @param {boolean} [options.includeHeader=true]
 * @returns {string}
 */
export const file2txt = (src, options = {}) => {
  const { format = '3dos' } = options;
  if (!src || !src.length) {
    throw new Error('Source must be an array of byte data');
  }
  if (options.includeHeader === false) {
    return bas2txtLines(new Uint8Array(src)) + '\n';
  } else if (format === 'tap') {
    return tap2txt(new Uint8Array(src)) + '\n';
  }

  // else format = '3dos'
  return bas2txt(new Uint8Array(src)) + '\n';
};
