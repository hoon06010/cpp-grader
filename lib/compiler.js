const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * .cpp 파일을 g++로 컴파일하고 결과를 반환한다.
 * @param {string} cppPath - 컴파일할 .cpp 파일 경로
 * @returns {{ success: boolean, score: number, error: string|null, binaryPath: string|null }}
 */
function compile(cppPath) {
  const binaryPath = cppPath.replace(/\.cpp$/, '');

  try {
    execSync(`g++ -o "${binaryPath}" "${cppPath}" 2>&1`, {
      timeout: 30000,
      encoding: 'utf8',
    });
    return { success: true, score: 10, error: null, binaryPath };
  } catch (err) {
    const errorOutput = err.stdout || err.stderr || err.message || '알 수 없는 컴파일 오류';
    // 생성된 바이너리가 있으면 제거
    if (fs.existsSync(binaryPath)) fs.unlinkSync(binaryPath);
    return { success: false, score: 0, error: errorOutput.trim(), binaryPath: null };
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
