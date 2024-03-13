// https://www.facebook.com/groups/ZXNextBasic/permalink/792585537934454/?comment_id=792727721253569
// by Daniel A. Nagy originally in C, bless his socks
export const floatToZX = (input) => {
  const sign = input < 0;
  const out = new Uint8Array(5);

  if (sign) input = -input;

  out[0] = 0x80;
  while (input < 0.5) {
    input *= 2;
    out[0]--;
  }

  while (input >= 1) {
    input *= 0.5;
    out[0]++;
  }

  input *= 0x100000000;
  input += 0.5;

  let mantissa = input;

  out[1] = mantissa >> 24;
  mantissa &= 0xffffff;
  out[2] = mantissa >> 16;
  mantissa &= 0xffff;
  out[3] = mantissa >> 8;
  mantissa &= 0xff;
  out[4] = mantissa;
  if (!sign) out[1] &= 0x7f;

  return out;
};
