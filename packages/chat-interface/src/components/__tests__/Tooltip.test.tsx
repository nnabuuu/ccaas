import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  it('renders children and tooltip content', () => {
    render(
      <Tooltip content="提示文字">
        <button>按钮</button>
      </Tooltip>,
    )
    screen.getByText('按钮')
    screen.getByText('提示文字')
  })

  it('has role="tooltip" on the tooltip element', () => {
    render(
      <Tooltip content="提示">
        <span>内容</span>
      </Tooltip>,
    )
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('links tooltip to children via aria-describedby', () => {
    render(
      <Tooltip content="提示">
        <button>按钮</button>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    const wrapper = tooltip.previousElementSibling!
    expect(wrapper.getAttribute('aria-describedby')).toBe(tooltip.id)
  })

  it('applies top placement class by default', () => {
    render(
      <Tooltip content="提示">
        <span>内容</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('bottom-full')
  })

  it('applies bottom placement class', () => {
    render(
      <Tooltip content="提示" placement="bottom">
        <span>内容</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('top-full')
  })

  it('applies left placement class', () => {
    render(
      <Tooltip content="提示" placement="left">
        <span>内容</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('right-full')
  })

  it('applies right placement class', () => {
    render(
      <Tooltip content="提示" placement="right">
        <span>内容</span>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('left-full')
  })
})
