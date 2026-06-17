import { AUTO, GROUND_Y, PHYSICS } from './config'
import type { Player } from './player'
import type { Obstacle } from './world'

export interface AutoInput {
  jump: boolean
  hold: boolean
}

const H_MARGIN = 10 // px 横断の余裕（プレイヤー幅 + 障害物幅に足す）
const V_MARGIN = 6 // px 高さの余裕
const CROSS_SAFETY = 1.5 // 横断項の安全係数（踏み切り timing 誤差を吸収。1.5 で全速度域に余裕）

// その障害物を1ジャンプで越えるのに必要な最高到達点(px)。
// 弧の頂点を障害物中心に合わせる前提で、幅×プレイヤー幅ぶんの横断中（頂点から端への落下 g·t²/8）も見込む。
// 低く広い壁ほど横断時間が長く、この項が支配的になる。timing 誤差ぶん CROSS_SAFETY で上乗せ。
function apexNeededFor(o: Obstacle, playerWidth: number, speed: number): number {
  const overlapTime = (o.width + playerWidth + H_MARGIN) / speed
  return o.height + V_MARGIN + ((PHYSICS.gravity * overlapTime * overlapTime) / 8) * CROSS_SAFETY
}

// 最高到達点 apex に達するまでのおおよその時間(s)。弧の頂点を障害物に合わせる踏切に使う。
function timeToApex(apex: number): number {
  return Math.sqrt((2 * Math.max(0, apex)) / PHYSICS.gravity)
}

// 自動操縦（アトラクト / 眺めるモード）。最寄りの未通過障害物に対して、
// 「それを越えられる最小のジャンプ」を出す。低い壁＝小ホップ、高い/広い壁＝大きく、と
// 自動で出し分けることで滞空を最小化し、連続障害物のリズムを保つ（早離しカット物理を利用）。
// オートは単体障害物のみ生成するので、空中で狙う対象は切り替わらず無状態で成立する。
// 表示・体験専用で、採点や地形には影響しない。
export function autoInput(player: Player, obstacles: Obstacle[], speed: number): AutoInput {
  const playerCenter = player.x + player.width / 2

  // プレイヤーより前にある、まだ通過していない最寄りの障害物を探す
  let nearest: Obstacle | null = null
  for (const o of obstacles) {
    if (o.x + o.width <= player.x + player.width) continue // すでに通過済み
    if (!nearest || o.x < nearest.x) nearest = o
  }
  if (!nearest) return { jump: false, hold: false }

  const apexNeeded = apexNeededFor(nearest, player.width, speed)

  // hold は接地中・空中を問わず「必要な高さに届くまで押し続ける」で計算する。
  // 接地中の値は player.update では無視されるが、踏み切りフレーム（跳んだ直後＝空中扱い）で
  // hold=true になることで、離した瞬間にカットされて小ホップになる事故を防ぐ。
  // 届いたら release＝早離しカットで頂点を必要分に抑える＝最小の跳び。
  const currentRise = GROUND_Y - player.height - player.y // 地面からの上昇量（接地時0）
  const risingSpeed = Math.max(-player.vy, 0) // 上向き速度（接地/落下時0）
  const cutRise = Math.min(risingSpeed, PHYSICS.cutVelocity) ** 2 / (2 * PHYSICS.gravity)
  const hold = currentRise + cutRise < apexNeeded

  // 踏み切り: 弧の頂点が障害物の中心に来るタイミングで（必要 apex に応じてリードが変わる）
  let jump = false
  if (player.grounded) {
    const lead = timeToApex(apexNeeded) * AUTO.leadBias
    const timeToReach = (nearest.x + nearest.width / 2 - playerCenter) / speed
    jump = timeToReach > 0 && timeToReach <= lead
  }

  return { jump, hold }
}
