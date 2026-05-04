'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { compare } = require('./compare');

const TESTCASES_ROOT = path.resolve(__dirname, '..', 'testcases');

// -------- 문제 번호 감지 --------

/**
 * .cpp 파일명에서 서브 문제 번호를 추출한다.
 * @param {string} cppPath
 * @returns {string|null}
 */
function detectSubProblem(cppPath) {
  const raw = path.basename(cppPath).replace(/\.(cpp|c)$/i, '').toLowerCase();
  // 전각 숫자 → 반각
  const base = raw.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30));
  const patterns = [
    /hw\d+[-_](\d)/,
    /(?:problem|prob)[-_]?(\d)/,
    /(?:^|[-_])([2-7])(?:[-_]|$)/,
    /[pq](\d)$/,
    /(\d)$/,
  ];
  for (const pat of patterns) {
    const m = base.match(pat);
    if (m && m[1] >= '1' && m[1] <= '9') return m[1];
  }
  return null;
}

// -------- 테스트케이스 로더 --------

/**
 * testcases/hw{hwNum}/p{subProbNum}/ 또는 problem{subProbNum}/ 디렉토리에서
 * judge.json을 읽어 테스트케이스 설정을 반환한다.
 *
 * judge.json 형식:
 * {
 *   "mode": "exact" | "contains_integer" | "contains_float" | "regex" | "custom",
 *   "cases": [
 *     { "input": "...", "expected": ..., "pattern": "...", "desc": "..." },
 *     ...
 *   ]
 * }
 *
 * mode = "exact" 이고 cases가 빈 배열이면 .in/.out 파일 쌍을 자동 수집한다.
 * mode = "custom" 이면 같은 디렉토리의 judge.js를 로드한다.
 */
function loadTestCases(hwNum, subProbNum) {
  const candidates = [
    path.join(TESTCASES_ROOT, `hw${hwNum}`, `p${subProbNum}`),
    path.join(TESTCASES_ROOT, `hw${hwNum}`, `problem${subProbNum}`),
  ];

  const dir = candidates.find(d => fs.existsSync(d));
  if (!dir) return null;

  const judgeJsonPath = path.join(dir, 'judge.json');
  if (!fs.existsSync(judgeJsonPath)) return null;

  let judgeConfig;
  try {
    judgeConfig = JSON.parse(fs.readFileSync(judgeJsonPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`[runner] judge.json 파싱 오류 (${judgeJsonPath}): ${err.message}\n`);
    return null;
  }

  const mode = judgeConfig.mode || 'exact';
  const cases = judgeConfig.cases ? [...judgeConfig.cases] : [];

  // exact 모드 + cases 미지정 → .in/.out 파일 자동 수집
  if (mode === 'exact' && cases.length === 0) {
    const inFiles = fs.readdirSync(dir).filter(f => f.endsWith('.in')).sort();
    for (const f of inFiles) {
      const stem = f.replace(/\.in$/, '');
      const outPath = path.join(dir, `${stem}.out`);
      if (fs.existsSync(outPath)) {
        cases.push({
          input: fs.readFileSync(path.join(dir, f), 'utf8'),
          expected: fs.readFileSync(outPath, 'utf8'),
          desc: stem,
        });
      }
    }
  }

  // custom 모드 → judge.js 로드
  let judgeFn = null;
  if (mode === 'custom') {
    const judgeJsPath = path.join(dir, 'judge.js');
    if (fs.existsSync(judgeJsPath)) {
      try {
        judgeFn = require(judgeJsPath);
      } catch (err) {
        process.stderr.write(`[runner] judge.js 로드 오류: ${err.message}\n`);
      }
    }
  }

  return { mode, cases, judgeFn };
}

// -------- 테스트 실행 --------

/**
 * 컴파일된 바이너리로 테스트케이스를 실행한다.
 * @param {string} binaryPath
 * @param {string} hwNum        - 과제 번호 (예: '1')
 * @param {string} subProbNum   - 서브 문제 번호 (예: '2')
 * @param {string} [sourcePath] - 소스 파일 경로 (소스 패턴 검사용)
 * @param {object} [opts]
 *   - sandbox: 'rlimit' | 'docker' | 'none' (default: 'rlimit')
 *   - timeout: ms per test (default: 3000)
 *   - memoryMB: MB limit (default: 256)
 * @returns {{ ran: boolean, allPassed: boolean, results: Array }}
 */
function runTests(binaryPath, hwNum, subProbNum, sourcePath, opts = {}) {
  const config = loadTestCases(hwNum, subProbNum);
  if (!config) return { ran: false, allPassed: false, results: [] };

  const { mode, cases, judgeFn } = config;
  const timeout = opts.timeout || 3000;
  const sandbox = opts.sandbox || 'rlimit';
  const memoryMB = opts.memoryMB || 256;
  const results = [];

  for (const tc of cases) {
    const output = execBinary(binaryPath, tc.input || '', { sandbox, timeout, memoryMB });
    const caseMode = tc.mode || mode; // 케이스별 mode 오버라이드 허용

    let passed;
    switch (caseMode) {
      case 'exact':
        passed = compare('exact', output, { expected: tc.expected || '' });
        break;
      case 'contains_integer':
        passed = compare('contains_integer', output, { value: tc.expected });
        break;
      case 'contains_float':
        passed = compare('contains_float', output, { value: tc.expected, epsilon: tc.epsilon });
        break;
      case 'regex':
        passed = compare('regex', output, { pattern: tc.pattern, flags: tc.flags });
        break;
      case 'custom':
        passed = compare('custom', output, { judge: judgeFn, input: tc.input || '', tc });
        break;
      default:
        passed = false;
    }

    results.push({ desc: tc.desc || '', passed, output: output.trim().slice(0, 120), deduction: tc.deduction || null });
  }

  // HW1-5 전용: for 루프 사용 여부 소스 확인
  if (subProbNum === '5' && sourcePath && fs.existsSync(sourcePath)) {
    const src = fs.readFileSync(sourcePath, 'utf8');
    const hasForLoop = /\bfor\s*\(/.test(src);
    results.push({
      desc: 'for 루프 사용',
      passed: hasForLoop,
      output: hasForLoop ? 'for 루프 확인됨' : 'for 루프 없음 (pow() 단독 사용 의심)',
      deduction: hasForLoop ? null : { label: 'for 루프 활용 오류', points: -2 },
    });
  }

  const allPassed = results.every(r => r.passed);
  return { ran: true, allPassed, results };
}

// -------- 바이너리 실행 --------

function execBinary(binaryPath, input, { sandbox, timeout, memoryMB }) {
  let proc;

  if (sandbox === 'docker') {
    proc = spawnSync('docker', [
      'run', '--rm', '-i',
      '--network=none',
      `--memory=${memoryMB}m`,
      '--memory-swap=0',
      '--cpus=1',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '-v', `${binaryPath}:/solution:ro`,
      'ubuntu:22.04',
      '/solution',
    ], { input, encoding: 'utf8', timeout: timeout + 5000 });
  } else if (sandbox === 'rlimit') {
    // shell ulimit으로 메모리·CPU 제한
    const memKB = memoryMB * 1024;
    proc = spawnSync(
      'sh', ['-c', `ulimit -v ${memKB}; ulimit -t 10; exec "${binaryPath}"`],
      { input, encoding: 'utf8', timeout }
    );
  } else {
    // sandbox=none: 직접 실행 (개발/테스트용)
    proc = spawnSync(binaryPath, [], { input, encoding: 'utf8', timeout });
  }

  if (proc.error && proc.error.code === 'ETIMEDOUT') return '__TLE__';
  return (proc.stdout || '') + (proc.stderr || '');
}

module.exports = { detectSubProblem, runTests };
