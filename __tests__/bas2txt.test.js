import { line2txt, file2txt } from '../index';
import tap from 'tap';
import { promises as fsPromises } from 'fs';
const { readFile } = fsPromises;

tap.test('strings protected', (t) => {
  const src = [0x00, 0x0a, 0x05, 0x00, 0xf5, 0x22, 0x90, 0x22, 0x0d];
  const line = line2txt(src);
  t.same(line.slice(-2, -1).charCodeAt(0), 144);
  t.end();
});

tap.test('UDG char encoding', async (t) => {
  t.plan(1);

  const src = await readFile(__dirname + '/fixtures/udg.bas');
  const line = file2txt(src);
  const res = Uint8Array.from({ length: line.length }, (_, i) => {
    return line.charCodeAt(i);
  });

  t.same(res.slice(-5), new Uint8Array([0x9e, 0x80, 0x9f, 0x22, 0x0a]));
});
