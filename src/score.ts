import { SCORE } from './config'

export interface Floater {
  x: number
  y: number
  text: string
  color: string
  life: number
  maxLife: number
}

// スコア・コンボ・ニアミスの管理。距離点は倍率で積算し、ニアミス連続で倍率が伸びる。
// 衝突＝即死なのでコンボは死亡（reset）でのみ途切れる＝「攻めて稼ぐ」が報われる。
export class Scorer {
  private points = 0
  combo = 0 // 連続ニアミス数
  multiplier = 1
  floaters: Floater[] = []
  private accountedDistance = 0
  private nextMilestone = 0

  reset() {
    this.points = 0
    this.combo = 0
    this.multiplier = 1
    this.floaters = []
    this.accountedDistance = 0
    this.nextMilestone = SCORE.milestoneDist
  }

  total(): number {
    return Math.floor(this.points)
  }

  /** 走った距離に応じて距離点を倍率込みで積む */
  addDistance(distance: number) {
    const dd = distance - this.accountedDistance
    this.accountedDistance = distance
    if (dd > 0) this.points += (dd / 10) * SCORE.pointsPerMeter * this.multiplier
  }

  /** 障害物を越えた。near=true ならニアミス。戻り値で演出側にニアミス成立を伝える */
  registerCleared(near: boolean, x: number, y: number): boolean {
    if (near) {
      this.combo += 1
      this.multiplier = Math.min(SCORE.maxMultiplier, 1 + this.combo * SCORE.comboGain)
      const bonus = Math.round(SCORE.nearMissBonus * this.multiplier)
      this.points += bonus
      this.addFloater(x, y, `NEAR +${bonus}`, '#f5c518')
    }
    return near
  }

  /** マイルストーン到達なら true（到達時に1回だけ）。距離は px */
  checkMilestone(distance: number, x: number, y: number): boolean {
    if (distance < this.nextMilestone) return false
    const meters = Math.round(this.nextMilestone / 10)
    this.nextMilestone += SCORE.milestoneDist
    this.points += SCORE.milestoneBonus
    this.addFloater(x, y, `${meters}m! +${SCORE.milestoneBonus}`, '#3a6df0')
    return true
  }

  /** 任意の加点（オーブ取得など）。倍率は掛けない素の点 */
  addPoints(n: number) {
    this.points += n
  }

  addFloater(x: number, y: number, text: string, color: string) {
    this.floaters.push({ x, y, text, color, life: SCORE.floaterLife, maxLife: SCORE.floaterLife })
  }

  updateFloaters(dt: number) {
    for (const f of this.floaters) {
      f.y -= 34 * dt
      f.life -= dt
    }
    this.floaters = this.floaters.filter((f) => f.life > 0)
  }
}
