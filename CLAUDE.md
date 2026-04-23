# C++ 과제 채점 에이전트

이 프로젝트는 **Claude Code (VS Code)** 가 직접 C++ 과제를 채점하는 에이전트입니다.
외부 API 호출 없이 Claude Code 자신이 코드를 읽고 판단합니다.
`/grade` 명령어로 채점을 시작합니다.

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

채점 기준이 PPTX로 있을 때 Claude Code가 직접 변환한다:

```bash
# uploads/ 에 .pptx 파일을 넣고 실행
node lib/pptx-to-criteria.js              # 가장 최근 파일 자동 선택
node lib/pptx-to-criteria.js hw1.pptx    # 특정 파일 지정
```

- 스크립트는 PPTX에서 슬라이드 텍스트를 추출해 stdout으로 출력
- Claude Code가 그 텍스트를 읽고 `criteria.md`를 직접 작성
- **`criteria.md`가 PPTX보다 최신이면 자동 스킵** — 강제 재추출: `node lib/pptx-to-criteria.js --force`
- **API 키 불필요** — Claude Code 자신이 처리

## 채점 워크플로우

`/grade` 실행 시 아래 순서를 반드시 따른다.

### 1단계 — 준비 (기계적 작업)

```bash
node lib/prepare.js
```

- `students/` 의 모든 `.zip` 파일을 `student_code/` 에 압축 해제
- 각 `.cpp` 파일을 `g++` 로 컴파일 (Windows `_s` 함수 호환 매크로 자동 주입, `void main` → `int main` 변환 후 컴파일)
- 중첩 zip 파일 재귀 압축 해제, `__MACOSX` 폴더 및 `._*` 파일 자동 제외
- 학생별 정보(학번, 이름, 파일 경로, 컴파일 결과)를 JSON으로 출력
- 코드 본문은 JSON에 포함하지 않음 — `codePath` 경로만 출력, Claude가 필요시 Read 툴로 로드
- 컴파일 성공 시 `lib/runner.js`의 테스트케이스를 자동 실행
- 컴파일 성공 시 `lib/static-check.js`의 정적 분석도 자동 실행 (`staticChecks` 필드)
  - `noVoidMain`: void main 사용 없음
  - `hasReturnInMain`: main에 return 문 존재
  - `noPoorVarNames`: 의미 없는 단일 문자 변수명 없음 (i/j/k/n 등은 허용)
  - `hasComments`: 주석 존재
  - `consistentIndent`: 탭/스페이스 혼용 없음
- `codeHash` 필드: 공백 정규화 후 SHA-256 앞 12자리 — 중복 제출 감지용
- `skipReview: true` → 코드 Read 불필요, 자동 만점 처리 (`allTestsPassed && staticChecks.allPassed`)

### 2단계 — 채점 기준 파악

`criteria.md` 를 읽어 항목별 배점과 평가 기준을 파악한다.

### 3단계 — 코드 리뷰 (Claude Code 직접 수행)

**리뷰는 한 명씩 순차 처리한다.** 전체 코드를 한꺼번에 컨텍스트에 올리지 않는다.

**`skipReview: true` 항목 → 코드를 읽지 않는다 (토큰 0):**
- 자동 만점 처리: `criteriaScore = maxCriteriaScore`, `deductions = ""`

**동일 `codeHash`를 가진 학생이 이미 채점된 경우:**
- 해당 학생의 `deductions` 결과를 그대로 복사한다 — 코드 Read 생략

**`skipReview: false` 항목 → 코드 리뷰 수행:**
- Read 툴로 `codePath` 파일을 로드한다 (JSON에 코드 본문 없음)
- `criteria.md` 각 항목에서 **감점 요인만** 확인
- `staticChecks` 의 `false` 항목은 이미 감점 사유 — criteria.md와 대조해 점수 반영
- 코드의 장점, 칭찬, 설명은 **절대 출력하지 않는다** — 감점 라인만 출력
- 항목 미충족 → 해당 배점만큼 감점 / 충족 → 넘어감 (언급 없음)
- 컴파일 실패 시: 기능 구현 점수 0점, 컴파일 오류 메시지 기록

**각 학생에 대해 산출:**
- `criteriaScore` — criteria.md 기준 획득 점수 (만점 - 감점 합계)
- `maxCriteriaScore` — criteria.md 기준 만점
- `totalScore` — `compileScore + criteriaScore`
- `deductions` — 감점 항목과 점수를 한 줄씩 나열 (예: `-5: 반환값 누락\n-3: 변수명 불명확`) / 감점 없으면 빈 문자열

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
    "deductions": "-5: 반환값 누락\n-5: 변수명 불명확"
  }
]
```

```bash
node lib/save-results.js /tmp/grade_results.json
```

**저장 동작:**
- `output/` 폴더에 기존 `.xlsx` 파일이 있으면 → 해당 파일의 `HW{n}` 열에 점수, `감점` 열에 감점 사유를 기록 (학번으로 행 매칭)
- 기존 파일이 없으면 → 새 Excel 파일 생성

### 5단계 — 완료 보고

채점이 끝나면 다음을 보고한다:
- 채점 완료 학생 수
- 컴파일 성공 / 실패 현황
- 점수 분포 (최고 / 최저 / 평균)
- 저장된 Excel 파일 경로
- `student_code/` 폴더는 사용자가 확인 후 직접 삭제하도록 안내

## 주의사항

- **API 키 불필요** — Claude Code (VS Code) 자신이 모든 코드 리뷰를 수행
- `g++` 이 설치되어 있어야 컴파일 점수가 부여됨
- Windows 전용 `_s` 함수(`scanf_s`, `strcpy_s`, `fopen_s` 등)는 호환 매크로로 자동 처리 (원본 파일 무수정)
- `void main()` → `int main()` 자동 변환 후 컴파일
- 학생 zip 안에 중첩 zip이 있으면 재귀 압축 해제
- `__MACOSX` 폴더 및 `._*` 파일 자동 무시
- `student_code/` 는 채점 후 자동 삭제하지 않음
- 스크린샷 폴더 등 `.cpp` 외 파일은 무시
