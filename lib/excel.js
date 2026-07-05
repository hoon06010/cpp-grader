'use strict';

const ExcelJS = require('exceljs');

/**
 * 채점 결과를 Excel 파일로 저장한다.
 * @param {Array} results - 채점 결과 배열
 * @param {string} outputPath - 저장 경로
 */
async function saveToExcel(results, outputPath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('채점 결과');

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const borderStyle = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  sheet.columns = [
    { header: '과제번호', key: 'hwNum', width: 10 },
    { header: '학번', key: 'studentId', width: 14 },
    { header: '이름', key: 'studentName', width: 12 },
    { header: '파일명', key: 'filename', width: 22 },
    { header: '컴파일', key: 'compiled', width: 10 },
    { header: '컴파일 점수', key: 'compileScore', width: 12 },
    { header: '채점기준 점수', key: 'criteriaScore', width: 14 },
    { header: '채점기준 만점', key: 'maxCriteriaScore', width: 14 },
    { header: '총점', key: 'totalScore', width: 10 },
    { header: '감점 사유', key: 'deductions', width: 40 },
    { header: '확인필요', key: 'reviewNote', width: 35 },
    { header: 'AI 피드백', key: 'aiFeedback', width: 40 },
    { header: 'AI 개선 제안', key: 'suggestions', width: 40 },
    { header: '컴파일 오류', key: 'compileError', width: 40 },
  ];

  sheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderStyle;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  results.forEach((r, idx) => {
    const row = sheet.addRow({
      hwNum: r.hwNum ? (/^\d+$/.test(r.hwNum) ? `HW${r.hwNum}` : r.hwNum) : '',
      studentId: r.studentId,
      studentName: r.studentName,
      filename: r.filename,
      compiled: r.compiled ? '성공' : '실패',
      compileScore: r.compileScore,
      criteriaScore: r.criteriaScore,
      maxCriteriaScore: r.maxCriteriaScore,
      totalScore: r.totalScore,
      deductions: r.deductions || '',
      reviewNote: r.reviewNote || '',
      aiFeedback: r.aiFeedback || '',
      suggestions: r.suggestions || '',
      compileError: r.compileError || '',
    });

    const compiledCell = row.getCell('compiled');
    compiledCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: r.compiled ? 'FF70AD47' : 'FFFF0000' },
    };
    compiledCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    row.getCell('totalScore').font = { bold: true };

    if (r.needsReview) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
      });
      const noteCell = row.getCell('reviewNote');
      noteCell.font = { bold: true, color: { argb: 'FFCC6600' } };
    } else if (idx % 2 === 1) {
      row.eachCell((cell) => {
        if (!cell.fill || cell.fill.fgColor?.argb === undefined) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' },
          };
        }
      });
    }

    row.eachCell((cell) => {
      cell.border = borderStyle;
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  // 요약 행
  sheet.addRow({});
  const summaryRow = sheet.addRow({
    studentName: '평균',
    compileScore: average(results, 'compileScore'),
    criteriaScore: average(results, 'criteriaScore'),
    totalScore: average(results, 'totalScore'),
  });
  summaryRow.font = { bold: true, color: { argb: 'FF4472C4' } };

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

function average(arr, key) {
  if (!arr.length) return 0;
  return Math.round((arr.reduce((sum, r) => sum + (r[key] || 0), 0) / arr.length) * 10) / 10;
}

// 감점 텍스트에서 숫자 합산 ("-5: 반환값 누락\n[파일] -3: 변수명" → 8)
// "-숫자:" 또는 "-숫자 " 패턴만 감점으로 인식 (파일명 내 숫자 제외)
function sumDeductions(deductionsStr) {
  if (!deductionsStr) return 0;
  const matches = deductionsStr.match(/-(\d+(?:\.\d+)?)(?=\s*:)/g) || [];
  return Math.abs(matches.reduce((sum, m) => sum + parseFloat(m), 0));
}

/**
 * output/ 폴더의 기존 Excel 파일에 채점 결과를 기록한다.
 * - 학번(Col 4)으로 행을 찾아 점수 열에 totalScore, 옆 감점 열에 감점 사유를 씀
 * - 점수 열이 없으면 맨 끝에 추가
 * @param {Array} results
 * @param {string} excelPath - 기존 Excel 파일 경로
 * @param {object} [opts]
 * @param {string} [opts.sheetName] - 대상 시트 이름 (없으면 첫 번째 시트)
 * @param {string} [opts.scoreHeader] - 점수 열 헤더 이름 (없으면 HW{n} 자동 결정)
 */
async function updateExistingExcel(results, excelPath, opts = {}) {
  const hwNum = results[0]?.hwNum;
  if (!hwNum) throw new Error('hwNum이 없습니다.');
  const hwHeader = opts.scoreHeader || (/^\d+$/.test(hwNum) ? `HW${hwNum}` : hwNum);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const sheet = opts.sheetName
    ? (workbook.getWorksheet(opts.sheetName) || workbook.worksheets[0])
    : workbook.worksheets[0];

  const headerRow = sheet.getRow(1);
  let hwCol = null;
  let deductNumCol = null;   // 감점 (숫자 합계)
  let deductReasonCol = null; // 감점사유 (텍스트)
  let lastCol = 0;

  headerRow.eachCell((cell, c) => {
    lastCol = Math.max(lastCol, c);
    if (String(cell.value || '').trim() === hwHeader) hwCol = c;
  });

  const isDeductReason = v => v === '감점사유' || v === '감점 사유' || v === '사유';

  if (hwCol) {
    const c1val = String(headerRow.getCell(hwCol + 1).value || '').trim();
    const c2val = String(headerRow.getCell(hwCol + 2).value || '').trim();
    if (c1val === '감점') {
      deductNumCol = hwCol + 1;
      if (isDeductReason(c2val)) {
        deductReasonCol = hwCol + 2;
      } else if (!c2val) {
        deductReasonCol = hwCol + 2;
        headerRow.getCell(hwCol + 2).value = '감점사유';
        sheet.getColumn(hwCol + 2).width = 40;
      }
    } else if (isDeductReason(c1val)) {
      deductReasonCol = hwCol + 1;
    } else if (!c1val) {
      deductNumCol = hwCol + 1;
      deductReasonCol = hwCol + 2;
      headerRow.getCell(hwCol + 1).value = '감점';
      headerRow.getCell(hwCol + 2).value = '감점사유';
      sheet.getColumn(hwCol + 1).width = 10;
      sheet.getColumn(hwCol + 2).width = 40;
    }
  } else {
    hwCol = lastCol + 1;
    deductNumCol = lastCol + 2;
    deductReasonCol = lastCol + 3;
    headerRow.getCell(hwCol).value = hwHeader;
    headerRow.getCell(deductNumCol).value = '감점';
    headerRow.getCell(deductReasonCol).value = '감점사유';
    sheet.getColumn(hwCol).width = 10;
    sheet.getColumn(deductNumCol).width = 10;
    sheet.getColumn(deductReasonCol).width = 40;
  }

  lastCol = Math.max(lastCol, hwCol, deductNumCol || 0, deductReasonCol || 0);

  // 확인필요 열 위치 확보
  let reviewNoteCol = null;
  headerRow.eachCell((cell, c) => {
    if (cell.value === '확인필요') reviewNoteCol = c;
  });
  if (!reviewNoteCol) {
    reviewNoteCol = lastCol + 1;
    headerRow.getCell(reviewNoteCol).value = '확인필요';
    sheet.getColumn(reviewNoteCol).width = 35;
    lastCol = reviewNoteCol;
  }

  // AI 피드백 열 위치 확보
  let aiFbCol = null;
  headerRow.eachCell((cell, c) => {
    if (cell.value === 'AI 피드백') aiFbCol = c;
  });
  if (!aiFbCol) {
    aiFbCol = lastCol + 1;
    headerRow.getCell(aiFbCol).value = 'AI 피드백';
    sheet.getColumn(aiFbCol).width = 40;
    lastCol = aiFbCol;
  }

  lastCol = Math.max(lastCol, reviewNoteCol || 0, aiFbCol || 0);

  // 학번 열 위치 찾기
  let idCol = 2;
  let dataStartRow = 2;
  const ID_HEADERS = new Set(['학번', 'idnumber', 'id', 'studentid', '학번(id)']);
  sheet.eachRow((row, rowNum) => {
    row.eachCell((cell, c) => {
      const val = String(cell.value || '').trim().toLowerCase();
      if (ID_HEADERS.has(val)) {
        idCol = c;
        dataStartRow = rowNum + 1;
      }
    });
  });

  // 학번 → 행 번호 인덱스 구성
  const idToRow = {};
  const allStudentRows = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum < dataStartRow) return;
    const id = String(row.getCell(idCol).value || '').trim();
    if (id && /^\d{6,12}$/.test(id)) {
      idToRow[id] = rowNum;
      allStudentRows.push({ id, rowNum });
    }
  });

  // 채점된 학번 집합
  const gradedIds = new Set(results.map(r => String(r.studentId).trim()));

  let matched = 0;
  const unmatched = [];

  // 채점 결과 기록
  for (const r of results) {
    const rowNum = idToRow[String(r.studentId).trim()];
    if (!rowNum) {
      unmatched.push(r.studentId);
      continue;
    }
    const row = sheet.getRow(rowNum);
    // 셀에 공식이 있으면 덮어쓰지 않음 (감점 열이 있어 공식이 자동 계산하는 구조)
    const scoreCell = row.getCell(hwCol);
    if (!scoreCell.formula && !scoreCell.sharedFormula) {
      scoreCell.value = r.totalScore;
    }

    // 감점 (숫자): 감점사유 텍스트에서 합산
    if (deductNumCol) {
      row.getCell(deductNumCol).value = sumDeductions(r.deductions);
    }

    // 감점사유 (텍스트)
    const reasonTarget = deductReasonCol || deductNumCol;
    if (reasonTarget) {
      const reasonCell = row.getCell(reasonTarget);
      reasonCell.numFmt = '@';
      reasonCell.value = r.deductions || '';
    }

    if (reviewNoteCol) {
      const rnCell = row.getCell(reviewNoteCol);
      rnCell.numFmt = '@';
      rnCell.value = r.reviewNote || '';
      if (r.needsReview) {
        rnCell.font = { bold: true, color: { argb: 'FFCC6600' } };
      } else {
        rnCell.font = {};
      }
    }
    if (r.aiFeedback && aiFbCol) {
      const fbCell = row.getCell(aiFbCol);
      fbCell.numFmt = '@';
      fbCell.value = r.aiFeedback || '';
    }
    for (let c = 1; c <= lastCol; c++) {
      row.getCell(c).fill = r.needsReview
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } }
        : { type: 'pattern', pattern: 'none' };
    }
    row.commit();
    matched++;
  }

  // 미제출자 처리
  let absentCount = 0;
  for (const { id, rowNum } of allStudentRows) {
    if (!gradedIds.has(id)) {
      const row = sheet.getRow(rowNum);
      const hwCell = row.getCell(hwCol);
      if (hwCell.value === null || hwCell.value === undefined || hwCell.value === '') {
        hwCell.value = 0;
        const absentTarget = deductReasonCol || deductNumCol;
        if (absentTarget) {
          const absentCell = row.getCell(absentTarget);
          absentCell.numFmt = '@';
          absentCell.value = '미제출';
        }
        row.commit();
        absentCount++;
      }
    }
  }

  await workbook.xlsx.writeFile(excelPath);

  console.log(`[열 매핑] ${hwHeader}=${hwCol} 감점=${deductNumCol || '-'} 감점사유=${deductReasonCol || '-'} 확인필요=${reviewNoteCol || '-'}`);
  if (unmatched.length) {
    console.warn(`[경고] 학번 매칭 실패 (${unmatched.length}명): ${unmatched.join(', ')}`);
  }
  if (absentCount) {
    console.log(`미제출자 ${absentCount}명 → 0점 / "미제출" 기록`);
  }
  console.log(`기존 Excel 업데이트 완료 (채점 ${matched}명 / 미제출 ${absentCount}명): ${excelPath}`);
  return excelPath;
}

module.exports = { saveToExcel, updateExistingExcel };
