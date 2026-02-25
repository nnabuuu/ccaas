import type { ChalkboardAction } from '../types/blackboard-actions'

const SVG_NS = 'http://www.w3.org/2000/svg'
const BG_COLOR = '#1A3A32'

class BlackboardPlayer extends HTMLElement {
  private svg: SVGSVGElement
  private bgRect: SVGRectElement

  private queue: Array<{ fn: () => void; duration: number }> = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private _paused = false
  private _timeScale = 1
  private _remaining = 0
  private _startedAt = 0

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `:host { display: block; width: 100%; height: 100%; }
svg { display: block; width: 100%; height: 100%; }`
    shadow.appendChild(style)

    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.setAttribute('viewBox', '0 0 800 600')
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    shadow.appendChild(this.svg)

    this.bgRect = document.createElementNS(SVG_NS, 'rect')
    this.bgRect.setAttribute('id', 'bg')
    this.bgRect.setAttribute('width', '800')
    this.bgRect.setAttribute('height', '600')
    this.bgRect.setAttribute('fill', BG_COLOR)
    this.svg.appendChild(this.bgRect)
  }

  private _schedule(): void {
    if (this._paused || this.timer !== null || this.queue.length === 0) return
    const item = this.queue.shift()!
    item.fn()
    const ms = (item.duration * 1000) / this._timeScale
    this._startedAt = Date.now()
    this._remaining = ms
    this.timer = setTimeout(() => {
      this.timer = null
      this._schedule()
    }, ms)
  }

  private _enqueue(fn: () => void, duration: number): void {
    this.queue.push({ fn, duration })
    this._schedule()
  }

  execute(actions: ChalkboardAction[]): void {
    for (const action of actions) {
      this._addAction(action)
    }
  }

  private _addAction(action: ChalkboardAction): void {
    const dur = ('duration' in action && typeof action.duration === 'number') ? action.duration : 0.5

    switch (action.type) {
      case 'write': {
        const { text, x, y, fontSize = 20, color = '#e8e8d8' } = action
        this._enqueue(() => {
          const el = document.createElementNS(SVG_NS, 'text')
          el.setAttribute('x', String(x))
          el.setAttribute('y', String(y))
          el.setAttribute('font-size', String(fontSize))
          el.setAttribute('fill', color)
          el.setAttribute('font-family', "'Courier New', Courier, monospace")
          el.textContent = text
          this.svg.appendChild(el)
        }, dur)
        break
      }
      case 'draw_line': {
        const { x1, y1, x2, y2, color = '#e8e8d8', width = 2 } = action
        this._enqueue(() => {
          const el = document.createElementNS(SVG_NS, 'line')
          el.setAttribute('x1', String(x1))
          el.setAttribute('y1', String(y1))
          el.setAttribute('x2', String(x2))
          el.setAttribute('y2', String(y2))
          el.setAttribute('stroke', color)
          el.setAttribute('stroke-width', String(width))
          this.svg.appendChild(el)
        }, dur)
        break
      }
      case 'draw_arc': {
        const { cx, cy, rx, ry, color = '#e8e8d8' } = action
        this._enqueue(() => {
          const el = document.createElementNS(SVG_NS, 'ellipse')
          el.setAttribute('cx', String(cx))
          el.setAttribute('cy', String(cy))
          el.setAttribute('rx', String(rx))
          el.setAttribute('ry', String(ry))
          el.setAttribute('stroke', color)
          el.setAttribute('stroke-width', '2')
          el.setAttribute('fill', 'none')
          this.svg.appendChild(el)
        }, dur)
        break
      }
      case 'draw_path': {
        const { points, closed = false, color = '#e8e8d8' } = action
        this._enqueue(() => {
          if (points.length < 2) return
          const pts = points.map(p => `${p[0]},${p[1]}`).join(' ')
          const tag = closed ? 'polygon' : 'polyline'
          const el = document.createElementNS(SVG_NS, tag)
          el.setAttribute('points', pts)
          el.setAttribute('stroke', color)
          el.setAttribute('stroke-width', '2')
          el.setAttribute('fill', 'none')
          this.svg.appendChild(el)
        }, dur)
        break
      }
      case 'highlight_box': {
        const { x, y, w, h, color = '#FFD700' } = action
        this._enqueue(() => {
          const el = document.createElementNS(SVG_NS, 'rect')
          el.setAttribute('x', String(x))
          el.setAttribute('y', String(y))
          el.setAttribute('width', String(w))
          el.setAttribute('height', String(h))
          el.setAttribute('stroke', color)
          el.setAttribute('stroke-width', '2')
          el.setAttribute('fill', 'none')
          this.svg.appendChild(el)
        }, dur)
        break
      }
      case 'erase': {
        const { x, y, w, h } = action
        this._enqueue(() => {
          const el = document.createElementNS(SVG_NS, 'rect')
          el.setAttribute('x', String(x))
          el.setAttribute('y', String(y))
          el.setAttribute('width', String(w))
          el.setAttribute('height', String(h))
          el.setAttribute('fill', BG_COLOR)
          this.svg.appendChild(el)
        }, dur)
        break
      }
      case 'clear': {
        this._enqueue(() => {
          while (this.svg.lastChild && this.svg.lastChild !== this.bgRect) {
            this.svg.removeChild(this.svg.lastChild)
          }
        }, dur)
        break
      }
      case 'pause': {
        this._enqueue(() => { /* intentional delay */ }, action.duration)
        break
      }
      case 'transform_region': {
        this._enqueue(() => { /* stub */ }, action.duration ?? 0.5)
        break
      }
    }
  }

  pause(): void {
    if (this._paused || this.timer === null) return
    clearTimeout(this.timer)
    this.timer = null
    this._paused = true
    this._remaining = Math.max(0, this._remaining - (Date.now() - this._startedAt))
  }

  resume(): void {
    if (!this._paused) return
    this._paused = false
    this._startedAt = Date.now()
    this.timer = setTimeout(() => {
      this.timer = null
      this._schedule()
    }, this._remaining)
  }

  timeScale(s: number): void {
    this._timeScale = s
  }

  reset(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.queue = []
    this._paused = false
    while (this.svg.lastChild && this.svg.lastChild !== this.bgRect) {
      this.svg.removeChild(this.svg.lastChild)
    }
  }
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
