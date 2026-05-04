'use strict';

const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'grader.db');

let _db = null;
let _unavailable = false;

function getDb() {
  if (_unavailable) return null;
  if (_db) return _db;
  try {
    const Database = require('better-sqlite3');
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        hw_num          TEXT    NOT NULL,
        student_id      TEXT    NOT NULL,
        student_name    TEXT,
        filename        TEXT,
        code_hash       TEXT,
        compiled        INTEGER,
        all_tests_passed INTEGER,
        total_score     REAL,
        graded_at       TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_sub_student ON submissions(student_id, hw_num);
      CREATE INDEX IF NOT EXISTS idx_sub_hash    ON submissions(code_hash);
    `);
    return _db;
  } catch {
    // better-sqlite3 미설치 시 조용히 비활성화 — npm install better-sqlite3 로 활성화
    _unavailable = true;
    return null;
  }
}

/**
 * 제출 기록을 DB에 저장한다. DB 미설치 시 무시.
 */
function recordSubmission(data) {
  const db = getDb();
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO submissions
        (hw_num, student_id, student_name, filename, code_hash, compiled, all_tests_passed, total_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(data.hwNum),
      String(data.studentId),
      data.studentName || '',
      data.filename || '',
      data.codeHash || '',
      data.compiled ? 1 : 0,
      data.allTestsPassed ? 1 : 0,
      data.totalScore ?? null
    );
  } catch {
    // DB 오류는 채점에 영향 없음
  }
}

/**
 * 동일 hw_num + code_hash 조합으로 이미 만점 처리된 제출이 있는지 확인한다.
 * 있으면 해당 레코드를, 없으면 null을 반환한다.
 */
function findPreviousPass(hwNum, codeHash) {
  const db = getDb();
  if (!db) return null;
  try {
    return db.prepare(`
      SELECT * FROM submissions
      WHERE hw_num = ? AND code_hash = ? AND all_tests_passed = 1
      ORDER BY graded_at DESC LIMIT 1
    `).get(String(hwNum), String(codeHash)) || null;
  } catch {
    return null;
  }
}

/**
 * hw_num 기준 제출 통계를 반환한다.
 */
function getStats(hwNum) {
  const db = getDb();
  if (!db) return null;
  try {
    return db.prepare(`
      SELECT
        COUNT(*)            AS total,
        SUM(compiled)       AS compiled_count,
        SUM(all_tests_passed) AS passed_count,
        ROUND(AVG(total_score), 1) AS avg_score,
        MAX(total_score)    AS max_score,
        MIN(total_score)    AS min_score
      FROM submissions
      WHERE hw_num = ?
    `).get(String(hwNum));
  } catch {
    return null;
  }
}

module.exports = { recordSubmission, findPreviousPass, getStats };
