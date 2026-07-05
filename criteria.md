# Lab1 채점 기준 (총 100점)

## 과제 개요

- 제출 형식: `Lab1-1.c`, `Lab1-2.c` (또는 이에 준하는 이름, 확장자 .c/.cpp 혼용 허용)
- 총 2문제, 총 100점
- 부정행위(코드 서치, 코드 자동완성, 코드 공유 등) 발견 시 0점 처리 — 단, 자동 채점 단계에서는 판단하지 않고 `needsReview`로 표시

---

## Lab1-1 (40점): 양수/음수 합계

### 요구사항
- N(입력할 정수 개수, 최대 100)을 입력받음 (`scanf`)
- N개의 정수를 배열에 저장
- `for` 루프로 배열을 순회하며 양수 합(Positive sum)과 음수 합(Negative sum)을 각각 누적
- 결과를 아래 형식으로 출력

### 예상 출력
```
Enter how many numbers (max 100): 5
Enter 5 numbers (positive or negative):
3
-4
7
-2
8
Positive sum: 18
Negative sum: -6
```

### 배점 및 감점 기준 (40점 = 8점 × 5)
- N 입력받기 (scanf 사용): 8점
- 배열 선언 및 N개 정수 입력 저장: 8점
- `for` 루프로 배열 순회: 8점
- 양수/음수 조건 분기 (if/else): 8점
- Positive sum / Negative sum 정확히 출력: 8점
- (항목 미충족 시 해당 배점만큼 감점)

---

## Lab1-2 (60점): 학점 변환 + 카운팅 + 검색

### 요구사항
- 함수 시그니처: `char convertGrade(int score)`
- 학점 기준: A(≥90), B(≥80), C(≥70), D(≥60), F(<60)
- `main()`에서 N(학생 수)과 N개의 점수를 int 배열로 입력받음
- `convertGrade()`로 점수를 학점으로 변환해 char 배열에 저장
- 각 학생의 점수와 학점을 출력
- 학점별(A/B/C/D/F) 인원 수를 카운팅해 출력
- 사용자로부터 검색할 학점을 입력받아, 해당 학점을 받은 학생들의 번호(1-based)를 출력

### 예상 출력
```
Enter number of students: 8
Enter 8 scores:
95 82 67 45 78 88 92 75

--- Grades ---
Student 1: score = 95, grade = A
Student 2: score = 82, grade = B
Student 3: score = 67, grade = D
Student 4: score = 45, grade = F
Student 5: score = 78, grade = C
Student 6: score = 88, grade = B
Student 7: score = 92, grade = A
Student 8: score = 75, grade = C

--- Grade counts ---
A: 2, B: 2, C: 2, D: 1, F: 1

Enter a grade to search (A/B/C/D/F): B
Students with grade B: 2 6
```

### 배점 및 감점 기준 (60점)
- `convertGrade` 함수 정의 + if/else 분기 정확: 15점
- N명 점수 배열 입력 + char 배열에 학점 저장: 10점
- 각 학생의 score + grade 출력: 10점
- 학점별 인원 수 카운팅 + 출력: 10점
- 사용자 입력 학점으로 검색 + 학생 번호 출력: 15점
- (항목 미충족 시 해당 배점만큼 감점)
