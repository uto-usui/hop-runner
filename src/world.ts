import { OBSTACLE, SPEED, VIEW } from './config'
import { pickPattern, type ObstacleKind } from './patterns'
import { Rng } from './rng'

export interface Obstacle {
  x: number // 左端の x（右から左へ流れる）
  width: number
  height: number // 地面からの高さ
  kind: ObstacleKind
  passed: boolean // 採点済みか（プレイヤーを通過し終えたか）
  minClear: number // 通過中の最小クリアランス（ニアミス判定用）
}

export class World {
  speed = SPEED.start
  obstacles: Obstacle[] = []
  distance = 0 // 走った総距離（px）。スコアの元になる
  private nextGap = 0 // 次のパターンまでの残り距離
  // シードを渡さなければランダム（従来挙動）。デイリーシードはここに seed を渡す。
  private rng = new Rng()

  reset(seed?: number) {
    this.rng = new Rng(seed)
    this.speed = SPEED.start
    this.obstacles = []
    this.distance = 0
    this.nextGap = 460 // 最初のパターンは少し先から
  }

  update(dt: number) {
    this.speed = Math.min(SPEED.max, this.speed + SPEED.accel * dt)
    const move = this.speed * dt
    this.distance += move

    for (const o of this.obstacles) o.x -= move
    this.obstacles = this.obstacles.filter((o) => o.x + o.width > -20)

    this.nextGap -= move
    if (this.nextGap <= 0) this.spawn()
  }

  // 距離に応じた「パターン」を1つぶんまとめて出す。間隔も含めて次の nextGap を決める。
  private spawn() {
    const specs = pickPattern(this.distance, this.speed, this.rng)
    let patternRight = 0
    for (const s of specs) {
      this.obstacles.push({
        x: VIEW.width + 10 + s.dx,
        width: s.width,
        height: s.height,
        kind: s.kind,
        passed: false,
        minClear: Infinity,
      })
      patternRight = Math.max(patternRight, s.dx + s.width)
    }
    // パターン全長 + ランダムギャップを消化してから次のパターン
    this.nextGap = patternRight + this.rng.range(OBSTACLE.minGap, OBSTACLE.maxGap)
  }
}
