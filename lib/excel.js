const ExcelJS = require('exceljs');
const path = require('path');

/**
 * 채점 결과를 Excel 파일로 저장한다.
 * @param {Array} results - 채점 결과 배열
 * @param {string} outputPath - 저장 경로
 */
async function saveToExcel(results, outputPath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('채점 결과');

  // 헤더 스타일
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
    { header: '학생 파일명', key: 'filename', width: 25 },
    { header: '컴파일', key: 'compiled', width: 10 },
    { header: '컴파일 점수', key: 'compileScore', width: 12 },
    { header: '채점기준 점수', key: 'criteriaScore', width: 14 },
    { header: '채점기준 만점', key: 'maxCriteriaScore', width: 14 },
    { header: '총점', key: 'totalScore', width: 10 },
    { header: '피드백', key: 'feedback', width: 50 },
    { header: '개선 제안', key: 'suggestions', width: 40 },
    { header: '컴파일 오류', key: 'compileError', width: 40 },
  ];

  // 헤더 스타일 적용
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderStyle;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // 데이터 행 추가
  results.forEach((r, idx) => {
    const row = sheet.addRow({
      filename: r.filename,
      compiled: r.compiled ? '성공' : '실패',
      compileScore: r.compileScore,
      criteriaScore: r.criteriaScore,
      maxCriteriaScore: r.maxCriteriaScore,
      totalScore: r.totalScore,
      feedback: r.feedback,
      suggestions: r.suggestions,
      compileError: r.compileError || '',
    });

    // 컴파일 성공/실패 색상
    const compiledCell = row.getCell('compiled');
    compiledCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: r.compiled ? 'FF70AD47' : 'FFFF0000' },
    };
    compiledCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // 총점 굵게
    row.getCell('totalScore').font = { bold: true };

    // 짝수 행 배경
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
    filename: '평균',
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

module.exports = { saveToExcel };
