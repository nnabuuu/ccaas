# Eval Criteria — Context Layer Referenceable AT Picker (Phase 1-3)

## 评分维度

| # | 维度 | 权重 | 检测方法 |
|---|------|------|---------|
| D1 | 场景通过率 | 35/100 | Playwright E2E: `passed / 12 * 35` |
| D2 | 架构合规性 | 25/100 | 静态分析 import 边界 + provider 分层 + 向后兼容 |
| D3 | TypeScript 正确性 | 15/100 | `tsc --noEmit` 零错误 + interface 与设计文档对齐 |
| D4 | EntityContext 数据质量 | 15/100 | summary ≤100 字、relations 正确、structured 完整 |
| D5 | 前端交互 | 10/100 | summary 显示、apply 按钮、color pill |

## 维度详情

### D1: 场景通过率 (35/100)

- **5/5 (35分)**: 12/12 场景全部通过
- **4/5 (28分)**: 10-11/12 场景通过
- **3/5 (21分)**: 8-9/12 场景通过
- **2/5 (14分)**: 6-7/12 场景通过
- **1/5 (7分)**: < 6/12 场景通过

**检测方法**: `npx playwright test --reporter=json` → 解析 passed/failed

### D2: 架构合规性 (25/100)

- **5/5 (25分)**: 完美分层
  - core/ 零 NestJS import
  - 现有 7 个端点 response 不变（向后兼容）
  - provider 注册在 solution 层（ReferenceableModule）
  - DB schema 零修改
  - 现有 entity/service 源文件未修改
- **4/5 (20分)**: 基本正确，1 处轻微越界
- **3/5 (15分)**: 1-2 处越界但不影响运行时
- **2/5 (10分)**: 分层有问题但核心思路正确
- **1/5 (5分)**: 分层混乱

**检测方法**:
```bash
# P1: core 不得 import NestJS
grep -rn "from '@nestjs" packages/context-layer/src/core/
# 必须为空

# P2: 现有端点向后兼容验证
curl -s http://localhost:3001/context/entity-types | jq 'keys'
# 必须包含 "types" 和 "tree"
curl -s http://localhost:3001/context/suggest | jq 'keys'
# 必须包含 "recents"
curl -s "http://localhost:3001/context/browse?type=lesson_plan" | jq 'keys'
# 必须包含 "items" 和 "breadcrumb"
curl -s "http://localhost:3001/context/search?q=SAS" | jq 'keys'
# 必须包含 "results"

# P3: 现有 entity/service 未修改
git diff --name-only solutions/business/edu-platform/backend/src/lesson-plan/
git diff --name-only solutions/business/edu-platform/backend/src/template/
git diff --name-only solutions/business/edu-platform/backend/src/curriculum/
# 必须无输出（或仅 app.module.ts 变更）

# P5: Provider 在 solution 层
ls solutions/business/edu-platform/backend/src/referenceable/providers/
# 必须存在 lesson-plan.provider.ts, template.provider.ts, requirement.provider.ts
```

### D3: TypeScript 正确性 (15/100)

- **5/5 (15分)**: `tsc --noEmit` 零错误；新增 interface 与设计文档完全对齐
  - AtReference（type, id, display_name, summary）
  - EntityContext（ref, structured, relations, attachments）
  - EntityAttachment（name, path, mime_type, size_bytes）
  - ApplyAction（id, target, field_path, suggested_value, description, status, applied_at?）
  - EntityContextProvider（getContext, search, apply?）
  - ApplyRequest（entity_id, field_path, suggested_value, action_description, session_id）
- **4/5 (12分)**: 零 tsc 错误；interface 基本对齐但 1-2 处字段差异
- **3/5 (9分)**: < 5 个 tsc 错误且不涉及 public API
- **2/5 (6分)**: 5-10 个 tsc 错误
- **1/5 (3分)**: > 10 个 tsc 错误或 public interface 与设计文档严重不符

**检测方法**:
```bash
cd packages/context-layer && npx tsc --noEmit 2>&1 | wc -l
cd packages/context-layer-react && npx tsc --noEmit 2>&1 | wc -l
cd solutions/business/edu-platform/backend && npx tsc --noEmit 2>&1 | wc -l
```

### D4: EntityContext 数据质量 (15/100)

- **5/5 (15分)**:
  - LessonPlan summary ≤100 字，包含 class + subject + lesson_type 信息
  - LessonPlan relations 包含关联 requirement 的 AtRef（如果 requirement_id 存在）
  - Template structured 包含 block_summary
  - Requirement structured 包含 name, level, subject, grade_range
  - 所有 summary 非空
- **4/5 (12分)**: summary 正确但 relations 缺漏 1-2 个
- **3/5 (9分)**: summary 存在但超过 100 字或信息不全
- **2/5 (6分)**: EntityContext 返回但结构不完整
- **1/5 (3分)**: EntityContext 端点不可用

**检测方法**:
```bash
# LessonPlan EntityContext
curl -s http://localhost:3001/context/entity/lesson_plan/{id} | jq '.ref.summary | length'
# 必须 <= 100

curl -s http://localhost:3001/context/entity/lesson_plan/{id} | jq '.relations[] | select(.type == "requirement")'
# 如果 lesson_plan 有 requirement_id，必须有结果

# Template EntityContext
curl -s http://localhost:3001/context/entity/template/{id} | jq '.structured | keys'
# 必须包含 block_summary

# Requirement EntityContext
curl -s http://localhost:3001/context/entity/requirement/{id} | jq '.structured | keys'
# 必须包含 name, level, subject
```

### D5: 前端交互 (10/100)

- **5/5 (10分)**: summary 在 picker 中正确显示（灰色小字）；apply 按钮可渲染；RefPill 使用注册 color
- **4/5 (8分)**: summary 显示正确但 apply 按钮缺失
- **3/5 (6分)**: 功能基本正确但样式有瑕疵
- **2/5 (4分)**: 部分功能可用
- **1/5 (2分)**: 前端改动不可用

**检测方法**: Playwright DOM 断言 + 代码审查

## Penalty 规则

| ID | 级别 | 触发条件 | 影响 |
|----|------|---------|------|
| P1 | 致命 | core/ 下 import `@nestjs/*` | D2 直接 0/25 |
| P2 | 致命 | 现有 7 个端点 response 格式改变 | D2 直接 0/25 |
| P3 | 严重 | 修改现有 entity 文件或 service 文件 | D2 -15 |
| P4 | 严重 | 新增 API response schema 与设计文档不符 | D3 -5 |
| P5 | 一般 | Provider 实现放在 core/ 而非 solution 层 | D2 -10 |

## 阈值

- **合格**: 65/100（至少 8/12 场景 + 架构基本合规 + 零 tsc 错误）
- **目标**: 90/100（12/12 场景 + 完美架构 + 数据质量达标）

## 评分输出格式

Evaluator 必须按以下格式输出最终分数（harness.sh 通过正则提取）：

```
总分: XX/100
```

完整评估报告写入 `eval-reports/v{N}-eval.md`。
