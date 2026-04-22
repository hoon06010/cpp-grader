const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// void main() 또는 void main(void) → int main() / int main(void)
const VOID_MAIN = /\bvoid(\s+main\s*\()/g;

// macOS/Linux g++에서 Windows 전용 _s 함수들을 표준 함수로 매핑하는 호환 매크로
const COMPAT_MACROS = `#define _CRT_SECURE_NO_WARNINGS
// _s 함수 → 표준 함수 호환 매크로
#ifndef _WIN32
#define scanf_s scanf
#define sscanf_s sscanf
#define fscanf_s fscanf
#define printf_s printf
#define fprintf_s fprintf
#define gets_s(buf, size) fgets(buf, size, stdin)
#define sprintf_s(buf, size, ...) sprintf(buf, __VA_ARGS__)
#define snprintf_s(buf, size, ...) snprintf(buf, size, __VA_ARGS__)
#define strcat_s(dst, size, src) strcat(dst, src)
#define strcpy_s(dst, size, src) strcpy(dst, src)
#define strtok_s(str, delim, ctx) strtok(str, delim)
#define fopen_s(fp, name, mode) (*(fp) = fopen(name, mode), *(fp) ? 0 : 1)
#define memcpy_s(dst, dsz, src, cnt) memcpy(dst, src, cnt)
#define memmove_s(dst, dsz, src, cnt) memmove(dst, src, cnt)
#endif
`;

/**
 * void main → int main 변환 후 함수 끝 } 직전에 return 0; 을 삽입한다.
 * 이미 return 문이 있으면 삽입하지 않는다.
 */
function fixVoidMain(src) {
  if (!VOID_MAIN.test(src)) return src;
  VOID_MAIN.lastIndex = 0;

  let result = src.replace(VOID_MAIN, 'int$1');

  // void main에서 변환된 int main 내부의 bare return; → return 0;
  result = result.replace(/\breturn\s*;/g, 'return 0;');

  // main 함수 본문의 마지막 } 앞에 return 0; 삽입
  // 단, main 본문 안에 이미 return 이 있으면 건너뜀
  const mainBodyMatch = result.match(/\bint\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/);
  if (mainBodyMatch) {
    const body = mainBodyMatch[1];
    if (!/\breturn\b/.test(body)) {
      result = result.replace(/(\})\s*$/, '\n    return 0;\n$1');
    }
  }
  return result;
}

/**
 * Windows _s 함수 호환 매크로를 주입한 임시 파일을 생성한다.
 * 원본을 수정하지 않으며, 임시 파일 경로를 반환한다.
 */
function patchSource(cppPath) {
  const raw = fs.readFileSync(cppPath, 'utf8');
  const original = raw.replace(/^\uFEFF/, '');
  const patched = COMPAT_MACROS + fixVoidMain(original);
  const tmpPath = cppPath.replace(/\.cpp$/, '__patched.cpp');
  fs.writeFileSync(tmpPath, patched, 'utf8');
  return tmpPath;
}

/**
 * .cpp 파일을 g++로 컴파일하고 결과를 반환한다.
 * Windows _s 함수는 호환 매크로로 자동 처리한다.
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
