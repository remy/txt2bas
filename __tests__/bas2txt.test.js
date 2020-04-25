import { line2txt } from '../index';
import tap from 'tap';

tap.test('strings protected', (t) => {
  const src = [0x00, 0x0a, 0x05, 0x00, 0xf5, 0x22, 0x90, 0x22, 0x0d];
  const line = line2txt(src);
  t.same(line.slice(-2, -1).charCodeAt(0), 144);
  t.end();
});
