---
description: students/ 폴더의 C++ 과제 zip 파일을 자동 채점합니다
---

CLAUDE.md의 채점 워크플로우에 따라 C++ 과제를 채점합니다.

## 1단계 — 준비

`node lib/prepare.js` 를 실행하여 학생별 코드와 컴파일 결과를 가져옵니다.
오류가 있으면 즉시 사용자에게 알립니다.

## 2단계 — 채점 기준 확인

`criteria.md` 를 읽어 항목별 배점과 평가 기준을 파악합니다.

## 3단계 — 코드 리뷰

1단계 JSON의 각 학생 코드를 criteria.md 기준으로 직접 검토합니다.

각 학생에 대해 산출:
- `criteriaScore` / `maxCriteriaScore` — 기준별 점수
- `totalScore` — `compileScore + criteriaScore`
- `feedback` — 한국어 2-3문장 (잘한 점 포함)
- `suggestions` — 한국어 1-2문장 개선 제안

## 4단계 — 결과 저장

채점 결과를 CLAUDE.md의 JSON 형식으로 `/tmp/grade_results.json` 에 저장한 뒤:

```bash
node lib/save-results.js /tmp/grade_results.json
```

## 5단계 — 완료 보고

- 채점 완료 학생 수
- 컴파일 성공 / 실패 현황
- 점수 분포 (최고 / 최저 / 평균)
- 저장된 Excel 파일 경로
- student_code/ 확인 후 삭제 안내
