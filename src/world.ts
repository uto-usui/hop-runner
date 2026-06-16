import { OBSTACLE, SPEED, VIEW } from './config'

export interface Obstacle {
  x: number // 左端の x（右から左へ流れる）
  width: number
  height: number // 地面からの高さ
}

export class World {
  speed = SPEED.start
  obstacles: Obstacle[] = []
  distance = 0 // 走った総距離（px）。スコアの元になる
  private nextGap = 0 // 次の障害物までの残り距離

  reset() {
    this.speed = SPEED.start
    this.obstacles = []
    this.distance = 0
    this.nextGap = 460 // 最初の障害物は少し先から
  }

  update(dt: number) {
    this.speed = Math.min(SPEED.max, this.speed + SPEED.accel * dt)
    const move = this.speed * dt
    this.distance += move

    for (const o of this.obstacles) o.x -= move
    this.obstacles = this.obstacles.filter((o) => o.x + o.width > -20)

    this.nextGap -= move
    if (this.nextGap <= 0) {
      this.spawn()
      this.nextGap = rand(OBSTACLE.minGap, OBSTACLE.maxGap)
    }
  }

  private spawn() {
    this.obstacles.push({
      x: VIEW.width + 10,
      width: rand(OBSTACLE.minWidth, OBSTACLE.maxWidth),
      height: rand(OBSTACLE.minHeight, OBSTACLE.maxHeight),
    })
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
