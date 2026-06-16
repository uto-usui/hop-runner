import { JUICE } from '../config'

export type ParticleKind = 'dust' | 'shard' | 'speedline'

interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  gravity: number
  color: string
  kind: ParticleKind
}

// 固定長プールのリングバッファ。毎フレーム new せず、上限を超えたら古いものを上書き。
// 演出専用なので Math.random で見た目のばらつきを出す（ゲーム性には影響しない）。
export class Particles {
  private pool: Particle[]
  private cursor = 0

  constructor(private max = JUICE.particles.max) {
    this.pool = Array.from({ length: this.max }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      gravity: 0,
      color: '#000',
      kind: 'dust' as ParticleKind,
    }))
  }

  clear() {
    for (const p of this.pool) p.active = false
  }

  private emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    gravity: number,
    color: string,
    kind: ParticleKind,
  ) {
    const p = this.pool[this.cursor]!
    this.cursor = (this.cursor + 1) % this.max
    p.active = true
    p.x = x
    p.y = y
    p.vx = vx
    p.vy = vy
    p.life = life
    p.maxLife = life
    p.size = size
    p.gravity = gravity
    p.color = color
    p.kind = kind
  }

  /** 着地の土埃。足元から左右へ低く広がる。strength は着地の勢い（0..1 目安） */
  landingDust(footX: number, groundY: number, strength: number, color = '#c7cfdb') {
    const n = Math.round(JUICE.particles.landDustBase * (0.6 + strength))
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1
      const sp = 40 + Math.random() * 120 * (0.5 + strength)
      this.emit(
        footX + (Math.random() - 0.5) * 14,
        groundY - 2,
        dir * sp * (0.4 + Math.random()),
        -Math.random() * 60,
        0.3 + Math.random() * 0.2,
        2 + Math.random() * 2,
        420,
        color,
        'dust',
      )
    }
  }

  /** ジャンプの蹴り出し。足元から後方（右）へ流れる小さな塵 */
  jumpKick(footX: number, groundY: number, color = '#c7cfdb') {
    for (let i = 0; i < JUICE.particles.jumpKick; i++) {
      this.emit(
        footX,
        groundY - 2,
        40 + Math.random() * 90,
        -Math.random() * 40,
        0.25 + Math.random() * 0.15,
        2 + Math.random() * 1.5,
        300,
        color,
        'dust',
      )
    }
  }

  /** 死亡の破片。プレイヤー矩形が砕けて飛び散る */
  deathShards(cx: number, cy: number, color: string) {
    for (let i = 0; i < JUICE.particles.deathShards; i++) {
      const ang = Math.random() * Math.PI * 2
      const sp = 120 + Math.random() * 260
      this.emit(
        cx + (Math.random() - 0.5) * 20,
        cy + (Math.random() - 0.5) * 24,
        Math.cos(ang) * sp - 120, // 全体に進行方向（左）へ流れる
        Math.sin(ang) * sp - 120,
        0.5 + Math.random() * 0.4,
        3 + Math.random() * 4,
        900,
        color,
        'shard',
      )
    }
  }

  /** 高速時の地面スピードライン（背面層）。Phase 3 で使用 */
  speedLine(x: number, y: number, len: number, speed: number) {
    this.emit(x, y, -speed, 0, 0.4, len, 0, 'rgba(140,150,165,0.5)', 'speedline')
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0) p.active = false
    }
  }

  /** kind でレイヤを分けて描く。layer='back' は土埃/スピードライン、'front' は破片 */
  draw(ctx: CanvasRenderingContext2D, layer: 'back' | 'front') {
    ctx.save()
    for (const p of this.pool) {
      if (!p.active) continue
      const isFront = p.kind === 'shard'
      if ((layer === 'front') !== isFront) continue
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife))
      ctx.fillStyle = p.color
      if (p.kind === 'speedline') {
        ctx.fillRect(p.x, p.y, p.size, 2)
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
    }
    ctx.restore()
  }
}
