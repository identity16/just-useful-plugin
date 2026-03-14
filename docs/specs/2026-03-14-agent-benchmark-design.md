# agent-benchmark Skill Design Spec

## Overview

`just-useful-plugin`에 추가하는 새 스킬. 현재 레포 환경에서 에이전트의 작업 수행 능력을 지표화하여 측정한다. 기존 벤치마크들이 "모델이 얼마나 똑똑한가"를 측정하는 것과 달리, **"이 환경이 에이전트가 일하기에 얼마나 잘 세팅되어 있는가"**를 측정한다.

### 핵심 가설

같은 모델이라도 CLAUDE.md, docs 구조, knowledge base 품질에 따라 수행 능력이 달라진다. 이를 정량적으로 측정하면 환경 개선의 방향과 효과를 객관적으로 판단할 수 있다.

### 대상 사용자

- 스킬 개발자: garden-docs 등 스킬의 효과를 검증하고 개선
- 플러그인 사용자: 자신의 프로젝트에서 환경 세팅 효과를 측정

### 플랫폼

- Claude Code 전용

## 이론적 기반

### Lostness Metric (Smith, 1996)

정보 탐색 효율성을 측정하는 UX 지표. 에이전트의 파일 탐색 패턴에 직접 적용 가능.

```
L = sqrt((N/S - 1)² + (R/N - 1)²)
```

- N: 접근한 고유 파일 수
- S: 총 파일 접근 횟수 (재방문 포함)
- R: 태스크 완료에 필요한 최소 파일 수
- 0 = 완벽히 효율적, 1 = 완전히 길 잃음, 0.4 이상 = "길 잃은 상태"

### DevEx Framework (Noda, Storey, 2023)

개발자 생산성을 3차원으로 측정하는 프레임워크. 에이전트 환경 품질 측정에 차용.

- **Cognitive Load**: 에이전트가 컨텍스트 파악에 쓰는 비용 vs 실제 작업 비용
- **Feedback Loops**: 작업 결과를 얼마나 빠르게 검증하는가
- **Flow State**: 막힘 없이 연속 작업이 가능한가

### 핵심 원리

에이전트의 행동을 **"이해하는 행동"(grep, read, glob)** vs **"실행하는 행동"(edit, write)** 으로 분류하면, 그 비율이 환경의 불필요한 인지 부하(extraneous load)를 나타낸다.

## 측정 프레임워크

> **Note:** The measurement framework below has been superseded by `docs/specs/2026-03-14-benchmark-metrics-redesign.md`. The new framework uses 3 flat metrics (Total Tokens, Elapsed Time, Backtrack Rate) instead of the 3-dimension 11-metric structure described here.

### 3차원 9개 지표

#### Dimension 1: Navigability (40%)

| 지표 | 정의 | 산출 | 방향 |
|------|------|------|------|
| **Pathfinding Score** | 목적지까지 얼마나 직행했는가 | `1 - L` (Lostness 반전, 0-1) | 높을수록 좋음 |
| **First Touch Rate** | 첫 탐색이 정확했던 비율 | 첫 3개 도구 호출이 정답 파일을 포함하는 비율 | 높을수록 좋음 |
| **Revisit Waste Rate** | 재방문 낭비 비율 | `(S - N) / S` | 낮을수록 좋음 |

#### Dimension 2: Cognitive Load (35%)

| 지표 | 정의 | 산출 | 방향 |
|------|------|------|------|
| **Focus Ratio** | 탐색 대비 실행 집중 비율 | `(edit+write 호출) / (grep+read+glob 호출)` | 높을수록 좋음 |
| **Warmup Cost** | 첫 실행까지 워밍업 호출 수 | 첫 edit/write 전 호출 횟수 | 낮을수록 좋음 |
| **Token Efficiency Rate** | 토큰을 실제 작업에 쓴 비율 | `실행 도구 토큰 / 전체 토큰` | 높을수록 좋음 |

#### Dimension 3: Task Effectiveness (25%)

| 지표 | 정의 | 산출 | 방향 |
|------|------|------|------|
| **Task Success Rate** | 태스크 완료율 | 정답 기준 대비 달성률 | 높을수록 좋음 |
| **Tool Call Count** | 총 도구 호출 수 | 카운트 | 낮을수록 좋음 |
| **Speed Score** | 완료까지 속도 점수 | 첫 호출~마지막 호출 간 시간 기반 | 높을수록 좋음 |

### 종합 점수

**Agent Readiness Score (0-100)**: 세 차원의 가중 합산.

## 태스크 생성기

### 생성 과정

**Step 1: 레포 구조 스캔**
- 파일 트리, 언어 비율, 디렉토리 깊이 수집
- CLAUDE.md, docs/, README 등 문서 자산 목록화

**Step 2: 코드 요소 추출**
- 진입점 파일 식별 (main, index, app 등)
- 주요 모듈/패키지 경계 식별 (디렉토리 단위)
- export된 함수/클래스 목록 수집
- import/require 관계로 의존 그래프 구성
- 에러 핸들링 패턴 수집 (try-catch, error class 등)

**Step 3: 태스크 템플릿에 실제 요소를 바인딩**

| 카테고리 | 템플릿 패턴 | 바인딩 예시 |
|---------|-----------|-----------|
| **Discovery** | `"{entry_point}에서 시작해서 {feature} 기능의 핵심 로직을 찾아라"` | `"main.py에서 시작해서 인증 기능의 핵심 로직을 찾아라"` |
| **Comprehension** | `"{module_a}와 {module_b}의 의존 관계를 설명해라"` | `"auth/와 users/의 의존 관계를 설명해라"` |
| **Modification** | `"{function}에 {param_type} 검증을 추가해라"` | `"create_user()에 email 형식 검증을 추가해라"` |
| **Diagnosis** | `"{error_pattern}이 발생하는 코드 경로를 추적해라"` | `"PermissionError가 발생하는 코드 경로를 추적해라"` |

**Step 4: 정답 기준 생성**
- 각 태스크에 대해 "최소한 어떤 파일들을 봐야 하는가"를 의존 그래프에서 도출
- Lostness의 R값(최소 필요 파일 수) 산출에 사용
- Modification 태스크: 수정해야 할 파일과 위치도 정답에 포함

**생성 규칙:**
- 레포당 최소 4개 (카테고리별 1개), 최대 8개
- 정답 기준은 레포를 실제로 분석한 에이전트가 생성 (레포 상태에 종속적)

## 실행 엔진

### 기본 모드: 단일 실행

1. 레포 분석 + 태스크 생성 (분석 에이전트)
2. hooks 세팅 (PreToolUse/PostToolUse 로그 캡처)
3. 태스크별로 서브에이전트 실행 (isolation: worktree)
4. 로그 수집 → 지표 산출 → 터미널 리포트 출력

### 고급 모드: A/B 비교 실행

사용자가 두 조건을 정의하면 활성화.

1. worktree A: 조건 1 환경 세팅
2. worktree B: 조건 2 환경 세팅
3. 동일 태스크를 양쪽에서 병렬 실행
4. 지표 비교 리포트 출력

조건 예시:
- "CLAUDE.md 있음 vs 없음"
- "docs/ 있음 vs 없음"
- "현재 구조 vs 리팩토링된 구조"

### 로그 수집 방식

Claude Code hooks (PreToolUse/PostToolUse)를 활용해 외부에서 도구 호출 로그를 캡처.
- 도구 이름, 파라미터, 타임스탬프
- 접근한 파일 목록
- 최종 결과물
- 벤치마크 실행 중에만 활성화, 종료 시 복원

### 제약사항

- 서브에이전트는 벤치마크 태스크만 수행하고 실제 커밋은 하지 않음
- worktree는 실행 후 자동 정리
- hooks는 벤치마크 실행 중에만 활성화되고 종료 시 복원

## 리포트 출력

### 터미널 출력 (기본)

```
╔══════════════════════════════════════════════════╗
║           Agent Benchmark Report                 ║
║           just-useful-plugin @ 464ffc4           ║
╠══════════════════════════════════════════════════╣

── Navigability (40%) ─────────────────────────────
  Pathfinding Score     0.77  ████████░░  Good
  First Touch Rate      75%   ███████░░░  Good
  Revisit Waste Rate    12%   █░░░░░░░░░  Excellent

── Cognitive Load (35%) ───────────────────────────
  Focus Ratio           0.48  █████░░░░░  Fair
  Warmup Cost           6     █████░░░░░  Fair
  Token Efficiency Rate 66%   ███████░░░  Good

── Task Effectiveness (25%) ───────────────────────
  Task Success Rate     100%  ██████████  Excellent
  Tool Call Count       24    ██████░░░░  Fair
  Speed Score           0.82  ████████░░  Good

── Overall ────────────────────────────────────────
  Agent Readiness Score:  72 / 100  ████████░░

── Task Breakdown ─────────────────────────────────
  #1 [Discovery]      PS=0.82  ✓ Complete  8 calls
  #2 [Comprehension]  PS=0.69  ✓ Complete  7 calls
  #3 [Modification]   PS=0.88  ✓ Complete  5 calls
  #4 [Diagnosis]      PS=0.71  ✓ Complete  4 calls

╚══════════════════════════════════════════════════╝
```

### A/B 비교 모드 출력

```
── A/B Comparison ─────────────────────────────────
                       Condition A     Condition B
                       (with docs)     (no docs)
  Pathfinding Score    0.77            0.39  (-49%)
  Focus Ratio          0.48            0.21  (-56%)
  Task Success Rate    100%            75%   (-25%)
  Agent Readiness      72              38    (-47%)
```

### 선택적 내보내기

- `--json` : 원본 데이터 JSON 출력
- `--report` : `docs/benchmarks/YYYY-MM-DD-report.md`로 Markdown 저장

## 스킬 파일 구조

```
skills/agent-benchmark/
├── SKILL.md              # 스킬 정의 (프롬프트, 실행 흐름)
└── references/
    ├── metrics.md        # 지표 정의, 산출 공식, 등급 기준
    ├── task-templates.md # 태스크 카테고리별 템플릿
    └── report-format.md  # 터미널/MD/JSON 출력 포맷 명세
```
