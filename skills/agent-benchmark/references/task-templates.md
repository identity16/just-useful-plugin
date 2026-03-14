# Task Templates Reference

This document defines the structured templates used by the agent-benchmark skill to generate repository-specific benchmark tasks. It covers the repo analysis output schema, category templates, variable binding rules, answer criteria generation, difficulty tiers, and task selection strategy.

---

## 1. Repo Analysis Output Schema

Phase 1 (repo analysis) must produce structured output conforming to the following schema. The benchmark runner uses this output to bind template variables and generate concrete tasks.

```
{
  entry_points: [
    // List of file paths matching main.*, index.*, app.*, server.*
    // These are the primary entry points into the application.
    "src/index.ts",
    "src/server.ts"
  ],

  modules: [
    // Top-level directories treated as module boundaries.
    // Each module lists its key files (by importance or size).
    {
      name: "auth",
      path: "src/auth",
      key_files: ["src/auth/login.ts", "src/auth/middleware.ts"]
    }
  ],

  functions: [
    // Public/exported functions discovered during analysis.
    // Only functions with explicit exports are included.
    {
      name: "validateUser",
      file: "src/auth/login.ts",
      exported: true,
      params: ["email", "password"]
    }
  ],

  dependencies: [
    // Import/require relationships between modules.
    // Each entry represents a directed edge in the dependency graph.
    {
      from_module: "auth",
      to_module: "database",
      import_paths: ["src/auth/login.ts -> src/database/users.ts"]
    }
  ],

  error_patterns: [
    // Throw/raise/catch/Error patterns found in the codebase.
    {
      type: "ValidationError",
      file: "src/auth/login.ts",
      line: 42,
      pattern: "throw new ValidationError('Invalid email format')"
    }
  ],

  doc_assets: [
    // Documentation files discovered during scan.
    {
      type: "claude_md",
      path: "CLAUDE.md"
    },
    {
      type: "readme",
      path: "README.md"
    },
    {
      type: "docs",
      path: "docs/architecture.md"
    },
    {
      type: "agents_md",
      path: "AGENTS.md"
    }
  ]
}
```

### Notes on Analysis

- `entry_points` are detected by filename convention: `main.*`, `index.*`, `app.*`, `server.*`. If multiple exist, they are ordered by directory depth (shallowest first).
- `modules` are derived from top-level subdirectories under the source root. Flat repos with no subdirectories use the root as a single module.
- `functions` only includes exported/public functions. Internal helpers are excluded to keep the schema manageable.
- `dependencies` captures inter-module edges only. Intra-module imports are not tracked.
- `error_patterns` captures explicit error construction or throwing. Patterns are detected via regex matching on `throw`, `raise`, `new Error`, `new \w+Error`, `catch`, `except`.

---

## 2. Category Templates

Each category has 2-3 template variants. Template variables are enclosed in `{}` and are bound from the repo analysis output (see Section 3).

### Discovery (탐색)

Tasks that require the agent to locate specific code within the repository.

**Template D-1: Feature Trace**
```
"{entry_point}에서 시작해서 {feature} 기능의 핵심 로직을 찾아라"
```
- Purpose: Trace from an entry point to the core logic of a feature.
- Expected skill: File navigation, import following, call chain traversal.

**Template D-2: Public API Enumeration**
```
"{module} 모듈의 public API를 모두 나열해라"
```
- Purpose: Enumerate all exported interfaces of a module.
- Expected skill: Export detection, interface/type listing.

**Template D-3: Config Source Location**
```
"{config_pattern}과 관련된 설정이 어디에서 로드되는지 찾아라"
```
- Purpose: Find where configuration values are loaded and consumed.
- Expected skill: Config file detection, environment variable tracing.

### Comprehension (이해)

Tasks that require the agent to understand and explain code relationships.

**Template C-1: Dependency Explanation**
```
"{module_a}와 {module_b}의 의존 관계를 설명해라"
```
- Purpose: Explain the dependency relationship between two modules.
- Expected skill: Import graph analysis, interface boundary understanding.

**Template C-2: Data Flow Trace**
```
"데이터가 {entry_point}에서 {module}까지 어떤 경로로 전달되는지 추적해라"
```
- Purpose: Trace the data flow path from an entry point to a target module.
- Expected skill: Call chain analysis, parameter threading, data transformation tracking.

**Template C-3: Architecture Summary**
```
"{module}의 아키텍처를 요약하고 핵심 컴포넌트를 나열해라"
```
- Purpose: Produce a structural summary of a module's architecture.
- Expected skill: Code structure understanding, component identification.

### Modification (수정)

Tasks that require the agent to make specific code changes.

**Template M-1: Parameter Validation**
```
"{function}에 {param_type} 검증을 추가해라"
```
- Purpose: Add input validation logic to an existing function.
- Expected skill: Function signature analysis, validation pattern matching, test awareness.

**Template M-2: Entity Addition**
```
"{module}에 새로운 {entity} 모델/타입을 추가해라"
```
- Purpose: Add a new model or type definition following existing patterns.
- Expected skill: Pattern recognition, convention following, type system understanding.

**Template M-3: Error Handling Improvement**
```
"{function}의 에러 핸들링을 개선하여 {error_type}을 잡아라"
```
- Purpose: Improve error handling to catch a specific error type.
- Expected skill: Error propagation understanding, try-catch placement, error type hierarchy.

### Diagnosis (진단)

Tasks that require the agent to identify and explain potential issues.

**Template G-1: Error Path Trace**
```
"{error_pattern}이 발생하는 코드 경로를 추적해라"
```
- Purpose: Trace the code path that leads to a specific error.
- Expected skill: Error origin identification, call stack reconstruction.

**Template G-2: Failure Cause Analysis**
```
"{function}이 {condition}일 때 실패하는 원인을 찾아라"
```
- Purpose: Identify why a function fails under a specific condition.
- Expected skill: Edge case analysis, null/boundary value reasoning.

**Template G-3: Circular Dependency Detection**
```
"{module}에서 발생할 수 있는 순환 의존성을 찾아라"
```
- Purpose: Detect potential circular dependencies originating from a module.
- Expected skill: Dependency graph traversal, cycle detection.

---

## 3. Binding Rules

These rules define how repo analysis output maps to template variables. The benchmark runner applies these bindings to produce concrete task prompts.

| Variable | Source | Binding Logic |
|---|---|---|
| `{entry_point}` | `entry_points[0]` | Primary entry point (shallowest file). |
| `{feature}` | `modules` | Module with the most files. Feature name is inferred from the directory name (e.g., `src/auth` -> "auth", `src/payment` -> "payment"). |
| `{module}` | `modules[*].name` | Any module with at least 2 key files. Prefer modules with outgoing dependency edges. |
| `{module_a}`, `{module_b}` | `dependencies[*]` | A pair of modules with a dependency connection between them. Select a pair where `from_module` != `to_module`. |
| `{function}` | `functions` where `exported=true` and `len(params) > 0` | Prefer functions with 2+ parameters for richer validation tasks. |
| `{param_type}` | Inferred from `functions[*].params` names | Heuristic mapping: `"email"` -> `"email format"`, `"url"` -> `"URL format"`, `"age"` -> `"numeric range"`, `"name"` -> `"string length"`, `"id"` -> `"non-empty string"`, `"password"` -> `"password strength"`. Default: `"non-null"`. |
| `{error_pattern}` | `error_patterns[*].type` | The error class/type name (e.g., `"ValidationError"`, `"NotFoundError"`). |
| `{error_type}` | `error_patterns[*].pattern` | The full error expression (e.g., `"throw new ValidationError('...')"`). |
| `{config_pattern}` | Config files found during scan | Files matching `*.config.*`, `.env*`, `config/*`, `settings.*`. Use the basename without extension as the pattern name. |
| `{entity}` | Inferred from existing model/type patterns | Scan for files named `*.model.*`, `*.entity.*`, `*.type.*`, or directories named `models/`, `entities/`, `types/`. Infer a plausible new entity name from the domain (e.g., if `User` and `Product` exist, suggest `Order`). |
| `{condition}` | Inferred from function params | Edge case heuristics: params that could be `null`, empty string, zero, negative, or boundary values. E.g., `"email"` -> `"null"`, `"count"` -> `"0"`, `"items"` -> `"empty array"`. |

### Binding Priority

When multiple candidates exist for a variable, the runner should prefer:
1. Candidates that produce tasks spanning more files (higher R value).
2. Candidates from modules with richer dependency connections.
3. Candidates that avoid overlap with already-selected tasks.

---

## 4. Answer Criteria Generation Rules

For each category, the benchmark defines how to generate the expected answer (ground truth) used for scoring. `R` denotes the number of relevant files the agent should reference or touch.

### Discovery

- **expected_files**: Files in the feature's call chain starting from the entry point. Derived by walking the dependency graph from `entry_point` through import edges until reaching the feature module's key files.
- **R** = `len(expected_files)`
- **Scoring basis**: Did the agent identify the correct files in the call chain? Partial credit for subset matches.

### Comprehension

- **expected_files**: Files at the boundary between `module_a` and `module_b`. These are files containing import edges that cross the module boundary.
- **Expected answer**: A textual description of the relationship (direction of dependency, what is imported, coupling level).
- **R** = `len(expected_files)`
- **Scoring basis**: Did the agent correctly identify the boundary files and accurately describe the dependency direction and nature?

### Modification

- **expected_files**: The file(s) to modify plus their corresponding test file(s). Test files are located by convention: `*.test.*`, `*.spec.*`, `__tests__/*`.
- **Expected changes**: Specific code additions (validation logic, type definitions, error handling blocks).
- **R** = `len(expected_files)`
- **Scoring basis**: Did the agent modify the correct files? Are the changes syntactically valid and semantically correct? Were tests updated?

### Diagnosis

- **expected_files**: Files in the error propagation path. Traced from the `throw`/`raise` site through callers up to the nearest `catch`/`except` handler (or the entry point if unhandled).
- **R** = `len(expected_files)`
- **Scoring basis**: Did the agent correctly identify the error origin, propagation path, and root cause?

---

## 5. Task Difficulty Tiers

Difficulty is determined by `R` (number of relevant files) and the scope of modules involved.

| Tier | R Value | Module Scope | Description |
|---|---|---|---|
| **Easy** | R <= 3 | Single module | Task is contained within one module. Requires navigating a small number of files with straightforward relationships. |
| **Medium** | R = 4-7 | 2-3 modules | Task spans multiple modules. Requires understanding cross-module dependencies and data flow. |
| **Hard** | R >= 8 | 4+ modules | Task spans many modules or involves deep call chains. Requires comprehensive codebase understanding. |

### Difficulty Adjustment

- If a repo has fewer than 5 modules, the Hard tier threshold drops to R >= 6.
- If a repo has fewer than 20 files total, all tiers shift down: Easy R <= 2, Medium R = 3-4, Hard R >= 5.

---

## 6. Task Selection Strategy

The benchmark runner uses the following strategy when selecting tasks from the generated candidate pool.

### Minimum Requirements

- At least **1 task per category** (4 minimum total).
- Each selected task must have **R >= 2** (tasks with R < 2 are too trivial to produce meaningful measurements).

### Diversity Rules

- **Difficulty mix**: Select tasks with varying difficulty. Ideal distribution: 1 Easy, 2 Medium, 1 Hard (for a 4-task run).
- **Template variety**: Avoid selecting the same template variant twice unless no alternatives exist.
- **Module coverage**: Prefer tasks that collectively cover more of the codebase's modules.

### Caps and Limits

- **Maximum 8 tasks** total to keep benchmark runtime reasonable.
- For a full run (8 tasks), target: 2 per category with mixed difficulty.

### Small Repo Adjustment

When the repo has fewer than 20 files:
- Reduce to **4 tasks** (1 per category).
- Lower R expectations (see difficulty adjustment above).
- Skip Template D-1 (feature trace) if only 1 module exists.
- Skip Template G-3 (circular dependency) if fewer than 3 modules exist.

### Selection Algorithm

```
1. Generate all candidate tasks by applying binding rules to templates.
2. Filter out candidates with R < 2.
3. For each category, sort candidates by R (descending) to prefer harder tasks.
4. Select 1 candidate per category (ensuring at least 1 Easy if available).
5. If budget allows (< 8 tasks), add more candidates prioritizing:
   a. Categories with only 1 task selected.
   b. Uncovered difficulty tiers.
   c. Uncovered modules.
6. Final validation: ensure no two tasks share identical expected_files sets.
```
