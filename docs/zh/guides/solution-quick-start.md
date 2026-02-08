# Solution 快速开始 - 10 分钟

在 10 分钟内创建一个新的 CCAAS solution。

---

## 前提条件

- CCAAS 后端运行在端口 3001
- 已安装 Node.js 18+

验证 CCAAS 正在运行：
```bash
curl http://localhost:3001/api/v1/chat/health
# 应该返回：{"status":"ok"}
```

---

## 步骤 1：创建目录

```bash
cd solutions
mkdir my-solution
cd my-solution
```

---

## 步骤 2：创建 solution.json

```json
{
  "id": "my-solution",
  "name": "My Solution",
  "version": "1.0.0",
  "description": "我的第一个 CCAAS solution",
  "author": "Your Name",

  "tenant": {
    "slug": "my-solution",
    "name": "My Solution",
    "maxSessions": 100
  },

  "ports": {
    "frontend": 5280
  }
}
```

---

## 步骤 3：创建 setup.sh

```bash
#!/bin/bash
set -e

CCAAS_DB="../../packages/backend/.agent-workspace/data.db"

# 创建租户
echo "正在创建租户..."
TENANT_EXISTS=$(sqlite3 "$CCAAS_DB" "SELECT COUNT(*) FROM tenants WHERE slug = 'my-solution';" 2>/dev/null || echo "0")

if [ "$TENANT_EXISTS" = "0" ]; then
    sqlite3 "$CCAAS_DB" "
    INSERT INTO tenants (id, name, slug, description, config, maxSessions, maxSkills, maxMcpServers, plan, apiKey, status, createdAt, updatedAt)
    VALUES (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
        'My Solution',
        'my-solution',
        '我的第一个 CCAAS solution',
        '{}', 100, 50, 10, 'free',
        'sk_' || lower(hex(randomblob(24))),
        'active', datetime('now'), datetime('now')
    );
    "
    echo "✓ 租户已创建"
else
    echo "✓ 租户已存在"
fi

# 安装前端依赖
echo "正在安装依赖..."
cd frontend && npm install
echo "✅ 设置完成！"
```

使其可执行：
```bash
chmod +x setup.sh
```

---

## 步骤 4：创建前端

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @ccaas/react-sdk
cd ..
```

编辑 `frontend/src/App.tsx`：

```typescript
import { useAgentConnection, useAgentChat, ChatPanel } from '@ccaas/react-sdk'

function App() {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my',
  })

  const chat = useAgentChat({
    connection,
    tenantId: 'my-solution',
  })

  return (
    <div style={{ height: '100vh', padding: '20px' }}>
      <h1>My Solution</h1>
      <ChatPanel
        messages={chat.messages}
        isProcessing={chat.isProcessing}
        onSendMessage={chat.sendMessage}
        connected={connection.connected}
      />
    </div>
  )
}

export default App
```

编辑 `frontend/vite.config.ts`：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5280 },
})
```

---

## 步骤 5：运行设置

```bash
bash setup.sh
```

---

## 步骤 6：启动开发环境

```bash
cd frontend
npm run dev
```

---

## 步骤 7：测试

打开 http://localhost:5280

输入 "Hello" 并按回车。你应该看到 Claude 的回复！

---

## 下一步

- [完整 Solution 指南](./creating-a-solution.md) - 了解 MCP 服务器、技能、自定义后端
- [Quiz Analyzer 示例](../../solutions/quiz-analyzer/) - 学习生产级 solution
- [@ccaas/react-sdk 文档](../../packages/react-sdk/README.md) - 探索 SDK 功能

---

## 故障排除

### "Tenant not found"（租户未找到）

再次运行 `bash setup.sh` 以创建租户。

### "WebSocket connection failed"（WebSocket 连接失败）

确保 CCAAS 后端正在运行：
```bash
cd packages/backend
npm run start:dev
```

### 端口冲突

在 `solution.json` 中将 `ports.frontend` 更改为不同的端口。
