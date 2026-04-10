# 成都某区教育局 Agentic 精准教学平台 — 技术设计文档

> 即见 Jijian 平台 · 上海即驰教育科技有限公司
> 顶层框架: 一个融合，两个平台，N个场景
> Widget 引擎: json-render (Vercel Labs)

---

## 1. 顶层架构

### 1.1 四层模型

```
┌─────────────────────────────────────────────────┐
│  入口层 — 一个融合                                │
│  Chat 对话入口 · Skill 管理面板 · 角色权限租户     │
├────────────────────┬────────────────────────────┤
│  精准教学 (By AI)   │  AI 教学 (For AI)           │
│  备课 · 出题 · 学情  │  课程托管 · AI实验室 · PBL  │
├────────────────────┴────────────────────────────┤
│  N个场景 — Skill 生态                             │
│  区级模板 · 学校 Fork+定制 · 共享评价市场          │
├─────────────────────────────────────────────────┤
│  底座 — Jijian Agentic 引擎                       │
│  多引擎可插拔 · SKILL.md · Widget协议 · MCP · Auth │
└─────────────────────────────────────────────────┘
```

### 1.2 角色分层

- **区教育局管理员**: 创建区级 Skill 模板、审核发布、查看全区使用分析
- **学校管理员**: Fork 区级 Skill、参数化定制、启用/停用、审核教师提交
- **教师**: 使用已启用 Skill、创建个人 Skill、评分反馈
- **学生**: AI 教学平台入口 (课程学习、AI 实验室)

---

## 2. Widget 渲染架构 (核心技术决策)

### 2.1 技术选型: json-render

选用 Vercel Labs 的 json-render 作为 Chat 客户端的 widget 渲染引擎。

**核心原因:**
- LLM 输出 JSON (非 HTML), token 消耗降低 90%+
- defineCatalog + Zod schema 约束 LLM 输出, 质量稳定
- $state / $cond 表达式系统支持步骤间变量引用
- catalog.prompt() 自动生成 system prompt, 无需手写组件描述
- 支持 React / Vue / Svelte / React Native, 跨端复用

**依赖:**
```
@json-render/core
@json-render/react (或 /vue)
zod
```

### 2.2 三层渲染管线

```
LLM 输出 JSON spec
      ↓
Jijian Harness 层 (MCP 数据注入 + 权限过滤)
      ↓
json-render Renderer (组件匹配 + 渲染)
```

**Harness 层职责:**
1. 拦截 JSON spec 中的 `mcp_source` 字段
2. 调用 callMcp 获取数据, 注入组件 props
3. 解析 `$mcp` 变量引用 (如 `$mcp.learning_analytics.gaps`)
4. 将 `submit` action 对接 submitToEngine (非 sendPrompt)

### 2.3 教育领域 Widget Catalog

在 json-render 的 36 个内置组件基础上, 注册 6 个教育专用组件:

| 组件 | 用途 | 核心 props |
|------|------|-----------|
| StepWizard | 多步参数收集 (备课/出题) | steps[], submit_action |
| TreeSelector | 课标/教材章节勾选 | mcp_source, multi_select |
| BarList | 学情数据展示+标记 | items[], toggleable, value_key |
| ReviewPanel | 逐项审核 (试卷/教案) | items[], actions[] |
| MetricDashboard | 使用分析仪表盘 | metrics[], chart_data |
| FormCollect | 动态表单 | fields[], defaults |

### 2.4 与方案 A 的 Fallback

当 LLM 输出的 JSON 包含 catalog 中不存在的 widget type 时:
1. Harness 层检测到未注册类型
2. 向 LLM 发一次追加请求: "请用 HTML 实现以下界面: {spec}"
3. HTML 在沙箱 iframe 中渲染
4. 记录 miss 日志, 作为新组件开发的需求信号

---

## 3. Chat 对话入口

### 3.1 消息处理管线

```
用户输入
  ↓
Harness 预处理:
  ├── Session 注入 (角色/学校/班级 → system_prompt)
  ├── Skill 候选匹配 (trigger 关键词扫描)
  └── 历史上下文 (最近 N 轮摘要)
  ↓
system_prompt = base + skill_prompt + catalog.prompt() + session + history
  ↓
Agentic 引擎 completion (LLM 推理 + tool_use)
  ↓
Harness 后处理:
  ├── text block → Markdown 气泡
  ├── tool_use: render_widget → json-render Renderer
  ├── tool_use: generate_file → 文件下载卡片
  └── tool_use: call_mcp → MCP 执行, 结果注入下一轮
```

### 3.2 Session Context

顶部上下文栏显示当前会话绑定的 班级/学科/学校, 教师可切换。

```typescript
interface SessionContext {
  userId: string;
  role: "district_admin" | "school_admin" | "teacher" | "student";
  schoolId?: string;
  classId?: string;
  subject?: Subject;
  gradeSemester?: GradeSemester;
  semesterPhase: "early" | "mid" | "late" | "exam";
}
```

切换 context 不需要新建会话 — 修改 session.context 后, 下一轮 completion 的 system_prompt 自动更新。

### 3.3 Skill 激活可见性

AI 回复上方显示绿色标签标注当前激活的 Skill (如 "备课助手")。
由 Harness 层在 response metadata 中标注 `active_skill` 字段。

### 3.4 消息类型混排

Chat 流中混合三种渲染:
- 纯文本 Markdown 气泡
- json-render Widget (备课向导/学情图表等)
- 文件卡片 (.docx / .pdf)

### 3.5 后续操作链

Skill 输出可附带 next_actions:

```typescript
interface SkillResponse {
  content: ContentBlock[];
  next_actions?: Array<{
    label: string;
    prompt: string;
    skill_hint?: SkillId;
  }>;
}
```

### 3.6 快捷建议

输入框上方快捷按钮由规则引擎动态生成 (不走 LLM):
- 基于角色 + 学科 + 教学进度 + 近期使用频率 + 日历上下文

---

## 4. 精准教学平台 (By AI)

### 4.1 备课助手

**交互模式:** StepWizard 组件, 四步参数收集

LLM 输出 json-render spec:
```json
{
  "root": "wizard",
  "elements": {
    "wizard": {
      "type": "StepWizard",
      "props": {
        "title": "备课向导",
        "submit_action": "lesson-plan-generator"
      },
      "children": ["step1", "step2", "step3", "step4"]
    },
    "step1": {
      "type": "FormCollect",
      "props": {
        "label": "选择范围",
        "fields": [
          {"key":"subject","label":"学科","type":"select","options":[...],"default":"数学"},
          {"key":"grade","label":"年级学期","type":"select","options":[...]},
          {"key":"class_id","label":"班级","type":"select","options":[...]},
          {"key":"lesson_type","label":"课型","type":"select","options":["新授课","复习课","练习课"]}
        ]
      }
    },
    "step2": {
      "type": "TreeSelector",
      "props": {
        "label": "选择章节",
        "mcp_source": "curriculum_tree",
        "mcp_params": {"subject": {"$state": "/step1/subject"}, "grade": {"$state": "/step1/grade"}},
        "multi_select": true
      }
    },
    "step3": {
      "type": "BarList",
      "props": {
        "label": "学情分析",
        "mcp_source": "learning_analytics",
        "mcp_params": {"class_id": {"$state": "/step1/class_id"}, "chapters": {"$state": "/step2/selected"}},
        "value_key": "error_rate",
        "label_key": "kp_name",
        "toggleable": true,
        "toggle_label": "重点关注"
      }
    },
    "step4": {
      "type": "Summary",
      "props": {"label": "确认生成"}
    }
  }
}
```

**Token 消耗:** ~350 tokens (vs 纯 HTML 3000+)
**MCP 数据获取:** 客户端在步骤切换时自动解析 $state 引用 + mcp_source, 调 callMcp, 零 LLM 参与

**依赖 MCP:**
- curriculum_tree: 课标知识点树查询
- learning_analytics: 班级学情数据
- textbook_mapping: 校本教材映射

### 4.2 出题组卷

**Agentic 工作流:**
```
教师发起 → 意图解析·约束补全 → 题目生成 → 人机审核 ↻ → 组卷导出
```

**Orchestrator Skill:** exam-paper-generator.skill.md

三个子能力:
- 约束收集器 (StepWizard + FormCollect)
- 题目生成器 (题库 MCP 检索 + LLM 原创, 难度校准)
- 组卷引擎 (ReviewPanel 逐题审核 + 排版 MCP 导出)

**题目来源混合策略:** bank_first (默认) / mixed / llm_only

**人机审核:** ReviewPanel 组件, 逐题操作 (保留/替换/微调/标记)

**依赖 MCP:**
- curriculum_mcp: 课标知识点检索
- question_bank_mcp: 区级题库检索
- learning_analytics_mcp: learningGapFactor 注入
- typesetting_mcp: Word/PDF 生成

### 4.3 学情分析 (待深入)
### 4.4 教研协作 (待深入)

---

## 5. AI 教学平台 (For AI) — 待深入

课程托管 / AI 实验室 / PBL 项目 / 素养课程

---

## 6. Skill 生态

### 6.1 生命周期

```
创建(draft) → 测试(testing) → 审核(in_review) → 发布(published) → [下架/归档]
                                    ↑ 退回(rejected)
```

### 6.2 Fork 机制

Fork 不是复制, 是带 upstream 引用的继承:
- 校级 Fork 保留对区级模板的版本引用
- 区级更新时, 校级收到合并通知
- 校级 overrides 不被上游覆盖

### 6.3 参数化定制

Skill 通过 YAML frontmatter 的 params 字段声明可配置参数:

```yaml
params:
  - key: default_difficulty_curve
    label: 默认难度曲线
    type: json
    defaultValue: {easy: 0.3, medium: 0.5, hard: 0.2}
    editableBy: school  # district | school | teacher
    group: 试卷结构
```

### 6.4 SKILL.md 中的 Widget 声明

```yaml
---
name: lesson-plan-generator
version: 2.1.0
category: lesson_planning
subjects: [math, chinese, english, physics]
stages: [junior]

# Widget catalog 扩展 — 声明本 Skill 需要的组件
widgets:
  - type: StepWizard    # 来自 Jijian 教育 catalog
  - type: TreeSelector
  - type: BarList
  - type: Summary

# MCP 依赖
mcp_tools:
  - name: curriculum_tree
    required: true
    purpose: 课标知识点树查询
  - name: learning_analytics
    required: true
    purpose: 班级学情数据
  - name: textbook_mapping
    required: false
    purpose: 校本教材映射

# 可定制参数
params:
  - key: lesson_template
    label: 教案模板
    type: enum
    options: [{value: district_standard, label: 区级标准}, {value: school_custom, label: 学校自定义}]
    defaultValue: district_standard
    editableBy: school
    group: 输出格式
---

# Prompt 部分

你是一个备课助手。当教师请求备课时:

1. 输出一个 StepWizard 组件收集参数 (学科/年级/班级/课型 → 章节选择 → 学情分析 → 确认)
2. 收到 submitToEngine 的结构化参数后, 生成教案

## 教案输出格式
...
```

### 6.5 管理面板

同一面板, 不同角色看不同视图:
- 区级: 全部 Skill / 待审核 / 使用分析
- 学校: 已启用 / 区级市场 / 校级定制 / 待审核
- 教师: 我的 Skill / 市场 / 我的创作

### 6.6 使用分析

每个 Skill 的分析仪表盘包含:
- 调用量趋势 (30 天)
- 月活教师数
- 学校覆盖率 + 教师采纳率分布
- 教师反馈 (近期高信息量评价)

### 6.7 权限矩阵

| 操作 | 区教育局 | 学校管理员 | 教师 |
|------|---------|-----------|------|
| 创建区级模板 | ✅ | - | - |
| 审核区级发布 | ✅ | - | - |
| Fork 区级 Skill | - | ✅ | - |
| 修改校级参数 | - | ✅ | - |
| 启用/停用 | - | ✅ | - |
| 审核教师提交 | - | ✅ | - |
| 使用已启用 Skill | - | - | ✅ |
| 创建个人 Skill | - | - | ✅ |
| 评分反馈 | - | ✅ | ✅ |
| 查看使用分析 | ✅ | ✅(本校) | - |

---

## 7. 数据结构

### 7.1 课标知识点树

四级: 领域 → 主题 → 单元 → 知识点

**ID 规范:** `kp:math.algebra.equation.linear_one.combine_like_terms`

**叶节点关键字段:**
- cognitive: Bloom 认知层次
- difficultyRange: [min, max]
- questionTypes: 适用题型
- examWeight: 考试权重
- prerequisites / successors: 知识图谱
- examPatterns: 常见考法 (给 LLM context)
- commonMistakes: 常见错误
- schoolTags: 学校自定义标签

详见: `src/types/curriculum.ts`

### 7.2 Skill 元数据

详见: `src/types/skill.ts`

### 7.3 Widget Catalog

详见: `src/widget-catalog/catalog.ts`

---

## 8. 关键文件清单

```
src/
├── types/
│   ├── curriculum.ts        # 课标知识点树类型
│   ├── skill.ts             # Skill 元数据 + 管理 + 权限
│   ├── session.ts           # Session context
│   └── chat.ts              # Chat 消息类型 + SkillResponse
├── widget-catalog/
│   ├── catalog.ts           # json-render catalog 定义 (Zod schemas)
│   ├── registry.ts          # React 组件注册
│   ├── components/
│   │   ├── StepWizard.tsx
│   │   ├── TreeSelector.tsx
│   │   ├── BarList.tsx
│   │   ├── ReviewPanel.tsx
│   │   ├── MetricDashboard.tsx
│   │   └── FormCollect.tsx
│   └── mcp-bridge.ts        # MCP 数据源桥接层
├── harness/
│   ├── preprocessor.ts      # 消息预处理 (session注入/skill匹配/历史摘要)
│   ├── postprocessor.ts     # 响应后处理 (widget路由/MCP执行)
│   └── submit-engine.ts     # submitToEngine 实现
└── skills/
    ├── lesson-plan-generator.skill.md
    └── exam-paper-generator.skill.md
```
