#!/usr/bin/env node
'use strict';

/**
 * prepare-from-extracted.js 의 JSON 출력을 읽어 자동 채점한다.
 * 입력: stdin 또는 첫 번째 인자 경로
 * 출력: /tmp/grade_results.json
 */

const fs = require('fs');
const path = require('path');
const { detectSubProblem } = require('./runner');

const inputPath = process.argv[2] || '/tmp/prepare_results.json';
const entries = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// 문제별 만점 (컴파일 성공 기준)
const BASE_SCORE = { '1': 10, '2': 10, '3': 10, '4': 10, '5': 10, '6': 10, '7': 10 };

/** 코드 본문에서 stdin 입출력 구문 존재 여부 확인 */
function hasIOStatement(codePath) {
  if (!codePath || !fs.existsSync(codePath)) return false;
  const src = fs.readFileSync(codePath, 'utf8');
  return /scanf|cin|printf|cout|gets\b|fgets/.test(src);
}

/**
 * 단일 cpp 파일 항목의 점수와 감점 사유를 계산한다.
 * @returns {{ probNum, base, score, deductions }}
 */
function gradeEntry(e) {
  const probNum = detectSubProblem(e.filename) || detectSubProblem(e.codePath || '');
  const base = probNum ? (BASE_SCORE[probNum] || 10) : 10;

  // 컴파일 실패
  if (!e.compiled) {
    const score = hasIOStatement(e.codePath) ? 3 : 0;
    return { probNum, base, score, deductions: `컴파일 실패(${score}점)` };
  }

  // 컴파일 성공 → 자동 만점
  if (e.skipReview || e.allTestsPassed) {
    return { probNum, base, score: base, deductions: '' };
  }

  // 컴파일 성공 → 테스트 실패 → 감점 계산
  const deductList = [];
  let score = base;

  const failed = (e.testResults || []).filter(r => !r.passed).map(r => r.desc);

  if (probNum === '1') {
    // 자동 테스트 없음, staticChecks 로 판단
    const sc = e.staticChecks || {};
    if (sc.hw1SentinelOk === false) { score -= 2; deductList.push('-2: -1 입력 시 종료 안됨'); }
    if (sc.hasOvertime === false)   { score -= 2; deductList.push('-2: 초과근무 계산 없음'); }

  } else if (probNum === '2') {
    // 9의 개수 세기
    const anyWrong = failed.some(d => d.startsWith('count_9'));
    if (anyWrong) { score -= 2; deductList.push('-2: 9의 개수 결과 오류'); }

  } else if (probNum === '3') {
    // 회문 판별
    if (failed.length > 0) { score -= 2; deductList.push('-2: 회문 판별 결과 오류'); }

  } else if (probNum === '4') {
    // 소수 목록
    if (failed.some(d => d.includes('소수'))) { score -= 2; deductList.push('-2: 소수 계산 오류'); }

  } else if (probNum === '5') {
    // N^P 계산
    const calcFailed = failed.filter(d => /\^/.test(d) || d.includes('='));
    const forFailed  = failed.some(d => d.includes('for'));
    if (calcFailed.length > 0) { score -= 2; deductList.push('-2: N^P 계산 결과 오류'); }
    if (forFailed)             { score -= 2; deductList.push('-2: for 루프 미사용'); }

  } else if (probNum === '6') {
    // 시간 변환 (초 → H:M:S)
    const failCount = failed.length;
    if (failCount === 1) {
      score -= 2; deductList.push('-2: 시/분/초 변환 1개 오류');
    } else if (failCount >= 2) {
      score -= 3; deductList.push('-3: 시/분/초 변환 2개 이상 오류');
    }

  } else if (probNum === '7') {
    // 일일 운전 비용
    if (failed.length > 0) { score -= 2; deductList.push('-2: 운전 비용 계산 오류'); }
  }

  score = Math.max(0, score);
  return { probNum, base, score, deductions: deductList.join('\n') };
}

// 학생별 결과 집계
const studentMap = {};

for (const e of entries) {
  const { probNum, base, score, deductions } = gradeEntry(e);
  const studentKey = e.studentId;

  if (!studentMap[studentKey]) {
    studentMap[studentKey] = {
      hwNum: e.hwNum,
      studentId: e.studentId,
      studentName: e.studentName,
      filename: e.filename,
      compiled: e.compiled,
      compileScore: 0,
      compileError: e.compileError || '',
      criteriaScore: 0,
      maxCriteriaScore: 0,
      totalScore: 0,
      deductions: '',
      problems: {},
    };
  }

  const s = studentMap[studentKey];

  // 중복 문제 번호(재제출 포함)는 더 높은 점수만 채택
  const probKey = probNum || '_';
  if (s.problems[probKey] !== undefined) {
    if (score > s.problems[probKey].score) {
      s.criteriaScore    -= s.problems[probKey].score;
      s.maxCriteriaScore -= s.problems[probKey].base;
      s.problems[probKey] = { score, base, deductions };
      s.criteriaScore   += score;
      s.maxCriteriaScore += base;
    }
  } else {
    s.problems[probKey] = { score, base, deductions };
    s.criteriaScore   += score;
    s.maxCriteriaScore += base;
  }

  s.totalScore = s.criteriaScore;

  // 감점 사유 취합
  const parts = [];
  for (const [pn, info] of Object.entries(s.problems)) {
    if (info.deductions) parts.push(`[P${pn}] ${info.deductions}`);
  }
  s.deductions = parts.join('\n');
}

const results = Object.values(studentMap).map(s => {
  // eslint-disable-next-line no-unused-vars
  const { problems, ...rest } = s;
  return rest;
});

const outPath = '/tmp/grade_results.json';
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

// 요약 출력
const total = results.length;
const compiled = results.filter(r => r.compiled).length;
const scores = results.map(r => r.totalScore);
const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
const max = Math.max(...scores);
const min = Math.min(...scores);

console.log(`채점 완료: ${total}명`);
console.log(`컴파일 성공: ${compiled}명 / 실패: ${total - compiled}명`);
console.log(`점수 분포: 최고 ${max}점 / 최저 ${min}점 / 평균 ${avg}점`);
console.log(`저장: ${outPath}`);
