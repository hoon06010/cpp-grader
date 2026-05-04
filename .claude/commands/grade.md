---
description: students/ 폴더의 C++ 과제 zip 파일을 자동 채점합니다
---

CLAUDE.md의 채점 워크플로우에 따라 C++ 과제를 채점합니다.
외부 API 호출 없이 Claude Code가 직접 모든 판단을 수행합니다.
**세션 1개 = 배치 1개.** 컨텍스트 누적을 막기 위해 `/grade`를 실행할 때마다 딱 1개 배치만 처리합니다.

## 0단계 — criteria.md 확인 (선택)

`uploads/` 에 `.pptx` 파일이 있고 `criteria.md`를 갱신해야 할 경우:

```bash
node lib/pptx-to-criteria.js
```

출력된 슬라이드 텍스트를 읽고 `criteria.md`를 직접 작성합니다.

## 1단계 — 현재 진행 상황 파악

전체 zip 수, 이미 완료된 배치 수를 확인해 **이번 세션에서 처리할 배치 번호**를 결정합니다.

```bash
ls students/*.zip 2>/dev/null | wc -l
ls /tmp/grade_batch_*.json 2>/dev/null | sort -V
```

- 총 N명 → 배치 수 = ceil(N / 10), 배치 번호는 0-based
- `/tmp/grade_batch_{n}.json` 이 없는 가장 작은 n이 **이번 배치**
- 예: grade_batch_0.json, grade_batch_1.json 이 있으면 → 이번 배치 = 2 (--start 20)
- 모든 배치 파일이 이미 존재하면 → 4단계(병합)로 바로 이동

## 2단계 — 채점 기준 확인

`criteria.md`를 읽어 항목별 배점과 평가 기준을 파악합니다.

## 3단계 — 이번 배치 채점 (1회만 수행)

### 3-1. 배치 준비

```bash
node lib/prepare.js --start {N} --limit 10 --output /tmp/grade_batch_{n}.json
```

stdout 출력 예시:
```
준비 완료: 10명 처리 | skipReview=false: 3명 (idx 11, 15, 17) | 저장: /tmp/grade_batch_1.json
리뷰 필요:
- idx=11 | 202037083 한상후 | hw12.cpp | /path/to/hw12.cpp
- idx=15 | 202533978 고준원 | HW1-6.cpp | /path/to/HW1-6.cpp
- idx=17 | 202011234 김민준 | hw1.cpp | /path/to/hw1.cpp
```

`skipReview: true` 항목의 상세 데이터는 `/tmp/grade_batch_{n}.json`에서 확인합니다.

### 3-2. 코드 리뷰

**시작 시 이 명령 하나만 실행합니다. 다른 node 명령은 절대 추가 실행하지 않습니다.**

```bash
node -e "
const d=require('/tmp/grade_batch_{n}.json');
const nr=d.filter(r=>!r.skipReview);
nr.forEach((r,i)=>console.log(i+1+'. '+r.studentId+' '+r.studentName+' | '+r.filename+'\n   '+r.codePath));
console.log('\n총 검토필요:', nr.length+'개 / 전체:', d.length+'개');
"
```

이 출력에 나열된 `codePath` 경로만 참조합니다. **배치 JSON을 다시 읽는 node 명령을 추가 실행하지 않습니다.**

**skipReview: true 항목** — 코드를 읽지 않습니다:
- `autoDeductions` 비어있으면: `criteriaScore = maxCriteriaScore`, `deductions = ""`
- `autoDeductions` 있으면: `criteriaScore = maxCriteriaScore + sum(autoDeductions[].points)`, `deductions` = `-{pts}: {label}` 형식으로 조합

**동일 `codeHash` 이미 채점됨** — 해당 학생의 deductions를 복사합니다. 코드 Read 생략.

**skipReview: false 항목** — 위 출력의 `codePath`를 번호 순서대로 Read 툴로 로드합니다:
- criteria.md 항목별 **감점 요인만** 확인 (칭찬·설명 출력 금지)
- `staticChecks`의 false 항목은 참고용이며 감점에 반영하지 않음
- 컴파일 실패 시 기능 구현 점수 0점

**코드 리뷰 완료 후** 결과를 배치 JSON에 직접 반영합니다. `{업데이트 코드}` 자리에 실제 채점 결과(studentId별 criteriaScore·deductions)를 채워 실행합니다:

```bash
node -e "
const fs=require('fs');
const d=require('/tmp/grade_batch_{n}.json');
{업데이트 코드}
// 예: const s=d.find(r=>r.studentId==='20240001'); s.criteriaScore=80; s.deductions='-5: 반환값 누락'; s.totalScore=s.compileScore+s.criteriaScore;
// skipReview=true 항목은 건드리지 않습니다
fs.writeFileSync('/tmp/grade_batch_{n}.json',JSON.stringify(d,null,2));
console.log('저장 완료:', d.length+'명');
"
```

### 3-3. 배치 완료 후 판단

다음 명령으로 남은 배치가 있는지 확인합니다:

```bash
node -e "
const fs=require('fs');
const total=fs.readdirSync('students').filter(f=>f.endsWith('.zip')).length;
const done=fs.readdirSync('/tmp').filter(f=>/^grade_batch_\d+\.json$/.test(f)).length;
const remaining=Math.ceil(total/10)-done;
console.log('전체 배치:',Math.ceil(total/10),'| 완료:',done,'| 남음:',remaining);
if(remaining>0) console.log('→ /grade 를 다시 실행하세요 (다음 배치 자동 시작)');
else console.log('→ 모든 배치 완료! 4단계로 진행합니다.');
"
```

**남은 배치가 있으면: 여기서 멈춥니다.** 사용자에게 `/grade` 재실행을 안내하고 세션을 종료합니다.

## 4단계 — 결과 병합 및 저장

모든 배치가 끝나면 배치 파일들을 병합한 뒤 Excel에 저장합니다.

```bash
node -e "
const fs = require('fs');
const files = fs.readdirSync('/tmp')
  .filter(f => /^grade_batch_\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
const all = files.flatMap(f => JSON.parse(fs.readFileSync('/tmp/' + f, 'utf8')));
fs.writeFileSync('/tmp/grade_results.json', JSON.stringify(all, null, 2));
console.log('병합 완료:', all.length, '명');
"
node lib/save-results.js /tmp/grade_results.json
```

배치 파일 정리:
```bash
rm /tmp/grade_batch_*.json 2>/dev/null; true
```

## 5단계 — 완료 보고

- 채점 완료 학생 수 / 총 배치 수
- 컴파일 성공 / 실패 현황
- 점수 분포 (최고 / 최저 / 평균)
- 저장된 Excel 파일 경로
- `student_code/` 폴더 확인 후 직접 삭제 안내
