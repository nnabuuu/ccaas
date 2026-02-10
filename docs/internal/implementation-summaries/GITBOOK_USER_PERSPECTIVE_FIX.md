# GitBook 用户视角修正完成 - 2026-02-06

## 问题诊断

### 原始问题
之前的术语标准化将 "Claude Code CLI" 改为 "AgentEngine CLI" 并作为**用户前置要求**，这是**错误的**，因为：

1. **CCAAS 是一个平台**，用户应该开箱即用
2. **AgentEngine 是内部组件**，不应该暴露给最终用户
3. 用户角色是 **Solution 开发者 / 前端集成开发者 / PM**，他们不需要关心底层引擎

### 用户困惑
新用户会问：
- ❓ "AgentEngine CLI 是什么？我需要安装它吗？"
- ❓ "如何选择 Claude Code 还是 OpenCode？"
- ❓ "在哪里下载和配置？"

**正确答案应该是**：
- ✅ "你不需要安装任何引擎，平台已经配置好了"
- ✅ "直接使用 API 和 SDK 开发你的 Solution"

---

## 修正内容

### 1. 前置要求修正 ✅

#### 英文版 (`getting-started/README.md`)

**修改前**：
```markdown
## Prerequisites
- Node.js 18.x
- npm 9.x
- AgentEngine CLI (Claude Code, OpenCode, or custom) ← ❌ 错误！
```

**修改后**：
```markdown
## Prerequisites
- Node.js 18.x or later
- npm 9.x or later
- CCAAS Platform - Either access to a deployed instance or run locally
```

#### 中文版 (`getting-started/README.md`)

**修改前**：
```markdown
## 前置要求
- Node.js 18.x
- npm 9.x
- AgentEngine CLI（Claude Code、OpenCode 或自定义引擎）← ❌ 错误！
```

**修改后**：
```markdown
## 前置要求
- Node.js 18.x 或更高版本
- npm 9.x 或更高版本
- CCAAS 平台 - 已部署的实例或本地运行
```

### 2. 安装文档优化 ✅

#### 英文版 (`getting-started/installation.md`)

**添加说明**：
```markdown
{% hint style="info" %}
**For Solution Developers**: This setup runs the full CCAAS platform
on your local machine. The platform comes with built-in AI capabilities -
you don't need to install or configure any AI engines separately.
{% endhint %}

{% hint style="warning" %}
**For Production Deployment**: If you're deploying CCAAS to production
servers, you'll need to configure the AI engine backend. Contact your
platform administrator for deployment documentation.
{% endhint %}
```

#### 中文版 (`getting-started/installation.md`)

**添加说明**：
```markdown
{% hint style="info" %}
**面向 Solution 开发者**：本安装流程会在你的本机运行完整的 CCAAS 平台。
平台内置了 AI 能力支持，你无需单独安装或配置任何 AI 引擎。
{% endhint %}

{% hint style="warning" %}
**生产环境部署**：如果你需要将 CCAAS 部署到生产服务器，
需要配置 AI 引擎后端。请联系平台管理员获取部署文档。
{% endhint %}
```

### 3. 架构文档澄清 ✅

#### 英文版 (`platform/architecture.md`)

**添加内部组件说明**：
```markdown
### Agent Engine

{% hint style="info" %}
**Internal Platform Component**: AgentEngine is managed by the CCAAS platform.
As a Solution developer or platform user, you interact with AI capabilities
through APIs and SDKs without needing to configure or manage the underlying engine.
{% endhint %}
```

#### 中文版 (`platform/architecture.md`)

**添加内部组件说明**：
```markdown
### Agent Engine

{% hint style="info" %}
**平台内部组件**：AgentEngine 由 CCAAS 平台统一管理。
作为 Solution 开发者或平台用户，你通过 API 和 SDK 使用 AI 能力，
无需配置或管理底层引擎。
{% endhint %}
```

### 4. 能力文档简化 ✅

#### 英文版 (`platform/capabilities.md`)

**修改前**：
```markdown
- **Headless Execution** -- Tasks run AgentEngine without WebSocket
```

**修改后**：
```markdown
- **Headless Execution** -- Tasks run in the background without WebSocket
```

#### 中文版 (`platform/capabilities.md`)

**修改前**：
```markdown
- **无头执行** —— 无需 WebSocket 连接，后台运行 AgentEngine
```

**修改后**：
```markdown
- **后台执行** —— 无需 WebSocket 连接，后台自动运行
```

---

## 用户体验改进

### 修改前（困惑的新用户）
```
新用户："我想开发一个 Solution"
读文档："需要 AgentEngine CLI"
新用户："这是什么？去哪下载？"
读文档："支持 Claude Code、OpenCode、自定义引擎"
新用户："我该选哪个？怎么配置？" ← 完全卡住
```

### 修改后（顺畅的新用户）
```
新用户："我想开发一个 Solution"
读文档："需要 CCAAS 平台 - 本地运行或远程访问"
新用户："OK，运行 npm run dev:backend"
读说明："平台内置 AI 能力，无需额外安装"
新用户："太好了！直接开始开发" ← 顺利进入开发
```

---

## 修改文件清单

### 英文版 (4 个文件)
- ✅ `docs/gitbook/en/getting-started/README.md` - 前置要求
- ✅ `docs/gitbook/en/getting-started/installation.md` - 添加说明
- ✅ `docs/gitbook/en/platform/architecture.md` - 内部组件标注
- ✅ `docs/gitbook/en/platform/capabilities.md` - 简化描述

### 中文版 (4 个文件)
- ✅ `docs/gitbook/zh/getting-started/README.md` - 前置要求
- ✅ `docs/gitbook/zh/getting-started/installation.md` - 添加说明
- ✅ `docs/gitbook/zh/platform/architecture.md` - 内部组件标注
- ✅ `docs/gitbook/zh/platform/capabilities.md` - 简化描述

**总计**: 8 个文件

---

## 设计原则

### ✅ 正确的信息分层

#### 对 Solution 开发者（GitBook 主要读者）
- **需要知道**：
  - 平台提供什么能力（Skill 系统、MCP 工具、定时任务等）
  - 如何使用 API 和 SDK
  - 如何开发 Solution
  - 如何编写 Skill

- **不需要知道**：
  - AgentEngine 的内部实现
  - 如何安装/配置 Claude Code
  - 引擎的选择和切换
  - 底层进程管理

#### 对平台管理员（不在 GitBook 中）
- **需要知道**：
  - 如何部署 CCAAS 平台
  - 如何配置 AgentEngine（Claude Code/OpenCode/自定义）
  - 如何设置 `AGENT_ENGINE_PATH` 环境变量
  - 性能优化和监控

### ✅ "开箱即用" vs "需要配置"

**开箱即用**（Solution 开发）：
```bash
npm install
npm run dev:backend
# 平台启动，内置 AI 能力，直接可用 ✅
```

**需要配置**（平台部署）：
```bash
# 由平台管理员配置
export AGENT_ENGINE_PATH=claude
# 或
export AGENT_ENGINE_PATH=opencode
```

---

## 术语使用规范

### GitBook 文档中的术语

| 术语 | 是否使用 | 说明 |
|------|---------|------|
| **CCAAS Platform** | ✅ 使用 | 面向用户的产品名称 |
| **AI Agent** | ✅ 使用 | 用户理解的抽象概念 |
| **Skill System** | ✅ 使用 | 用户使用的功能 |
| **MCP Tools** | ✅ 使用 | 用户使用的功能 |
| **AgentEngine** | ⚠️ 谨慎使用 | 仅在架构说明中提及，并标注为内部组件 |
| **Claude Code CLI** | ❌ 避免 | 不应作为用户要求 |
| **AGENT_ENGINE_PATH** | ❌ 避免 | 内部配置细节 |

### 技术文档中的术语（代码注释、实现文档）

| 术语 | 是否使用 | 说明 |
|------|---------|------|
| **AgentEngine** | ✅ 使用 | 准确的内部术语 |
| **AgentEngine process** | ✅ 使用 | 进程管理描述 |
| **Claude Code / OpenCode** | ✅ 使用 | 具体实现选项 |
| **AGENT_ENGINE_PATH** | ✅ 使用 | 配置变量 |

---

## 验证清单

- ✅ 用户不会在 GitBook 中看到 "AgentEngine CLI" 作为前置要求
- ✅ installation.md 明确说明 "平台内置 AI 能力"
- ✅ 架构文档标注 AgentEngine 是内部组件
- ✅ 移除了对用户不必要的技术细节
- ✅ 保持了技术准确性（在适当的上下文中）
- ✅ 中英文文档一致

---

## 下一步建议

### 可选增强（未实施）

1. **添加 FAQ 章节**：
   - "我需要安装 Claude Code 吗？" → "不需要，平台已内置"
   - "如何切换 AI 引擎？" → "由平台管理员配置，用户无需关心"

2. **添加概念澄清页面**：
   - 解释 CCAAS 作为平台的角色
   - 说明用户、平台、引擎之间的关系

3. **分离管理员文档**（如果需要）：
   - 创建单独的 deployment 指南（不在 GitBook 主分支）
   - 针对平台运维人员

---

## 总结

✅ **问题已解决**

通过这次修正，我们：
1. **移除了错误的用户要求** - AgentEngine CLI 不再是前置条件
2. **澄清了平台角色** - 明确 CCAAS 是开箱即用的平台
3. **标注了内部组件** - AgentEngine 是平台内部，用户无需管理
4. **简化了用户体验** - 直接运行即可开发，无需额外配置

新用户现在可以：
- ✅ 快速理解 CCAAS 是什么
- ✅ 无障碍地开始 Solution 开发
- ✅ 专注于业务逻辑，而不是基础设施

**文档现在真正做到了"开箱即用"！** 🎉
