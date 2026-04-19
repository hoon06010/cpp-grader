#!/usr/bin/env node
'use strict';

/**
 * uploads/ 폴더의 PPTX 파일에서 텍스트를 추출해 stdout으로 출력한다.
 * Claude Code가 이 출력을 읽어 criteria.md를 직접 작성한다.
 *
 * 사용법: node lib/pptx-to-criteria.js [파일명.pptx]
 *   파일명 생략 시 uploads/ 에서 가장 최근 .pptx 파일을 사용
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const uploadsDir = path.resolve('uploads');

function extractTextFromPptx(pptxPath) {
  const zip = new AdmZip(pptxPath);
  const entries = zip.getEntries();

  const slideEntries = entries
    .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const numA = parseInt(a.entryName.match(/\d+/)[0]);
      const numB = parseInt(b.entryName.match(/\d+/)[0]);
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    throw new Error('PPTX에서 슬라이드를 찾을 수 없습니다.');
  }

  const slides = slideEntries.map((entry, i) => {
    const xml = entry.getData().toString('utf8');
    const texts = [];
    const re = /<a:t[^>]*>([^<]+)<\/a:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const t = m[1].trim();
      if (t) texts.push(t);
    }
    return `[슬라이드 ${i + 1}]\n${texts.join('\n')}`;
  });

  return slides.join('\n\n');
}

function findLatestPptx(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`uploads/ 폴더가 없습니다: ${dir}`);
  }
  const files = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.pptx'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error('uploads/ 폴더에 .pptx 파일이 없습니다.');
  }
  return path.join(dir, files[0].name);
}

function main() {
  const arg = process.argv[2];
  let pptxPath;

  if (arg) {
    pptxPath = path.isAbsolute(arg) ? arg : path.resolve(uploadsDir, arg);
    if (!fs.existsSync(pptxPath)) {
      console.error(`[오류] 파일을 찾을 수 없습니다: ${pptxPath}`);
      process.exit(1);
    }
  } else {
    pptxPath = findLatestPptx(uploadsDir);
    console.error(`사용할 파일: ${path.basename(pptxPath)}`);
  }

  console.error('슬라이드 텍스트 추출 중...');
  const slideText = extractTextFromPptx(pptxPath);

  if (!slideText.trim()) {
    console.error('[오류] 슬라이드에서 텍스트를 추출하지 못했습니다.');
    process.exit(1);
  }

  // stdout으로 추출된 텍스트 출력 — Claude Code가 읽어서 criteria.md 작성
  console.log(`PPTX_FILE: ${path.basename(pptxPath)}`);
  console.log('---SLIDE_TEXT_START---');
  console.log(slideText);
  console.log('---SLIDE_TEXT_END---');
}

main();
