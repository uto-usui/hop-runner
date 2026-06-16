import { GROUND_Y, ORB, VIEW } from './config'
import { Rng } from './rng'

export interface Orb {
  x: number
  y: number
  taken: boolean
}

// 収集オーブの生成・移動・取得。障害物とは独立（空中に浮くので回避と両立し、取れなくても死なない）。
export class Collectibles {
  orbs: Orb[] = []
  private rng = new Rng()
  private nextSpawn = 0

  reset(seed?: number) {
    this.rng = new Rng(seed)
    this.orbs = []
    this.nextSpawn = 600
  }

  /** move はそのフレームに地面が流れた距離(px) */
  update(move: number) {
    for (const o of this.orbs) o.x -= move
    this.orbs = this.orbs.filter((o) => !o.taken && o.x > -30)

    this.nextSpawn -= move
    if (this.nextSpawn <= 0) {
      if (this.rng.chance(ORB.spawnChance)) {
        this.orbs.push({
          x: VIEW.width + 20,
          y: GROUND_Y - this.rng.range(ORB.minHeight, ORB.maxHeight),
          taken: false,
        })
      }
      this.nextSpawn = this.rng.range(ORB.minGap, ORB.maxGap)
    }
  }

  /** プレイヤー中心 (px,py) に近いオーブを取得して返す（甘め円判定） */
  collect(px: number, py: number): Orb[] {
    const grabbed: Orb[] = []
    const r2 = ORB.grabRadius * ORB.grabRadius
    for (const o of this.orbs) {
      if (o.taken) continue
      const dx = o.x - px
      const dy = o.y - py
      if (dx * dx + dy * dy < r2) {
        o.taken = true
        grabbed.push(o)
      }
    }
    return grabbed
  }
}
