#!/usr/bin/env node
'use strict';

/**
 * Claude가 작성한 채점 결과 JSON을 Excel로 저장한다.
 *
 * 사용법: node lib/save-results.js <results.json> [output.xlsx]
 */

const fs = require('fs');
const path = require('path');
const { saveToExcel, updateExistingExcel } = require('./excel');

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

// output/ 폴더에서 기존 Excel 파일 탐색 (임시 잠금 파일 제외)
const outputDir = path.resolve('output');
fs.mkdirSync(outputDir, { recursive: true });

function findExistingExcel() {
  if (outputFile) return null; // 명시적 경로가 지정되면 기존 파일 모드 스킵
  try {
    return fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
      .map(f => path.join(outputDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch {
    return null;
  }
}

const existingExcel = findExistingExcel();

const save = existingExcel
  ? updateExistingExcel(results, existingExcel)
  : (() => {
      const newPath = outputFile || (() => {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
        return path.join(outputDir, `결과_${stamp}.xlsx`);
      })();
      return saveToExcel(results, path.resolve(newPath)).then(p => {
        console.log(`✅ Excel 신규 생성: ${p}`);
        return p;
      });
    })();

save
  .then(() => {
    if (resultsFile.startsWith('/tmp/')) {
      fs.unlinkSync(resultsFile);
    }
  })
  .catch(err => {
    console.error(`[오류] Excel 저장 실패: ${err.message}`);
    process.exit(1);
  });
