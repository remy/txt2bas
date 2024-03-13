import { pack } from '@remy/unpack';

/**
 * Calculates XOR checksum
 *
 * @param {Array|Uint8Array} data
 * @returns {number} checksum
 */
export const calculateXORChecksum = (data) =>
  Uint8Array.of(data.reduce((checksum, item) => checksum ^ item, 0))[0];

/**
 * Generates TAP header for given bytes and metadata
 *
 * @param {Uint8Array} basic
 * @param {string} filename
 * @param {number} [autostart=0]
 * @returns {Uint8Array} TAP header with checksum
 */
export const tapHeader = (basic, filename = 'BASIC', autostart = 0) => {
  const res = pack(
    '<S$headerLength C$flagByte C$type A10$filename S$length S$p1 S$p2 C$checksum',
    {
      headerLength: 19,
      flagByte: 0x0, // header
      type: 0x00, // program
      filename: filename.slice(0, 10).padEnd(10, ' '),
      length: basic.length,
      p1: autostart,
      p2: basic.length,
      checksum: 0, // solved later
    }
  );

  const checksum = calculateXORChecksum(res.slice(2, 20));

  res[res.length - 1] = checksum;

  return res;
};

/**
 * Generates TAP file containing given bytes
 *
 * @param {Uint8Array} basic
 * @param {object} options
 * @param {string} [options.filename="untitled"]
 * @param {number} [options.autostart=0x8000]
 * @returns {Uint8Array} bytes
 */
export const asTap = (basic, { filename = 'untitled', autostart }) => {
  const header = tapHeader(basic, filename, autostart);
  const dataType = 0xff;
  const checksum = calculateXORChecksum(Array.from([dataType, ...basic]));
  const tapData = new Uint8Array(header.length + basic.length + 2 + 2); // ? [header.length, basic.length]
  tapData.set(header, 0); // put header in tap
  new DataView(tapData.buffer).setUint16(header.length, basic.length + 2, true); // set follow block length (plus 2 for flag + checksum)

  tapData[header.length + 2] = dataType; // data follows
  tapData.set(basic, header.length + 3); // put basic binary in tap
  tapData[tapData.length - 1] = checksum; // finish with 8bit checksum

  return tapData;
};

/**
 * Generates +3dos file containing given bytes
 *
 * @param {Uint8Array} basic
 * @param {object} [options]
 * @param {number} [options.autostart]
 * @returns {Uint8Array} bytes
 */
export const plus3DOSHeader = (basic, options = { autostart: 128 }) => {
  let { hType = 0, hOffset = basic.length - 128, autostart } = options;
  const hFileLength = basic.length - 128;
  autostart = new DataView(Uint16Array.of(autostart).buffer).getUint16(
    0,
    false
  );
  const res = pack(
    '< A8$sig C$eof C$issue C$version I$length C$hType S$hFileLength n$autostart S$hOffset',
    {
      sig: 'PLUS3DOS',
      eof: 26,
      issue: 1,
      version: 0,
      length: basic.length,
      hType,
      hFileLength,
      autostart,
      hOffset,
    }
  );

  const checksum = Array.from(res).reduce((acc, curr) => (acc += curr), 0);

  const result = new Uint8Array(128);
  result.set(res, 0);
  result[127] = checksum;

  return result;
};

// const fs = require('fs');
// const data = new Uint8Array(
//   fs.readFileSync(__dirname + '/__tests__/fixtures/picture.scr')
// );

// const length = data.length;
// const bank = true;
// const directives = {};
// let fileLength = length + 128;
// let offset = 128;
// if (bank) {
//   // fileLength = 0x4000 + 128;
//   directives.hType = 4;
//   directives.hOffset = 0x8000;
//   directives.autostart = 20; // unsure why, but autostart doesn't make sense in a BANK
//   // offset = 130;
// }

// const file = new Uint8Array(fileLength);
// file.fill(0x80);

// file.set(plus3DOSHeader(file, directives)); // set the header (128)

// // file[128] = 'B'.charCodeAt(0);
// // file[129] = 'C'.charCodeAt(0);

// file.set(data, offset);
// fs.writeFileSync(__dirname + '/__tests__/fixtures/picture.bin', file);
