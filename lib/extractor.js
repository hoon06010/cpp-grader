'use strict';

const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

// 학번_이름.zip 또는 학번이름.zip (학번이 앞, 이름이 뒤)
const ZIP_PATTERN_ID_FIRST = /^(\d{7,10})_?(.+)\.zip$/i;
// 이름_학번.zip (이름이 앞, 학번이 뒤) — 레거시 지원
const ZIP_PATTERN_NAME_FIRST = /^(.+)_(\d{7,10})\.zip$/i;

/**
 * zip 파일명에서 학번과 이름을 파싱한다.
 * 지원 형식:
 *   - 학번_이름.zip  (예: 202033624_한민섭.zip)
 *   - 학번이름.zip   (예: 202634018정희승.zip, 언더스코어 없음)
 *   - 이름_학번.zip  (예: 홍길동_20240001.zip, 레거시)
 * @param {string} filename
 * @returns {{ hwNum: null, studentId: string, studentName: string } | null}
 */
function parseZipName(filename) {
  const base = path.basename(filename);

  // 학번 우선 패턴 (숫자로 시작)
  const m1 = base.match(ZIP_PATTERN_ID_FIRST);
  if (m1) return { hwNum: null, studentId: m1[1], studentName: m1[2] };

  // 레거시: 이름_학번 패턴
  const m2 = base.match(ZIP_PATTERN_NAME_FIRST);
  if (m2) return { hwNum: null, studentId: m2[2], studentName: m2[1] };

  return null;
}

/**
 * zip 파일을 student_code/ 하위 폴더에 압축 해제한다.
 * @param {string} zipPath - zip 파일 절대 경로
 * @param {string} studentCodeDir - 압축 해제 대상 루트 폴더 (student_code/)
 * @returns {{ folderPath: string, folderName: string, hwNum: string, studentId: string, studentName: string }}
 */
function extractZip(zipPath, studentCodeDir) {
  const filename = path.basename(zipPath);
  const info = parseZipName(filename);

  if (!info) {
    throw new Error(`파일명 형식 오류: ${filename}\n  올바른 형식: 학번_이름.zip 또는 학번이름.zip`);
  }

  const folderName = path.basename(filename, '.zip');
  const folderPath = path.join(studentCodeDir, folderName);

  fs.mkdirSync(folderPath, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(folderPath, /* overwrite */ true);
  extractNestedZips(folderPath);

  return { folderPath, folderName, ...info };
}

/**
 * 폴더 내 중첩 zip 파일을 재귀적으로 압축 해제한다.
 * @param {string} folderPath
 */
function extractNestedZips(folderPath) {
  for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      extractNestedZips(fullPath);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
      const destDir = path.join(path.dirname(fullPath), path.basename(entry.name, '.zip'));
      fs.mkdirSync(destDir, { recursive: true });
      try {
        const zip = new AdmZip(fullPath);
        zip.extractAllTo(destDir, true);
        extractNestedZips(destDir);
      } catch (_) {
        // 손상된 zip은 무시
      }
    }
  }
}

/**
 * 폴더 내 .cpp 파일 목록을 반환한다 (재귀 탐색).
 * @param {string} folderPath
 * @returns {string[]} - 절대 경로 배열
 */
function findCppFiles(folderPath) {
  const results = [];
  for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory() && entry.name !== '__MACOSX') {
      results.push(...findCppFiles(fullPath));
    } else if (entry.isFile() && /\.(cpp|c)$/i.test(entry.name) && !entry.name.startsWith('._')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

module.exports = { extractZip, findCppFiles, parseZipName };
