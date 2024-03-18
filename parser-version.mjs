export const v208 = '208';
export const v207 = '207';
export const FIRST = v207;
export const LATEST = v208;
export const LATEST_TEXT = 'LATEST';

export const valid = [LATEST_TEXT, v208, v207];

global.parser = LATEST;

/**
 * Sets the default parser across the software
 *
 * @param {string} value
 */
export function setParser(value) {
  value = value.toUpperCase();
  if (value === LATEST_TEXT) {
    value = LATEST;
  }

  if (!valid.includes(value)) {
    throw new Error(`Unknown parser: ${value} - try "${LATEST}"`);
  }

  global.parser = value;
}

/**
 * @returns {string}
 */
export function getParser() {
  return global.parser;
}
