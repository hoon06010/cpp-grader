#!/usr/bin/env node
'use strict';

/**
 * students/ 폴더의 zip 파일을 모두 압축 해제하고 컴파일한 뒤
 * 결과를 JSON 파일로 저장하고 요약만 stdout에 출력한다.
 *
 * 사용법: node lib/prepare.js [--sandbox rlimit|docker|none] [--start N] [--limit N] [--output PATH]
 *   --start N      : 처리 시작 인덱스 (0-based, 기본값 0)
 *   --limit N      : 처리할 최대 개수 (기본값: 전체)
 *   --output PATH  : 결과 JSON 저장 경로 (기본값: /tmp/prepare_batch_{timestamp}.json)
 */

const fs = require('fs');
const path = require('path');
const { extractZip, findCppFiles } = require('./extractor');
const { compile, cleanup } = require('./compiler');
const { detectSubProblem, runTests } = require('./runner');
const { runStaticChecks, computeHash } = require('./static-check');
const { recordSubmission, findPreviousPass } = require('./db');

// --sandbox 플래그 파싱
const sandboxArg = process.argv.indexOf('--sandbox');
const sandboxMode = sandboxArg !== -1 ? (process.argv[sandboxArg + 1] || 'rlimit') : 'rlimit';

// --start / --limit / --output 파싱
const startArg = process.argv.indexOf('--start');
const limitArg = process.argv.indexOf('--limit');
const outputArg = process.argv.indexOf('--output');
const batchStart = startArg !== -1 ? parseInt(process.argv[startArg + 1], 10) : 0;
const batchLimit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const outputPath = outputArg !== -1 ? process.argv[outputArg + 1] : `/tmp/prepare_batch_${Date.now()}.json`;

const studentsDir = path.resolve('students');
const studentCodeDir = path.resolve('student_code');

if (!fs.existsSync(studentsDir)) {
  console.error(`[오류] students/ 폴더가 없습니다: ${studentsDir}`);
  process.exit(1);
}

fs.mkdirSync(studentCodeDir, { recursive: true });

const allZipFiles = fs.readdirSync(studentsDir)
  .filter(f => f.toLowerCase().endsWith('.zip'))
  .sort();

if (allZipFiles.length === 0) {
  console.error('[오류] students/ 폴더에 .zip 파일이 없습니다.');
  process.exit(1);
}

const zipFiles = allZipFiles.slice(batchStart, batchLimit === Infinity ? undefined : batchStart + batchLimit);

if (zipFiles.length === 0) {
  console.error(`[오류] --start ${batchStart}이 전체 파일 수(${allZipFiles.length})를 초과합니다.`);
  process.exit(1);
}

process.stderr.write(`[배치] 전체 ${allZipFiles.length}명 중 ${batchStart + 1}~${batchStart + zipFiles.length}번째 처리 (${zipFiles.length}명)\n`);

const results = [];

for (const zipFilename of zipFiles) {
  const zipPath = path.join(studentsDir, zipFilename);

  let extracted;
  try {
    extracted = extractZip(zipPath, studentCodeDir);
  } catch (err) {
    results.push({
      hwNum: '', studentId: '', studentName: zipFilename,
      filename: zipFilename, cppPath: null,
      compiled: false, compileScore: 0,
      compileError: `압축 해제 오류: ${err.message}`,
    });
    continue;
  }

  const cppFiles = findCppFiles(extracted.folderPath);

  if (cppFiles.length === 0) {
    results.push({
      hwNum: extracted.hwNum, studentId: extracted.studentId,
      studentName: extracted.studentName, filename: zipFilename,
      cppPath: null, compiled: false, compileScore: 0,
      compileError: 'zip 내에 .cpp 파일이 없습니다.',
    });
    continue;
  }

  for (const cppPath of cppFiles) {
    const compileResult = compile(cppPath);

    const subProbNum = detectSubProblem(cppPath);
    let testInfo = { ran: false, allPassed: false, results: [] };

    if (compileResult.success && compileResult.binaryPath && subProbNum) {
      testInfo = runTests(
        compileResult.binaryPath,
        extracted.hwNum,
        subProbNum,
        cppPath,
        { sandbox: sandboxMode }
      );
    }

    cleanup(compileResult.binaryPath);

    const staticResult = runStaticChecks(cppPath);
    const codeHash = computeHash(cppPath);

    // 동일 해시 + 만점 이력이 있으면 skipReview
    const prevPass = findPreviousPass(extracted.hwNum, codeHash);

    const isP1AutoOk = subProbNum === '1'
      && staticResult.checks.hw1SentinelOk
      && staticResult.checks.hasOvertime;

    // 테스트 실패 항목에서 자동 감점 계산 (모든 실패에 deduction 메타데이터가 있을 때만)
    let autoDeductions = [];
    if (!testInfo.allPassed && testInfo.ran) {
      const failedResults = testInfo.results.filter(r => !r.passed);
      if (failedResults.length > 0 && failedResults.every(r => r.deduction)) {
        const seen = new Set();
        for (const r of failedResults) {
          if (!seen.has(r.deduction.label)) {
            seen.add(r.deduction.label);
            autoDeductions.push(r.deduction);
          }
        }
      }
    }

    // 정적 분석은 참고용이므로 skipReview 조건에서 제외
    const skipReview = !!(prevPass) || isP1AutoOk || testInfo.allPassed || autoDeductions.length > 0;

    const entry = {
      hwNum: extracted.hwNum,
      studentId: extracted.studentId,
      studentName: extracted.studentName,
      filename: path.basename(cppPath),
      codePath: cppPath,
      codeHash,
      compiled: compileResult.success,
      compileScore: compileResult.score,
      compileError: compileResult.error || '',
      testResults: testInfo.results,
      allTestsPassed: testInfo.allPassed,
      staticChecks: staticResult.checks,
      autoDeductions,
      skipReview,
    };

    results.push(entry);

    // DB에 제출 기록 (오류 시 무시)
    recordSubmission({
      hwNum: extracted.hwNum,
      studentId: extracted.studentId,
      studentName: extracted.studentName,
      filename: path.basename(cppPath),
      codeHash,
      compiled: compileResult.success,
      allTestsPassed: testInfo.allPassed,
      totalScore: null, // Claude 리뷰 후 확정
    });
  }
}

// JSON을 파일로 저장
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

// stdout에 요약 한 줄 출력
const reviewNeeded = results
  .map((r, i) => ({ ...r, idx: batchStart + i }))
  .filter(r => !r.skipReview);

const reviewCount = reviewNeeded.length;
const reviewIdxStr = reviewNeeded.map(r => r.idx).join(', ');
process.stdout.write(
  `준비 완료: ${results.length}명 처리 | skipReview=false: ${reviewCount}명` +
  (reviewCount > 0 ? ` (idx ${reviewIdxStr})` : '') +
  ` | 저장: ${outputPath}\n`
);

// skipReview=false 항목 상세 출력
if (reviewNeeded.length > 0) {
  process.stdout.write('리뷰 필요:\n');
  for (const r of reviewNeeded) {
    process.stdout.write(`- idx=${r.idx} | ${r.studentId} ${r.studentName} | ${r.filename} | ${r.codePath}\n`);
  }
}
