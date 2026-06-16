import { GROUND_Y, JUICE, PHYSICS, PLAYER } from './config'

export class Player {
  x = PLAYER.x
  y = 0 // 左上の y
  vy = 0
  grounded = true
  /** このフレームで着地したか（演出トリガー用、毎フレーム update 冒頭でリセット） */
  justLanded = false
  /** 着地直前の落下速度。squash / shake / 着地音の強さに使う */
  landingImpact = 0
  /** 描画専用の伸縮（squash & stretch）。当たり判定には影響させない */
  scaleX = 1
  scaleY = 1
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
    this.justLanded = false
    this.landingImpact = 0
    this.scaleX = 1
    this.scaleY = 1
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
    this.justLanded = false

    if (!this.grounded) {
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
        this.landingImpact = this.vy // vy を 0 にする前に着地の勢いを退避
        this.justLanded = true
        this.vy = 0
        this.grounded = true
        this.holdTime = 0
      }
    }

    this.updateSquash(dt)
  }

  // 描画用の伸縮。空中では上下速度で伸び、着地で潰れ、毎フレーム元の形へバネ復帰する。
  private updateSquash(dt: number) {
    const sq = JUICE.squash

    if (this.justLanded) {
      const s = Math.min(sq.maxStretch, this.landingImpact * sq.landSquash)
      this.scaleY = 1 - s // 縦に潰れる
      this.scaleX = 1 + s * 0.8 // 横に広がる
      return
    }

    let targetY = 1
    let targetX = 1
    if (!this.grounded) {
      // vy<0(上昇)で縦に伸び、vy>0(落下)でも軽く伸びる方向に。体積保存的に横は逆相関。
      const k = clamp(-this.vy * sq.velStretch, -0.16, sq.maxStretch)
      targetY = 1 + k
      targetX = 1 - k * 0.6
    }

    // dt 非依存のバネ復帰（フレームレートに依らず同じ戻り感）
    const a = 1 - Math.exp(-sq.spring * dt)
    this.scaleX += (targetX - this.scaleX) * a
    this.scaleY += (targetY - this.scaleY) * a
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
