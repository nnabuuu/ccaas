# 设计文档: {功能名称}

**状态**: Draft / Under Review / Approved / Implemented
**作者**: @{your-name}
**日期**: {YYYY-MM-DD}
**Linear Issue**: CCaas-{number}

---

## 1. 背景与动机

### 问题描述
<!-- 现在遇到什么问题？为什么需要这个变更？ -->

### 业务价值
<!-- 解决这个问题的价值是什么？ -->

---

## 2. 目标与非目标

### 目标
<!-- 这次设计要解决什么 -->
- 目标 1
- 目标 2

### 非目标
<!-- 这次不解决什么（避免范围蔓延） -->
- 非目标 1
- 非目标 2

---

## 3. 架构设计

### 当前架构
<!-- 如果是改造现有功能，描述当前架构 -->

```
┌─────────────┐     ┌──────────┐
│  Component  │────▶│ Service  │
└─────────────┘     └──────────┘
```

### 目标架构
<!-- 图示 + 说明 -->

```
┌─────────────┐     ┌──────────┐     ┌──────────┐
│  Component  │────▶│ Service  │────▶│ Database │
└─────────────┘     └──────────┘     └──────────┘
```

**关键组件**:
- **Component**: 职责描述
- **Service**: 职责描述
- **Database**: 职责描述

### 数据模型
<!-- Entity 设计、数据库 schema -->

```typescript
// 新增或修改的 Entity
@Entity()
export class MyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // ...
}
```

**数据库迁移**:
- [ ] 需要新建表
- [ ] 需要修改现有表
- [ ] 不需要数据库变更

### API 设计
<!-- REST endpoints 或 WebSocket events -->

#### REST API

```typescript
// GET /api/v1/my-resource
interface MyResourceResponse {
  id: string;
  name: string;
}

// POST /api/v1/my-resource
interface CreateMyResourceDto {
  name: string;
}
```

#### WebSocket Events

```typescript
// Event: my_event
interface MyEvent {
  type: 'my_event';
  payload: {
    data: string;
  };
}
```

### 关键决策

**决策 1**: 选择方案 A 而不是 B
- **理由**: ...
- **Trade-offs**: ...

**决策 2**: 使用技术 X
- **理由**: ...
- **Trade-offs**: ...

---

## 4. 实现计划

### 阶段划分

**Phase 1: 基础功能** (2 天)
- [ ] 任务 1.1
- [ ] 任务 1.2

**Phase 2: 集成测试** (1 天)
- [ ] 任务 2.1
- [ ] 任务 2.2

**Phase 3: 文档和部署** (0.5 天)
- [ ] 任务 3.1
- [ ] 任务 3.2

### 文件清单

需要修改/创建的文件：

**Backend**:
- `packages/backend/src/my-module/my.entity.ts` (新建)
- `packages/backend/src/my-module/my.service.ts` (新建)
- `packages/backend/src/my-module/my.controller.ts` (新建)

**SDK**:
- `packages/react-sdk/src/hooks/useMyFeature.ts` (新建)

**Tests**:
- `packages/backend/src/my-module/my.service.spec.ts` (新建)

### 依赖关系

- **需要先完成的任务**: 无 / {任务名称}
- **可以并行的任务**: {任务列表}
- **后续任务**: {任务列表}

---

## 5. 测试策略

### 单元测试

需要覆盖的场景：
- [ ] 正常流程
- [ ] 错误处理
- [ ] 边界条件

```typescript
describe('MyService', () => {
  it('should do something', () => {
    // 测试用例
  });
});
```

### 集成测试

API 调用链路测试：
- [ ] API endpoint 测试
- [ ] 数据库操作测试
- [ ] WebSocket 事件测试

### E2E 测试

用户操作流程：
- [ ] 用户场景 1
- [ ] 用户场景 2

---

## 6. 风险与缓解

### 已知风险

**风险 1**: {风险描述}
- **影响**: {影响范围}
- **缓解措施**: {如何缓解}

**风险 2**: {风险描述}
- **影响**: {影响范围}
- **缓解措施**: {如何缓解}

### 兼容性影响

- [ ] **Breaking Changes**: 有 / 无
- [ ] **迁移计划**: {如果有 breaking changes，如何迁移}
- [ ] **向后兼容**: {是否保持向后兼容}

---

## 7. 上线计划

### 部署步骤

1. **数据库迁移** (如果需要)
   ```bash
   npm run migration:run
   ```

2. **后端部署**
   ```bash
   npm run build
   npm run deploy:backend
   ```

3. **前端部署**
   ```bash
   npm run build
   npm run deploy:frontend
   ```

### 回滚计划

如果出问题怎么回滚：

1. **回滚代码**
   ```bash
   git revert {commit-hash}
   ```

2. **回滚数据库** (如果需要)
   ```bash
   npm run migration:revert
   ```

### 监控指标

上线后监控：
- [ ] API 响应时间
- [ ] 错误率
- [ ] 用户行为指标

---

## 8. 参考资料

- [相关文档链接]()
- [类似功能实现]()
- [技术文档]()

---

## Review Checklist (for Claude Code)

请 Claude Code review 时检查：

- [ ] **架构合规性**: 是否符合 Core vs Solution 分离原则？
- [ ] **数据模型**: Entity 设计是否合理？
- [ ] **API 设计**: RESTful 规范？向后兼容？
- [ ] **测试策略**: 测试覆盖是否充分？
- [ ] **风险评估**: 是否考虑了主要风险？
- [ ] **技术可行性**: 方案是否可行？
- [ ] **性能影响**: 是否有性能问题？
- [ ] **安全性**: 是否有安全隐患？
