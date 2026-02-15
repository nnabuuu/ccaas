# 快速开始

本章节帮助你在本地快速搭建即见Agentic 开发环境，并体验平台的核心功能。

## 前置要求

- **Node.js** 18.x 或更高版本
- **npm** 9.x 或更高版本
- **即见Agentic 平台** - 已部署的实例或本地运行（参见[安装与启动](installation.md)）

## 章节导航

| 章节 | 内容 | 适合人群 |
|------|------|----------|
| [安装与启动](installation.md) | 环境配置、依赖安装、服务启动 | 所有开发者 |
| [5 分钟快速体验](quickstart.md) | 核心功能演示、基础 API 交互 | 想快速了解平台的开发者 |

## 项目结构概览

```
ccaas/
├── package.json                # Workspace 根配置（npm workspaces）
├── packages/
│   ├── backend/                # @ccaas/backend - NestJS 后端服务
│   ├── admin/                  # @ccaas/admin - Vue 3 管理后台
│   ├── vue-sdk/                # @ccaas/vue-sdk - Vue 前端 SDK
│   └── shared/                 # @ccaas/common - 共享类型与协议
├── solutions/                  # Solution 示例项目
│   ├── ccaas-demo/             # 基础演示
│   ├── lesson-plan-designer/   # 教案设计助手
│   └── problem-explainer/      # 题目讲解助手
└── docs/                       # 文档
```
