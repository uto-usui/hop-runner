import { GROUND_Y, VIEW } from './config'
import { Input } from './input'
import { Player } from './player'
import { World } from './world'

type State = 'ready' | 'playing' | 'gameover'

const HI_KEY = 'hop-runner.hiscore'

export class Game {
  private ctx: CanvasRenderingContext2D
  private input: Input
  private player = new Player()
  private world = new World()
  private state: State = 'ready'
  private last = 0
  private score = 0
  private hiScore = 0

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW.width
    canvas.height = VIEW.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context is not available')
    this.ctx = ctx
    this.input = new Input(canvas)
    this.hiScore = Number(localStorage.getItem(HI_KEY) ?? 0)
    this.player.reset()
    this.world.reset()
  }

  start() {
    this.last = performance.now()
    requestAnimationFrame(this.loop)
  }

  private loop = (now: number) => {
    let dt = (now - this.last) / 1000
    this.last = now
    if (dt > 0.05) dt = 0.05 // タブ離脱などで dt が跳ねたときの保険
    this.update(dt)
    this.render()
    requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    const pressed = this.input.takePress()

    if (this.state !== 'playing') {
      if (pressed) this.beginRun()
      return
    }

    if (pressed) this.player.jump()
    this.player.update(dt, this.input.holding)
    this.world.update(dt)
    this.score = this.world.distance / 10

    if (this.collides()) this.endRun()
  }

  private beginRun() {
    this.player.reset()
    this.world.reset()
    this.score = 0
    this.state = 'playing'
  }

  private endRun() {
    this.state = 'gameover'
    const final = Math.floor(this.score)
    if (final > this.hiScore) {
      this.hiScore = final
      localStorage.setItem(HI_KEY, String(final))
    }
  }

  /** プレイヤーと障害物の AABB 判定。当たり判定は見た目より少し小さくして甘めに */
  private collides(): boolean {
    const p = this.player
    const px = p.x + 4
    const pw = p.width - 8
    const py = p.y + 4
    const ph = p.height - 6
    for (const o of this.world.obstacles) {
      const oy = GROUND_Y - o.height
      if (
        px < o.x + o.width &&
        px + pw > o.x &&
        py < oy + o.height &&
        py + ph > oy
      ) {
        return true
      }
    }
    return false
  }

  // ---- 描画 ----

  private render() {
    this.drawBackground()
    this.drawGround()
    this.drawObstacles()
    this.drawPlayer()
    this.drawHud()

    if (this.state === 'ready') {
      this.drawCenterText('HOP RUNNER', 'SPACE / タップ でスタート')
    } else if (this.state === 'gameover') {
      this.drawCenterText('GAME OVER', 'SPACE / タップ でリトライ')
    }
  }

  private drawBackground() {
    const ctx = this.ctx
    ctx.fillStyle = '#f4f7fb'
    ctx.fillRect(0, 0, VIEW.width, VIEW.height)
    // ゆるい遠景の帯
    ctx.fillStyle = '#e9eef5'
    ctx.fillRect(0, GROUND_Y - 60, VIEW.width, 60)
  }

  private drawGround() {
    const ctx = this.ctx
    ctx.strokeStyle = '#3a3f47'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y)
    ctx.lineTo(VIEW.width, GROUND_Y)
    ctx.stroke()

    // 流れる破線でスピード感を出す
    ctx.fillStyle = '#aab4c0'
    const spacing = 44
    const offset = this.world.distance % spacing
    for (let x = -offset; x < VIEW.width; x += spacing) {
      ctx.fillRect(x, GROUND_Y + 12, 22, 4)
    }
  }

  private drawObstacles() {
    const ctx = this.ctx
    ctx.fillStyle = '#2f8f4e'
    for (const o of this.world.obstacles) {
      ctx.fillRect(o.x, GROUND_Y - o.height, o.width, o.height)
    }
  }

  private drawPlayer() {
    const ctx = this.ctx
    const p = this.player
    ctx.fillStyle = this.state === 'gameover' ? '#c0455b' : '#3a6df0'
    this.roundRect(p.x, p.y, p.width, p.height, 8)
    ctx.fill()
    // 目
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(p.x + p.width - 12, p.y + 14, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawHud() {
    const ctx = this.ctx
    ctx.textAlign = 'right'
    ctx.fillStyle = '#2a2f37'
    ctx.font = '600 18px system-ui, sans-serif'
    ctx.fillText(Math.floor(this.score).toString().padStart(5, '0'), VIEW.width - 16, 30)
    ctx.fillStyle = '#9098a3'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`HI ${this.hiScore.toString().padStart(5, '0')}`, VIEW.width - 16, 50)
  }

  private drawCenterText(title: string, sub: string) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(244, 247, 251, 0.7)'
    ctx.fillRect(0, 0, VIEW.width, VIEW.height)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#222'
    ctx.font = '700 34px system-ui, sans-serif'
    ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 6)
    ctx.fillStyle = '#555'
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 26)
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
}
