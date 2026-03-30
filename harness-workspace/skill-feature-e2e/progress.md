# Progress Log — Skill Toggle E2E

## Task
修复 Skill toggle 完整链路：toast 时序、auth 前置检查、error 反馈、状态持久

## Known Bugs at Start
1. Toast fires before API response (sync instead of await)
2. No auth pre-check (silent 403 when not logged in)
3. Error only in panel header, not near action

## Iterations

| Version | Timestamp | Score | D1 Auth(20) | D2 Toggle(25) | D3 Error(20) | D4 Data(15) | D5 Code(20) | Top Issue |
|---------|-----------|-------|-------------|---------------|--------------|-------------|-------------|-----------|
| v0 | (baseline) | ~20 | 0 | ~10 | 0 | ~10 | 0 | All 3 bugs present |
| v1 | 2026-03-31 03:50 | 100 | 20/20 | 25/25 | 20/20 | 15/15 | 20/20 | see eval report |
