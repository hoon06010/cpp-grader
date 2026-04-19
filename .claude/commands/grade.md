---
description: students/ 폴더의 C++ 과제 zip 파일을 자동 채점합니다
---

CLAUDE.md의 채점 워크플로우에 따라 C++ 과제를 채점합니다.
외부 API 호출 없이 Claude Code가 직접 모든 판단을 수행합니다.

## 0단계 — criteria.md 확인 (선택)

`uploads/` 에 `.pptx` 파일이 있고 `criteria.md`를 갱신해야 할 경우:

```bash
node lib/pptx-to-criteria.js
```

출력된 슬라이드 텍스트를 읽고 `criteria.md`를 직접 작성합니다.

## 1단계 — 준비

`node lib/prepare.js` 를 실행하여 학생별 코드와 컴파일 결과를 가져옵니다.
오류가 있으면 즉시 사용자에게 알립니다.

## 2단계 — 채점 기준 확인

`criteria.md` 를 읽어 항목별 배점과 평가 기준을 파악합니다.

## 3단계 — 코드 리뷰

1단계 JSON의 각 학생 코드를 criteria.md 기준으로 직접 검토합니다.
API를 호출하지 않고 현재 컨텍스트에서 Claude Code가 직접 판단합니다.

각 학생에 대해 산출:
- `criteriaScore` / `maxCriteriaScore` — 기준별 점수
- `totalScore` — `compileScore + criteriaScore`
- `deductions` — 감점 항목과 점수 (예: `-5: 반환값 누락\n-3: 변수명 불명확`) / 없으면 빈 문자열
- `feedback` — 한국어 2-3문장 (잘한 점 포함)
- `suggestions` — 한국어 1-2문장 개선 제안

## 4단계 — 결과 저장

채점 결과를 CLAUDE.md의 JSON 형식으로 `/tmp/grade_results.json` 에 저장한 뒤:

```bash
node lib/save-results.js /tmp/grade_results.json
```

- `output/` 에 기존 `.xlsx` 파일이 있으면 해당 파일의 `HW{n}` / `감점` 열을 학번 기준으로 업데이트
- 점수가 기록되지 않은 학생(미제출자)은 자동으로 0점, 감점 "미제출" 처리됨

## 5단계 — 완료 보고

- 채점 완료 학생 수 / 미제출자 수
- 컴파일 성공 / 실패 현황
- 점수 분포 (최고 / 최저 / 평균)
- 저장된 Excel 파일 경로
- student_code/ 확인 후 삭제 안내
