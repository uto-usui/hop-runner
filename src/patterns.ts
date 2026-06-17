import { OBSTACLE, PATTERN, PHYSICS, PLAYER } from './config'
import { Rng } from './rng'

export type ObstacleKind = 'block' | 'low' | 'tall'

export interface SpawnSpec {
  dx: number // パターン先頭からの相対 x
  width: number
  height: number
  kind: ObstacleKind
}

// --- クリア可能エンベロープ（現在の PHYSICS / speed から算出） ---
// 「標準ジャンプで越えられる」ことを保証し、理不尽な壁を出さない。
// 基準は jumpVelocity 由来の「標準ジャンプ」（早離しカットも長押しfloatもしない素のジャンプ）。
// 早離しの小ホップ（cutVelocity 由来）はこれより小さいので基準にしない。

/** 標準ジャンプの最高到達点(px)。jumpVelocity 由来＝早離し/floatなしの素の山 */
function standardApex(): number {
  return (PHYSICS.jumpVelocity * PHYSICS.jumpVelocity) / (2 * PHYSICS.gravity)
}

/** 標準ジャンプの滞空時間(s) */
function standardAirtime(): number {
  return (2 * PHYSICS.jumpVelocity) / PHYSICS.gravity
}

export function maxClearableHeight(): number {
  return standardApex() * PATTERN.safetyHeightRatio
}

export function maxClearableWidth(speed: number): number {
  return speed * standardAirtime() * PATTERN.safetyWidthRatio
}

// 連続した障害物を「着地して跳び直す」で越えるには、障害物どうしの間隔が
// 少なくとも 1 ジャンプの滞空時間ぶん（速度×滞空時間）必要。逆に解くと、最小間隔
// minGap で詰めて並んでも越えられる最大速度は minGap / 滞空時間。これを超えると
// 高速域で間隔が詰まり、腕に関係なく避けられない＝運ゲーになる。world が実速度をこれにクランプする。
export function maxClearableSpeed(): number {
  return OBSTACLE.minGap / standardAirtime()
}

// --- 連続パターンの「1ジャンプ越え」保証（方針A） ---
// 固定威力ジャンプ（最低でも滞空 0.6s）では連続ブロックの狭い隙間に着地できないため、
// 連続パターンは「1回の長押しジャンプで全部を跨げる」長さに収める。そうすれば理不尽
// （理論上避けられない配置）が出ない。長押しジャンプの「高さ H 以上を保てる滞空時間」を
// 物理から求め、その間に進める水平距離がプレイヤー幅＋スパンを覆える、を条件にする。

/** 長押しジャンプで高さ height(px) 以上を保てる滞空時間(s)。
 *  上昇は maxHoldTime まで減衰重力、以降は通常重力、下降は通常重力で区分積分する。 */
function timeAboveHeight(height: number): number {
  const g = PHYSICS.gravity
  const v0 = PHYSICS.jumpVelocity
  const holdG = g * PHYSICS.holdGravityScale
  const tHold = Math.min(PHYSICS.maxHoldTime, v0 / holdG) // 減衰重力が効く時間
  const yHold = v0 * tHold - 0.5 * holdG * tHold * tHold // 減衰区間終わりの高さ
  const vHold = v0 - holdG * tHold // 同時点の上向き速度
  const apex = yHold + (vHold * vHold) / (2 * g) // 長押し込みの最高到達点
  const h = Math.max(0, height)
  if (h >= apex) return 0

  const tApex = tHold + vHold / g
  // 高さ h を上向きに横切る時刻（h が減衰区間の高さ以下かどうかで分岐）
  const tUp =
    h <= yHold
      ? (v0 - Math.sqrt(v0 * v0 - 2 * holdG * h)) / holdG
      : tHold + (vHold - Math.sqrt(vHold * vHold - 2 * g * (h - yHold))) / g
  // 下向きに横切る時刻（頂点から自由落下）
  const tDown = tApex + Math.sqrt((2 * (apex - h)) / g)
  return tDown - tUp
}

/** 1回の長押しジャンプで、高さ height 以上を保ったまま跨げる連続パターンの最大スパン(px)。
 *  speed が低いほど（横移動が短いぶん）小さくなる＝低速ほど厳しい。安全余裕込み。 */
export function maxClearableSpan(speed: number, height: number): number {
  const verticalMargin = 4 // px 当たり判定の甘さ・誤差ぶん高めに見積もる
  const timeMargin = 1 / 30 // s フレーム離散・踏み切りタイミング誤差
  const horizontalMargin = 8 // px 端の余裕
  const highTime = Math.max(0, timeAboveHeight(height + verticalMargin) - timeMargin)
  return Math.max(0, speed * highTime - PLAYER.width - horizontalMargin)
}

function clampSpec(spec: SpawnSpec, speed: number): SpawnSpec {
  return {
    ...spec,
    height: Math.min(spec.height, maxClearableHeight()),
    width: Math.min(spec.width, maxClearableWidth(speed)),
  }
}

// 連続パターン（double/triple）の合計スパンを maxClearableSpan に収める。
// 収まらなければブロック間隔を一律圧縮し、圧縮しても無理（ブロック幅の合計すら超える）なら
// 先頭1個（single 相当）にフォールバックする。これで必ず1回の長押しジャンプで越えられる。
function clampPatternSpan(specs: SpawnSpec[], speed: number): SpawnSpec[] {
  if (specs.length <= 1) return specs
  const ordered = [...specs].sort((a, b) => a.dx - b.dx)
  const maxHeight = Math.max(...ordered.map((s) => s.height))
  const maxSpan = maxClearableSpan(speed, maxHeight)
  const last = ordered[ordered.length - 1]!
  const span = last.dx + last.width - ordered[0]!.dx
  if (span <= maxSpan) return ordered

  const widths = ordered.reduce((sum, s) => sum + s.width, 0)
  const totalGap = span - widths
  const targetGap = maxSpan - widths
  // ブロック幅の合計すら入らない＝詰めても1ジャンプで越えられないので single にフォールバック
  if (totalGap <= 0 || targetGap <= 0) return [{ ...ordered[0]!, dx: 0 }]

  const gapScale = targetGap / totalGap
  let x = 0
  return ordered.map((s, i) => {
    if (i === 0) return { ...s, dx: 0 }
    const prev = ordered[i - 1]!
    const rawGap = s.dx - (prev.dx + prev.width)
    x += prev.width + rawGap * gapScale
    return { ...s, dx: x }
  })
}

// --- パターンビルダー ---
// 各ビルダーは「現在の安全上限の範囲内」で形を返す。clampSpec で最終的に保証する。

type Builder = (rng: Rng, speed: number) => SpawnSpec[]

const single: Builder = (rng) => [
  { dx: 0, width: rng.range(18, 40), height: rng.range(28, 50), kind: 'block' },
]

// 低くて長い → 長く滞空する必要があり「長押し」が要る
const low: Builder = (rng, speed) => {
  const maxW = maxClearableWidth(speed)
  return [
    {
      dx: 0,
      width: Math.min(maxW, rng.range(56, 96)),
      height: rng.range(22, 34),
      kind: 'low',
    },
  ]
}

// 高くて薄い → 素早く高いジャンプが要る
const tall: Builder = (rng) => [
  { dx: 0, width: rng.range(16, 24), height: rng.range(48, maxClearableHeight()), kind: 'tall' },
]

// 2連 → 間に着地して跳び直すリズム
const double: Builder = (rng) => {
  const w1 = rng.range(18, 32)
  const h1 = rng.range(28, 46)
  const gap = PATTERN.landingBufferPx + rng.range(0, 40)
  return [
    { dx: 0, width: w1, height: h1, kind: 'block' },
    { dx: w1 + gap, width: rng.range(18, 32), height: rng.range(28, 46), kind: 'block' },
  ]
}

// 3連の階段リズム
const triple: Builder = (rng) => {
  const specs: SpawnSpec[] = []
  let x = 0
  for (let i = 0; i < 3; i++) {
    const w = rng.range(16, 28)
    specs.push({ dx: x, width: w, height: rng.range(26, 44), kind: 'block' })
    x += w + PATTERN.landingBufferPx + rng.range(0, 30)
  }
  return specs
}

interface Weighted {
  build: Builder
  // 進行度 p(0..1) における重み
  weight: (p: number) => number
}

const TABLE: Weighted[] = [
  { build: single, weight: (p) => 1.0 - 0.55 * p },
  { build: low, weight: (p) => 0.2 + 0.35 * p },
  { build: tall, weight: (p) => 0.2 + 0.35 * p },
  { build: double, weight: (p) => 0.05 + 0.5 * p },
  { build: triple, weight: (p) => Math.max(0, p - 0.45) * 1.2 },
]

// オート（眺める）モード用: 単体障害物のみ。固定威力のジャンプ（最低でも apex 117px /
// 滞空 0.6s）では連続ブロックの狭い隙間に着地できず弧が次のブロックに乗り上げるため、
// 自動プレイでは double / triple を出さない。単体は全速度でクリーンに越えられる。
const AUTO_TABLE: Weighted[] = [
  { build: single, weight: () => 1.0 },
  { build: low, weight: () => 0.6 },
  { build: tall, weight: () => 0.6 },
]

/** 距離に応じて重み付きでパターンを選び、安全な SpawnSpec[] を返す。
 *  auto=true（眺めるモード）では単体のみの AUTO_TABLE を使う。 */
export function pickPattern(distance: number, speed: number, rng: Rng, auto = false): SpawnSpec[] {
  const table = auto ? AUTO_TABLE : TABLE
  const p = Math.min(1, distance / PATTERN.difficultyRampDist)
  const weights = table.map((w) => Math.max(0, w.weight(p)))
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = rng.next() * sum
  let chosen = table[0]!
  for (let i = 0; i < table.length; i++) {
    r -= weights[i]!
    if (r <= 0) {
      chosen = table[i]!
      break
    }
  }
  const specs = chosen.build(rng, speed).map((s) => clampSpec(s, speed))
  return clampPatternSpan(specs, speed) // 連続パターンを1ジャンプ越え可能な長さに収める
}
