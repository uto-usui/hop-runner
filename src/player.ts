import { GROUND_Y, PHYSICS, PLAYER } from './config'

export class Player {
  x = PLAYER.x
  y = 0 // 左上の y
  vy = 0
  grounded = true
  private holdTime = 0

  get width() {
    return PLAYER.width
  }
  get height() {
    return PLAYER.height
  }

  reset() {
    this.y = GROUND_Y - PLAYER.height
    this.vy = 0
    this.grounded = true
    this.holdTime = 0
  }

  /** 接地中のみジャンプ開始 */
  jump() {
    if (!this.grounded) return
    this.vy = -PHYSICS.jumpVelocity
    this.grounded = false
    this.holdTime = 0
  }

  update(dt: number, holding: boolean) {
    if (this.grounded) return

    // 可変ジャンプ: 上昇中かつボタンを押し続けている間（最大 maxHoldTime まで）は
    // 重力を弱め、ふわっと高く・長く飛ばす。離す/上限到達/落下開始で通常重力に戻る。
    const ascendingAndHeld =
      this.vy < 0 && holding && this.holdTime < PHYSICS.maxHoldTime
    if (ascendingAndHeld) this.holdTime += dt

    const gravity = ascendingAndHeld
      ? PHYSICS.gravity * PHYSICS.holdGravityScale
      : PHYSICS.gravity

    this.vy += gravity * dt
    this.y += this.vy * dt

    const floor = GROUND_Y - PLAYER.height
    if (this.y >= floor) {
      this.y = floor
      this.vy = 0
      this.grounded = true
      this.holdTime = 0
    }
  }
}
