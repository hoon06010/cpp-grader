'use strict';

function normalizeLines(text) {
  const lines = text.split('\n').map(l => l.trimEnd());
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * @param {'exact'|'contains_integer'|'contains_float'|'regex'|'custom'} mode
 * @param {string} actual - 실제 프로그램 출력
 * @param {object} opts
 *   - exact:             opts.expected (string)
 *   - contains_integer:  opts.value (number)
 *   - contains_float:    opts.value (number), opts.epsilon (default 0.5)
 *   - regex:             opts.pattern (string), opts.flags (string)
 *   - custom:            opts.judge(input, actual, tc) => boolean,
 *                        opts.input (string), opts.tc (object)
 */
function compare(mode, actual, opts = {}) {
  switch (mode) {
    case 'exact': {
      const exp = normalizeLines(opts.expected || '');
      const got = normalizeLines(actual);
      return JSON.stringify(exp) === JSON.stringify(got);
    }
    case 'contains_integer': {
      const n = opts.value;
      return new RegExp(`(?<![0-9])${n}(?![0-9])`).test(actual);
    }
    case 'contains_float': {
      const tol = opts.epsilon ?? 0.5;
      const nums = (actual.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      return nums.some(n => Math.abs(n - opts.value) < tol);
    }
    case 'regex': {
      return new RegExp(opts.pattern, opts.flags || '').test(actual);
    }
    case 'custom': {
      if (typeof opts.judge !== 'function') return false;
      return opts.judge(opts.input || '', actual, opts.tc || {});
    }
    default:
      throw new Error(`Unknown compare mode: ${mode}`);
  }
}

module.exports = { compare, normalizeLines };
