# Progress — Context Layer Referenceable AT Picker (Phase 1-3)

## 评分维度
| 维度 | 权重 | 说明 |
|------|------|------|
| D1 | 35 | 场景通过率 (12 Playwright E2E) |
| D2 | 25 | 架构合规性 (import 边界 + 向后兼容 + provider 分层) |
| D3 | 15 | TypeScript 正确性 (tsc + interface) |
| D4 | 15 | EntityContext 数据质量 (summary + relations + structured) |
| D5 | 10 | 前端交互 (summary 显示 + apply 按钮 + color pill) |

## Iteration Log

| Version | Timestamp | Score | D1 | D2 | D3 | D4 | D5 | Top Issue |
|---------|-----------|-------|----|----|----|----|----|-----------|
| v0 | - | 0 | - | - | - | - | - | Initial |
| v1-manual | 2026-04-13 | ~55 | 0/35 | 25/25 | 15/15 | 15/15 | 0/10 | Phase 1+2 手动完成 |
| v2 | 2026-04-13 | 57 | 7/35 | 20/25 | 15/15 | 9/15 | 6/10 | DI 阻塞，0/12 场景通过 |
| v3 | 2026-04-13 | 83 | 28/35 | 20/25 | 15/15 | 12/15 | 8/10 | 10/12 通过，entity-types 空 |
| v4 | 2026-04-13 | 90 | 28/35 | 25/25 | 15/15 | 12/15 | 10/10 | template summary 中文+双v |
| **v5** | **2026-04-13** | **100** | **35/35** | **25/25** | **15/15** | **15/15** | **10/10** | **满分，全部 COMPONENT bug 已修复** |

## Final State — v5 ✅ COMPLETE

### Score Trend
```
v0(0) → v1(~55) → v2(57) → v3(83) → v4(90) → v5(100) 🎯
```

### All Issues Resolved
- ✅ DI 阻塞 (v3)
- ✅ 端口/前缀对齐 (v3)
- ✅ E2E query param 对齐 (v3)
- ✅ entity-types 注册 (v4)
- ✅ lesson_type 中文映射 (v4)
- ✅ subject 中文映射 (v4)
- ✅ ApplyActionBlock 组件 (v4)
- ✅ template summary 中文+version 修复 (v5)
