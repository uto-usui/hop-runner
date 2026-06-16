import { SHAKE } from '../config'

// 描画全体に適用する screen shake（trauma 方式）とカメラ scale。
// trauma を加算するだけで、毎フレーム線形減衰。複数イベントが重なっても
// min(1, ...) で頭打ちになるので揺れが爆発しない（"art of screenshake"）。
// 変位は毎フレーム再計算し save/translate/restore で囲む＝前フレームの揺れを残さない。
export class Camera {
  /** 0..1。addShake で増え、update で減衰 */
  private trauma = 0
  /** 1.0 を基準にした拡大率。1未満で「引き」 */
  scale = 1

  addShake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  reset() {
    this.trauma = 0
    this.scale = 1
  }

  update(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt / SHAKE.recover)
  }

  /** 描画開始。world 空間の描画はこの begin/end で囲む */
  begin(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    // trauma^2 で小揺れは控えめ、大イベントだけ大きく
    const amp = SHAKE.maxPx * this.trauma * this.trauma
    const ox = (Math.random() * 2 - 1) * amp
    const oy = (Math.random() * 2 - 1) * amp

    ctx.save()
    ctx.translate(ox, oy)
    if (this.scale !== 1) {
      // プレイヤー付近を中心にスケール（引き）
      ctx.translate(centerX, centerY)
      ctx.scale(this.scale, this.scale)
      ctx.translate(-centerX, -centerY)
    }
  }

  end(ctx: CanvasRenderingContext2D) {
    ctx.restore()
  }
}
