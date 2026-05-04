'use strict';

const PRIMES_1_TO_100 = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97];

module.exports = function (input, actual) {
  const nums = (actual.match(/\d+/g) || []).map(Number);
  return PRIMES_1_TO_100.every(p => nums.includes(p));
};
