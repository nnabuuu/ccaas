# Eval Criteria — Context Layer @ Reference Picker

## 评分维度

| # | 维度 | 权重 | 检测方法 |
|---|------|------|---------|
| D1 | 场景通过率 | 35/100 | Playwright E2E: `passed / 13 * 35` |
| D2 | 架构合规性 | 30/100 | 静态分析 import 边界 + 分包结构 + decorator 实现 |
| D3 | TypeScript 正确性 | 15/100 | `tsc --noEmit` 零错误 + interface 与设计文档对齐 |
| D4 | 性能 SLA | 8/100 | suggest < 50ms, search debounce, drill-down < 200ms |
| D5 | 前端交互质量 | 8/100 | picker 弹出流畅、面包屑正确、ref pill 正确显示 |
| D6 | 代码规范 | 4/100 | CCAAS conventions、无冗余、ESLint |

## 维度详情

### D1: 场景通过率 (35/100)

- **5/5 (35分)**: 13/13 场景全部通过
- **4/5 (28分)**: 11-12/13 场景通过
- **3/5 (21分)**: 9-10/13 场景通过，失败的不涉及核心交互
- **2/5 (14分)**: 7-8/13 场景通过
- **1/5 (7分)**: < 7/13 场景通过

**检测方法**: `npx playwright test --reporter=json` → 解析 passed/failed

### D2: 架构合规性 (30/100)

- **5/5 (30分)**: 完美分层
  - core/ 零 NestJS import
  - nestjs/ 只调 core 接口
  - client/ 独立
  - context-layer-react 只依赖 client
  - chat-interface 只添加新文件
  - mock solution 完全独立
- **4/5 (24分)**: 基本正确，1 处轻微越界（如 core 里用了 NestJS type-only import）
- **3/5 (18分)**: 1-2 处越界但不影响运行时
- **2/5 (12分)**: 分层有问题但核心思路正确
- **1/5 (6分)**: 分层混乱

**检测方法**:
```bash
# P1: core 不得 import NestJS
grep -r "from '@nestjs" packages/context-layer/src/core/
# 必须为空

# P2: 不修改 Composer
git diff --name-only packages/chat-interface/src/components/chat/ChatInterfaceComposer.tsx
# 必须无输出

# P3: mock 不依赖 edu-platform
grep -r "from '.*edu-platform" solutions/mock/context-layer-demo/
# 必须为空

# P5: Decorator 检查
# @Referenceable 和 @Tracked 函数体内只有 SetMetadata 调用
```

### D3: TypeScript 正确性 (15/100)

- **5/5 (15分)**: `tsc --noEmit` 零错误；所有 interface 与设计文档 Section 3/7 完全对齐
  - ReferenceableOptions, ActivityRecord, EntityTypesResponse, SuggestResponse, BrowseResponse, SearchResponse, ResolveResponse
- **4/5 (12分)**: 零 tsc 错误；interface 基本对齐但有 1-2 处字段差异
- **3/5 (9分)**: < 5 个 tsc 错误且不涉及 public API
- **2/5 (6分)**: 5-10 个 tsc 错误
- **1/5 (3分)**: > 10 个 tsc 错误或 public interface 与设计文档严重不符

**检测方法**:
```bash
cd packages/context-layer && npx tsc --noEmit 2>&1 | wc -l
cd packages/context-layer-react && npx tsc --noEmit 2>&1 | wc -l
cd solutions/mock/context-layer-demo && npx tsc --noEmit 2>&1 | wc -l
```

### D4: 性能 SLA (8/100)

- **5/5 (8分)**: suggest API < 50ms; search 有 200ms debounce; drill-down browse < 200ms
- **4/5 (6.4分)**: suggest < 100ms; 有 debounce
- **3/5 (4.8分)**: suggest < 200ms; debounce 时间不精确
- **2/5 (3.2分)**: 功能可用但明显卡顿
- **1/5 (1.6分)**: suggest > 200ms 或无 debounce

**检测方法**: E2E 中使用 `performance.now()` 或 `Date.now()` 测量 API 响应时间

### D5: 前端交互质量 (8/100)

- **5/5 (8分)**: picker 弹出有过渡动画；面包屑逐级正确；ref pill 显示 icon + displayName + ×；多 pill 并排
- **4/5 (6.4分)**: 功能完整但细节有瑕疵
- **3/5 (4.8分)**: 功能正确但无动画；面包屑偶有错误
- **2/5 (3.2分)**: 基本可用但视觉不佳
- **1/5 (1.6分)**: picker 弹出但交互卡顿或视觉残缺

**检测方法**: Playwright 截图 + DOM 结构断言

### D6: 代码规范 (4/100)

- **5/5 (4分)**: CCAAS 命名规范；Controller 有 `@ApiTags`；无 TODO/FIXME；无冗余
- **4/5 (3.2分)**: 1 处规范违反
- **3/5 (2.4分)**: 2-3 处违反
- **2/5 (1.6分)**: 明显不遵循规范
- **1/5 (0.8分)**: 大量违反

**检测方法**: 手动审查 + ESLint

## Penalty 规则

| ID | 级别 | 触发条件 | 影响 |
|----|------|---------|------|
| P1 | 致命 | core/ 下 import `@nestjs/*` | D2 直接 0/30 |
| P2 | 致命 | 修改 ChatInterfaceComposer.tsx 现有代码 | D2 直接 0/30 |
| P3 | 致命 | mock solution import edu-platform 代码 | D2 直接 0/30 |
| P4 | 严重 | API response schema 与设计文档不符 | D3 -5 |
| P5 | 一般 | decorator 内含运行时逻辑 | D2 -10 |

## 阈值

- **合格**: 65/100（至少 9/13 场景 + 架构基本合规 + 零 tsc 错误）
- **目标**: 90/100（13/13 场景 + 完美架构 + 性能达标）

## 评分输出格式

Evaluator 必须按以下格式输出最终分数（harness.sh 通过正则提取）：

```
总分: XX/100
```

完整评估报告写入 `eval-reports/v{N}-eval.md`。
