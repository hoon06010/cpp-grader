# cpp-grader

C++ 과제 자동 채점 에이전트입니다. 학생 `.zip` 파일을 압축 해제하고 컴파일한 뒤, **Claude Code 자신이** 채점 기준에 따라 코드를 리뷰하고 결과를 Excel 파일로 저장합니다.

> API 키 불필요 — Claude Code (VS Code 확장)가 모든 코드 리뷰를 직접 수행합니다.

## 기능

- **PPTX → criteria.md 자동 변환**: 채점 기준 PPTX 슬라이드를 읽어 `criteria.md` 자동 생성
- **컴파일 채점**: g++으로 컴파일 성공 시 10점, 실패 시 0점 (`scanf_s` → `scanf` 자동 변환 지원)
- **AI 코드 리뷰**: Claude Code가 `criteria.md`를 읽고 감점 항목 중심으로 항목별 점수 산출
- **Excel 출력**: 기존 파일에 열 추가 또는 새 파일 생성

## 요구사항

- Node.js 18 이상
- g++ (macOS: Xcode Command Line Tools, Linux: `sudo apt install g++`)
- Claude Code VS Code 확장

## 설치

```bash
git clone https://github.com/hoon06010/cpp-grader.git
cd cpp-grader
npm install
```

## 사용법

### 1. 채점 기준 준비

**방법 A — PPTX 변환 (권장)**

`uploads/` 폴더에 `.pptx` 파일을 넣은 뒤 `/grade` 명령을 실행하면 Claude Code가 자동으로 `criteria.md`를 생성합니다.

**방법 B — 직접 작성**

`criteria.md`를 열어 과제에 맞는 채점 기준을 직접 작성합니다.

```markdown
# 과제명: HW1 - 두 수의 합

## 기능 구현 (50점)
- cin으로 두 정수를 입력받는가: 20점
- 합을 올바르게 계산하는가: 20점
- cout으로 결과를 출력하는가: 10점

## 코드 스타일 (30점)
- 변수명이 명확한가: 15점
- 들여쓰기가 일관적인가: 15점
```

### 2. 학생 파일 준비

`students/` 폴더에 채점할 `.zip` 파일을 넣습니다.

파일명 형식: `hw{숫자}_{학번}_{이름}.zip`

```
students/
├── hw1_20240001_홍길동.zip
├── hw1_20240002_김철수.zip
└── hw1_20240003_이영희.zip
```

### 3. 채점 실행

Claude Code에서 `/grade` 명령을 실행합니다.

```
/grade
```

결과는 `output/` 폴더에 Excel 파일로 저장됩니다.

## 출력 형식

| 열 | 설명 |
|----|------|
| 학번 | zip 파일명에서 추출 |
| 이름 | zip 파일명에서 추출 |
| 컴파일 | 성공 / 실패 |
| 컴파일 점수 | 10 또는 0 |
| HW{n} | criteria.md 기준 획득 점수 |
| 감점 | 감점 항목과 점수 (항목별 한 줄) |
| 총점 | 컴파일 + 채점기준 점수 |

## 프로젝트 구조

```
grader/
├── students/          # 채점할 .zip 파일을 여기에 넣는다
│   └── hw1_20240001_홍길동.zip
├── uploads/           # 채점 기준 PPTX 파일을 여기에 넣는다
├── student_code/      # 압축 해제된 학생 코드 (채점 후 보존)
├── criteria.md        # 채점 기준 및 배점
├── output/            # 채점 결과 Excel 파일
└── lib/
    ├── prepare.js           # zip 압축 해제 + 컴파일
    ├── save-results.js      # 채점 결과 JSON → Excel 저장
    ├── pptx-to-criteria.js  # PPTX 텍스트 추출 → stdout
    ├── extractor.js         # zip 파싱/압축 해제 유틸
    ├── compiler.js          # g++ 컴파일 유틸
    └── excel.js             # Excel 생성 유틸
```

## 주의사항

- `student_code/`는 채점 후 자동 삭제되지 않습니다. 확인 후 직접 삭제하세요.
- 학생 코드를 직접 실행하지 않으므로 런타임 보안 위험은 없습니다 (컴파일만 수행).
- `scanf_s` 사용 코드는 컴파일 전 임시 파일로 `scanf` 변환 후 처리됩니다. 원본 파일은 변경되지 않습니다.
- 기존 Excel 파일이 있으면 `HW{n}` 열과 `감점` 열만 추가/갱신됩니다 (학번으로 행 매칭).
