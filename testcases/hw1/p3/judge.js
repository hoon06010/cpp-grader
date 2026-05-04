'use strict';

// 회문 판별: 영문(palindrome/not) 또는 한국어(회문/아닙) 출력 모두 인정
module.exports = function (input, actual, tc) {
  const l = actual.toLowerCase();
  if (tc.isPalindrome) {
    return (l.includes('palindrome') && !l.includes('not')) ||
           (actual.includes('회문') && !actual.includes('아닙'));
  } else {
    return l.includes('not') || actual.includes('아닙');
  }
};
