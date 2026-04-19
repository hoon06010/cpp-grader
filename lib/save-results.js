#!/usr/bin/env node
'use strict';

/**
 * Claude가 작성한 채점 결과 JSON을 Excel로 저장한다.
 *
 * 사용법: node lib/save-results.js <results.json> [output.xlsx]
 */

const fs = require('fs');
const path = require('path');
const { saveToExcel } = require('./excel');

const [,, resultsFile, outputFile] = process.argv;

if (!resultsFile) {
  console.error('사용법: node lib/save-results.js <results.json> [output.xlsx]');
  process.exit(1);
}

if (!fs.existsSync(resultsFile)) {
  console.error(`[오류] 파일을 찾을 수 없습니다: ${resultsFile}`);
  process.exit(1);
}

let results;
try {
  results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
} catch (err) {
  console.error(`[오류] JSON 파싱 실패: ${err.message}`);
  process.exit(1);
}

const outputPath = outputFile || (() => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return path.resolve('output', `결과_${stamp}.xlsx`);
})();

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });

saveToExcel(results, path.resolve(outputPath))
  .then(p => {
    console.log(`✅ Excel 저장 완료: ${p}`);
    // 임시 결과 파일 정리
    if (resultsFile.startsWith('/tmp/')) {
      fs.unlinkSync(resultsFile);
    }
  })
  .catch(err => {
    console.error(`[오류] Excel 저장 실패: ${err.message}`);
    process.exit(1);
  });
