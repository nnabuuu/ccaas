# Quick Start: AI 智能录题

## 快速开始

### 1. 启动所有服务

```bash
# 终端 1: CCAAS Backend
cd /Users/niex/Documents/GitHub/kedge-ccaas/packages/backend
npm run start:dev

# 终端 2: Quiz Analyzer Backend
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/quiz-analyzer/backend
npm run start:dev

# 终端 3: Quiz Analyzer Frontend
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/quiz-analyzer/frontend
npm run dev
```

### 2. 访问 AI 聊天界面

打开浏览器访问: http://localhost:5282/quizzes/ai-chat

### 3. 使用示例

#### 示例 1: 粘贴完整题目

```
已知一元二次方程 x² - 5x + 6 = 0，求该方程的解。
A. x₁=1, x₂=6
B. x₁=2, x₂=3
C. x₁=-2, x₂=-3
D. x₁=-1, x₂=-6
正确答案：B
```

**AI 会自动识别**:
- 题型: 选择题
- 难度: ⭐⭐⭐
- 正确答案: B
- 选项: A/B/C/D

#### 示例 2: 自然语言描述

```
这是一道九年级的一元二次方程解题题，难度适中
```

然后 AI 会要求你提供题目内容...

#### 示例 3: 快捷提示

点击预设的快捷提示：
- "解析这道一元二次方程题"
- "这是一道选择题"
- "分析这道几何证明题"
- "提取题目中的知识点"

### 4. 查看解析结果

解析完成后，右侧会显示:
- ✅ 置信度分数
- 📝 题目内容
- 🎯 题型
- ⭐ 难度
- 📚 年级/章节
- 🔤 选项 (如果是选择题)
- ✓ 正确答案

### 5. 保存到题库

确认信息无误后，点击 **"保存到题库"** 按钮。

保存成功后会自动跳转到题目列表页面。

## 常见问题

### Q: 显示"正在连接服务器..."？
**A**: 检查 CCAAS Backend 是否启动 (端口 3001)

### Q: 解析结果不准确？
**A**:
1. 检查题目格式是否规范
2. 可以多轮对话调整，例如: "难度应该是4星"
3. 确认后手动在题库中编辑

### Q: 无法保存到题库？
**A**: 检查 Quiz Analyzer Backend 是否启动 (端口 3005)

### Q: 知识点没有自动识别？
**A**: 当前版本知识点需要手动选择，AI 自动识别功能正在开发中

## 提示

### 为了获得最佳解析结果:

✅ **推荐格式**:
```
题目内容...

A. 选项A
B. 选项B
C. 选项C
D. 选项D

正确答案: B
```

❌ **避免**:
- 不规范的选项格式 (如 "1." "①")
- 缺少答案标记
- 题目和答案混在一起

## 下一步

尝试更多功能:
- 📋 `/quizzes` - 查看所有题目
- ✏️ `/quizzes/:id/edit` - 编辑题目
- 📊 `/analytics` - 数据分析
- 🔍 `/error-patterns` - 错误分析

## 反馈

如有问题或建议，请在 GitHub Issues 中反馈。
