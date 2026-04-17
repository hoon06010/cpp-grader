#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { compile, cleanup } = require('./lib/compiler');
const { reviewCode } = require('./lib/reviewer');
const { saveToExcel } = require('./lib/excel');

// ---------------------------------------------------------------------------
// 인수 파싱
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { input: 'students', criteria: 'criteria.md', output: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input' || argv[i] === '-i') args.input = argv[++i];
    else if (argv[i] === '--criteria' || argv[i] === '-c') args.criteria = argv[++i];
    else if (argv[i] === '--output' || argv[i] === '-o') args.output = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
C++ 과제 자동 채점 에이전트
사용법: node grade.js [옵션]

옵션:
  -i, --input <폴더>      .cpp 파일이 있는 폴더 (기본값: students/)
  -c, --criteria <파일>   채점 기준 파일 (기본값: criteria.md)
  -o, --output <파일>     결과 Excel 파일 경로 (기본값: output/결과_YYYYMMDD_HHmm.xlsx)
  -h, --help              도움말 표시

예시:
  node grade.js
  node grade.js --input ./hw1 --criteria hw1_criteria.md
  node grade.js --output ./results/hw1.xlsx
`);
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // 채점 기준 로드
  const criteriaPath = path.resolve(args.criteria);
  if (!fs.existsSync(criteriaPath)) {
    console.error(`[오류] 채점 기준 파일을 찾을 수 없습니다: ${criteriaPath}`);
    console.error('  criteria.md 파일을 만들거나 --criteria 옵션으로 경로를 지정하세요.');
    process.exit(1);
  }
  const criteria = fs.readFileSync(criteriaPath, 'utf8');

  // 학생 파일 목록
  const inputDir = path.resolve(args.input);
  if (!fs.existsSync(inputDir)) {
    console.error(`[오류] 입력 폴더를 찾을 수 없습니다: ${inputDir}`);
    process.exit(1);
  }
  const cppFiles = fs.readdirSync(inputDir)
    .filter(f => f.endsWith('.cpp'))
    .sort();

  if (cppFiles.length === 0) {
    console.error(`[오류] ${inputDir} 폴더에 .cpp 파일이 없습니다.`);
    process.exit(1);
  }

  // 출력 경로
  if (!args.output) {
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    args.output = path.resolve('output', `결과_${stamp}.xlsx`);
  }
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });

  console.log(`\n🎓 C++ 과제 채점 시작`);
  console.log(`   학생 파일: ${cppFiles.length}개 (${inputDir})`);
  console.log(`   채점 기준: ${criteriaPath}`);
  console.log(`   결과 저장: ${args.output}\n`);

  const results = [];

  for (let i = 0; i < cppFiles.length; i++) {
    const filename = cppFiles[i];
    const cppPath = path.join(inputDir, filename);
    const code = fs.readFileSync(cppPath, 'utf8');

    process.stdout.write(`[${i+1}/${cppFiles.length}] ${filename} ... `);

    // 1. 컴파일
    const compileResult = compile(cppPath);
    process.stdout.write(compileResult.success ? '컴파일 ✓  ' : '컴파일 ✗  ');

    // 2. Claude 리뷰
    let review = { criteriaScore: 0, maxCriteriaScore: 0, feedback: '', suggestions: '' };
    try {
      review = await reviewCode(code, criteria, compileResult.success);
      process.stdout.write('리뷰 완료\n');
    } catch (err) {
      process.stdout.write(`리뷰 오류: ${err.message}\n`);
      review.feedback = `Claude 리뷰 오류: ${err.message}`;
    }

    // 3. 바이너리 정리
    cleanup(compileResult.binaryPath);

    const totalScore = compileResult.score + (review.criteriaScore || 0);

    results.push({
      filename,
      compiled: compileResult.success,
      compileScore: compileResult.score,
      criteriaScore: review.criteriaScore || 0,
      maxCriteriaScore: review.maxCriteriaScore || 0,
      totalScore,
      feedback: review.feedback || '',
      suggestions: review.suggestions || '',
      compileError: compileResult.error || '',
    });
  }

  // 4. Excel 저장
  const outputPath = await saveToExcel(results, path.resolve(args.output));

  console.log(`\n✅ 채점 완료!`);
  console.log(`   결과 파일: ${outputPath}`);

  // 요약 출력
  const passed = results.filter(r => r.compiled).length;
  const avgTotal = (results.reduce((s, r) => s + r.totalScore, 0) / results.length).toFixed(1);
  console.log(`   컴파일 성공: ${passed}/${results.length}명`);
  console.log(`   평균 점수: ${avgTotal}점\n`);
}

function pad(n) { return String(n).padStart(2, '0'); }

main().catch(err => {
  console.error(`\n[치명적 오류] ${err.message}`);
  process.exit(1);
});
