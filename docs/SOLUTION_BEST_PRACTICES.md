# Solution 开发最佳实践

本文档总结了 CCAAS 解决方案开发过程中的最佳实践和教训。

## 1. 类型与契约

### 1.1 使用 @kedge-agentic/common 共享类型

前后端应从同一包导入类型定义，确保 API 响应格式一致。

✅ 正确做法：
```typescript
// 从 shared 包导入
import { Session, Skill, TokenUsage } from '@kedge-agentic/common'
```

❌ 错误做法：
```typescript
// 前后端各自定义类型 - 容易不一致
interface Skill { ... }
```

### 1.2 API 契约规范

- **修改 API 前**：必须检查前端类型定义和调用方式
- **使用 class-validator**：在 DTO 中添加运行时校验
- **向后兼容**：新参数应为可选，保持旧版本兼容

```typescript
// DTO 示例
export class CreateCompletionDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkills?: string[];  // 可选参数，向后兼容
}
```

## 2. TDD 强制规则

### 2.1 修改前检查清单

```
□ npm test 确认当前所有测试通过
□ 检查前端类型定义是否会受影响
□ 如果计划要改变 API/接口，先检查现有测试
```

### 2.2 修改后验证

```
□ 立即运行相关测试，不要等到最后
□ 测试失败 = 停下来分析，不要继续前进
□ 手动测试前端功能
```

### 2.3 核心原则

> **测试是代码的契约，计划只是意图的表达。**
> **当计划与测试冲突时，应该质疑计划，而不是忽略测试。**

## 3. 端到端数据流

### 3.1 完整追溯调用链

UI 状态变更必须追溯到最终执行点，确认数据真正流通：

```
UI 组件 (toggle)
    → React State (enabledSkillIds)
    → useMemo 转换 (enabledSkills)
    → Session Hook (chatPayload)
    → REST API 请求体
    → Backend Controller
    → Service (syncToSession)
    → 实际执行
```

❌ 常见错误：看到 UI 开关就以为功能完整，实际上只是视觉效果

### 3.2 后端能力先行确认

修改前先检查后端是否已支持所需功能，避免重复实现：

```typescript
// 检查现有 API
// packages/backend/src/skills/skill-sync.service.ts
async syncToSession(sessionDir, solutionId, options = {}) {
  const { skillSlugs } = options;  // ✅ 已支持过滤！
  if (skillSlugs) {
    skills = skills.filter((s) => skillSlugs.includes(s.slug));
  }
}
```

### 3.3 向后兼容

新参数为空/undefined 时应保持原有行为：

```typescript
// 如果不传 skillSlugs，同步所有 skills（原有行为）
if (skillSlugs && skillSlugs.length > 0) {
  skills = skills.filter(...);
}
```

## 4. 代码组织

### 4.1 Hook 调用顺序

依赖数据的 hook 必须在数据提供者之后调用：

```typescript
// ✅ 正确顺序
const { skills, enabledSkillIds } = useSkills(solutionId)  // 数据提供者

const enabledSkills = useMemo(() => {
  return skills.filter(s => enabledSkillIds.has(s.id)).map(s => s.slug)
}, [skills, enabledSkillIds])  // 依赖上面的数据

const session = useLessonPlanSession({ enabledSkills })  // 使用转换后的数据
```

### 4.2 最小改动原则

后端已有能力时，只需打通前端传参，无需重构后端。

## 5. Solution 开发规范

### 5.1 复用 CCAAS 后端

Solution 不应重复实现 session/skill 管理，通过 API 调用 CCAAS：

```
Solution Backend (port 300x)     CCAAS Backend (port 3001)
        │                                │
        │  代理 /api/v1/sessions/* ──────►│
        │  代理 /api/v1/skills/* ────────►│
        │                                │
        └── 只处理 solution 特有逻辑      └── 处理通用逻辑
```

### 5.2 solution.json 配置

```json
{
  "skill": {
    "skillFile": "skills/xxx/SKILL.md"  // 解决方案级 skill，始终加载
  },
  "backend": {
    "ccaasUrl": "http://localhost:3001"  // CCAAS 地址
  }
}
```

### 5.3 Skill 集成模式

完整的 skill 集成需要：

1. **useSkills hook** - 管理 skill 列表和启用状态
2. **ID → Slug 转换** - useMemo 转换 enabledSkillIds 为 enabledSkills
3. **传递给 session hook** - 通过 API 传给后端
4. **SkillsPanel UI** (可选) - 展示 skill toggle 开关

```typescript
// 完整集成示例
const { skills, enabledSkillIds, toggleSkill } = useSkills(solutionId)

const enabledSkills = useMemo(() =>
  skills.filter(s => enabledSkillIds.has(s.id)).map(s => s.slug),
  [skills, enabledSkillIds]
)

const { sendMessage } = useSession({ enabledSkills })
```

## 6. 常见错误与教训

### 6.1 API 格式不兼容事件 (2025-01)

**问题**：修改 textbook API 后，前端"创建新备课方案"功能完全失效

**原因**：
- 计划文档定义了简化的 API 格式（返回 `string[]`）
- 没有先运行测试就按计划实现
- 前端实际需要 `{id, label}` 格式

**教训**：
```
测试 > 计划
现有代码 > 新设计
先验证 > 后实现
```

### 6.2 Skill Toggle 无效事件

**问题**：UI 上的 skill 开关只是"装饰品"，无论开关状态如何，所有 skill 都会被加载

**原因**：
- useSkills 的 enabledSkillIds 从未传递给 session hook
- 前后端数据流断裂

**教训**：
```
不要假设"看起来工作"就是真的工作
完整追溯调用链到最终执行点
```

## 7. 检查清单模板

### 修改 API 前
- [ ] 检查 `frontend/src/types/` 中的类型定义
- [ ] 检查 hooks 中的 API 调用方式
- [ ] 运行 `npm test`

### 修改代码后
- [ ] 运行 `npm test` 确认通过
- [ ] `npx tsc --noEmit` 类型检查
- [ ] 手动测试功能

### 新增 Solution 功能
- [ ] 是否需要 skill toggle？添加 useSkills + SkillsPanel
- [ ] 是否需要与 CCAAS 通信？配置代理和 API 调用
- [ ] 是否有类型共享需求？使用 @kedge-agentic/common
