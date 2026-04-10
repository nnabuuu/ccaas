# Progress — AskUserQuestion Wizard Harness

| Version | Timestamp | Score | D1 | D2 | D3 | D4 | D5 | D6 | Penalties | Top Issue |
|---------|-----------|-------|----|----|----|----|----|----|-----------|-----------|
| v0 | 2026-04-02 | — | — | — | — | — | — | — | — | 架构已实现，未经 E2E 验证 |
| v1 (est) | 2026-04-02 | ~45 | 3 | 3 | 3 | 3 | 2 | 2 | 0 | Wizard path not triggered (LLM uses default AskUserQuestion) |
| v1 (eval) | 2026-04-02 | 69 | 3 | 3 | 4 | 4 | 4 | 3 | 0 | LLM resume after control_response not visually confirmed |
| v1 | 2026-04-02 15:16 | 69 |  |  |  |  |  |  | 0 |  |
| v2 (est) | 2026-04-02 | ~75 | 3 | 3 | 5 | 4 | 5 | 3 | 0 | LLM resume content still not captured (latency, not data flow) |
| v2 (eval) | 2026-04-02 | 75 | 3 | 3 | 5 | 4 | 5 | 3 | 0 | LLM resume after control_response — latency or failure (>4 min, no output) |
| v2 | 2026-04-02 16:08 | 75 |  |  |  |  |  |  | 0 |  |
| v3 (est) | 2026-04-02 | ~94 | 5 | 3 | 5 | 5 | 5 | 5 | 0 | D2 default UI not specifically browser-tested |
| v3 (eval) | 2026-04-02 | 86 | 4 | 3 | 5 | 5 | 5 | 4 | 0 | Browser message-send failed; D1/D6 could not be independently verified |
| v3 | 2026-04-02 | 86 |  |  |  |  |  |  | 0 |  |
| v3 | 2026-04-02 16:43 | 86 |  |  |  |  |  |  | 0 |  |
| v4 (est) | 2026-04-02 | ~97 | 5 | 4 | 5 | 5 | 5 | 5 | 0 | SKILL.md fix for double AskUserQuestion |
| v4 (eval) | 2026-04-02 | 89 | 5 | 4 | 5 | 5 | 5 | 3 | 0 | Double AskUserQuestion persists — SKILL.md fix not applied at runtime |
| v4 | 2026-04-02 17:54 | 89 |  |  |  |  |  |  | 0 |  |
| v4 | 2026-04-02 17:22 | 89 |  |  |  |  |  |  | 0 |  |
| v5 (est) | 2026-04-02 | ~95 | 5 | 4 | 5 | 5 | 5 | 5 | 0 | D2 default UI still incidental observation only |
| v5 (eval) | 2026-04-02 | 97 | 5 | 4 | 5 | 5 | 5 | 5 | 0 | D2 default UI not independently triggered (4/5); all other dimensions 5/5 |
| v5 | 2026-04-02 20:05 | 97 |  |  |  |  |  |  | 0 |  |
| v5 | 2026-04-02 19:02 | 97 | 5/5 | 4/5 | 5/5 | 5/5 | 5/5 | 5/5 | 0 |  |
