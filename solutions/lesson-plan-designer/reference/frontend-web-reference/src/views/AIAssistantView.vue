<script setup lang="ts">
import { ref } from 'vue'

const chatHistory = ref([
  '教案设计建议：勾股定理',
  '生成数学试卷题目',
  '解释"认知负荷理论"',
  '班级活动策划方案',
  '学生评语生成'
])

const activeChat = ref(0)
const inputMessage = ref('')

const suggestions = ['生成配套练习题', '设计板书草图', '推荐教学视频', '课后作业建议']

const messages = ref([
  {
    type: 'user',
    content: '请帮我设计一个关于"勾股定理"的导入环节，要求生动有趣，能吸引八年级学生的注意力。'
  },
  {
    type: 'ai',
    content: `好的，针对八年级学生，我为你设计了以下三个导入方案，你可以根据实际情况选择：

**方案一：历史故事导入（毕达哥拉斯的发现）**
讲述毕达哥拉斯在朋友家做客时，通过观察地板砖的图案发现勾股定理的故事。展示相关的地砖图片，引导学生观察正方形面积之间的关系。

**方案二：生活情境导入（捷径问题）**
展示一张学校草坪被踩出一条斜路的照片（"走的人多了也便成了路"）。提问：为什么大家喜欢走斜路？这其中蕴含了什么数学原理？从而引出"两点之间线段最短"和直角三角形边长的计算问题。

**方案三：动手操作导入（剪纸拼图）**
让学生准备四个全等的直角三角形纸片，尝试拼成一个大正方形（赵爽弦图）。通过拼图活动，直观感受面积之间的关系。`
  }
])

const useSuggestion = (suggestion: string) => {
  inputMessage.value = suggestion
}
</script>

<template>
  <div class="ai-container">
    <!-- Sidebar -->
    <aside class="ai-sidebar">
      <button class="new-chat-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        新建对话
      </button>
      <div class="history-list">
        <div
          v-for="(item, index) in chatHistory"
          :key="index"
          :class="['history-item', { active: index === activeChat }]"
          @click="activeChat = index"
        >
          {{ item }}
        </div>
      </div>
    </aside>

    <!-- Chat Main -->
    <div class="chat-main">
      <div class="chat-header">
        <span class="chat-title">{{ chatHistory[activeChat] }}</span>
        <div class="model-selector">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <span>Edu-Model Pro</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      <div class="chat-messages">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['message-row', message.type]"
        >
          <div :class="['message-avatar', message.type]">
            {{ message.type === 'user' ? '我' : 'AI' }}
          </div>
          <div class="message-bubble" v-html="message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')"></div>
        </div>
      </div>

      <div class="chat-input-container">
        <div class="input-wrapper">
          <div class="suggestion-chips">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion"
              class="chip"
              @click="useSuggestion(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
          <div class="chat-input-row">
            <textarea
              class="chat-input"
              v-model="inputMessage"
              placeholder="输入你的问题..."
            ></textarea>
            <button class="send-btn">发送</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-container {
  display: flex;
  gap: var(--space-6);
  height: calc(100vh - 180px);
  padding: var(--space-6);
  max-width: var(--max-width-extra-wide, 1400px);
  margin: 0 auto;
}

.ai-sidebar {
  width: 260px;
  background: var(--white);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  border: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.new-chat-btn {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--primary);
  color: var(--white);
  border: none;
  border-radius: var(--radius-lg);
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  transition: background var(--transition-fast);
}

.new-chat-btn:hover {
  background: var(--primary-hover);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-item {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--gray-700);
  cursor: pointer;
  font-size: var(--text-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background var(--transition-fast);
}

.history-item:hover {
  background: var(--gray-50);
}

.history-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}

.chat-main {
  flex: 1;
  background: var(--white);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.chat-header {
  padding: var(--space-5);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-title {
  font-weight: 600;
  color: var(--gray-800);
}

.model-selector {
  padding: var(--space-2) var(--space-3);
  background: var(--gray-100);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--gray-700);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.chat-messages {
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
  background: var(--gray-50);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.message-row {
  display: flex;
  gap: var(--space-4);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.message-row.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--text-sm);
}

.message-avatar.ai {
  background: linear-gradient(135deg, var(--primary), #6366f1);
  color: var(--white);
}

.message-avatar.user {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  color: var(--white);
}

.message-bubble {
  background: var(--white);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-xl);
  border-top-left-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  line-height: 1.7;
  color: var(--gray-700);
  max-width: calc(100% - 56px);
}

.message-row.user .message-bubble {
  background: var(--primary);
  color: var(--white);
  border: none;
  border-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-sm);
}

.message-bubble :deep(strong) {
  color: var(--gray-800);
  display: block;
  margin-top: var(--space-3);
  margin-bottom: var(--space-1);
}

.message-row.user .message-bubble :deep(strong) {
  color: var(--white);
}

.chat-input-container {
  padding: var(--space-5);
  background: var(--white);
  border-top: 1px solid var(--gray-100);
}

.input-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.suggestion-chips {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  justify-content: center;
}

.chip {
  padding: var(--space-2) var(--space-4);
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chip:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-light);
}

.chat-input-row {
  position: relative;
}

.chat-input {
  width: 100%;
  padding: var(--space-4);
  padding-right: 100px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--text-base);
  resize: none;
  height: 56px;
  box-shadow: var(--shadow-sm);
}

.chat-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.send-btn {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  padding: var(--space-2) var(--space-4);
  background: var(--primary);
  color: var(--white);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}

.send-btn:hover {
  background: var(--primary-hover);
}
</style>
