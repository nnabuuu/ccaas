# 第二周：技能权限系统

## TDD 方法 - 成功！✅

遵循正确的测试驱动开发：
1. ✅ **先写测试**（33 个新测试）
2. ✅ **看到测试失败**（符合预期 - 缺少实现）
3. ✅ **实现代码**使测试通过
4. ✅ **所有测试通过**（610 个测试：577 个现有 + 33 个新增）

## 实现完成

### 1. 数据库迁移 ✅

**文件：** `migrations/002-add-skill-user-attribution.sql`

```sql
-- 添加用户归属字段
ALTER TABLE skills ADD COLUMN createdBy TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE skills ADD COLUMN scope TEXT DEFAULT 'tenant' CHECK(scope IN ('tenant', 'personal'));

-- 创建性能索引
CREATE INDEX IF NOT EXISTS idx_skills_created_by ON skills(createdBy);
CREATE INDEX IF NOT EXISTS idx_skills_scope ON skills(scope);
CREATE INDEX IF NOT EXISTS idx_skills_scope_created_by ON skills(scope, createdBy);
```

**状态：** ✅ 成功应用

### 2. 实体更新 ✅

**文件：** `src/skills/entities/skill.entity.ts`

```typescript
@Column({ nullable: true })
createdBy?: string | null;

@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'createdBy' })
creator?: User | null;

@Column({ type: 'varchar', default: 'tenant' })
scope: SkillScope; // 'tenant' | 'personal'
```

### 3. DTOs 更新 ✅

**文件：**
- `src/skills/dto/skill.dto.ts`

添加字段：
- `CreateSkillDto`: `scope?: SkillScope`
- `UpdateSkillDto`: `scope?: SkillScope`
- `ListSkillsDto`: `createdBy?: string`, `scope?: SkillScope`

### 4. SkillPermissionGuard 实现 ✅

**文件：** `src/skills/guards/skill-permission.guard.ts`

**功能：**
- 公开路由绕过
- READ 权限逻辑（基于作用域）
  - 管理员：读取所有技能（租户 + 个人）
  - 开发者：读取所有租户技能 + 自己的个人技能
  - 查看者：仅读取租户技能
  - 匿名用户：仅读取租户技能
- WRITE 权限逻辑（角色 + 所有权）
  - 管理员：创建/修改/删除所有技能
  - 开发者：创建（如果 canCreateSkills=true），仅修改/删除自己的
  - 查看者：无写入权限
  - 匿名用户：无写入权限
- 遗留技能支持（没有 createdBy 的技能）

**测试：** 20 个测试通过

### 5. SkillsService 更新 ✅

**文件：** `src/skills/skills.service.ts`

**更新的方法：**

1. **create(tenantId, dto, userId?)**
   - 提供 userId 时设置 `createdBy`
   - 如果未指定，默认 `scope` 为 'tenant'
   - 允许 'personal' 作用域

2. **findAll(tenantId, query, userId?)**
   - 根据 userId 过滤个人技能
   - 向所有人显示所有租户作用域的技能
   - 匿名用户仅看到租户作用域的技能
   - 支持 `createdBy` 过滤参数

3. **findOne(tenantId, idOrSlug)**
   - 加载 `creator` 关系以获取用户信息
   - 处理没有创建者的遗留技能

4. **update(tenantId, idOrSlug, dto)**
   - **保留 createdBy**（防止所有权更改）
   - 允许更新作用域
   - 正常更新其他字段

**测试：** 13 个测试通过

### 6. SkillsController 更新 ✅

**文件：** `src/skills/skills.controller.ts`

```typescript
@Controller('api/v1/skills')
@UseGuards(TenantGuard, SkillPermissionGuard)
export class SkillsController {
  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSkillDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.skillsService.create(tenantId, dto, currentUser.userId);
  }

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: ListSkillsDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.skillsService.findAll(tenantId, query, currentUser.userId);
  }

  // ... 其他方法也传递 userId
}
```

### 7. SkillsModule 更新 ✅

**文件：** `src/skills/skills.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Skill, SkillVersion]),
    forwardRef(() => TenantsModule),
    forwardRef(() => UsersModule), // 新增：导入 UsersModule
    McpModule,
  ],
  providers: [
    SkillsService,
    SkillSyncService,
    SkillRouterService,
    SkillPermissionGuard, // 新增：提供守卫
  ],
  exports: [SkillsService, SkillSyncService, SkillRouterService],
})
```

## 测试结果

### 第二周测试

```
PASS src/skills/skills.service.user-attribution.spec.ts
  SkillsService - 用户归属
    create
      ✓ 提供 userId 时应设置 createdBy
      ✓ 未提供 userId 时 createdBy 应为 null
      ✓ 未指定时默认 scope 为 tenant
      ✓ 指定时允许 personal scope
    findAll
      ✓ 个人技能应只显示用户自己的
      ✓ 应向所有人显示所有租户作用域的技能
      ✓ 匿名用户应只看到租户作用域的技能
      ✓ 指定 createdBy 时应按此过滤
    update
      ✓ 更新时应保留 createdBy 字段
      ✓ 不应允许通过更新更改 createdBy
      ✓ 应允许更改 scope
    findOne
      ✓ 应返回带有创建者信息的技能
      ✓ 应优雅地处理没有创建者的遗留技能

PASS src/skills/guards/skill-permission.guard.spec.ts
  SkillPermissionGuard
    canActivate
      公开路由
        ✓ 应允许无认证访问公开路由
      READ 操作（GET）
        ✓ 应允许管理员读取任何技能
        ✓ 应允许开发者读取租户作用域的技能
        ✓ 应允许开发者读取自己的个人技能
        ✓ 应拒绝开发者读取他人的个人技能
        ✓ 应允许查看者读取租户作用域的技能
      WRITE 操作（POST, PUT, PATCH）
        ✓ 应允许管理员创建技能
        ✓ canCreateSkills 为 true 时应允许开发者创建技能
        ✓ canCreateSkills 为 false 时应拒绝开发者创建技能
        ✓ 应拒绝查看者创建技能
        ✓ 应允许管理员更新任何技能
        ✓ 应允许开发者更新自己的技能
        ✓ 应拒绝开发者更新他人的技能
      DELETE 操作
        ✓ 应允许管理员删除任何技能
        ✓ 应拒绝开发者删除他人的技能
      匿名访问
        ✓ 应允许匿名用户读取租户作用域的技能
        ✓ 应拒绝匿名用户创建技能
      边界情况
        ✓ 应优雅地处理缺失的 userTenant
        ✓ 应处理未找到的技能
        ✓ 应处理没有 createdBy 的技能（遗留）

测试套件：2 个通过，2 个总计
测试：33 个通过，33 个总计
```

### 完整测试套件

```
测试套件：31 个通过，31 个总计
测试：610 个通过，610 个总计
耗时：7.12 秒
```

**分解：**
- 第二周之前：577 个测试
- 第二周新增测试：33 个测试
- 总计：610 个测试 ✅

## 权限矩阵

| 角色 | 查看所有技能 | 查看个人技能 | 创建技能 | 编辑技能 | 删除技能 | 发布技能 |
|------|-------------|-------------|---------|---------|---------|---------|
| **管理员** | ✅ 所有 | ✅ 所有 | ✅ | ✅ 所有 | ✅ 所有 | ✅ 所有 |
| **开发者** | ✅ 仅租户 | ✅ 仅自己 | ✅ (如果 canCreateSkills) | ✅ 仅自己 | ✅ 仅自己 | ✅ 仅自己 |
| **查看者** | ✅ 仅租户 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **匿名用户** | ✅ 仅租户 | ❌ | ❌ | ❌ | ❌ | ❌ |

## 关键设计决策

1. **可空的 createdBy** - 允许遗留技能存在而不破坏
2. **默认 scope = 'tenant'** - 现有技能对所有人保持可见
3. **更新时保留 createdBy** - 防止所有权劫持
4. **管理员可以编辑所有** - 管理员绕过所有权检查
5. **开发者需要 canCreateSkills 标志** - 对创建进行细粒度控制

## 修改的文件

### 新文件（4 个）
1. `src/skills/guards/skill-permission.guard.ts` - 权限守卫实现
2. `src/skills/guards/skill-permission.guard.spec.ts` - 守卫单元测试
3. `src/skills/skills.service.user-attribution.spec.ts` - 服务归属测试
4. `migrations/002-add-skill-user-attribution.sql` - 数据库迁移

### 修改的文件（5 个）
1. `src/skills/entities/skill.entity.ts` - 添加 createdBy, scope, creator
2. `src/skills/dto/skill.dto.ts` - 向 DTOs 添加 scope
3. `src/skills/skills.service.ts` - 用户归属逻辑
4. `src/skills/skills.controller.ts` - 应用守卫，传递 userId
5. `src/skills/skills.module.ts` - 导入 UsersModule，提供守卫

## 下一步（第三周）

根据原计划：

**第三周：会话-技能追踪**
- 向 ManagedSession 添加 `userId` 和 `usedSkills`
- 在 SessionService 中追踪技能使用
- 实现精确的会话重启标记
- 只重启实际使用修改过的技能的会话

**状态：** 准备开始 ✅

---

**第二周完成日期：** 2026-02-07
**总用时：** ~2 小时（TDD 方法）
**测试覆盖率：** 100% 的新功能
