# C++ 과제 채점 에이전트

이 프로젝트는 Claude가 직접 C++ 과제를 채점하는 에이전트입니다.
`/grade` 명령어로 채점을 시작합니다.

## 프로젝트 구조

```
grader/
├── students/          # 채점할 .zip 파일을 여기에 넣는다
│   └── hw1_20240001_홍길동.zip   # 형식: hw(숫자)_학번_이름.zip
├── student_code/      # 압축 해제된 학생 코드 (채점 후 보존)
├── criteria.md        # 채점 기준 및 배점
├── output/            # 채점 결과 Excel 파일
└── lib/
    ├── prepare.js     # zip 압축 해제 + 컴파일 → JSON 출력
    ├── save-results.js # 채점 결과 JSON → Excel 저장
    ├── extractor.js   # zip 파싱/압축 해제 유틸
    ├── compiler.js    # g++ 컴파일 유틸
    └── excel.js       # Excel 생성 유틸
```

## 채점 워크플로우

`/grade` 실행 시 아래 순서를 반드시 따른다.

### 1단계 — 준비 (기계적 작업)

```bash
node lib/prepare.js
```

- `students/` 의 모든 `.zip` 파일을 `student_code/` 에 압축 해제
- 각 `.cpp` 파일을 `g++` 로 컴파일
- 학생별 정보(학번, 이름, 코드, 컴파일 결과)를 JSON으로 출력

### 2단계 — 채점 기준 파악

`criteria.md` 를 읽어 항목별 배점과 평가 기준을 파악한다.

### 3단계 — 코드 리뷰 (Claude 직접 수행)

prepare.js 출력 JSON의 각 항목에 대해 직접 코드를 검토한다.

**평가 방법:**
- `criteria.md` 의 각 항목을 코드가 충족하는지 판단
- 항목 충족 → 해당 배점 부여 / 미충족 → 0점 또는 부분 점수
- 컴파일 실패 시: 기능 구현 점수 0점, 코드 스타일 부분 점수 가능

**각 학생에 대해 산출:**
- `criteriaScore` — criteria.md 기준 획득 점수
- `maxCriteriaScore` — criteria.md 기준 만점
- `totalScore` — `compileScore + criteriaScore`
- `feedback` — 한국어 2-3문장 (잘한 점 포함)
- `suggestions` — 한국어 1-2문장 개선 제안

### 4단계 — 결과 저장

검토 결과를 아래 JSON 형식으로 `/tmp/grade_results.json` 에 저장한 뒤 스크립트를 실행한다.

```json
[
  {
    "hwNum": "1",
    "studentId": "20240001",
    "studentName": "홍길동",
    "filename": "main.cpp",
    "compiled": true,
    "compileScore": 10,
    "compileError": "",
    "criteriaScore": 80,
    "maxCriteriaScore": 90,
    "totalScore": 90,
    "feedback": "cin/cout을 올바르게 사용하였고 변수명도 명확합니다. 전반적으로 과제 요구사항을 잘 충족했습니다.",
    "suggestions": "주석을 추가하면 코드 가독성이 향상됩니다."
  }
]
```

```bash
node lib/save-results.js /tmp/grade_results.json
```

### 5단계 — 완료 보고

채점이 끝나면 다음을 보고한다:
- 채점 완료 학생 수
- 컴파일 성공 / 실패 현황
- 점수 분포 (최고 / 최저 / 평균)
- 저장된 Excel 파일 경로
- `student_code/` 폴더는 사용자가 확인 후 직접 삭제하도록 안내

## 주의사항

- `ANTHROPIC_API_KEY` 불필요 — Claude 자신이 코드 리뷰를 수행
- `g++` 이 설치되어 있어야 컴파일 점수가 부여됨
- `student_code/` 는 채점 후 자동 삭제하지 않음
- 스크린샷 폴더 등 `.cpp` 외 파일은 무시
