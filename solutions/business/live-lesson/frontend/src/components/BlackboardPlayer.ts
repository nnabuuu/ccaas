import { gsap } from 'gsap'
import type { ChalkboardAction } from '../types/blackboard-actions'

// Logical canvas size — all manifest coordinates use this space.
// BlackboardPlayer scales to actual canvas dimensions automatically.
const LOGICAL_W = 800
const LOGICAL_H = 600

class BlackboardPlayer extends HTMLElement {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tl: gsap.core.Timeline
  private ro: ResizeObserver
  private scaleX = 1
  private scaleY = 1

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `
      :host { display: block; width: 100%; height: 100%; }
      canvas { display: block; width: 100%; height: 100%; background: #1A3A32; }
    `
    shadow.appendChild(style)

    this.canvas = document.createElement('canvas')
    shadow.appendChild(this.canvas)

    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D not supported')
    this.ctx = ctx

    this.tl = gsap.timeline()

    this.ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        this.canvas.width = Math.round(entry.contentRect.width)
        this.canvas.height = Math.round(entry.contentRect.height)
        this.scaleX = this.canvas.width / LOGICAL_W
        this.scaleY = this.canvas.height / LOGICAL_H
      }
    })
  }

  connectedCallback() {
    this.ro.observe(this)
  }

  disconnectedCallback() {
    this.ro.disconnect()
    this.tl.kill()
  }

  execute(actions: ChalkboardAction[]): void {
    for (const action of actions) {
      this._addAction(action)
    }
  }

  private _addAction(action: ChalkboardAction): void {
    const dur = ('duration' in action && typeof action.duration === 'number') ? action.duration : 0.5
    // Capture current scale values for the closure (avoids stale refs in GSAP callbacks)
    const sx = this.scaleX
    const sy = this.scaleY
    const s = Math.min(sx, sy) // uniform scale for sizes (font, line width)

    switch (action.type) {
      case 'write': {
        const { text, x, y, fontSize = 20, color = '#e8e8d8' } = action
        this.tl.call(() => {
          this.ctx.font = `${Math.round(fontSize * s)}px 'Courier New', Courier, monospace`
          this.ctx.fillStyle = color
          this.ctx.fillText(text, x * sx, y * sy)
        })
        this.tl.to({}, { duration: dur })
        break
      }
      case 'draw_line': {
        const { x1, y1, x2, y2, color = '#e8e8d8', width = 2 } = action
        this.tl.call(() => {
          this.ctx.beginPath()
          this.ctx.strokeStyle = color
          this.ctx.lineWidth = Math.max(1, width * s)
          this.ctx.moveTo(x1 * sx, y1 * sy)
          this.ctx.lineTo(x2 * sx, y2 * sy)
          this.ctx.stroke()
        })
        this.tl.to({}, { duration: dur })
        break
      }
      case 'draw_arc': {
        const { cx, cy, rx, ry, color = '#e8e8d8' } = action
        this.tl.call(() => {
          this.ctx.beginPath()
          this.ctx.strokeStyle = color
          this.ctx.lineWidth = Math.max(1, 2 * s)
          this.ctx.ellipse(cx * sx, cy * sy, rx * sx, ry * sy, 0, 0, Math.PI * 2)
          this.ctx.stroke()
        })
        this.tl.to({}, { duration: dur })
        break
      }
      case 'draw_path': {
        const { points, closed = false, color = '#e8e8d8' } = action
        this.tl.call(() => {
          if (points.length < 2) return
          this.ctx.beginPath()
          this.ctx.strokeStyle = color
          this.ctx.lineWidth = Math.max(1, 2 * s)
          this.ctx.moveTo(points[0][0] * sx, points[0][1] * sy)
          for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i][0] * sx, points[i][1] * sy)
          }
          if (closed) this.ctx.closePath()
          this.ctx.stroke()
        })
        this.tl.to({}, { duration: dur })
        break
      }
      case 'highlight_box': {
        const { x, y, w, h, color = '#FFD700' } = action
        this.tl.call(() => {
          this.ctx.strokeStyle = color
          this.ctx.lineWidth = Math.max(1, 2 * s)
          this.ctx.strokeRect(x * sx, y * sy, w * sx, h * sy)
        })
        this.tl.to({}, { duration: dur })
        break
      }
      case 'erase': {
        const { x, y, w, h } = action
        this.tl.call(() => {
          this.ctx.clearRect(x * sx, y * sy, w * sx, h * sy)
        })
        this.tl.to({}, { duration: dur })
        break
      }
      case 'clear': {
        this.tl.call(() => {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        })
        this.tl.to({}, { duration: dur })
        break
      }
      case 'pause': {
        this.tl.to({}, { duration: action.duration })
        break
      }
      case 'transform_region': {
        this.tl.to({}, { duration: action.duration ?? 0.5 })
        break
      }
    }
  }

  pause(): void { this.tl.pause() }
  resume(): void { this.tl.resume() }

  reset(): void {
    this.tl.kill()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.tl = gsap.timeline()
  }

  timeScale(s: number): void { this.tl.timeScale(s) }
}

if (!customElements.get('blackboard-player')) {
  customElements.define('blackboard-player', BlackboardPlayer)
}

declare global {
  interface HTMLElementTagNameMap {
    'blackboard-player': BlackboardPlayer
  }
}

export type { BlackboardPlayer }
