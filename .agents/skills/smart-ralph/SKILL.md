---
name: smart-ralph
description: >-
  Spec-driven development and autonomous task-by-task execution engine.
  Transforms complex feature requests into structured specifications
  (research, requirements, design, tasks) before execution. Executes
  task-by-task with verification gates, test-driven validation, and clean
  state tracking. Use when planning complex features, large refactors, or
  multi-step implementations.
---

# Smart Ralph — Spec-Driven Autonomous Engine

Smart Ralph turns feature requests into structured specifications, then executes
them one task at a time with clean context and continuous verification gates.

## The Spec Workflow

For any non-trivial feature or multi-file architectural change:

```
[Feature Request]
       │
       ▼
   Research   ─── Inspect codebase, understand existing APIs, verify constraints
       │
       ▼
 Requirements ─── User stories, acceptance criteria, boundaries, error paths
       │
       ▼
    Design    ─── Architecture, file changes, data schema, UI interactions
       │
       ▼
    Tasks     ─── Incremental, ordered, POC-first task breakdown
       │
       ▼
  Execution   ─── Task-by-task execution with automated verification
```

## Task Execution Phases

For each task in the plan, follow the 4 execution gates:

1. **Phase 1: Make It Work (POC / Core)**
   Implement the minimum viable mechanism that accomplishes the task objective.
2. **Phase 2: Refactor & Clean**
   Apply the Ponytail Necessity Ladder. Remove redundant abstractions, clean up
   dead paths, adhere to existing naming and module patterns.
3. **Phase 3: Automated Verification & Testing**
   Run the test suite or verify the runtime artifact immediately. Zero broken tests.
4. **Phase 4: Quality Gate & Status Sync**
   Check off completed task, verify git diff, and document status before advancing
   to the next task.

## Execution Rules

- **Fresh Context per Task:** Don't drag unneeded debug history between tasks.
- **Fail-Fast Gates:** If any verification step fails, stop and fix immediately before continuing.
- **Artifact Traceability:** Update the task plan document as tasks transition from pending to completed.
