#!/usr/bin/env node
'use strict';

/**
 * Claude가 작성한 채점 결과 JSON을 Excel로 저장한다.
 *
 * 사용법:
 *   node lib/save-results.js <results.json> [output.xlsx]
 *   node lib/save-results.js <results.json> --reviews <review_results.json>
 */

const fs = require('fs');
const path = require('path');
const { saveToExcel, updateExistingExcel } = require('./excel');

// 인자 파싱 (--reviews 플래그 지원)
const args = process.argv.slice(2);
const reviewsFlagIdx = args.indexOf('--reviews');
const reviewsFile = reviewsFlagIdx !== -1 ? args[reviewsFlagIdx + 1] : null;
const positional = args.filter((a, i) =>
  !a.startsWith('--') && (reviewsFlagIdx === -1 || i !== reviewsFlagIdx + 1)
);
const [resultsFile, outputFile] = positional;

if (!resultsFile) {
  console.error('사용법: node lib/save-results.js <results.json> [output.xlsx] [--reviews review_results.json]');
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

// 리뷰 결과 병합 (--reviews 지정 시)
if (reviewsFile) {
  if (!fs.existsSync(reviewsFile)) {
    console.error(`[오류] 리뷰 파일을 찾을 수 없습니다: ${reviewsFile}`);
    process.exit(1);
  }
  try {
    const reviews = JSON.parse(fs.readFileSync(reviewsFile, 'utf8'));
    // studentId + hwNum + filename 기준으로 병합
    const reviewMap = {};
    for (const r of reviews) {
      const key = `${r.studentId}__${r.hwNum}__${r.filename || ''}`;
      reviewMap[key] = r;
    }
    for (const r of results) {
      const key = `${r.studentId}__${r.hwNum}__${r.filename || ''}`;
      const rev = reviewMap[key];
      if (rev) {
        r.aiFeedback = rev.aiFeedback || '';
        r.suggestions = rev.suggestions || '';
      }
    }
    console.log(`리뷰 데이터 병합 완료 (${reviews.length}건)`);
  } catch (err) {
    console.error(`[오류] 리뷰 JSON 파싱 실패: ${err.message}`);
    process.exit(1);
  }
}

// output/ 폴더에서 기존 Excel 파일 탐색
const outputDir = path.resolve('output');
fs.mkdirSync(outputDir, { recursive: true });

function findExistingExcel() {
  if (outputFile) return null;
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
    if (resultsFile.startsWith('/tmp/')) fs.unlinkSync(resultsFile);
    if (reviewsFile && reviewsFile.startsWith('/tmp/')) {
      try { fs.unlinkSync(reviewsFile); } catch {}
    }
  })
  .catch(err => {
    console.error(`[오류] Excel 저장 실패: ${err.message}`);
    process.exit(1);
  });
