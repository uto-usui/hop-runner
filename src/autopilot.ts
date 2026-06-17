import { AUTO } from './config'
import type { Player } from './player'
import type { Obstacle } from './world'

export interface AutoInput {
  jump: boolean
  hold: boolean
}

// 自動操縦（アトラクト / 眺めるモード）。最寄りの未通過障害物に対して、
// クリア可能エンベロープ（patterns.ts が全障害物をタップジャンプで越えられる範囲に収める）を
// 前提に「確実に越えられるタイミング」で跳ぶ。高い/広い壁は長押しで滞空を伸ばし余裕を作る。
// 状態を持たない純関数。表示・体験専用で、採点や地形には影響しない。
export function autoInput(player: Player, obstacles: Obstacle[], speed: number): AutoInput {
  const front = player.x + player.width

  // プレイヤーの前方にある、まだ通過していない最寄りの障害物を探す
  let nearest: Obstacle | null = null
  for (const o of obstacles) {
    if (o.x + o.width <= front) continue // すでに通過済み
    if (!nearest || o.x < nearest.x) nearest = o
  }
  if (!nearest) return { jump: false, hold: false }

  if (player.grounded) {
    // 障害物が「滞空時間ぶん手前」に来たら踏み切る＝最高到達点がだいたい障害物の上に来る
    const lead = speed * AUTO.leadTime
    const d = nearest.x - front
    return { jump: d <= lead && d > -nearest.width, hold: false }
  }

  // 空中: 高い/広い障害物のときだけ、上昇中に長押しして滞空を伸ばす（クリアに余裕を持たせる）
  const demanding = nearest.height >= AUTO.tallThreshold || nearest.width >= AUTO.wideThreshold
  return { jump: false, hold: demanding && player.vy < 0 }
}
