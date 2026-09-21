---
name: headroom
description: >-
  Context window optimization and intelligent token reduction using the Headroom
  MCP engine. Compress conversation history, large files, command outputs, and
  debug logs into dense semantic packages, and retrieve them on-demand. Use when
  dealing with large file edits, long task sequences, token limits, or context
  compaction.
---

# Headroom — Context & Token Optimization

Headroom keeps the agent's context window lean, fast, and high-signal by
compressing large outputs, documents, and historical logs into compact,
retrievable tokens.

## Available MCP Tools

- `headroom_compress`: Compresses text or large payload into a compact tokenized format.
- `headroom_retrieve`: Decompresses or retrieves specific sections from a compressed block.
- `headroom_stats`: Checks active token savings, compression ratios, and cache metrics.

## When to Use Headroom

1. **Massive File Reads:** When inspecting logs or data files exceeding 2,000 lines, compress or slice with Headroom instead of dumping raw text into the context.
2. **Multi-Step Refactors:** Between major tasks, compress the verbose intermediate outputs while preserving key decision invariants.
3. **Session Compaction:** Before long-running background tasks or multi-agent delegations, check `headroom_stats` to ensure optimal context headroom.
