---
name: agentmemory
description: >-
  Persistent cross-session memory and continuous learning engine using the
  AgentMemory MCP server. Store architectural decisions, bugfix lessons, user
  preferences, and release milestones. Recall relevant context before starting
  tasks so mistakes are never repeated and past knowledge is immediately applied.
---

# AgentMemory — Cross-Session Memory & Learning

AgentMemory connects the agent to a persistent local memory graph at `http://localhost:3111`,
retaining key knowledge across sessions, restarts, and workspaces.

## Key MCP Tools & Workflows

1. **Lesson Learning (`memory_lesson_save` / `memory_save`)**
   - Whenever a non-obvious bug or runtime crash is resolved (e.g. React hook order errors, Android manifest issues, build errors), record the root cause and resolution immediately.
   - Tag with relevant keywords (e.g. `[bugfix, react, capacitor, android]`).

2. **Context Recall (`memory_recall`)**
   - At the beginning of a feature or debugging session, query AgentMemory for related lessons, schemas, and user directives.

3. **Milestone Snapshots (`memory_save` / `memory_snapshot_create`)**
   - After compiling and publishing releases (e.g. v1.0.30, v1.0.31), record the release version, checksum, and changelog for instant future lookup.

4. **Reflective Synthesis (`memory_reflect`)**
   - Summarize multi-step workflows into distilled principles to continuously improve efficiency.
