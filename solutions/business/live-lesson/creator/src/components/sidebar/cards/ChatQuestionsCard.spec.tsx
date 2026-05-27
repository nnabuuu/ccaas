import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatQuestionsCard, {
  formatAnswersForAgent,
} from './ChatQuestionsCard'
import type { QuestionsData, RadioQuestion, TextQuestion } from '../../../types/chat-cards'

const radioQ = (
  id: string,
  options: Array<{ value: string; label: string; detail?: string }>,
  extra: Partial<RadioQuestion> = {},
): RadioQuestion => ({
  id,
  label: `Radio ${id}`,
  type: 'radio',
  options,
  ...extra,
})

const textQ = (id: string, extra: Partial<TextQuestion> = {}): TextQuestion => ({
  id,
  label: `Text ${id}`,
  type: 'text',
  ...extra,
})

const fixture = (overrides: Partial<QuestionsData> = {}): QuestionsData => ({
  kind: 'questions',
  title: '需要确认',
  items: [
    radioQ('q1', [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ]),
  ],
  ...overrides,
})

describe('formatAnswersForAgent (pure helper)', () => {
  it('builds a readable line per radio + per filled text with [id] prefix', () => {
    const data = fixture({
      items: [
        radioQ('q1', [
          { value: '4w', label: 'Where / Who / What / Why' },
          { value: 'simple', label: 'What / How / Why' },
        ], { label: '矩阵维度' }),
        textQ('q2', { label: '补充说明' }),
      ],
    })
    const out = formatAnswersForAgent(data, {
      q1: '4w',
      q2: '班级阅读基础较弱',
    })
    // [id] prefix added per review warning — disambiguates when
    // labels repeat across cards or contain `:` characters.
    expect(out).toBe(
      '已确认以下选择:\n- [q1] 矩阵维度: Where / Who / What / Why\n- [q2] 补充说明: 班级阅读基础较弱',
    )
  })

  it('skips empty text answers (chat-doc says optional)', () => {
    const data = fixture({
      items: [
        radioQ('q1', [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]),
        textQ('q2'),
      ],
    })
    const out = formatAnswersForAgent(data, { q1: 'a', q2: '   ' })
    expect(out).toBe('已确认以下选择:\n- [q1] Radio q1: A')
    expect(out).not.toMatch(/Text q2/)
  })

  it('falls back to raw value when option not found (defensive)', () => {
    const data = fixture()
    const out = formatAnswersForAgent(data, { q1: 'unknown-value' })
    expect(out).toMatch(/\[q1\] Radio q1: unknown-value/)
  })

  it('falls back to "(未选)" when radio answer is missing entirely', () => {
    const data = fixture()
    const out = formatAnswersForAgent(data, {})
    expect(out).toMatch(/\[q1\] Radio q1: \(未选\)/)
  })
})

describe('ChatQuestionsCard', () => {
  describe('initial render', () => {
    it('renders title + subtitle from data', () => {
      render(
        <ChatQuestionsCard
          data={fixture({ title: 'X', subtitle: 'sub' })}
        />,
      )
      expect(screen.getByText('X')).toBeInTheDocument()
      expect(screen.getByText('sub')).toBeInTheDocument()
    })

    it('seeds radio defaultValue into the answer state', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ(
                'q1',
                [
                  { value: 'a', label: 'A' },
                  { value: 'b', label: 'B' },
                ],
                { defaultValue: 'b' },
              ),
            ],
          })}
        />,
      )
      // Selected option label shown in the collapsed header pill.
      expect(screen.getByText('B')).toBeInTheDocument()
      // Submit becomes enabled because radio is pre-answered.
      const submitBtn = screen.getByRole('button', { name: '确认选择' })
      expect(submitBtn).not.toBeDisabled()
    })

    it('counter "0/1 已选择" when nothing answered', () => {
      render(<ChatQuestionsCard data={fixture()} />)
      expect(screen.getByText('0/1 已选择')).toBeInTheDocument()
    })

    it('exposes data-card-kind="questions" on root', () => {
      const { container } = render(<ChatQuestionsCard data={fixture()} />)
      expect(
        container.querySelector('[data-card-kind="questions"]'),
      ).toBeTruthy()
    })
  })

  describe('accordion + radio selection', () => {
    it('clicking question header expands options grid', () => {
      render(<ChatQuestionsCard data={fixture()} />)
      // Options hidden until expanded.
      expect(
        screen.queryByTestId('questions-option-q1-a'),
      ).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Radio q1/ }))
      expect(screen.getByTestId('questions-option-q1-a')).toBeInTheDocument()
    })

    it('only one question expanded at a time', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ]),
              radioQ('q2', [
                { value: 'x', label: 'X' },
                { value: 'y', label: 'Y' },
              ]),
            ],
          })}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /Radio q1/ }))
      expect(screen.getByTestId('questions-option-q1-a')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Radio q2/ }))
      expect(
        screen.queryByTestId('questions-option-q1-a'),
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('questions-option-q2-x')).toBeInTheDocument()
    })

    it('clicking an option records the answer (aria-checked + counter updates)', () => {
      render(<ChatQuestionsCard data={fixture()} />)
      fireEvent.click(screen.getByRole('button', { name: /Radio q1/ }))
      fireEvent.click(screen.getByTestId('questions-option-q1-a'))
      expect(
        screen.getByTestId('questions-option-q1-a'),
      ).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText('1/1 已选择')).toBeInTheDocument()
    })

    it('clicking a different option swaps the selection', () => {
      render(<ChatQuestionsCard data={fixture()} />)
      fireEvent.click(screen.getByRole('button', { name: /Radio q1/ }))
      fireEvent.click(screen.getByTestId('questions-option-q1-a'))
      fireEvent.click(screen.getByTestId('questions-option-q1-b'))
      expect(
        screen.getByTestId('questions-option-q1-a'),
      ).toHaveAttribute('aria-checked', 'false')
      expect(
        screen.getByTestId('questions-option-q1-b'),
      ).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('text input', () => {
    it('renders a textarea + persists typed value', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [textQ('q1', { placeholder: 'placeholder text' })],
          })}
        />,
      )
      const textarea = screen.getByPlaceholderText(
        'placeholder text',
      ) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'my notes' } })
      expect(textarea.value).toBe('my notes')
    })

    it('text questions are optional — submit enabled even with no text', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ]),
              textQ('q2'),
            ],
          })}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /Radio q1/ }))
      fireEvent.click(screen.getByTestId('questions-option-q1-a'))
      // Text q2 empty, submit still enabled.
      expect(screen.getByRole('button', { name: '确认选择' })).not.toBeDisabled()
    })
  })

  describe('submit button enablement', () => {
    it('disabled when no radios answered', () => {
      render(<ChatQuestionsCard data={fixture()} />)
      expect(screen.getByRole('button', { name: '确认选择' })).toBeDisabled()
    })

    it('enabled when all radios answered (text optional)', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
              radioQ('q2', [
                { value: 'x', label: 'X' },
                { value: 'y', label: 'Y' },
              ], { defaultValue: 'x' }),
            ],
          })}
        />,
      )
      expect(
        screen.getByRole('button', { name: '确认选择' }),
      ).not.toBeDisabled()
    })

    it('disabled when only some radios answered', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
              radioQ('q2', [
                { value: 'x', label: 'X' },
                { value: 'y', label: 'Y' },
              ]),
            ],
          })}
        />,
      )
      expect(screen.getByRole('button', { name: '确认选择' })).toBeDisabled()
    })
  })

  describe('submit + freeze', () => {
    it('calls onSubmit with the pre-formatted answer text', () => {
      const onSubmit = vi.fn()
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'Apple' },
                { value: 'b', label: 'Banana' },
              ], { defaultValue: 'a', label: 'Pick a fruit' }),
            ],
          })}
          onSubmit={onSubmit}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith(
        '已确认以下选择:\n- [q1] Pick a fruit: Apple',
      )
    })

    it('does NOT freeze when onSubmit returns false (send was dropped)', () => {
      // Critical from review: if the chat hook is mid-stream, its
      // sendNow returns false. The card MUST stay interactive so
      // the user can retry — without this fix the card would show
      // "✓ 已确认" while the agent never received the answers.
      const onSubmit = vi.fn(() => false)
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
            ],
          })}
          onSubmit={onSubmit}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      expect(onSubmit).toHaveBeenCalledTimes(1)
      // Still on the interactive view — submit button + counter present.
      expect(screen.getByRole('button', { name: '确认选择' })).toBeInTheDocument()
      expect(screen.queryByText('✓ 已确认')).not.toBeInTheDocument()
      // Retry succeeds.
      onSubmit.mockReturnValueOnce(true)
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      expect(onSubmit).toHaveBeenCalledTimes(2)
      expect(screen.getByText('✓ 已确认')).toBeInTheDocument()
    })

    it('freezes when onSubmit returns true (or undefined)', () => {
      // Both `true` and `void` are accepted as "success" per the
      // Props contract — last test had vi.fn() returning undefined
      // and the card froze. Lock this behavior with an explicit
      // `true` return too.
      const onSubmit = vi.fn(() => true)
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
            ],
          })}
          onSubmit={onSubmit}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      expect(screen.getByText('✓ 已确认')).toBeInTheDocument()
    })

    it('still flips to submitted state when onSubmit is omitted (local UI works alone)', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
            ],
          })}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      expect(screen.getByText('✓ 已确认')).toBeInTheDocument()
    })

    it('after submit, the submit button + counter disappear', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
            ],
          })}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      expect(
        screen.queryByRole('button', { name: '确认选择' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/已选择$/)).not.toBeInTheDocument()
    })

    it('after submit, radio rows compact to summary view (label + chosen option)', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'Apple' },
                { value: 'b', label: 'Banana' },
              ], { defaultValue: 'a', label: 'Fruit' }),
            ],
          })}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      const summary = screen.getByTestId('questions-summary-q1')
      expect(summary).toHaveTextContent('Fruit')
      expect(summary).toHaveTextContent('Apple')
    })

    it('after submit, empty text questions are omitted entirely', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
              textQ('q2'),
            ],
          })}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      expect(
        screen.queryByTestId('questions-summary-q2'),
      ).not.toBeInTheDocument()
    })

    it('after submit, filled text questions show their value', () => {
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
              textQ('q2', { label: '补充' }),
            ],
          })}
        />,
      )
      const textarea = screen.getByPlaceholderText('输入内容...') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'my note' } })
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      const summary = screen.getByTestId('questions-summary-q2')
      expect(summary).toHaveTextContent('补充')
      expect(summary).toHaveTextContent('my note')
    })

    it('clicking an option after submit is a no-op (frozen)', () => {
      const onSubmit = vi.fn()
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
            ],
          })}
          onSubmit={onSubmit}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
      // Summary view is rendered; option buttons no longer exist.
      // Even if a test author tried to find one, it's gone.
      expect(
        screen.queryByTestId('questions-option-q1-a'),
      ).not.toBeInTheDocument()
      // And onSubmit was called exactly once.
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('clicking submit twice fires onSubmit only once (guard)', () => {
      const onSubmit = vi.fn()
      render(
        <ChatQuestionsCard
          data={fixture({
            items: [
              radioQ('q1', [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ], { defaultValue: 'a' }),
            ],
          })}
          onSubmit={onSubmit}
        />,
      )
      const btn = screen.getByRole('button', { name: '确认选择' })
      fireEvent.click(btn)
      // Button is gone now (replaced by summary); even if it weren't,
      // submitted guard would no-op the second click.
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })
})
