# cpp-grader

C++ 과제 자동 채점 에이전트입니다. 학생 `.zip` 파일을 압축 해제하고 컴파일한 뒤, **Claude Code 자신이** 채점 기준에 따라 코드를 리뷰하고 결과를 Excel 파일로 저장합니다.

> API 키 불필요 — Claude Code (VS Code 확장)가 모든 코드 리뷰를 직접 수행합니다.

## 기능

- **PPTX → criteria.md 자동 변환**: 채점 기준 PPTX 슬라이드를 읽어 `criteria.md` 자동 생성
- **컴파일 채점**: g++으로 컴파일 (Windows `_s` 함수 호환 매크로, `void main` → `int main` 자동 변환 지원). 실패 시 입출력 구문이 있으면 부분 점수 3점
- **테스트케이스 자동 실행**: `testcases/hw{n}/p{m}/judge.json` 기반으로 컴파일된 바이너리를 샌드박스에서 실행해 출력 검증 (exact / 정수 / 실수 / regex / custom 모드)
- **정적 분석**: void main, return, 변수명, 주석, 들여쓰기 등 참고용 체크
- **AI 코드 리뷰**: Claude Code가 `criteria.md`를 읽고 감점 항목 중심으로 점수 산출 — 단, 명백한 케이스(전체 테스트 통과 등)는 코드를 읽지 않고 자동 처리해 토큰 절약
- **중복 제출 감지**: 코드 해시로 동일 제출을 식별하고 `grader.db`에 이력 기록
- **Excel 출력**: 기존 파일에 열 추가 또는 새 파일 생성

## 개발 과정

실제 수업 채점에 적용하기까지 세 번의 구조 변경을 거쳤습니다.

**1차 — 전체 코드 직접 리뷰**
Claude Code가 학생 코드 전체를 컨텍스트에 올려 채점하는 방식이었습니다.
350개 가까운 파일을 한꺼번에 처리하면서 컨텍스트가 폭발했고,
채점 기준에 없는 항목을 AI가 임의로 만들어내는 hallucination이 반복됐습니다.

**2차 — 입출력 쌍 검증**
PPT에서 채점 기준을 추출하고, 예상 입출력 쌍을 생성해 코드 실행으로 검증하는 방식으로 전환했습니다.
C++ 과제 특성상 입출력만으로 커버할 수 없는 케이스(코드 스타일, 메모리 관리, 알고리즘 선택 등)가 많아
커버리지 한계에 부딪혔습니다.

**3차 — 배치 처리 + 실패 코드 필터링 (현재 구조)**
10개 단위 배치 처리와 컴파일 실패 코드만 AI가 읽는 구조를 결합했습니다.
AI가 읽는 코드 수를 대폭 줄이고, `criteria.md`로 채점 기준을 명세화해
hallucination을 억제했습니다.

결과적으로 채점 소요 시간이 6시간 이상에서 1시간으로 단축됐고,
토큰 사용량은 초기 대비 약 30% 줄었습니다 (사용량의 50% → 35%).

이 과정에서 얻은 핵심 교훈은, LLM에 전달하는 지식이 비구조화돼 있으면
AI는 빈 자리를 반드시 스스로 채운다는 것이었습니다.
`criteria.md`의 명세화 구조는 그 문제에 대한 직접적인 대응입니다.

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

파일명 형식: `{이름}_{학번}.zip` (과제 번호는 zip 내부 `.cpp` 파일명에서 자동 감지)

```
students/
├── 홍길동_20240001.zip
├── 김철수_20240002.zip
└── 이영희_20240003.zip
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
| HW{n} | criteria.md 기준 획득 점수 |
| 감점 | 감점 항목과 점수 (항목별 한 줄) |
| 총점 | 컴파일 + 채점기준 점수 |

## 프로젝트 구조

```
grader/
├── students/          # 채점할 .zip 파일을 여기에 넣는다
│   └── 홍길동_20240001.zip
├── uploads/           # 채점 기준 PPTX 파일을 여기에 넣는다
├── student_code/      # 압축 해제된 학생 코드 (채점 후 보존)
├── criteria.md        # 채점 기준 및 배점
├── testcases/         # hw{n}/p{m}/judge.json 테스트케이스 정의
├── output/            # 채점 결과 Excel 파일 + 배치 진행 파일
└── lib/
    ├── prepare.js           # zip 압축 해제 + 컴파일 + 테스트 실행 → JSON 출력
    ├── static-check.js      # C++ 정적 분석 (참고용)
    ├── save-results.js      # 채점 결과 JSON → Excel 저장
    ├── pptx-to-criteria.js  # PPTX 텍스트 추출 → stdout
    ├── extractor.js         # zip 파싱/압축 해제 유틸
    ├── compiler.js          # g++ 컴파일 유틸
    ├── runner.js            # 테스트케이스 실행 (샌드박스)
    ├── compare.js           # 출력 비교 유틸
    ├── db.js                # 제출 이력 SQLite DB
    ├── dashboard.js         # 채점 결과 HTML 대시보드
    └── excel.js             # Excel 생성 유틸
```

## 주의사항

- `student_code/`는 채점 후 자동 삭제되지 않습니다. 확인 후 직접 삭제하세요.
- 테스트케이스가 정의된 과제는 컴파일된 바이너리를 실제로 실행합니다. 기본적으로 `rlimit` 샌드박스(ulimit 메모리·CPU 제한)에서 격리 실행하며, `--sandbox docker`로 네트워크·파일시스템 완전 격리도 가능합니다.
- `/grade`는 1회 실행 시 최대 10명(1배치)만 처리합니다. 학생 수가 10명을 초과하면 `/grade`를 여러 번 실행하고, 모든 배치 완료 후 결과가 병합되어 Excel에 저장됩니다.
- Windows 전용 `_s` 함수(`scanf_s`, `strcpy_s`, `fopen_s` 등)는 호환 매크로로 자동 처리됩니다. 원본 파일은 변경되지 않습니다.
- `void main()` 코드는 `int main()`으로 자동 변환 후 컴파일됩니다.
- 학생 zip 안에 중첩 zip이 있으면 재귀적으로 압축 해제됩니다.
- `__MACOSX` 폴더 및 `._*` 파일은 자동으로 무시됩니다.
- 기존 Excel 파일이 있으면 `HW{n}` 열과 `감점` 열만 추가/갱신됩니다 (학번으로 행 매칭).
