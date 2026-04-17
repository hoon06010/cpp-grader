# cpp-grader

C++ 과제 자동 채점 에이전트입니다. 학생 `.cpp` 파일을 컴파일하고 Claude AI가 채점 기준에 따라 코드를 리뷰한 뒤, 결과를 Excel 파일로 저장합니다.

## 기능

- **컴파일 채점**: g++으로 컴파일 성공 시 10점, 실패 시 0점
- **AI 코드 리뷰**: 교수가 작성한 채점 기준을 Claude가 읽고 항목별 점수 및 피드백 생성
- **Excel 출력**: 학생별 점수, 피드백, 개선 제안, 컴파일 오류를 Excel 파일로 저장

## 요구사항

- Node.js 18 이상
- g++ (macOS: Xcode Command Line Tools, Linux: `sudo apt install g++`)
- Anthropic API 키

## 설치

```bash
git clone https://github.com/hoon06010/cpp-grader.git
cd cpp-grader
npm install
```

## 사용법

### 1. 채점 기준 작성

`criteria.md`를 열어 과제에 맞는 채점 기준을 작성합니다.

```markdown
# 과제명: HW1 - 두 수의 합

## 기능 구현 (50점)
- cin으로 두 정수를 입력받는가: 20점
- 합을 올바르게 계산하는가: 20점
- cout으로 결과를 출력하는가: 10점

## 코드 스타일 (30점)
- 변수명이 명확한가: 15점
- 들여쓰기가 일관적인가: 15점

## 헤더 및 네임스페이스 (10점)
- #include <iostream> 포함: 5점
- using namespace std 또는 std:: 사용: 5점
```

### 2. 학생 파일 준비

`students/` 폴더에 채점할 `.cpp` 파일을 넣습니다. 파일명이 결과 Excel에 그대로 표시됩니다.

```
students/
├── 홍길동.cpp
├── 김철수.cpp
└── 이영희.cpp
```

### 3. API 키 설정

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 4. 채점 실행

```bash
node grade.js
```

결과는 `output/결과_YYYYMMDD_HHmm.xlsx`에 저장됩니다.

### 옵션

```
-i, --input <폴더>      .cpp 파일 폴더 (기본값: students/)
-c, --criteria <파일>   채점 기준 파일 (기본값: criteria.md)
-o, --output <파일>     결과 Excel 파일 경로
-h, --help              도움말
```

예시:

```bash
# 다른 폴더와 기준 파일 사용
node grade.js --input ./hw2 --criteria hw2_criteria.md

# 결과 파일 경로 직접 지정
node grade.js --output ./results/hw1.xlsx
```

## 출력 형식

| 열 | 설명 |
|----|------|
| 학생 파일명 | .cpp 파일명 |
| 컴파일 | 성공 / 실패 |
| 컴파일 점수 | 10 또는 0 |
| 채점기준 점수 | Claude가 부여한 점수 |
| 채점기준 만점 | criteria.md 기준 총점 |
| 총점 | 컴파일 + 채점기준 점수 |
| 피드백 | 채점 근거 및 잘한 점 |
| 개선 제안 | Claude의 개선 제안 |
| 컴파일 오류 | 컴파일 실패 시 g++ 오류 메시지 |

## 프로젝트 구조

```
cpp-grader/
├── grade.js          # 메인 채점 스크립트
├── criteria.md       # 채점 기준 (직접 수정)
├── students/         # 학생 .cpp 파일 넣는 폴더
├── output/           # Excel 결과 저장 폴더 (자동 생성)
└── lib/
    ├── compiler.js   # g++ 컴파일
    ├── reviewer.js   # Claude API 코드 리뷰
    └── excel.js      # Excel 파일 생성
```

## 주의사항

- `output/`과 `students/`의 컴파일 바이너리는 `.gitignore`에 포함되어 커밋되지 않습니다.
- Claude API 요금이 발생합니다. 학생 수가 많을 경우 비용을 미리 확인하세요.
- 학생 코드를 직접 실행하지 않으므로 런타임 보안 위험은 없습니다 (컴파일만 수행).
