#!/usr/bin/env node
'use strict';

/**
 * student_code/ 에 이미 압축 해제된 폴더를 처리한다.
 * 결과를 JSON 파일로 저장하고 요약만 stdout에 출력한다.
 *
 * 사용법: node lib/prepare-from-extracted.js [--sandbox rlimit|docker|none] [--output PATH]
 *   --output PATH  : 결과 JSON 저장 경로 (기본값: /tmp/prepare_batch_{timestamp}.json)
 */

const fs = require('fs');
const path = require('path');
const { findCppFiles } = require('./extractor');
const { compile, cleanup } = require('./compiler');
const { detectSubProblem, runTests } = require('./runner');
const { runStaticChecks, computeHash } = require('./static-check');
const { recordSubmission, findPreviousPass } = require('./db');

const sandboxArg = process.argv.indexOf('--sandbox');
const sandboxMode = sandboxArg !== -1 ? (process.argv[sandboxArg + 1] || 'rlimit') : 'rlimit';

const outputArg = process.argv.indexOf('--output');
const outputPath = outputArg !== -1 ? process.argv[outputArg + 1] : `/tmp/prepare_batch_${Date.now()}.json`;

const startArg = process.argv.indexOf('--start');
const limitArg = process.argv.indexOf('--limit');
const batchStart = startArg !== -1 ? parseInt(process.argv[startArg + 1], 10) : 0;
const batchLimit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

const studentCodeDir = path.resolve('student_code');
const FOLDER_PATTERN = /^hw(\d+)_(\d+)_(.+)$/i;

if (!fs.existsSync(studentCodeDir)) {
  console.error(`[오류] student_code/ 폴더가 없습니다: ${studentCodeDir}`);
  process.exit(1);
}

const allFolders = fs.readdirSync(studentCodeDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort();

if (allFolders.length === 0) {
  console.error('[오류] student_code/ 폴더가 비어 있습니다.');
  process.exit(1);
}

const folders = allFolders.slice(batchStart, batchLimit === Infinity ? undefined : batchStart + batchLimit);

if (folders.length === 0) {
  console.error(`[오류] --start ${batchStart}이 전체 폴더 수(${allFolders.length})를 초과합니다.`);
  process.exit(1);
}

process.stderr.write(`[배치] 전체 ${allFolders.length}명 중 ${batchStart + 1}~${batchStart + folders.length}번째 처리 (${folders.length}명)\n`);

const results = [];

for (const folderName of folders) {
  const m = folderName.match(FOLDER_PATTERN);
  if (!m) {
    process.stderr.write(`[경고] 폴더명 형식 불일치, 스킵: ${folderName}\n`);
    continue;
  }
  const hwNum = m[1];
  const studentId = m[2];
  const studentName = m[3];
  const folderPath = path.join(studentCodeDir, folderName);

  const cppFiles = findCppFiles(folderPath);

  if (cppFiles.length === 0) {
    results.push({
      hwNum, studentId, studentName,
      filename: folderName, codePath: null, codeHash: null,
      compiled: false, compileScore: 0,
      compileError: '폴더 내 .cpp 파일 없음',
      testResults: [], allTestsPassed: false,
      staticChecks: {}, skipReview: false,
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
        hwNum,
        subProbNum,
        cppPath,
        { sandbox: sandboxMode }
      );
    }

    cleanup(compileResult.binaryPath);

    const staticResult = runStaticChecks(cppPath);
    const codeHash = computeHash(cppPath);

    const prevPass = findPreviousPass(hwNum, codeHash);

    const isP1AutoOk = subProbNum === '1'
      && staticResult.checks.hw1SentinelOk
      && staticResult.checks.hasOvertime;
    const skipReview = !!(prevPass) || isP1AutoOk || (testInfo.allPassed && staticResult.allPassed);

    results.push({
      hwNum, studentId, studentName,
      filename: path.basename(cppPath),
      codePath: cppPath,
      codeHash,
      compiled: compileResult.success,
      compileScore: compileResult.score,
      compileError: compileResult.error || '',
      testResults: testInfo.results,
      allTestsPassed: testInfo.allPassed,
      staticChecks: staticResult.checks,
      skipReview,
    });

    recordSubmission({
      hwNum, studentId, studentName,
      filename: path.basename(cppPath),
      codeHash,
      compiled: compileResult.success,
      allTestsPassed: testInfo.allPassed,
      totalScore: null,
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
