import { AUTO, PHYSICS } from './config'
import type { Player } from './player'
import type { Obstacle } from './world'

export interface AutoInput {
  jump: boolean
  hold: boolean
}

// 自動操縦（アトラクト / 眺めるモード）。最寄りの未通過障害物に対して、
// クリア可能エンベロープ（patterns.ts が全障害物をタップジャンプで越えられる範囲に収める）を
// 前提に「弧の頂点が障害物の真上に来る」タイミングでタップジャンプする。
// 長押しは使わない: 滞空が伸びてリズムが崩れ、最小間隔で連続する障害物を越えられなくなるため。
// タップ（滞空 2*jumpVel/gravity 一定）ならエンベロープ内を必ず越えられ、一定リズムを保てる。
// 状態を持たない純関数。表示・体験専用で、採点や地形には影響しない。
export function autoInput(player: Player, obstacles: Obstacle[], speed: number): AutoInput {
  const playerCenter = player.x + player.width / 2

  // プレイヤーより前にある、まだ通過していない最寄りの障害物を探す
  let nearest: Obstacle | null = null
  for (const o of obstacles) {
    if (o.x + o.width <= player.x + player.width) continue // すでに通過済み
    if (!nearest || o.x < nearest.x) nearest = o
  }
  if (!nearest || !player.grounded) return { jump: false, hold: false }

  // タップジャンプが最高到達点に達するまでの時間（物理から算出）。障害物の「中心」が
  // プレイヤー中心へ届くまでの時間がこれと一致したら踏み切る＝弧の頂点が障害物の真上に来る。
  // （頂点を障害物の到達点に合わせると、降下しながら越えるためめり込んで見えてしまう）
  const apexTime = (PHYSICS.jumpVelocity / PHYSICS.gravity) * AUTO.leadBias
  const obstacleCenter = nearest.x + nearest.width / 2
  const timeToReach = (obstacleCenter - playerCenter) / speed
  return { jump: timeToReach > 0 && timeToReach <= apexTime, hold: false }
}
