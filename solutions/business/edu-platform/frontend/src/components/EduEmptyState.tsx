import type { ClassInfo } from '../data/mock-classes'

export interface StarterCard {
  name: string
  iconText: string
  desc: string
  prompt: string
  bgColor: string
  textColor: string
}

export interface PromptExample {
  text: string
  prompt: string
}

export interface EduEmptyStateProps {
  teacherName: string
  selectedClass: ClassInfo
  starterCards?: StarterCard[]
  promptExamples?: PromptExample[]
  onSend: (prompt: string) => void
}

const DEFAULT_STARTERS: StarterCard[] = [
  { name: '备课', iconText: '备', desc: '生成教案和课件，对齐学情', prompt: '帮我备一下明天的课', bgColor: 'var(--teal-bg)', textColor: 'var(--teal-t)' },
  { name: '出题', iconText: '题', desc: '题库 + AI 原创混合组卷', prompt: '帮我出一套随堂测试', bgColor: 'var(--info-bg)', textColor: 'var(--info-t)' },
  { name: '学情', iconText: '情', desc: '薄弱点分析、趋势对比', prompt: '看一下学情数据', bgColor: 'var(--purple-bg)', textColor: 'var(--purple-t)' },
  { name: '错题本', iconText: '错', desc: '自动归类学生个人错题', prompt: '帮学生整理错题', bgColor: 'var(--coral-bg)', textColor: 'var(--coral-t)' },
]

const DEFAULT_PROMPTS: PromptExample[] = [
  { text: '三角形全等的判定，设计15分钟课堂小测', prompt: '三角形全等的判定，设计15分钟课堂小测' },
  { text: '对比两个班上周的数学学情', prompt: '对比两个班上周的数学学情' },
]

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function getWeekInfo(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  return `第${weekNo}周`
}

export function EduEmptyState({
  teacherName,
  selectedClass,
  starterCards = DEFAULT_STARTERS,
  promptExamples = DEFAULT_PROMPTS,
  onSend,
}: EduEmptyStateProps) {
  const greeting = getGreeting()
  const weekInfo = getWeekInfo()

  return (
    <div className="edu-landing">
      <div className="edu-landing__greet">{greeting}，{teacherName}</div>
      <div className="edu-landing__sub">我是你的教学助手</div>
      <div className="edu-landing__time">{weekInfo} · {selectedClass.name} · {selectedClass.subject}</div>

      <div className="edu-landing__cards">
        {starterCards.map((card) => (
          <button
            key={card.name}
            className="edu-starter"
            onClick={() => onSend(card.prompt)}
          >
            <div className="edu-starter__top">
              <span
                className="edu-starter__icon"
                style={{ background: card.bgColor, color: card.textColor }}
              >
                {card.iconText}
              </span>
              <span className="edu-starter__name">{card.name}</span>
            </div>
            <div className="edu-starter__desc">{card.desc}</div>
          </button>
        ))}
      </div>

      {promptExamples.length > 0 && (
        <div className="edu-prompts">
          <div className="edu-prompts__title">试试这样说</div>
          {promptExamples.map((p) => (
            <button
              key={p.text}
              className="edu-prompt"
              onClick={() => onSend(p.prompt)}
            >
              {p.text}
              <span className="edu-prompt__arrow">&rarr;</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
