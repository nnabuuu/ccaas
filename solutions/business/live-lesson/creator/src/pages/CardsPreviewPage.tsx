/**
 * /dev/cards-preview — read-only sandbox page for visually verifying
 * the 3 rich chat card components against the chat-doc.md spec.
 *
 * Mount: routed via `App.tsx` only when `import.meta.env.DEV` so it
 * never ships to production bundles. Cards render with realistic
 * sample payloads (one per kind, plus state variants) inside a
 * narrow column that approximates the AiPanel chat width (340px).
 *
 * This is a dev tool — not user-facing, not tested. Used for
 * Playwright screenshots + manual eyeballing of palette / spacing /
 * collapse behavior without needing a real chat session.
 */

import { useState } from 'react'
import ChatTodoCard from '../components/sidebar/cards/ChatTodoCard'
import ChatVerifyCard from '../components/sidebar/cards/ChatVerifyCard'
import ChatQuestionsCard from '../components/sidebar/cards/ChatQuestionsCard'
import type {
  TodoData,
  VerifyData,
  QuestionsData,
} from '../types/chat-cards'

const TODO_IN_PROGRESS: TodoData = {
  kind: 'todo',
  title: '执行设计生成',
  summary: '根据教案自动生成 5 个 Step、13 个模块',
  items: [
    { id: 't1', label: '解析教案文档', status: 'done' },
    { id: 't2', label: '匹配教学要求到模块类型', status: 'done' },
    {
      id: 't3',
      label: '生成 Step 1-3 模块配置',
      status: 'done',
      detail: 'Predict · Skim · Scan & Build',
    },
    {
      id: 't4',
      label: '生成 Step 4-5 模块配置',
      status: 'active',
      detail: 'Evaluate · Wrap-up',
    },
    { id: 't5', label: '配置 AI Tutor 指令与 Rubric', status: 'pending' },
    { id: 't6', label: '设置观测维度与自动规则', status: 'pending' },
  ],
}

const TODO_ALL_DONE: TodoData = {
  kind: 'todo',
  title: '校验流程',
  items: [
    { id: 't1', label: 'Schema 验证', status: 'done' },
    { id: 't2', label: '时间预算检查', status: 'done' },
    { id: 't3', label: '观测维度引用', status: 'done' },
  ],
}

const QUESTIONS: QuestionsData = {
  kind: 'questions',
  title: '需要确认几个设计决策',
  subtitle: '以下信息在教案中未明确指定, 请帮我确认:',
  items: [
    {
      id: 'q1',
      label: '矩阵填空的维度选择',
      type: 'radio',
      desc: '教案要求"多维度信息提取", 请选择维度:',
      options: [
        {
          value: '4w',
          label: 'Where / Who / What / Why',
          detail: '经典 4W, 覆盖位置、主体、内容、原因',
        },
        {
          value: 'custom',
          label: 'Culture / Practice / Purpose / Evidence',
          detail: '更学术, 强调文化分析视角',
        },
        {
          value: 'simple',
          label: 'What / How / Why',
          detail: '3 列简化版, 降低难度',
        },
      ],
      defaultValue: '4w',
    },
    {
      id: 'q2',
      label: '对话兜底轮数',
      type: 'radio',
      options: [
        { value: '3', label: '3 轮' },
        { value: '5', label: '5 轮 (推荐)' },
        { value: '7', label: '7 轮' },
      ],
    },
    {
      id: 'q3',
      label: '补充说明 (可选)',
      type: 'text',
      desc: '对以上选择有任何补充或特殊要求?',
      placeholder: '例如: 班级阅读基础较弱, 建议降低难度...',
    },
  ],
}

const VERIFY_DONE: VerifyData = {
  kind: 'verify',
  title: 'manifest.json 校验',
  target: 'manifest.json',
  schema: 'execution-schema v2.1',
  status: 'done',
  startedAt: '10:32:15',
  completedAt: '10:32:18',
  checks: [
    { id: 'c1', label: 'Schema 结构', desc: '顶层字段完整性', status: 'pass' },
    { id: 'c2', label: '题目数量', desc: '5 题', status: 'pass' },
    {
      id: 'c3',
      label: '观测维度引用',
      desc: 'observe.metrics 引用的指标 ID 在组件注册表中存在',
      status: 'warn',
      detail:
        'b7.observe 引用了 "understanding" 指标, 该指标在 discuss 组件中标记为实验性',
    },
    { id: 'c4', label: '时间预算', desc: '45min = 课时 45min', status: 'pass' },
  ],
}

const VERIFY_RUNNING: VerifyData = {
  kind: 'verify',
  title: 'discuss 模块校验',
  target: 'discuss.json',
  schema: 'discuss-schema v1.3',
  status: 'running',
  startedAt: '10:33:01',
  completedAt: '',
  checks: [
    { id: 'r1', label: 'Phase 配置', desc: '4 阶段定义完整', status: 'pass' },
    {
      id: 'r2',
      label: 'AI Tutor 指令',
      desc: '指令格式 + tone 一致性',
      status: 'pass',
    },
    {
      id: 'r3',
      label: '退出条件',
      desc: '达到 5 轮或学生回答正确',
      status: 'warn',
      detail: '建议添加显式"放弃"按钮',
    },
    { id: 'r4', label: '评分维度', desc: '3 维度都有权重', status: 'pass' },
    {
      id: 'r5',
      label: '错例覆盖',
      desc: '至少 1 个错例用于训练',
      status: 'fail',
      detail: 'currentmanifest 没有 wrong_example 字段',
    },
  ],
}

export default function CardsPreviewPage() {
  // Track submit-back from QuestionsCard to demonstrate the flow.
  const [lastSubmittedText, setLastSubmittedText] = useState<string | null>(
    null,
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <header className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">
            Cards Preview · dev
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Sample payloads rendered against the actual production card
            components. Not user-facing — see route in App.tsx
            (DEV-only).
          </p>
        </header>

        {/* Approximate AiPanel chat column (~340px usable) */}
        <div className="flex flex-col gap-5 bg-white border border-gray-200 rounded-lg p-4 w-[340px]">
          <Section title="TodoCard · in-progress">
            <ChatTodoCard data={TODO_IN_PROGRESS} />
          </Section>

          <Section title="TodoCard · all done">
            <ChatTodoCard data={TODO_ALL_DONE} />
          </Section>

          <Section title="QuestionsCard · interactive (try submitting)">
            <ChatQuestionsCard
              data={QUESTIONS}
              onSubmit={(text) => {
                setLastSubmittedText(text)
                return true
              }}
            />
            {lastSubmittedText && (
              <pre
                className="mt-3 text-[10px] text-gray-700 bg-gray-100 p-2 rounded-md whitespace-pre-wrap"
                data-testid="last-submitted-text"
              >
                {lastSubmittedText}
              </pre>
            )}
          </Section>

          <Section title="VerifyCard · done (with warn)">
            <ChatVerifyCard data={VERIFY_DONE} />
          </Section>

          <Section title="VerifyCard · running (progressive reveal)">
            <ChatVerifyCard data={VERIFY_RUNNING} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}
