# agent-benchmark Skill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `just-useful-plugin`에 agent-benchmark 스킬을 추가한다. 현재 레포 환경에서 에이전트의 작업 수행 능력을 지표화하여 측정하고, 선택적으로 A/B 비교 실험을 지원하는 프롬프트 기반 스킬.

**Architecture:** 코드 없는 순수 Markdown 스킬. SKILL.md가 실행 흐름을 지시하고, references/ 파일들이 지표 공식, 태스크 템플릿, 리포트 포맷을 정의한다. garden-docs와 같은 SKILL.md 기반 스킬이나, references/ 디렉토리를 추가로 사용하는 확장 구조.

**Tech Stack:** Markdown (YAML frontmatter), Claude Code hooks (PreToolUse/PostToolUse), Claude Code Agent tool (서브에이전트)

---

## File Structure

```
skills/agent-benchmark/
├── SKILL.md                    # 스킬 정의: 실행 흐름, HARD-GATE, 서브에이전트 전략
└── references/
    ├── metrics.md              # 3차원 9개 지표 정의, 산출 공식, 등급 기준, 종합 점수 계산
    ├── task-templates.md       # 4개 카테고리 템플릿, 레포 분석→바인딩 규칙, 정답 기준 생성 규칙
    └── report-format.md        # 터미널 출력 포맷, A/B 비교 포맷, JSON/Markdown 내보내기 스키마
```

수정 대상 기존 파일:
- `README.md` — Skills 테이블에 agent-benchmark 추가
- `.claude-plugin/plugin.json` — keywords에 benchmark 관련 키워드 추가

---

## Chunk 1: Core Skill Definition

### Task 1: Create SKILL.md

**Files:**
- Create: `skills/agent-benchmark/SKILL.md`

- [ ] **Step 1: Create SKILL.md with frontmatter and overview**

```markdown
---
name: agent-benchmark
description: Use when measuring agent task performance in a codebase, evaluating environment setup quality for AI agents, benchmarking agent navigation efficiency, running A/B comparisons of documentation/context configurations, or assessing Agent Readiness Score
---

# Agent Benchmark

Measure how well a codebase environment supports AI agent task performance. Uses the Lostness Metric (Smith, 1996) and DevEx Framework (Noda & Storey, 2023) to quantify agent navigability, cognitive load, and task effectiveness.

<HARD-GATE>

- Never report scores without actually running benchmark tasks
- Always generate tasks dynamically from the target repo — never use hardcoded tasks
- Always use hooks (PreToolUse/PostToolUse) for log capture — never rely on agent self-reporting
- Always run benchmark agents in worktree isolation — never let them modify the actual repo
- Never skip the repo analysis step — task quality depends on accurate code element extraction
- Always clean up hooks and worktrees after benchmark completion

</HARD-GATE>
```

- [ ] **Step 2: Add execution flow overview and Phase 1**

SKILL.md에 실행 흐름 개요와 Phase 1(레포 분석 + 태스크 생성)을 기술한다:

```markdown
---

## Execution Flow

### Overview

\`\`\`
사용자가 agent-benchmark 실행
         │
         ▼
   ┌─────────────┐
   │ Phase 1      │ ── 레포 분석 + 태스크 생성
   └──────┬──────┘
         ▼
   ┌─────────────┐
   │ Phase 2      │ ── hooks 세팅 + 서브에이전트 실행
   └──────┬──────┘
         ▼
   ┌─────────────┐
   │ Phase 3      │ ── 로그 수집 + 지표 산출 + 리포트 출력
   └─────────────┘
\`\`\`

### Phase 1: Repo Analysis & Task Generation

Main agent가 직접 수행한다.

1. **레포 구조 스캔**
   - `Glob`으로 파일 트리 수집 (언어 비율, 디렉토리 깊이)
   - CLAUDE.md, docs/, README 등 문서 자산 목록화
   - `Bash (git log)`으로 최근 변경 이력 확인

2. **코드 요소 추출**
   - 진입점 파일 식별: main, index, app, server 등 패턴으로 `Glob` 검색
   - 주요 모듈 경계 식별: 최상위 디렉토리를 모듈 단위로 파악
   - `Grep`으로 export/import 관계 수집 → 의존 그래프 구성
   - `Grep`으로 에러 핸들링 패턴 수집 (try-catch, error class, raise/throw)

3. **태스크 동적 생성**
   - `references/task-templates.md` 참조
   - 각 카테고리(Discovery, Comprehension, Modification, Diagnosis)에서 최소 1개씩
   - 레포당 총 4~8개 태스크 생성
   - 각 태스크에 정답 기준(expected files, expected answer) 포함 — Lostness R값 산출에 사용
```

- [ ] **Step 3: Add Phase 2 (hooks + agent execution)**

```markdown
### Phase 2: Hooks Setup & Agent Execution

#### Hooks 세팅

벤치마크 실행 전 임시 hooks를 세팅하여 도구 호출 로그를 캡처한다.

\`\`\`bash
# 로그 파일 경로 (임시)
BENCHMARK_LOG="/tmp/agent-benchmark-$(date +%s).jsonl"
\`\`\`

hooks가 캡처해야 하는 데이터:
- 도구 이름 (Read, Grep, Glob, Edit, Write, Bash, Agent)
- 파라미터 (file_path, pattern, command 등)
- 타임스탬프
- 접근한 파일 경로 추출

#### 기본 모드: 단일 실행

태스크별로 서브에이전트를 실행한다.

\`\`\`
Agent tool 호출 시:
- isolation: "worktree"
- prompt: 태스크 프롬프트 (정답 기준은 포함하지 않음)
- 서브에이전트는 태스크만 수행하고 커밋하지 않음
\`\`\`

각 서브에이전트 실행 완료 후 hooks 로그에서 해당 세션의 도구 호출을 수집한다.

#### 고급 모드: A/B 비교 실행

사용자가 조건을 명시하면 A/B 모드로 진입한다.

1. 사용자가 두 조건을 정의 (예: "CLAUDE.md 있음 vs 없음")
2. worktree A: 조건 1 환경 세팅 (Bash로 파일 추가/제거)
3. worktree B: 조건 2 환경 세팅
4. 동일 태스크를 양쪽에서 실행 (각각 서브에이전트 + hooks)
5. 양쪽 로그를 수집하여 비교 리포트 생성
```

- [ ] **Step 4: Add Phase 3 (log collection + report)**

```markdown
### Phase 3: Log Collection & Report

1. **로그 파싱** — JSONL 로그에서 도구 호출 기록 추출
2. **지표 산출** — `references/metrics.md` 참조하여 9개 지표 계산
3. **등급 부여** — 각 지표에 Excellent/Good/Fair/Poor 등급
4. **종합 점수** — Agent Readiness Score (0-100) 산출
5. **터미널 출력** — `references/report-format.md` 참조
6. **선택적 내보내기** — 사용자가 JSON 또는 Markdown 출력을 요청하면 해당 포맷으로 출력
7. **정리** — hooks 제거, worktree 정리
```

- [ ] **Step 5: Add tools and red flags sections**

```markdown
---

## Tools

- `Glob`: 레포 구조 스캔, 파일 패턴 검색
- `Grep`: import/export 관계 수집, 에러 패턴 검색
- `Read`: 파일 내용 확인, 로그 파일 읽기
- `Bash`: git log, hooks 세팅/해제, worktree 관리, 로그 파일 관리
- `Agent`: 벤치마크 태스크 실행 서브에이전트, 레포 분석 보조

## Red Flags

| Thought | Reality |
|---------|---------|
| "레포가 작아서 벤치마크할 필요 없다" | 작은 레포도 환경 세팅 품질은 다를 수 있다 |
| "태스크 하나만 돌려보면 충분하다" | 카테고리별 최소 1개씩 4개는 필요하다 |
| "에이전트가 직접 도구 호출을 보고하면 된다" | 자기 보고는 누락 가능. hooks로 외부 캡처해야 한다 |
| "실제 레포에서 바로 수정 태스크를 돌려도 된다" | worktree isolation 필수. 실제 코드를 오염시키면 안 된다 |
| "점수가 낮으면 모델이 나쁜 것이다" | 이 벤치마크는 환경 품질을 측정한다. 모델 성능 측정이 아니다 |
| "hooks 로그가 없어도 대략 추정하면 된다" | 추정은 벤치마크가 아니다. 정확한 데이터 수집이 핵심 |
```

- [ ] **Step 6: Commit SKILL.md**

```bash
git add skills/agent-benchmark/SKILL.md
git commit -m "feat: add agent-benchmark SKILL.md with execution flow and hard gates"
```

---

### Task 2: Create references/metrics.md

**Files:**
- Create: `skills/agent-benchmark/references/metrics.md`

- [ ] **Step 1: Write tool classification and Navigability dimension**

파일 생성 후 도구 분류 기준과 첫 번째 차원을 작성한다:

1. **도구 분류 기준** — 어떤 도구 호출이 "탐색"이고 어떤 것이 "실행"인지
   - 탐색(orientation): Read, Grep, Glob, Bash(git/ls/find 명령)
   - 실행(execution): Edit, Write, Bash(그 외 명령)
   - 위임(delegation): Agent — 서브에이전트 내부 호출은 별도 추적

2. **Navigability (40%)** 섹션
   - Pathfinding Score: 공식 `1 - sqrt((N/S - 1)² + (R/N - 1)²)`, 변수 정의, 등급 기준
   - First Touch Rate: 공식 `(첫 3개 도구 호출 중 정답 파일 포함 수) / 3`, 등급 기준
   - Revisit Waste Rate: 공식 `(S - N) / S`, 등급 기준

- [ ] **Step 2: Write Cognitive Load and Task Effectiveness dimensions**

3. **Cognitive Load (35%)** 섹션
   - Focus Ratio: 공식 `(edit + write 호출) / (grep + read + glob 호출)`, 등급 기준
   - Warmup Cost: 정의, 등급 기준 (호출 수 기반)
   - Token Efficiency Rate: 공식 `실행 도구 토큰 / 전체 토큰`, 등급 기준

4. **Task Effectiveness (25%)** 섹션
   - Task Success Rate: 정답 기준 대비 달성률
   - Tool Call Count: 카운트, 태스크 복잡도 대비 등급
   - Speed Score: 시간 기반 정규화, 등급 기준

- [ ] **Step 3: Write grading criteria table and scoring formula**

5. **등급 기준 테이블**: 각 지표별 Excellent/Good/Fair/Poor 임계값

6. **종합 점수 산출**: Agent Readiness Score 계산법
   - 각 지표를 0-1로 정규화
   - 차원별 가중 평균 → 0-100 스케일링

- [ ] **Step 4: Commit metrics.md**

```bash
git add skills/agent-benchmark/references/metrics.md
git commit -m "feat: add metrics reference with formulas, grading criteria, and scoring"
```

---

### Task 3: Create references/task-templates.md

**Files:**
- Create: `skills/agent-benchmark/references/task-templates.md`

- [ ] **Step 1: Write repo analysis output schema**

파일 생성 후 레포 분석 결과 스키마를 작성한다:

1. **레포 분석 출력 스키마** — Phase 1에서 수집해야 하는 코드 요소 목록
   - `entry_points`: 진입점 파일 목록
   - `modules`: 모듈/패키지 경계 (디렉토리 + 핵심 파일)
   - `functions`: 주요 export 함수/클래스 목록
   - `dependencies`: import/require 관계 그래프
   - `error_patterns`: 에러 핸들링 패턴 (에러 클래스, throw/raise 위치)
   - `doc_assets`: CLAUDE.md, docs/, README 등 문서 목록

- [ ] **Step 2: Write category templates and binding rules**

2. **카테고리별 템플릿**
   - Discovery: 2~3개 템플릿 변형
   - Comprehension: 2~3개 템플릿 변형
   - Modification: 2~3개 템플릿 변형
   - Diagnosis: 2~3개 템플릿 변형

3. **바인딩 규칙** — 어떤 코드 요소를 어떤 템플릿 변수에 바인딩하는지
   - `{entry_point}` ← `entry_points[0]`
   - `{feature}` ← 가장 많은 파일을 가진 모듈의 추정 기능명
   - `{module_a}`, `{module_b}` ← dependencies에서 연결이 있는 두 모듈
   - `{function}` ← functions에서 파라미터가 있는 public 함수
   - `{error_pattern}` ← error_patterns에서 추출한 에러 클래스/메시지

- [ ] **Step 3: Write answer criteria and difficulty tiers**

4. **정답 기준 생성 규칙**
   - Discovery: 정답 파일 목록 = 해당 기능의 핵심 파일들 (의존 그래프에서 도출)
   - Comprehension: 정답 = 두 모듈 간 의존 파일 목록 + 기대되는 관계 설명
   - Modification: 정답 = 수정 대상 파일 + 수정 위치 + 기대되는 변경 내용
   - Diagnosis: 정답 = 에러 경로의 파일 목록 (호출 체인)

5. **태스크 난이도 산정 기준**
   - Easy: R값(최소 필요 파일) ≤ 3, 단일 모듈 내
   - Medium: R값 4~7, 2~3개 모듈 걸침
   - Hard: R값 ≥ 8, 4개 이상 모듈 또는 깊은 호출 체인

- [ ] **Step 4: Commit task-templates.md**

```bash
git add skills/agent-benchmark/references/task-templates.md
git commit -m "feat: add task templates with binding rules and answer criteria"
```

---

### Task 4: Create references/report-format.md

**Files:**
- Create: `skills/agent-benchmark/references/report-format.md`

- [ ] **Step 1: Write report format specifications**

이 파일은 터미널 출력, A/B 비교, JSON/Markdown 내보내기의 정확한 포맷을 정의한다.

내용 구성:
1. **터미널 출력 포맷**
   - 헤더: 프로젝트명 + git commit hash
   - 3개 차원별 섹션: 지표명, 수치, 바 차트, 등급
   - 종합 점수: Agent Readiness Score
   - Task Breakdown: 태스크별 요약
   - 바 차트 렌더링 규칙: `█` 10칸 기준 비율 표시

2. **A/B 비교 출력 포맷**
   - 조건 A/B 레이블 표시
   - 주요 지표 나란히 비교 + 변화율(%) 표시

3. **JSON 내보내기 스키마**
   - 메타데이터: project, commit, timestamp, mode
   - tasks: 태스크별 상세 (prompt, expected, actual, tool_calls)
   - metrics: 9개 지표 수치 + 등급
   - score: Agent Readiness Score
   - A/B 모드 시: conditions, comparison 추가

4. **Markdown 내보내기 포맷**
   - 파일 경로: `docs/benchmarks/YYYY-MM-DD-report.md`
   - 터미널 출력과 동일한 구조를 Markdown 테이블로 변환

- [ ] **Step 2: Commit report-format.md**

```bash
git add skills/agent-benchmark/references/report-format.md
git commit -m "feat: add report format specs for terminal, JSON, and Markdown output"
```

---

## Chunk 2: Integration & Finalization

### Task 5: Update README.md

**Files:**
- Modify: `README.md:6-9` (Skills 테이블)

- [ ] **Step 1: Add agent-benchmark to Skills table**

```markdown
## Skills

| Skill | Description |
|-------|-------------|
| **garden-docs** | Document gardening — verify docs match code, maintain knowledge base structure, CLAUDE.md authoring |
| **agent-benchmark** | Agent benchmark — measure agent task performance, evaluate environment setup quality, A/B comparison |
```

- [ ] **Step 2: Commit README.md update**

```bash
git add README.md
git commit -m "docs: add agent-benchmark to skills table in README"
```

---

### Task 6: Update plugin.json keywords

**Files:**
- Modify: `.claude-plugin/plugin.json:10` (keywords)

- [ ] **Step 1: Add benchmark keywords**

```json
"keywords": ["skills", "documentation", "gardening", "knowledge-base", "claude-md", "benchmark", "agent-evaluation", "metrics"]
```

- [ ] **Step 2: Commit plugin.json update**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: add benchmark keywords to plugin.json"
```

---

### Task 7: Verify skill structure

- [ ] **Step 1: Verify file existence and structure**

```bash
# 모든 파일이 존재하는지 확인
ls -la skills/agent-benchmark/SKILL.md
ls -la skills/agent-benchmark/references/metrics.md
ls -la skills/agent-benchmark/references/task-templates.md
ls -la skills/agent-benchmark/references/report-format.md
```

Expected: 4개 파일 모두 존재

- [ ] **Step 2: Verify SKILL.md frontmatter**

```bash
head -4 skills/agent-benchmark/SKILL.md
```

Expected: YAML frontmatter에 `name: agent-benchmark`과 `description:` 포함

- [ ] **Step 3: Verify all references/ files are referenced from SKILL.md**

```bash
grep -c "references/" skills/agent-benchmark/SKILL.md
```

Expected: 3 이상 (metrics.md, task-templates.md, report-format.md 각각 참조)

- [ ] **Step 4: Verify README.md lists the new skill**

```bash
grep "agent-benchmark" README.md
```

Expected: Skills 테이블에 agent-benchmark 행 존재

- [ ] **Step 5: Verify plugin.json keywords updated**

```bash
grep "benchmark" .claude-plugin/plugin.json
```

Expected: keywords 배열에 "benchmark" 포함
