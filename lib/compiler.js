const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCANF_S_VARIANTS = /\bscanf_s\b/g;
const SECURE_MACRO = '#define _CRT_SECURE_NO_WARNINGS\n';

/**
 * scanf_s → scanf 치환 및 _CRT_SECURE_NO_WARNINGS 주입을 적용한 임시 파일을 생성한다.
 * 원본을 수정하지 않으며, 임시 파일 경로를 반환한다.
 */
function patchSource(cppPath) {
  const original = fs.readFileSync(cppPath, 'utf8');
  const patched = SECURE_MACRO + original.replace(SCANF_S_VARIANTS, 'scanf');
  const tmpPath = cppPath.replace(/\.cpp$/, '__patched.cpp');
  fs.writeFileSync(tmpPath, patched, 'utf8');
  return tmpPath;
}

/**
 * .cpp 파일을 g++로 컴파일하고 결과를 반환한다.
 * scanf_s 사용 코드는 자동으로 scanf로 변환 후 컴파일한다.
 * @param {string} cppPath - 컴파일할 .cpp 파일 경로
 * @returns {{ success: boolean, score: number, error: string|null, binaryPath: string|null }}
 */
function compile(cppPath) {
  const binaryPath = cppPath.replace(/\.cpp$/, '');
  const tmpPath = patchSource(cppPath);

  try {
    execSync(`g++ -o "${binaryPath}" "${tmpPath}" 2>&1`, {
      timeout: 30000,
      encoding: 'utf8',
    });
    return { success: true, score: 10, error: null, binaryPath };
  } catch (err) {
    const errorOutput = err.stdout || err.stderr || err.message || '알 수 없는 컴파일 오류';
    if (fs.existsSync(binaryPath)) fs.unlinkSync(binaryPath);
    return { success: false, score: 0, error: errorOutput.trim(), binaryPath: null };
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

/**
 * 컴파일된 바이너리를 제거한다.
 * @param {string} binaryPath
 */
function cleanup(binaryPath) {
  if (binaryPath && fs.existsSync(binaryPath)) {
    fs.unlinkSync(binaryPath);
  }
}

module.exports = { compile, cleanup };
