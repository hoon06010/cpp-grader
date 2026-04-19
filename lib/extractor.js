'use strict';

const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

// hw(숫자)_학번_이름.zip
const ZIP_PATTERN = /^hw(\d+)_(\d+)_(.+)\.zip$/i;

/**
 * zip 파일명에서 과제번호, 학번, 이름을 파싱한다.
 * @param {string} filename - 예: hw1_20240001_홍길동.zip
 * @returns {{ hwNum: string, studentId: string, studentName: string } | null}
 */
function parseZipName(filename) {
  const match = path.basename(filename).match(ZIP_PATTERN);
  if (!match) return null;
  return { hwNum: match[1], studentId: match[2], studentName: match[3] };
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
    throw new Error(`파일명 형식 오류: ${filename}\n  올바른 형식: hw(숫자)_학번_이름.zip`);
  }

  const folderName = path.basename(filename, '.zip');
  const folderPath = path.join(studentCodeDir, folderName);

  fs.mkdirSync(folderPath, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(folderPath, /* overwrite */ true);

  return { folderPath, folderName, ...info };
}

/**
 * 폴더 내 .cpp 파일 목록을 반환한다 (비재귀, 직접 하위만).
 * @param {string} folderPath
 * @returns {string[]} - 절대 경로 배열
 */
function findCppFiles(folderPath) {
  return fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.cpp'))
    .sort()
    .map(f => path.join(folderPath, f));
}

module.exports = { extractZip, findCppFiles, parseZipName };
