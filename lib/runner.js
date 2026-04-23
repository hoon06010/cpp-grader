'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PRIMES_1_TO_100 = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97];

/** 출력에서 정수 목록 추출 */
function extractIntegers(str) {
  return (str.match(/\d+/g) || []).map(Number);
}

/** 출력에 독립된 정수 n이 포함되는지 확인 (단어 경계) */
function hasInteger(str, n) {
  return new RegExp(`(?<![0-9])${n}(?![0-9])`).test(str);
}

/** 출력에 근사 부동소수점 값이 포함되는지 확인 */
function hasFloat(str, expected, tol = 0.5) {
  const nums = (str.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return nums.some(n => Math.abs(n - expected) < tol);
}

/**
 * 문제번호 → 테스트케이스 목록
 * check(output): 정답이면 true
 */
const TEST_CASES = {
  // HW1-1: 이미지 기반 — 자동 테스트 불가
  '1': null,

  // HW1-2: 9의 개수 세기
  '2': [
    { input: '99\n',    check: o => hasInteger(o, 2), desc: 'count_9(99)=2' },
    { input: '12345\n', check: o => hasInteger(o, 0), desc: 'count_9(12345)=0' },
    { input: '99999\n', check: o => hasInteger(o, 5), desc: 'count_9(99999)=5' },
    { input: '9\n',     check: o => hasInteger(o, 1), desc: 'count_9(9)=1' },
  ],

  // HW1-3: 회문 판별
  '3': [
    {
      input: '12321\n',
      check: o => { const l = o.toLowerCase(); return l.includes('palindrome') && !l.includes('not'); },
      desc: '12321=palindrome',
    },
    {
      input: '12345\n',
      check: o => o.toLowerCase().includes('not'),
      desc: '12345=not palindrome',
    },
    {
      input: '11211\n',
      check: o => { const l = o.toLowerCase(); return l.includes('palindrome') && !l.includes('not'); },
      desc: '11211=palindrome',
    },
  ],

  // HW1-4: 소수 목록 출력 (입력 없음)
  '4': [
    {
      input: '',
      check: o => {
        const nums = extractIntegers(o);
        return PRIMES_1_TO_100.every(p => nums.includes(p));
      },
      desc: '1~100 소수 전체 포함',
    },
  ],

  // HW1-5: N^P 계산 (for 루프 여부는 소스에서 별도 확인)
  '5': [
    { input: '2.0\n3\n',  check: o => hasFloat(o, 8),    desc: '2^3=8' },
    { input: '3.0\n2\n',  check: o => hasFloat(o, 9),    desc: '3^2=9' },
    { input: '2.0\n10\n', check: o => hasFloat(o, 1024), desc: '2^10=1024' },
  ],

  // HW1-6: 시간 변환 (초 → H:M:S)
  '6': [
    {
      input: '3661\n',
      check: o => /1\s*:\s*1\s*:\s*1/.test(o),
      desc: '3661→1:1:1',
    },
    {
      input: '7200\n',
      check: o => /2\s*:\s*0\s*:\s*0/.test(o),
      desc: '7200→2:0:0',
    },
    {
      input: '86400\n',
      check: o => /24\s*:\s*0\s*:\s*0/.test(o),
      desc: '86400→24:0:0',
    },
  ],

  // HW1-7: 입력 항목 형식 불명확 — 자동 테스트 불가
  '7': null,
};

/**
 * .cpp 파일명에서 서브 문제 번호(1~7)를 추출한다.
 * @param {string} cppPath
 * @returns {string|null}
 */
function detectSubProblem(cppPath) {
  // 전각 숫자(１２３…) → 반각 숫자로 정규화
  const raw = path.basename(cppPath, '.cpp').toLowerCase();
  // 전각 숫자 ０(FF10)~９(FF19) → 반각 숫자 0~9
  const base = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30));
  const patterns = [
    /hw\d+[-_](\d)/,              // hw1-2, hw1_2
    /(?:problem|prob)[-_]?(\d)/,  // problem2, prob2
    /(?:^|[-_])([2-7])(?:[-_]|$)/, // _2_, -3-, etc.
    /[pq](\d)$/,                  // p2, q3
    /(\d)$/,                      // 끝 한 자리 숫자
  ];
  for (const pat of patterns) {
    const m = base.match(pat);
    if (m && m[1] >= '1' && m[1] <= '7') return m[1];
  }
  return null;
}

/**
 * 컴파일된 바이너리로 테스트케이스를 실행한다.
 * @param {string} binaryPath
 * @param {string} subProbNum - '1'~'7'
 * @param {string} sourcePath - 소스 파일 경로 (HW1-5 for 루프 검사용)
 * @returns {{ ran: boolean, allPassed: boolean, results: Array<{desc,passed,output}> }}
 */
function runTests(binaryPath, subProbNum, sourcePath) {
  const cases = TEST_CASES[subProbNum];
  if (!cases) return { ran: false, allPassed: false, results: [] };

  const results = [];

  for (const tc of cases) {
    const proc = spawnSync(binaryPath, [], {
      input: tc.input,
      encoding: 'utf8',
      timeout: 3000,
    });
    const output = (proc.stdout || '') + (proc.stderr || '');
    // 타임아웃이어도 부분 출력이 있으면 검사 (루프형 프로그램 대응)
    const passed = tc.check(output);
    results.push({ desc: tc.desc, passed, output: output.trim().slice(0, 120) });
  }

  // HW1-5 전용: for 루프 사용 여부 소스 확인
  if (subProbNum === '5' && sourcePath && fs.existsSync(sourcePath)) {
    const src = fs.readFileSync(sourcePath, 'utf8');
    const hasForLoop = /\bfor\s*\(/.test(src);
    results.push({
      desc: 'for 루프 사용',
      passed: hasForLoop,
      output: hasForLoop ? 'for 루프 확인됨' : 'for 루프 없음 (pow() 단독 사용 의심)',
    });
  }

  const allPassed = results.every(r => r.passed);
  return { ran: true, allPassed, results };
}

module.exports = { detectSubProblem, runTests };
