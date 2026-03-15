# Solutions 目录

本目录包含所有基于 KedgeAgentic 平台构建的 Solution（解决方案）。

## 目录结构

```
solutions/
├── demo/           # 渐进式教学示例（12 个）
├── business/       # 生产级业务 Solution（4 个）
└── README.md       # 本文件
```

## Demo Solutions（教学示例）

按功能点渐进排列的 12 个示例，从最简单的纯对话到复杂的同步字段，覆盖平台全部核心能力：

| 编号 | 名称 | 核心概念 | MCP |
|------|------|----------|-----|
| 01 | [纯对话](demo/01-pure-chat/) | 最小 Skill，无工具 | 无 |
| 02 | [多模板](demo/02-multi-template/) | sessionTemplates 切换行为 | 无 |
| 03 | [SSE 事件流](demo/03-sse-events/) | 事件协议调试 | 无 |
| 04 | [write_output](demo/04-write-output/) | MCP 工具写入前端表单 | 有 |
| 05 | [Skill Frontmatter](demo/05-skill-frontmatter/) | YAML 元数据与触发器 | 无 |
| 06 | [Skill 路由](demo/06-skill-routing/) | 关键词 + 正则触发器路由 | 无 |
| 07 | [工作流 Skill](demo/07-workflow-skill/) | 顺序多步骤对话流程 | 无 |
| 08 | [输出操作](demo/08-output-operations/) | set/append/merge 三种写入模式 | 有 |
| 09 | [Skill 提示模式](demo/09-skill-prompt-mode/) | protocol vs inline 对比 | 无 |
| 10 | [追加系统提示](demo/10-append-prompt/) | 同一 Skill 不同行为叠加 | 无 |
| 11 | [工具事件触发器](demo/11-tool-event-triggers/) | MCP 结果自动映射为事件 | 有 |
| 12 | [同步字段](demo/12-sync-fields/) | 字段分组订阅 | 有 |

详见 [demo/README.md](demo/README.md)。

## Business Solutions（业务方案）

| Solution | 说明 | MCP | 模板数 | Skill 数 |
|----------|------|-----|--------|----------|
| [智慧农服](business/smart-agri-service/) | 农户咨询 + 信贷评估 | agri-tools (10 工具) | 2 | 2 |
| [麦肯锡顾问](business/mckinsey-cli/) | 结构化商业分析 | 无 | 0 | — |
| [Builder 冒烟测试](business/builder-smoke-test/) | Builder API 流程验证 | 无 | 0 | 1 |
| [调度器冒烟测试](business/scheduler-smoke-test/) | 定时任务流程验证 | 无 | 0 | 1 |

## 快速上手

### 1. 运行 Demo

Demo 已发布到 [kedge-agentic/examples](https://github.com/kedge-agentic/examples) 仓库，提供 `setup.sh` 一键导入到 `https://ccaas.zhushou.one`：

```bash
git clone https://github.com/kedge-agentic/examples.git
cd examples/demo
cp .env.example .env   # 编辑 .env 设置 CCAAS_API_KEY
./setup.sh 01-pure-chat
```

`setup.sh` 自动完成：导入 solution.json → 注册 Skills。后端 URL 可通过 `.env` 中的 `CCAAS_URL` 配置。

### 2. 运行 Business Solution

每个 Business Solution 都有 `setup.sh` 自动化脚本：

```bash
cd solutions/business/smart-agri-service
./setup.sh
```

setup.sh 会自动完成：创建 tenant → 注册 MCP → 注册 Skill → 创建 API Key → 启动服务。

## Builder Key 流程

外部开发者通过 Builder API 自助完成接入：

```
管理员创建 Builder → Builder 导入 Solution → 注册 Skill → 创建用户 Key → 终端用户对话
```

详见 [Builder Flow 教程](../docs/gitbook/zh/guide/builder-flow.md)。

## 架构原则

- **CCAAS 核心** = Agent 中继 + Skill 路由 + 认证鉴权
- **Solution** = 业务逻辑 + MCP 工具 + 前端界面
- Solution 通过 `solution.json` 声明配置，通过 API 注册到平台
- Skill 定义在 `skills/*/SKILL.md`，MCP 工具在 `mcp-server/` 实现
