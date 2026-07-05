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

function extractTextFromDocx(docxPath) {
  const zip = new AdmZip(docxPath);
  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) throw new Error('DOCX에서 word/document.xml을 찾을 수 없습니다.');

  const xml = docEntry.getData().toString('utf8');
  const paragraphs = [];
  // 단락(<w:p>) 단위로 분리해 텍스트 추출
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let paraMatch;
  while ((paraMatch = paraRe.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const texts = [];
    const textRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = textRe.exec(paraXml)) !== null) {
      const t = m[1];
      if (t) texts.push(t);
    }
    const line = texts.join('').trim();
    if (line) paragraphs.push(line);
  }

  if (paragraphs.length === 0) throw new Error('DOCX에서 텍스트를 추출하지 못했습니다.');
  return paragraphs.join('\n');
}

function findLatestDocument(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`uploads/ 폴더가 없습니다: ${dir}`);
  }
  const files = fs.readdirSync(dir)
    .filter(f => /\.(pptx|docx)$/i.test(f))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error('uploads/ 폴더에 .pptx 또는 .docx 파일이 없습니다.');
  }
  return path.join(dir, files[0].name);
}

// 레거시 별칭
const findLatestPptx = findLatestDocument;

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const arg = args.find(a => !a.startsWith('--'));
  let filePath;

  if (arg) {
    filePath = path.isAbsolute(arg) ? arg : path.resolve(uploadsDir, arg);
    if (!fs.existsSync(filePath)) {
      console.error(`[오류] 파일을 찾을 수 없습니다: ${filePath}`);
      process.exit(1);
    }
  } else {
    filePath = findLatestDocument(uploadsDir);
    console.error(`사용할 파일: ${path.basename(filePath)}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  // criteria.md 가 소스 파일보다 최신이면 재추출 생략 (--force 로 강제 실행 가능)
  const criteriaPath = path.resolve('criteria.md');
  if (!force && fs.existsSync(criteriaPath)) {
    const criteriaMtime = fs.statSync(criteriaPath).mtime;
    const srcMtime = fs.statSync(filePath).mtime;
    if (criteriaMtime > srcMtime) {
      console.error(`[스킵] criteria.md 가 ${path.basename(filePath)}보다 최신입니다. 재추출 생략.`);
      console.error('강제 재추출: node lib/pptx-to-criteria.js --force');
      process.exit(0);
    }
  }

  console.error('텍스트 추출 중...');
  let text;
  if (ext === '.docx') {
    text = extractTextFromDocx(filePath);
  } else {
    text = extractTextFromPptx(filePath);
  }

  if (!text.trim()) {
    console.error('[오류] 파일에서 텍스트를 추출하지 못했습니다.');
    process.exit(1);
  }

  // stdout으로 추출된 텍스트 출력 — Claude Code가 읽어서 criteria.md 작성
  console.log(`SOURCE_FILE: ${path.basename(filePath)}`);
  console.log('---TEXT_START---');
  console.log(text);
  console.log('---TEXT_END---');
}

main();
