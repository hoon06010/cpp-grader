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
      hwNum: r.hwNum ? `HW${r.hwNum}` : '',
      studentId: r.studentId,
      studentName: r.studentName,
      filename: r.filename,
      compiled: r.compiled ? '성공' : '실패',
      compileScore: r.compileScore,
      criteriaScore: r.criteriaScore,
      maxCriteriaScore: r.maxCriteriaScore,
      totalScore: r.totalScore,
      deductions: r.deductions || '',
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

    if (idx % 2 === 1) {
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

/**
 * output/ 폴더의 기존 Excel 파일에 채점 결과를 기록한다.
 * - 학번(Col 4)으로 행을 찾아 HW{n} 열에 점수, 옆 감점 열에 감점 사유를 씀
 * - HW{n} 열이 없으면 맨 끝에 추가
 * @param {Array} results
 * @param {string} excelPath - 기존 Excel 파일 경로
 */
async function updateExistingExcel(results, excelPath) {
  const hwNum = results[0]?.hwNum;
  if (!hwNum) throw new Error('hwNum이 없습니다.');
  const hwHeader = `HW${hwNum}`;
  const deductHeader = '감점';

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const sheet = workbook.worksheets[0];

  // 헤더 행에서 HW 열 위치 파악
  const headerRow = sheet.getRow(1);
  let hwCol = null;
  let deductCol = null;
  let lastCol = 0;

  headerRow.eachCell((cell, c) => {
    lastCol = Math.max(lastCol, c);
    if (cell.value === hwHeader) hwCol = c;
  });

  if (hwCol) {
    // HW 열 바로 오른쪽이 감점 열인지 확인
    const nextCell = headerRow.getCell(hwCol + 1);
    if (nextCell.value === deductHeader || !nextCell.value) {
      deductCol = hwCol + 1;
      if (!nextCell.value) nextCell.value = deductHeader;
    } else {
      // 감점 열이 별도로 없으면 HW 바로 다음에 삽입
      deductCol = hwCol + 1;
      headerRow.getCell(deductCol).value = deductHeader;
    }
  } else {
    // HW 열 없으면 맨 끝에 추가
    hwCol = lastCol + 1;
    deductCol = lastCol + 2;
    headerRow.getCell(hwCol).value = hwHeader;
    headerRow.getCell(deductCol).value = deductHeader;
    sheet.getColumn(hwCol).width = 10;
    sheet.getColumn(deductCol).width = 40;
  }

  // AI 피드백 열 위치 확보
  let aiFbCol = null;
  headerRow.eachCell((cell, c) => {
    if (cell.value === 'AI 피드백') aiFbCol = c;
  });
  if (!aiFbCol) {
    // 감점 열 오른쪽에 삽입
    aiFbCol = (deductCol || lastCol) + 1;
    headerRow.getCell(aiFbCol).value = 'AI 피드백';
    sheet.getColumn(aiFbCol).width = 40;
  }

  // 학번 열 위치 찾기 (모든 행의 헤더 검색, '학번'/'idnumber' 둘 다 인식)
  let idCol = 2; // 기본값: 두 번째 열
  let dataStartRow = 2; // 데이터 시작 행 기본값
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
  let unmatched = [];

  // 채점 결과 기록
  for (const r of results) {
    const rowNum = idToRow[String(r.studentId).trim()];
    if (!rowNum) {
      unmatched.push(r.studentId);
      continue;
    }
    const row = sheet.getRow(rowNum);
    row.getCell(hwCol).value = r.totalScore;
    const deductCell = row.getCell(deductCol);
    deductCell.numFmt = '@';
    deductCell.value = r.deductions || '';
    if (r.aiFeedback && aiFbCol) {
      const fbCell = row.getCell(aiFbCol);
      fbCell.numFmt = '@';
      fbCell.value = r.aiFeedback || '';
    }
    row.commit();
    matched++;
  }

  // 미제출자 처리: Excel에 있지만 채점 결과에 없는 학생 → 0점, 감점 "미제출"
  let absentCount = 0;
  for (const { id, rowNum } of allStudentRows) {
    if (!gradedIds.has(id)) {
      const row = sheet.getRow(rowNum);
      // HW 열이 아직 비어 있을 때만 미제출 처리 (이미 값이 있으면 건드리지 않음)
      if (row.getCell(hwCol).value === null || row.getCell(hwCol).value === undefined || row.getCell(hwCol).value === '') {
        row.getCell(hwCol).value = 0;
        const absentCell = row.getCell(deductCol);
        absentCell.numFmt = '@';
        absentCell.value = '미제출';
        row.commit();
        absentCount++;
      }
    }
  }

  await workbook.xlsx.writeFile(excelPath);

  if (unmatched.length) {
    console.warn(`[경고] 학번 매칭 실패 (${unmatched.length}명): ${unmatched.join(', ')}`);
  }
  if (absentCount) {
    console.log(`📭 미제출자 ${absentCount}명 → 0점 / "미제출" 기록`);
  }
  console.log(`✅ 기존 Excel 업데이트 완료 (채점 ${matched}명 / 미제출 ${absentCount}명): ${excelPath}`);
  return excelPath;
}

module.exports = { saveToExcel, updateExistingExcel };
