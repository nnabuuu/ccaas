# Live Lesson 交互功能使用说明

## 启动服务

需要 3 个服务同时运行：

```bash
# 终端 1: CCAAS 核心后端 (:3001)
cd <repo-root> && npm run dev:backend

# 终端 2: Live-lesson 后端 (:3007)
cd solutions/business/live-lesson/backend && npx nest build && node dist/main.js

# 终端 3: 前端 (:5283)
cd solutions/business/live-lesson/frontend && npx vite --port 5283
```

## 页面入口

| 角色 | URL | 说明 |
|------|-----|------|
| 教师 | http://localhost:5283/teacher/ideal-beauty-reading | 课堂控制台 |
| 学生 | http://localhost:5283/student/ideal-beauty-reading | 学生端 |
| 演示 | http://localhost:5283/demo/ideal-beauty-reading | 三端合一演示 |
| 板书 | http://localhost:5283/board/ideal-beauty-reading | 教室大屏 |

**推荐体验方式**：打开两个浏览器窗口，一个作为教师端，一个作为学生端，观察实时同步效果。

---

## 功能 A: 教师推步同步

**教师端操作**：
1. 点击顶部 **Step Rail** 中的任意步骤按钮（1-5）
2. 或点击底部 **"进入 Step N →"** 按钮前进一步
3. 或点击 **"← 上一步"** 按钮后退一步

**学生端效果**：
- 学生端自动切换到教师所选步骤
- 任务面板、阅读聚焦段落、板书内容同步更新
- 同步延迟 < 3 秒（SSE 实时推送）

**技术细节**：
- 教师点击 → `POST /api/classroom/:lessonId/step` → 后端广播 SSE `step_sync` 命名事件 → 学生端 `useStudentStream` hook 监听并更新

---

## 功能 B: 推送提示给全班

**教师端操作**：
点击教师控制台中部的 4 个 **快捷推送** 按钮：

| 按钮 | 内容 | 类型 |
|------|------|------|
| 📍 Myanmar 位置提示 | Myanmar 地理位置提示 | hint |
| 🎯 Practice 写法示例 | Practice 列要写具体名称 | hint |
| 📝 tā moko 生词卡 | tā moko 的含义和用法 | vocab |
| ⏱ 再给 2 分钟 | 时间延长提示 | time |

**学生端效果**：
- 屏幕底部弹出 **toast 通知**（带 📢 图标）
- 5 秒后自动消失，也可点击提前关闭

---

## 功能 C: AI 助教自由提问

**学生端操作**：
1. 点击左侧导航栏的 **"助教"** 按钮，打开 AI 面板
2. 可点击预设问题芯片快速提问
3. 也可在底部输入框输入自定义问题，按 **Enter** 发送

**回答特点**：
- 回答与当前步骤相关（不同步骤有不同领域的回答）
- 回答后出现 **"✓ 我明白了"** / **"? 还不明白"** 反馈按钮
- 点击"还不明白"会获得换一种说法的解释

**各步骤 AI 擅长回答的问题**：

| 步骤 | 示例问题 |
|------|----------|
| Step 1 (图式激活) | "什么是 predicting？" "schema 是什么意思？" |
| Step 2 (结构解码) | "什么是 skimming？" "怎么找 signal words？" |
| Step 3 (矩阵构建) | "矩阵怎么填？" "practice 和 reason 的区别？" |
| Step 4 (批判质疑) | "为什么说 beauty ideals 是 shallow？" |
| Step 5 (复盘升华) | "今天学了哪些阅读策略？" |

---

## 功能 D: 实时计时器

**教师端显示**：
- 顶部状态栏和步骤详情区都显示 **MM:SS / 总时长** 倒计时
- 每切换一个步骤，计时器自动重置为该步骤的分配时长

**延长时间**：
- 点击底部 **"延长 2 min"** 按钮
- 计时器自动增加 2 分钟
- 可多次点击累加

**各步骤时长分配**：

| 步骤 | 名称 | 分配时长 |
|------|------|----------|
| Step 1 | 图式激活 | 5 分钟 |
| Step 2 | 结构解码 | 8 分钟 |
| Step 3 | 矩阵构建 | 15 分钟 |
| Step 4 | 批判质疑 | 12 分钟 |
| Step 5 | 复盘升华 | 5 分钟 |

---

## 典型使用流程

1. **教师**打开教师端，进入 Step 1
2. **学生**打开学生端，输入姓名加入课堂
3. 学生端自动同步到教师当前步骤
4. 学生完成当前步骤任务后点击"提交"
5. 教师在矩阵面板看到学生提交的数据实时聚合
6. 教师发现学生困惑时，点击快捷推送按钮发送提示
7. 学生收到 toast 通知，也可打开 AI 助教提问
8. 教师观察计时器，需要时点击"延长 2 min"
9. 教师点击"进入 Step N →"推进到下一步
10. 所有学生端自动同步切换

---

## API 参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/classroom/:id/join` | POST | 学生加入课堂 |
| `/api/classroom/:id/submit` | POST | 学生提交步骤数据 |
| `/api/classroom/:id/state` | GET | 获取课堂状态 |
| `/api/classroom/:id/stream` | GET | SSE 实时流 |
| `/api/classroom/:id/step` | POST | 教师推步 `{"step": 0-4}` |
| `/api/classroom/:id/notify` | POST | 教师推送通知 `{"message": "...", "type": "hint"}` |
| `/api/classroom/:id/ai/ask` | POST | AI 提问 `{"studentId": "...", "question": "...", "step": 0}` |
