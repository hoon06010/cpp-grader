# C++ 과제 채점 에이전트 (Gemini CLI 최적화)

이 프로젝트는 **Gemini CLI**가 직접 C++ 과제를 채점하는 에이전트입니다.
외부 API 호출 없이 Gemini CLI가 직접 코드를 읽고 판단합니다.

## 프로젝트 구조

```
grader/
├── students/          # 채점할 .zip 파일을 여기에 넣는다
│   └── hw1_20240001_홍길동.zip   # 형식: hw(숫자)_학번_이름.zip
├── uploads/           # 채점 기준 PPTX 파일을 여기에 넣는다
├── student_code/      # 압축 해제된 학생 코드 (채점 후 보존)
├── criteria.md        # 채점 기준 및 배점 (PPTX → 자동 생성 가능)
├── output/            # 채점 결과 Excel 파일
└── lib/
    ├── prepare.js       # zip 압축 해제 + 컴파일 → JSON 출력
    ├── static-check.js  # C++ 정적 분석 (void main, return, 변수명, 주석, 들여쓰기)
    ├── save-results.js  # 채점 결과 JSON → Excel 저장
    ├── pptx-to-criteria.js  # PPTX 슬라이드 텍스트 추출 → stdout
    ├── extractor.js     # zip 파싱/압축 해제 유틸
    ├── compiler.js      # g++ 컴파일 유틸
    ├── runner.js        # 자동 테스트케이스 실행
    └── excel.js         # Excel 생성 유틸
```

## PPTX → criteria.md 자동 업데이트

채점 기준이 PPTX로 있을 때 Gemini CLI가 직접 변환합니다:

```bash
# uploads/ 에 .pptx 파일을 넣고 실행
node lib/pptx-to-criteria.js              # 가장 최근 파일 자동 선택
node lib/pptx-to-criteria.js hw1.pptx    # 특정 파일 지정
```

- 스크립트는 PPTX에서 슬라이드 텍스트를 추출해 stdout으로 출력합니다.
- Gemini CLI가 해당 텍스트를 읽고 `criteria.md`를 직접 작성하거나 업데이트합니다.
- **`criteria.md`가 PPTX보다 최신이면 자동 스킵** — 강제 재추출: `node lib/pptx-to-criteria.js --force`

## 채점 워크플로우 (Grading Workflow)

채점을 시작하라는 요청을 받으면 아래 순서를 반드시 따릅니다.

### 1단계 — 준비 (기계적 작업)

```bash
node lib/prepare.js
```

- `students/` 의 모든 `.zip` 파일을 `student_code/` 에 압축 해제합니다.
- 각 `.cpp` 파일을 `g++` 로 컴파일합니다 (Windows `_s` 함수 호환 매크로 주입, `void main` → `int main` 변환 포함).
- 중첩 zip 파일 재귀 압축 해제, `__MACOSX` 및 `._*` 파일 제외를 자동으로 수행합니다.
- 학생별 정보(학번, 이름, 파일 경로, 컴파일 결과)를 JSON으로 출력합니다.
- 컴파일 성공 시 `lib/runner.js`의 테스트케이스 및 `lib/static-check.js`의 정적 분석을 자동 실행합니다.
- `skipReview: true` 항목은 자동 만점 대상으로 분류됩니다.

### 2단계 — 채점 기준 파악

`criteria.md` 를 읽어 항목별 배점과 평가 기준을 파악합니다.

### 3단계 — 코드 리뷰 (Gemini CLI 직접 수행)

**리뷰는 한 명씩 순차 처리합니다.** (컨텍스트 효율을 위해 한꺼번에 로드하지 않음)

- **`skipReview: true` 항목:** 코드를 읽지 않고 자동 만점 처리합니다. (`criteriaScore = maxCriteriaScore`, `deductions = ""`)
- **중복 제출 (`codeHash` 동일):** 이전 결과를 복사하여 중복 작업을 방지합니다.
- **`skipReview: false` 항목:**
  - `read_file`로 `codePath` 파일을 로드합니다.
  - `criteria.md` 기준에 따라 **감점 요인만** 확인합니다.
  - `staticChecks` 결과가 `false`인 항목을 반영합니다.
  - 칭찬이나 설명은 생략하고 **감점 사유와 점수만** 명확히 기록합니다.
  - 컴파일 실패 시 기능 점수는 0점 처리하고 오류 메시지를 기록합니다.

### 4단계 — 결과 저장

검토 결과를 아래 JSON 형식으로 `/tmp/grade_results.json` 에 저장한 뒤 저장 스크립트를 실행합니다.

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
    "deductions": "-5: 반환값 누락\n-5: 변수명 불명확"
  }
]
```

```bash
node lib/save-results.js /tmp/grade_results.json
```

- `output/` 의 기존 엑셀 파일이 있으면 업데이트하고, 없으면 새로 생성합니다.

### 5단계 — 완료 보고

- 채점 완료 학생 수 및 컴파일 성공/실패 현황
- 점수 분포 (최고/최저/평균)
- 저장된 Excel 파일 경로
- `student_code/` 폴더 삭제 안내

## 주의사항

- `g++` 설치 필수
- Windows 전용 `_s` 함수 및 `void main()`은 자동 처리됨
- `student_code/`는 수동 삭제 권장
- **효율적인 컨텍스트 관리:** `read_file`을 사용하여 필요한 시점에만 학생 코드를 읽습니다.
