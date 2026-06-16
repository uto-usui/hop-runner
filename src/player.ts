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
  /** 目の開き具合（1=通常, >1=見開き, ~0=まばたき/細め）。描画専用 */
  eyeOpen = 1
  /** 視線の上下（-1=上, +1=下）。描画専用 */
  eyeLook = 0
  private holdTime = 0
  private blinkTimer = 2.5 // 次のまばたきまでの秒
  private blinkRemaining = 0 // まばたき継続中の残り秒
  private squint = 0 // 着地で目を細める残り秒

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
    this.eyeOpen = 1
    this.eyeLook = 0
    this.blinkTimer = 2.5
    this.blinkRemaining = 0
    this.squint = 0
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
    this.updateFace(dt)
  }

  // 目の表情。上昇で見開き、着地で細め、たまにまばたき、視線は上下に動く（描画専用）。
  private updateFace(dt: number) {
    // まばたき
    if (this.blinkRemaining > 0) {
      this.blinkRemaining -= dt
    } else {
      this.blinkTimer -= dt
      if (this.blinkTimer <= 0) {
        this.blinkRemaining = 0.12
        this.blinkTimer = 2.5 + Math.random() * 3
      }
    }
    // 着地で目を細める
    if (this.justLanded) this.squint = 0.16
    else if (this.squint > 0) this.squint = Math.max(0, this.squint - dt)

    // 開き具合の目標（優先: まばたき > 細め > 上昇で見開き > 通常）
    let targetOpen = 1
    if (!this.grounded && this.vy < 0) targetOpen = 1.4
    if (this.squint > 0) targetOpen = 0.5
    if (this.blinkRemaining > 0) targetOpen = 0.08

    // 視線（上昇=上、落下=やや下、接地=正面）
    let targetLook = 0
    if (!this.grounded) targetLook = this.vy < 0 ? -1 : 0.4

    const a = 1 - Math.exp(-30 * dt) // dt 非依存の追従
    this.eyeOpen += (targetOpen - this.eyeOpen) * a
    this.eyeLook += (targetLook - this.eyeLook) * a
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
