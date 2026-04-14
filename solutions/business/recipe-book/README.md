# Recipe Book — CCAAS Solution

智能食谱管理平台，演示 `@kedge-agentic/entity-document` + `@kedge-agentic/context-layer` 的完整功能。

## 功能

- 食谱 CRUD（NestJS + TypeORM + SQLite）
- 自定义 `ingredient` 块类型（TransformRegistry 扩展）
- RecipeProvider 支持 str_replace 编辑（传入自定义 registry）
- CCAAS 租户接入（solution.json, Skills, MCP Server）
- context-layer 本地控制器（完整端点）

## 快速开始

```bash
cd backend
npm install
npm run seed        # 生成 3 道示范食谱
npm run start:dev   # 启动在 :3002
```

## 技术栈

- NestJS 10 + TypeORM + SQLite (better-sqlite3)
- @kedge-agentic/entity-document — TransformRegistry, serialize, deserialize, strReplace
- @kedge-agentic/context-layer — DocumentEditProvider, EntityRegistry
