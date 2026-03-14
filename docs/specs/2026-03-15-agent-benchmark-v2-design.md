# agent-benchmark v2: Task Quality Redesign

## Overview

agent-benchmark의 태스크 생성 방식을 개선한다. 기존 템플릿 바인딩 단일 트랙을 **canonical fixture + git history 병렬 트랙**으로 교체하여, 레포 간 편차를 줄이고 실제 개발 상황에 가까운 태스크를 생성한다.

### 핵심 가설 (유지)

같은 모델이라도 CLAUDE.md, docs 구조, knowledge base 품질에 따라 수행 능력이 달라진다. 이를 정량적으로 측정하면 환경 개선의 방향과 효과를 객관적으로 판단할 수 있다.

### 기존 설계의 한계

- **합성 태스크**: "entry point 찾기", "의존관계 설명" 같은 태스크가 실제 개발 상황을 반영하지 못함
- **레포 편차**: 같은 템플릿이 레포 규모에 따라 전혀 다른 난이도로 작동
- **정답 검증 취약**: Discovery/Comprehension 태스크의 정답을 객관적으로 판단하기 어려움

### 개선 방향

1. **Canonical fixture**: 플러그인 내장 fixture로 표준화된 baseline 태스크 제공
2. **Git history 태스크**: 실제 커밋 기반으로 레포 특화 태스크 생성
3. **하이브리드 검증**: 카테고리별 최적 검증 전략 (정적분석 + mutation + test pass/fail)

---

## 태스크 소스 아키텍처

기존 "Phase 1: Repo Analysis & Task Generation"을 두 개의 병렬 트랙으로 교체한다.

```
┌─ Track A: Canonical fixtures ──→ 태스크 2-4개 ─┐
│                                                 ├─→ 전부 병렬 dispatch ─→ 통합 리포트
└─ Track B: Git history 분석 ──→ 태스크 0-4개 ───┘
```

Discovery와 Comprehension은 항상 생성. Diagnosis와 Modification은 mutation 대상이 있을 때만 생성되므로 Track A는 2-4개.

### Track A: Canonical Fixtures (항상 실행)

플러그인에 내장된 fixture 파일이 태스크 템플릿 + 대상 선택 규칙 + 검증 방법을 정의한다.

**파일 위치:**

```
skills/agent-benchmark/fixtures/
├── discovery.yaml
├── comprehension.yaml
├── diagnosis.yaml
└── modification.yaml
```

**정적분석 기반 fixture 예시 (Discovery):**

```yaml
- id: canonical-discovery-01
  name: "Trace feature entry to core logic"
  category: discovery
  select:
    entry_point: { glob: ["main.*", "index.*", "app.*", "server.*"], pick: "shallowest" }
    target_module: { strategy: "most_files" }
  task: "Find the core logic of {target_module} starting from {entry_point}"
  verify:
    method: "import_graph"
    expect: "files in call chain from {entry_point} to {target_module}"
    match: "precision_recall"
```

**정적분석 기반 fixture 예시 (Comprehension):**

```yaml
- id: canonical-comprehension-01
  name: "Explain dependency relationship between modules"
  category: comprehension
  select:
    module_a: { strategy: "most_outgoing_deps" }
    module_b: { strategy: "dependency_of", ref: "module_a" }
  task: "Explain the dependency relationship between {module_a} and {module_b}. List the files that form the boundary between them."
  verify:
    method: "checklist"
    expect:
      required_files:                # 에이전트가 반드시 언급해야 하는 파일
        source: "import_graph"       # import graph에서 두 모듈 간 경계 파일 자동 도출
      required_concepts:             # 에이전트 답변에 반드시 포함해야 하는 개념
        - "which module depends on which"
        - "boundary files that connect them"
    match: "all_required"            # 모든 required 항목이 에이전트 답변에 포함되어야 pass
```

**Mutation 기반 fixture 예시 (Diagnosis):**

```yaml
- id: canonical-diagnosis-01
  name: "Find and fix injected validation bug"
  category: diagnosis
  select:
    target_function: { has_tests: true, min_params: 2, pick: "random" }
  mutate:
    action: "delete_validation_branch"
    description: "Remove one parameter validation check"
  task: "This test is failing: {test_command}. Find the cause and fix it."
  verify:
    method: "test_pass"
    command: "{test_command}"
```

**바인딩 프로세스:**

1. `select` 규칙으로 대상 레포에서 적합한 코드 요소 탐색
2. 요소를 찾으면 태스크 변수에 바인딩
3. Mutation fixture는 worktree에서 코드 변형 적용
4. 적합한 대상이 없으면 해당 fixture 스킵

### Track B: Git History 분석 (가용 시 실행)

**커밋 스캔 프로세스:**

```
git log --oneline -50
    │
    ├─ conventional commits 감지 (fix:, feat: 패턴)
    │   ├─ 있으면 → prefix 기반 필터
    │   └─ 없으면 → diff 크기 기반 필터 (변경 파일 1-5개, diff 50-300줄)
    │
    ├─ 추가 필터:
    │   ├─ merge commit 제외
    │   ├─ 관련 테스트 존재 커밋 우선
    │   └─ diff 줄 수 50-300 범위
    │
    └─ 적격 커밋 → 태스크 생성
```

**커밋 → 태스크 변환 규칙:**

**fix: 커밋 → Regression 태스크:**

1. 해당 커밋의 부모로 checkout (worktree) — 부모 checkout 자체가 버그 존재 상태
2. 관련 테스트 실행 → fail 확인
3. 에이전트에게 전달: "이 테스트가 실패한다: {test_command}. 원인을 찾아 고쳐라."
4. 검증: 테스트 pass/fail

**feat: 커밋 → Modification 태스크:**

1. 해당 커밋의 부모로 checkout (worktree)
2. 커밋 메시지 + diff에서 태스크 설명 도출 (정답인 diff 내용은 노출하지 않음)
3. 에이전트에게 전달: "{기능 설명}을 구현하라."
4. 검증: 테스트 pass/fail (테스트가 커밋에 포함된 경우), fallback으로 diff 파일 목록 비교

**feat 태스크 설명 도출 순서:**

1. 커밋 메시지 본문
2. 연결된 이슈/PR 설명 (`#123` 참조가 있으면 `gh issue view`/`gh pr view`로 조회, best-effort — 실패 시 스킵)
3. 위 둘로 부족하면 해당 커밋을 태스크 후보에서 제외

**정답 누출 방지 규칙:** 태스크 설명에 diff 내용(구체적 파일 경로, 변경된 코드 패턴, 함수명 등)을 절대 포함하지 않는다. 태스크 설명은 "무엇을 구현할 것인가"(사용자 관점 기능 설명)만 전달하고, "어디를 어떻게 수정할 것인가"는 에이전트가 판단한다. 커밋 메시지나 이슈에서 충분한 기능 설명을 도출할 수 없으면 해당 커밋은 사용하지 않는다.

**선택 우선순위 (적격 커밋이 여러 개일 때):**

1. 테스트가 포함된 커밋 우선
2. Regression(fix)과 Modification(feat) 각각 최소 1개씩 포함 (가능한 경우). 한쪽 유형만 있으면 해당 유형으로만 채움
3. 변경된 모듈이 겹치지 않도록 다양성 확보
4. 최대 4개

**Git history 태스크가 0개인 경우:** canonical만으로 실행. 리포트에 "Git history tasks: 0 (no eligible commits found)" 표시.

---

## Fixture 스키마

### 공통 스키마

```yaml
- id: string                    # 고유 ID (canonical-{category}-{number})
  name: string                  # 사람이 읽을 수 있는 태스크 이름
  category: enum                # discovery | comprehension | diagnosis | modification

  select:                       # 대상 코드 요소 선택 규칙
    {variable_name}:
      # 후보 탐색 조건 (하나 이상 필수)
      glob: [patterns]          # 파일 탐색 패턴
      grep: pattern             # 코드 패턴 매칭
      has_tests: bool           # 테스트 존재 여부 필터
      min_params: int           # 함수 파라미터 수 필터
      # 후보 중 선택 방법 (택일)
      strategy: string          # 후보군 정렬/필터 전략 (most_files, most_outgoing_deps, dependency_of 등)
      ref: string               # strategy가 다른 변수를 참조할 때 (dependency_of 등)
      pick: string              # 최종 1개 선택 방법 (shallowest, random, first 등)
                                # strategy가 후보군을 좁히고 pick이 그중 하나를 선택
                                # 둘 다 없으면 첫 번째 매칭 결과를 사용

  mutate:                       # mutation 기반만 해당 (선택)
    action: string              # mutation 유형
    description: string         # 변형 설명

  task: string                  # 태스크 프롬프트 (변수 바인딩 전)

  verify:
    method: enum                # import_graph | checklist | test_pass | diff_files
    expect: ...                 # method에 따라 구조가 다름 (아래 검증 방법 참조)
    command: string             # test_pass인 경우 실행할 테스트 명령 (선택)
    match: string               # 매칭 전략 (선택)
```

### 검증 방법 (verify.method) 정의

**`import_graph`** — Discovery 카테고리용. 벤치마크 러너가 레포의 import/require 관계를 정적 분석하여 정답 파일 목록을 도출한다.

- 실행: `select`에서 바인딩된 entry point → target module 경로를 import graph에서 탐색
- 정답: call chain에 포함된 파일 목록
- 비교: 에이전트가 언급한 파일과 정답 파일의 precision/recall 산출. `match: "precision_recall"` 시 F1 > 0.6이면 pass

**`checklist`** — Comprehension 카테고리용. 에이전트 답변에 필수 요소가 포함되어 있는지 확인한다.

- `expect.required_files`: 정답에 반드시 포함되어야 하는 파일 목록 (정적분석으로 자동 도출)
- `expect.required_concepts`: 에이전트 답변에 포함되어야 하는 개념 키워드 목록 (fixture에 정의)
- 비교: `match: "all_required"` — 모든 required 항목이 에이전트 답변에 포함되어야 pass

**`test_pass`** — Diagnosis, Modification, Regression 카테고리용. 에이전트의 코드 변경 후 테스트를 실행한다.

- `command`: 실행할 테스트 명령 (바인딩 시 자동 결정)
- 비교: exit code 0이면 pass

**`diff_files`** — Git history Modification 태스크의 fallback 검증. 테스트가 없는 feat 커밋에 사용.

- 정답: 원본 커밋에서 변경된 파일 목록
- 비교: 에이전트가 수정한 파일과 정답 파일의 집합 비교. 70% 이상 일치하면 pass

### Mutation 유형

| action | 설명 | 대상 조건 |
|--------|------|-----------|
| `delete_validation_branch` | 함수 내 validation if문 하나 삭제 | 테스트 있는 함수, 2+ params |
| `remove_error_handler` | try-catch/except 블록에서 에러 핸들링 제거 | 에러 핸들링 패턴이 있는 함수 |
| `swap_condition` | 조건문의 비교 연산자 반전 (`>` → `<` 등) | 테스트 있는 함수, 조건문 포함 |
| `delete_import` | 사용 중인 import문 하나 삭제 | 모듈 의존성이 있는 파일 |

### Mutation 실행 순서

1. 벤치마크 러너가 `git worktree add`로 mutation 전용 worktree 생성
2. Worktree에서 `select` 규칙으로 대상 탐색
3. 대상을 찾으면 mutation 적용 전 테스트 실행 → pass 확인 (baseline)
4. Mutation 적용
5. 테스트 실행 → fail 확인 (mutation이 실제로 버그를 만들었는지 검증)
6. 검증 통과 시 에이전트를 해당 worktree에 dispatch (A/B 모드와 동일하게 `isolation: "worktree"` 대신 준비된 worktree 경로 사용)
7. 태스크 완료 후 `git worktree remove`로 정리

Step 3-5 모두 만족해야 유효한 태스크. 하나라도 실패하면 해당 fixture 스킵. 테스트 실행 시 타임아웃 60초 — 초과 시 해당 fixture 스킵.

**Note:** Mutation 태스크는 사전 코드 변형이 필요하므로 자동 생성 worktree(`isolation: "worktree"`)를 사용하지 않는다. 대신 벤치마크 러너가 수동으로 worktree를 생성하고 mutation을 적용한 뒤, 에이전트에게 해당 worktree 경로를 전달한다. Discovery/Comprehension 등 mutation이 없는 태스크는 기존처럼 `isolation: "worktree"`를 사용한다.

### Select 실패 처리

`select`가 대상을 못 찾으면 해당 fixture 스킵. 카테고리 내 모든 fixture가 스킵되면 해당 카테고리 N/A. 리포트에 "N/A (no suitable target)" 표시.

---

## 카테고리 체계

### 5개 카테고리

| 카테고리 | 소스 | 검증 방법 | 필수 여부 |
|----------|------|-----------|-----------|
| Discovery | canonical fixture | import graph 정답 비교 | 필수 |
| Comprehension | canonical fixture | 핵심 파일/관계 체크리스트 | 필수 |
| Diagnosis | canonical fixture (mutation) | 테스트 pass/fail | 대상 있을 때만 |
| Modification | canonical fixture (mutation) + git history (feat) | 테스트 pass/fail | 대상 있을 때만 |
| Regression | git history (fix) 전용 | 테스트 pass/fail | 적격 커밋 있을 때만 |

### 태스크 믹스 규칙

**Canonical (4개 목표):**

- Discovery 1개 (항상)
- Comprehension 1개 (항상)
- Diagnosis 1개 (mutation 대상 있을 때)
- Modification 1개 (mutation 대상 있을 때)

**Git history (0-4개):**

- Regression 0-2개 (fix 커밋에서)
- Modification 0-2개 (feat 커밋에서)

**총 태스크 수: 2-8개.** 최소 2개 (테스트 없는 새 레포: Discovery + Comprehension만), 일반적 4-6개, 최대 8개.

### 리포트에서의 구분

태스크 소스를 리포트에 명시:

```
── Task Breakdown ─────────────────────────────────
  #1 [Discovery]      canonical   ✓   1,204 tok   3.2s
  #2 [Comprehension]  canonical   ✓   1,891 tok   5.1s
  #3 [Diagnosis]      canonical   ✓     943 tok   2.8s
  #4 [Modification]   canonical   ✓   2,340 tok   8.4s
  #5 [Regression]     git-history ✓   1,567 tok   4.7s
  #6 [Modification]   git-history ✓   3,102 tok  11.2s
```

A/B 비교 시 메트릭 집계는 소스 무관하게 전체 통합. 목적이 환경 측정이므로 태스크 소스와 무관하게 환경 간 차이를 보는 것이 핵심.

---

## 기존 설계와의 변경점

### 유지

| 요소 | 비고 |
|------|------|
| Phase 0: AskUserQuestion으로 모드 확인 | 그대로 |
| Phase 2: hooks 세팅 + 병렬 dispatch | 그대로 |
| Phase 3: 로그 파싱 + 메트릭 + 리포트 | 그대로 |
| 3개 메트릭 (Total Tokens, Elapsed Time, Backtrack Rate) | 그대로 |
| A/B 비교 모드 | 그대로 |
| worktree 격리 | 그대로 |
| hooks를 통한 외부 로그 캡처 | 그대로 |
| 리포트 포맷 (터미널, JSON, Markdown) | 소스 컬럼 추가 외 그대로 |

### 변경

| 요소 | 현재 | 변경 후 |
|------|------|---------|
| **태스크 소스** | 템플릿 바인딩 단일 트랙 | canonical fixture + git history 병렬 트랙 |
| **태스크 생성** | 레포 스캔 → 템플릿 변수 바인딩 | fixture select 규칙 + git log 분석 |
| **검증 방법** | 파일 목록 비교 (Backtrack Rate만) | 하이브리드: import graph / 체크리스트 / test pass-fail |
| **카테고리** | 4개 (D/C/G/M) | 5개 (+Regression) |
| **태스크 수** | 4-8개 (카테고리별 최소 1) | 2-8개 (테스트 없는 레포 허용) |
| **난이도 기준** | R(관련 파일 수) 기반 tier | 제거 — 태스크 난이도가 소스에 의해 자연 결정 |

### 삭제

| 요소 | 이유 |
|------|------|
| `task-templates.md` 전체 | fixture YAML로 대체 |
| 템플릿 변수 바인딩 규칙 | fixture의 `select` 규칙으로 대체 |
| R 기반 난이도 tier (Easy/Medium/Hard) | 불필요 — mutation/git history 태스크는 난이도 자연 결정 |
| 레포 분석 output schema | fixture의 `select`가 필요한 것만 개별 탐색 |

### 추가

| 요소 | 위치 |
|------|------|
| Canonical fixture 파일들 | `skills/agent-benchmark/fixtures/*.yaml` |
| Mutation 엔진 명세 | `references/mutation.md` |
| Git history 태스크 생성 명세 | `references/git-history.md` |

### 파일 구조 (변경 후)

```
skills/agent-benchmark/
├── SKILL.md                    # 실행 흐름 (Phase 0-3 업데이트)
├── fixtures/
│   ├── discovery.yaml          # NEW
│   ├── comprehension.yaml      # NEW
│   ├── diagnosis.yaml          # NEW
│   └── modification.yaml       # NEW
└── references/
    ├── metrics.md              # 유지
    ├── report-format.md        # 소스 컬럼 추가
    ├── mutation.md             # NEW
    └── git-history.md          # NEW
```

`task-templates.md`는 삭제.
