# 精准教学平台 — 顶层架构

> 即见 Jijian 平台 · 上海即驰教育科技有限公司
> 顶层框架: 一个融合，两个平台，N个场景
> Widget 引擎: json-render (Vercel Labs)

## 四层模型

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

## 角色分层

- **区教育局管理员**: 创建区级 Skill 模板、审核发布、查看全区使用分析
- **学校管理员**: Fork 区级 Skill、参数化定制、启用/停用、审核教师提交
- **教师**: 使用已启用 Skill、创建个人 Skill、评分反馈
- **学生**: AI 教学平台入口 (课程学习、AI 实验室)

---

## 精准教学平台 (By AI)

### 备课助手

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

### 出题组卷

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

### 学情分析 (待深入)
### 教研协作 (待深入)

---

## AI 教学平台 (For AI) — 待深入

课程托管 / AI 实验室 / PBL 项目 / 素养课程
