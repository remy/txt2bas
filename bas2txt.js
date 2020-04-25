import BASIC from './codes.js';
import { BASIC as BASIC_CHRS } from './unicode.js';
import { unpack } from '@remy/unpack';
const Unpack = unpack.Unpack;

export function tap2txt(data) {
  const unpack = new Unpack(data);

  unpack.parse(
    `<S$headerLength C$flagByte C$type A10$filename S$length S$p1 S$p2 C$checksum x2`
  );

  return bas2txtLines(data.slice(24, data.length - 24));
}

export function bas2txt(data) {
  const unpack = new Unpack(data);

  const header = unpack.parse(
    `<A8$sig
    C$marker
    C$issue
    C$version
    I$length
    C$hType
    S$hFileLength
    S$autostart
    S$hOffset
    x
    x104
    C$checksum`
  );

  let txt = bas2txtLines(data.slice(unpack.offset));

  if (header.autostart && header.autostart != 0x8000) {
    txt = `#autostart ${header.autostart}\n${txt}`;
  }

  return txt;
}

export function bas2txtLines(data) {
  const unpack = new Unpack(data);
  let next;

  const lines = [];

  while ((next = unpack.parse('<n$line s$length'))) {
    const { length, line: lineNumber } = next;
    if (lineNumber > 9999) {
      break;
    }
    const content = unpack.parse(`<C${length}$data`);
    if (!content || !content.data) break;

    let string = lineNumber + ' ';

    let lastChr = null;
    let inString = false;

    const data = Array.from(content.data);

    while (data.length) {
      let chr = data.shift();
      if (chr === 0x0d) {
        break;
      }

      if (!inString && BASIC[chr]) {
        if (lastChr !== null && !BASIC[lastChr]) {
          string += ' ' + BASIC[chr] + ' ';
        } else {
          string += BASIC[chr] + ' ';
        }
      } else if (chr === 0x0e) {
        // move forward 5 bits - this contains the encoded numerical value
        // which, since we're porting to text, we don't care about on the way in
        data.splice(0, 5);
      } else if (BASIC_CHRS[chr]) {
        string += BASIC_CHRS[chr];
      } else {
        string += String.fromCharCode(chr);
      }

      if (chr === 0x22) {
        // a quote
        inString = !inString;
      }

      lastChr = chr;
    }

    lines.push(string);
  }

  // note that the 0x0d (13) is dropped in the line, so we're putting it back here
  return lines.join('\n');
}
