# Benchmark Metrics Redesign Spec

## 배경

기존 벤치마크 메트릭 (3차원 11개 지표)은 "읽기 vs 쓰기" 비율 기반 평가로, 읽기 전용 태스크(Discovery, Comprehension, Diagnosis)를 구조적으로 불이익 처리하는 문제가 있었다. Cognitive Load 차원(35% 가중치)의 Focus Ratio, Warmup Cost, Token Efficiency Rate, Orientation Time Ratio 등이 태스크 유형과 무관하게 "쓰기가 적으면 비효율"로 판정했다.

### 핵심 전환

"읽기/쓰기 비율이 좋은가?" → **"동일 태스크를 적은 리소스로 완료했는가?"**

## 설계

### 메트릭 (3개, 플랫 구조)

차원 구분 및 가중치 없음. 세 지표는 독립적으로 표시한다.

| 메트릭 | 정의 | 방향 |
|--------|------|------|
| **Total Tokens** | 태스크 실행 중 소모된 전체 토큰 (input + output, 서브에이전트 합산) | lower is better |
| **Elapsed Time** | 첫 도구 호출 ~ 마지막 도구 호출 wall clock 시간 (초) | lower is better |
| **Backtrack Rate** | `(총 파일 접근 수 - 고유 파일 수) / 총 파일 접근 수` | lower is better |

### 태스크 성공: 전제 조건

태스크 성공 여부는 메트릭이 아닌 **전제 조건**이다. 성공한 태스크만 효율 비교 대상이 된다. 실패한 태스크는 리포트에 별도 표시하되 점수 산출에서 제외한다.

### 점수 산출

#### 단일 실행

점수를 산출하지 않는다. 태스크별 3개 메트릭의 원시값만 기록한다.

#### A/B 비교

성공한 태스크 각각에 대해 메트릭별 ratio를 산출한다.

```
token_ratio     = tokens_A / tokens_B
time_ratio      = time_A / time_B
backtrack_ratio = backtrack_A / backtrack_B
```

- ratio > 1 → B가 효율적
- ratio < 1 → A가 효율적
- ratio = 1 → 동등

양쪽 모두 backtrack이 0이면 ratio = 1.0. 한쪽만 0이면 0인 쪽이 승.

전체 요약은 성공한 태스크들의 **메트릭별 평균 ratio** 3개를 독립적으로 표시한다. 합산 점수는 없다.

### 제거 항목

- 3차원 구조 (Navigability, Cognitive Load, Task Effectiveness) 및 가중치
- 기존 11개 메트릭 전부 (Pathfinding Score, First Touch Rate, Revisit Waste Rate, Focus Ratio, Warmup Cost, Token Efficiency Rate, Orientation Time Ratio, Warmup Precision, Task Success Rate, Tool Call Count, Speed Score)
- Agent Readiness Score (0-100 합산 점수)
- Excellent/Good/Fair/Poor 등급 체계
- Tool Classification (orientation/execution/delegation 분류)
- baseline_time 등 answer key 내 속도 관련 필드

### 유지 항목

- 4개 태스크 카테고리 (Discovery, Comprehension, Modification, Diagnosis)
- task-templates.md의 템플릿, 바인딩 규칙, 난이도 티어
- answer key의 expected_files, R값 (백트래킹 산출에 필요)
- 태스크 성공 판정 로직 (answer key의 validation checks)
- 파일 접근 추적 (백트래킹 산출용)
- 토큰 카운팅 (input + output, 서브에이전트 합산)
- 시간 측정 (첫 도구 호출 ~ 마지막 도구 호출)

## 리포트 포맷

### 단일 실행

```
╔══════════════════════════════════════════════════╗
║           Agent Benchmark Report                 ║
║           {project} @ {commit}                   ║
╠══════════════════════════════════════════════════╣

── Task Results ───────────────────────────────────
  #   Category        Status   Tokens    Time    Backtrack
  1   Discovery       ✓        12,340    42.0s   0.08
  2   Comprehension   ✓        28,100   107.3s   0.15
  3   Diagnosis       ✓         8,200    26.1s   0.00
  4   Modification    ✓         6,500    26.9s   0.03

── Summary ────────────────────────────────────────
  Successful: 4/4
  Total Tokens: 55,140
  Total Time: 202.3s
  Avg Backtrack: 0.07

╚══════════════════════════════════════════════════╝
```

### A/B 비교

```
╔══════════════════════════════════════════════════════════╗
║           Agent Benchmark Report                         ║
║           {project} @ {commit_a} vs {commit_b}           ║
╠══════════════════════════════════════════════════════════╣

── Task Comparison (successful only) ──────────────────────
  #   Category        A Tokens   B Tokens   Ratio
  1   Discovery        12,340     10,200     1.21  ← B
  2   Comprehension    28,100     32,500     0.86  ← A
  3   Diagnosis         8,200     24,800     0.33  ← A
  4   Modification      6,500      6,800     0.96  ← A

  #   Category        A Time     B Time     Ratio
  1   Discovery        42.0s      43.1s     0.98  ← A
  2   Comprehension   107.3s      96.6s     1.11  ← B
  3   Diagnosis        26.1s      50.3s     0.52  ← A
  4   Modification     26.9s      27.3s     0.99  ← A

  #   Category        A BT       B BT       Ratio
  1   Discovery        0.08       0.05      1.60  ← B
  2   Comprehension    0.15       0.10      1.50  ← B
  3   Diagnosis        0.00       0.12      0.00  ← A
  4   Modification     0.03       0.04      0.75  ← A

── Summary ──────────────────────────────────────────
  Avg Token Ratio:     0.72  → A가 효율적
  Avg Time Ratio:      0.88  → A가 효율적
  Avg Backtrack Ratio: 1.22  → B가 효율적

╚══════════════════════════════════════════════════════════╝
```

### 해석

- ratio > 1: B가 효율적
- ratio < 1: A가 효율적
- ratio = 1: 동등

세 지표가 다른 방향을 가리킬 수 있으며, 이 자체가 유용한 진단 정보다. (예: "B가 토큰은 더 쓰지만 백트래킹은 적다 → 문서 구조가 재방문을 줄여주지만 한번 읽을 때 더 많이 읽어야 한다")
