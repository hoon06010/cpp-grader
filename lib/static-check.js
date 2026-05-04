'use strict';

const fs = require('fs');
const crypto = require('crypto');

// 관용적으로 허용되는 단일 문자 변수명 (루프 카운터, 수학 변수)
const ALLOWED_SINGLE = new Set(['i', 'j', 'k', 'n', 'x', 'y', 'p', 'q', 'c', 'm']);

/**
 * C++ 소스 파일에 대한 정적 분석 체크를 수행한다.
 * 각 항목이 true면 통과, false면 감점 사유 후보.
 *
 * @param {string} sourcePath - .cpp 파일 경로
 * @returns {{ allPassed: boolean, checks: Record<string,boolean> }}
 */
function runStaticChecks(sourcePath) {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const lines = src.split('\n');

  // void main 사용 금지
  const noVoidMain = !/\bvoid\s+main\s*\(/.test(src);

  // int main 본문에 return 문 존재
  const mainBodyMatch = src.match(/\bint\s+main\s*\([^)]*\)\s*\{([\s\S]*)/);
  const hasReturnInMain = mainBodyMatch
    ? /\breturn\s/.test(mainBodyMatch[1])
    : true; // main 없으면 체크 생략

  // 의미 없는 단일 문자 변수명 검사 (허용 목록 제외)
  const varRe = /\b(?:int|double|float|char|long|short|bool|string)\s+([a-z])\b/g;
  let noPoorVarNames = true;
  let hit;
  while ((hit = varRe.exec(src)) !== null) {
    if (!ALLOWED_SINGLE.has(hit[1])) {
      noPoorVarNames = false;
      break;
    }
  }

  // 주석 존재 여부 (// 또는 /* */)
  const hasComments = /\/\/|\/\*/.test(src);

  // 들여쓰기 일관성 (탭과 스페이스 혼용 금지)
  const tabLines   = lines.filter(l => /^\t/.test(l)).length;
  const spaceLines = lines.filter(l => /^ {2,}/.test(l)).length;
  const consistentIndent = !(tabLines > 0 && spaceLines > 0);

  // HW1-1 전용: -1 입력 종료 패턴 (while/do-while 루프 + -1 비교)
  const hasLoop = /\b(while|do)\b/.test(src);
  const hasMinus1Exit = /!=\s*-1|-1\s*!=|==\s*-1|-1\s*==/.test(src);
  const hw1SentinelOk = hasLoop && hasMinus1Exit;

  // HW1-1 전용: 초과근무 1.5배 계산 패턴
  const hasOvertime = /1\.5/.test(src);

  const checks = {
    noVoidMain, hasReturnInMain, noPoorVarNames, hasComments, consistentIndent,
    hw1SentinelOk, hasOvertime,
  };
  // allPassed는 코딩 스타일 항목만으로 판단 (hw1 전용 항목 제외)
  const styleChecks = { noVoidMain, hasReturnInMain, noPoorVarNames, hasComments, consistentIndent };
  const allPassed = Object.values(styleChecks).every(Boolean);
  return { allPassed, checks };
}

/**
 * .cpp 파일의 공백 정규화 후 SHA-256 해시 앞 12자리를 반환한다.
 * 동일 코드 중복 제출 감지용.
 *
 * @param {string} sourcePath
 * @returns {string}
 */
function computeHash(sourcePath) {
  const src = fs.readFileSync(sourcePath, 'utf8');
  const normalized = src.replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

module.exports = { runStaticChecks, computeHash };
