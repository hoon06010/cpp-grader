#!/usr/bin/env node
'use strict';

/**
 * 채점 결과 JSON → 정적 HTML 대시보드 생성 (외부 서버 불필요)
 *
 * 사용법: node lib/dashboard.js [grade_results.json] [output.html]
 *   기본값: /tmp/grade_results.json → output/dashboard.html
 */

const fs = require('fs');
const path = require('path');

const inputPath  = process.argv[2] || '/tmp/grade_results.json';
const outputDir  = path.resolve('output');
const outputPath = process.argv[3] || path.join(outputDir, 'dashboard.html');

if (!fs.existsSync(inputPath)) {
  console.error(`[오류] 채점 결과 파일이 없습니다: ${inputPath}`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
fs.mkdirSync(outputDir, { recursive: true });

// -------- 통계 계산 --------

const total = results.length;
const compiled = results.filter(r => r.compiled).length;
const scores = results.map(r => r.totalScore ?? 0).filter(s => typeof s === 'number');
const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
const max = scores.length ? Math.max(...scores) : '-';
const min = scores.length ? Math.min(...scores) : '-';

// 점수 구간 히스토그램 (10점 단위)
const buckets = Array(11).fill(0); // 0~9, 10~19, ..., 100
for (const s of scores) {
  const idx = Math.min(Math.floor(s / 10), 10);
  buckets[idx]++;
}

// 문제별 통과율
const problemStats = {};
for (const r of results) {
  for (const t of r.testResults || []) {
    if (!problemStats[t.desc]) problemStats[t.desc] = { pass: 0, total: 0 };
    problemStats[t.desc].total++;
    if (t.passed) problemStats[t.desc].pass++;
  }
}

// 정렬된 결과 (점수 내림차순)
const sorted = [...results].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

// -------- HTML 생성 --------

const bucketLabels = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80-89','90-99','100'];
const barMax = Math.max(...buckets, 1);

function barSvg(count) {
  const w = Math.round((count / barMax) * 200);
  return `<div class="bar" style="width:${Math.max(w, 2)}px">${count > 0 ? count : ''}</div>`;
}

const histRows = buckets.map((c, i) =>
  `<tr><td>${bucketLabels[i]}</td><td>${barSvg(c)}</td><td>${c}</td></tr>`
).join('\n');

const problemRows = Object.entries(problemStats).map(([desc, s]) => {
  const rate = ((s.pass / s.total) * 100).toFixed(0);
  const color = rate >= 80 ? '#70ad47' : rate >= 50 ? '#ffc000' : '#ff4444';
  return `<tr><td>${esc(desc)}</td><td>${s.pass}/${s.total}</td>
    <td><div class="rate-bar" style="background:${color};width:${rate}%">${rate}%</div></td></tr>`;
}).join('\n');

const studentRows = sorted.map((r, i) => {
  const scoreClass = (r.totalScore ?? 0) >= 60 ? 'pass' : 'fail';
  const compiled = r.compiled ? '<span class="ok">성공</span>' : '<span class="err">실패</span>';
  return `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.studentId)}</td>
    <td>${esc(r.studentName)}</td>
    <td class="${scoreClass}">${r.totalScore ?? '-'}</td>
    <td>${compiled}</td>
    <td class="deduct">${esc((r.deductions || '').replace(/\n/g, ' | '))}</td>
  </tr>`;
}).join('\n');

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const hwNum = results[0]?.hwNum || '?';
const generatedAt = new Date().toLocaleString('ko-KR');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>HW${hwNum} 채점 대시보드</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; margin: 0; background: #f5f6fa; color: #333; }
  header { background: #2c3e50; color: #fff; padding: 20px 32px; }
  header h1 { margin: 0; font-size: 1.6rem; }
  header p  { margin: 4px 0 0; opacity: .7; font-size: .85rem; }
  .cards { display: flex; gap: 16px; padding: 24px 32px 0; flex-wrap: wrap; }
  .card { background: #fff; border-radius: 8px; padding: 16px 24px; box-shadow: 0 1px 4px #0001; min-width: 130px; }
  .card .val { font-size: 2rem; font-weight: 700; color: #2c3e50; }
  .card .lbl { font-size: .78rem; color: #888; margin-top: 2px; }
  section { background: #fff; margin: 24px 32px; border-radius: 8px; box-shadow: 0 1px 4px #0001; }
  section h2 { margin: 0; padding: 16px 20px; border-bottom: 1px solid #eee; font-size: 1rem; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: .88rem; }
  th { background: #f0f2f5; text-align: left; padding: 8px 12px; font-weight: 600; }
  td { padding: 7px 12px; border-bottom: 1px solid #f0f0f0; }
  .bar { background: #4472c4; height: 18px; border-radius: 3px; display: inline-block; min-width: 2px; color: #fff; font-size: .75rem; line-height: 18px; padding: 0 4px; }
  .rate-bar { height: 16px; border-radius: 3px; display: inline-block; min-width: 4px; color: #fff; font-size: .75rem; line-height: 16px; padding: 0 4px; }
  .pass { color: #27ae60; font-weight: 700; }
  .fail { color: #e74c3c; font-weight: 700; }
  .ok  { color: #27ae60; }
  .err { color: #e74c3c; }
  .deduct { color: #888; font-size: .8rem; max-width: 300px; }
  footer { text-align: center; padding: 20px; color: #aaa; font-size: .78rem; }
</style>
</head>
<body>
<header>
  <h1>HW${hwNum} 채점 대시보드</h1>
  <p>생성: ${generatedAt}</p>
</header>

<div class="cards">
  <div class="card"><div class="val">${total}</div><div class="lbl">총 제출자</div></div>
  <div class="card"><div class="val">${compiled}</div><div class="lbl">컴파일 성공</div></div>
  <div class="card"><div class="val">${total - compiled}</div><div class="lbl">컴파일 실패</div></div>
  <div class="card"><div class="val">${avg}</div><div class="lbl">평균 점수</div></div>
  <div class="card"><div class="val">${max}</div><div class="lbl">최고 점수</div></div>
  <div class="card"><div class="val">${min}</div><div class="lbl">최저 점수</div></div>
</div>

<section>
  <h2>점수 분포 (10점 구간)</h2>
  <table>
    <tr><th>구간</th><th>분포</th><th>인원</th></tr>
    ${histRows}
  </table>
</section>

${Object.keys(problemStats).length > 0 ? `
<section>
  <h2>문제별 통과율</h2>
  <table>
    <tr><th>테스트</th><th>통과/전체</th><th>통과율</th></tr>
    ${problemRows}
  </table>
</section>` : ''}

<section>
  <h2>학생별 결과 (점수 내림차순)</h2>
  <table>
    <tr><th>#</th><th>학번</th><th>이름</th><th>총점</th><th>컴파일</th><th>감점 사유</th></tr>
    ${studentRows}
  </table>
</section>

<footer>cpp-grader &nbsp;|&nbsp; output/dashboard.html</footer>
</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`✅ 대시보드 생성: ${outputPath}`);
