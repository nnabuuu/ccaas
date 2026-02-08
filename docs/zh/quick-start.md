# 快速开始

本指南将帮助你在 5 分钟内启动 CCAAS 服务。

## 前置要求

在开始之前，请确保你的系统已安装：

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

检查版本：

```bash
node --version  # 应该显示 v18.0.0 或更高
npm --version   # 应该显示 9.0.0 或更高
```

## 第一步：克隆仓库

```bash
git clone https://github.com/nnabuuu/ccaas.git
cd ccaas
```

## 第二步：安装依赖

```bash
# 安装所有包的依赖
npm install
```

这会自动安装 monorepo 中所有包的依赖项。

## 第三步：构建共享包

```bash
# 共享包需要先构建（其他包依赖它）
npm run build:shared
```

## 第四步：启动开发服务器

### 启动后端

```bash
# 在一个终端窗口中
npm run dev:backend
```

后端将在 **http://localhost:3001** 上运行。

### 启动管理界面

```bash
# 在另一个终端窗口中
npm run dev:admin
```

管理界面将在 **http://localhost:5175** 上运行。

## 第五步：访问应用

打开浏览器访问：

- **管理后台**：http://localhost:5175
- **API 文档**：http://localhost:3001/api

## 下一步

恭喜！🎉 你已经成功启动了 CCAAS。

接下来你可以：

1. [配置你的第一个技能](./guides/create-skill.md)
2. [了解系统架构](./architecture/overview.md)
3. [阅读开发者指南](./developer-guide.md)

## 常见问题

### 端口被占用？

如果 3001 或 5175 端口被占用，你可以修改：

**后端端口**（packages/backend/.env）：
```bash
PORT=3002
```

**前端端口**（packages/admin-next/.env）：
```bash
VITE_PORT=5176
```

### 构建失败？

确保先构建共享包：

```bash
npm run build:shared
```

如果还有问题，清除并重新安装：

```bash
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build:shared
```
