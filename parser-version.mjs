export const v208 = '208';
export const v207 = '207';
export const FIRST = v207;
export const LATEST = v208;

const valid = [v208, v207];

global.parser = LATEST;

/**
 * Sets the default parser across the software
 *
 * @param {string} value
 */
export function setParser(value) {
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
