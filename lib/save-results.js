#!/usr/bin/env node
'use strict';

/**
 * Claude가 작성한 채점 결과 JSON을 Excel로 저장한다.
 *
 * 사용법:
 *   node lib/save-results.js <results.json> [output.xlsx]
 *   node lib/save-results.js <results.json> --reviews <review_results.json>
 *   node lib/save-results.js <results.json> --sheet "Lab1" --score-header "총점"
 */

const fs = require('fs');
const path = require('path');
const { saveToExcel, updateExistingExcel } = require('./excel');

// 인자 파싱
const args = process.argv.slice(2);

function getFlagValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const reviewsFile = getFlagValue('--reviews');
const sheetName = getFlagValue('--sheet');
const scoreHeader = getFlagValue('--score-header');

const positional = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  const prev = args[i - 1];
  if (prev === '--reviews' || prev === '--sheet' || prev === '--score-header') return false;
  return true;
});
const [resultsFile, outputFile] = positional;

if (!resultsFile) {
  console.error('사용법: node lib/save-results.js <results.json> [output.xlsx] [--sheet <시트명>] [--score-header <열이름>] [--reviews review_results.json]');
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

// "[파일명]" prefix가 이미 있는 감점 라인인지 확인
function hasFilePrefix(line) {
  return /^\[.+\]/.test(line.trim());
}

// 감점 텍스트에 파일명 prefix를 붙임 (이미 있으면 유지)
function prefixDeductions(deductions, filename) {
  if (!deductions) return '';
  return deductions.split('\n')
    .map(l => l.trim() ? (hasFilePrefix(l) ? l : `[${filename}] ${l}`) : l)
    .join('\n');
}

// 동일 학생 + 동일 hwNum 항목을 합산 (기존 Excel 업데이트 시만 적용)
function aggregateResults(results) {
  const map = new Map();
  for (const r of results) {
    const key = `${r.studentId}__${r.hwNum}`;
    if (!map.has(key)) {
      map.set(key, { ...r, _files: [r.filename] });
    } else {
      const agg = map.get(key);
      agg.totalScore = (agg.totalScore || 0) + (r.totalScore || 0);
      agg.criteriaScore = (agg.criteriaScore || 0) + (r.criteriaScore || 0);
      agg.compileScore = (agg.compileScore || 0) + (r.compileScore || 0);
      // 첫 번째 항목 deductions에도 prefix가 없으면 붙임
      if (agg._files.length === 1 && agg.deductions) {
        agg.deductions = prefixDeductions(agg.deductions, agg.filename);
      }
      const thisDeductions = prefixDeductions(r.deductions, r.filename);
      agg.deductions = [agg.deductions, thisDeductions].filter(Boolean).join('\n');
      agg._files.push(r.filename);
      agg.needsReview = agg.needsReview || r.needsReview;
      agg.reviewNote = [agg.reviewNote, r.reviewNote].filter(Boolean).join(' / ');
    }
  }
  return [...map.values()];
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
  ? updateExistingExcel(aggregateResults(results), existingExcel, { sheetName, scoreHeader })
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
    // /tmp 파일 보존 (사용자 요청)
  })
  .catch(err => {
    console.error(`[오류] Excel 저장 실패: ${err.message}`);
    process.exit(1);
  });
