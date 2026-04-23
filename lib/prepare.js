#!/usr/bin/env node
'use strict';

/**
 * students/ 폴더의 zip 파일을 모두 압축 해제하고 컴파일한 뒤
 * 결과를 JSON 배열로 stdout에 출력한다.
 *
 * Claude가 이 출력을 받아 코드 리뷰를 수행한다.
 *
 * 사용법: node lib/prepare.js
 */

const fs = require('fs');
const path = require('path');
const { extractZip, findCppFiles } = require('./extractor');
const { compile, cleanup } = require('./compiler');
const { detectSubProblem, runTests } = require('./runner');

const studentsDir = path.resolve('students');
const studentCodeDir = path.resolve('student_code');

if (!fs.existsSync(studentsDir)) {
  console.error(`[오류] students/ 폴더가 없습니다: ${studentsDir}`);
  process.exit(1);
}

fs.mkdirSync(studentCodeDir, { recursive: true });

const zipFiles = fs.readdirSync(studentsDir)
  .filter(f => f.toLowerCase().endsWith('.zip'))
  .sort();

if (zipFiles.length === 0) {
  console.error('[오류] students/ 폴더에 .zip 파일이 없습니다.');
  process.exit(1);
}

const results = [];

for (const zipFilename of zipFiles) {
  const zipPath = path.join(studentsDir, zipFilename);

  // zip 압축 해제
  let extracted;
  try {
    extracted = extractZip(zipPath, studentCodeDir);
  } catch (err) {
    results.push({
      hwNum: '',
      studentId: '',
      studentName: zipFilename,
      filename: zipFilename,
      cppPath: null,
      code: null,
      compiled: false,
      compileScore: 0,
      compileError: `압축 해제 오류: ${err.message}`,
    });
    continue;
  }

  // .cpp 파일 탐색
  const cppFiles = findCppFiles(extracted.folderPath);

  if (cppFiles.length === 0) {
    results.push({
      hwNum: extracted.hwNum,
      studentId: extracted.studentId,
      studentName: extracted.studentName,
      filename: zipFilename,
      cppPath: null,
      code: null,
      compiled: false,
      compileScore: 0,
      compileError: 'zip 내에 .cpp 파일이 없습니다.',
    });
    continue;
  }

  // .cpp 파일별 컴파일 + 테스트
  for (const cppPath of cppFiles) {
    const compileResult = compile(cppPath);
    const code = fs.readFileSync(cppPath, 'utf8');

    // 컴파일 성공 시 자동 테스트 실행
    let testInfo = { ran: false, allPassed: false, results: [] };
    if (compileResult.success && compileResult.binaryPath) {
      const subProbNum = detectSubProblem(cppPath);
      if (subProbNum) {
        testInfo = runTests(compileResult.binaryPath, subProbNum, cppPath);
      }
    }

    cleanup(compileResult.binaryPath);

    results.push({
      hwNum: extracted.hwNum,
      studentId: extracted.studentId,
      studentName: extracted.studentName,
      filename: path.basename(cppPath),
      cppPath,
      // 모든 테스트 통과 시 코드 본문 제외 — Claude 토큰 절감
      code: testInfo.allPassed ? null : code,
      compiled: compileResult.success,
      compileScore: compileResult.score,
      compileError: compileResult.error || '',
      testResults: testInfo.results,
      allTestsPassed: testInfo.allPassed,
    });
  }
}

console.log(JSON.stringify(results, null, 2));
