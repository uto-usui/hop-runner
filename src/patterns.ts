import { OBSTACLE, PATTERN, PHYSICS, PLAYER, SPEED } from './config'
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

function clampSpec(spec: SpawnSpec, speed: number): SpawnSpec {
  return {
    ...spec,
    height: Math.min(spec.height, maxClearableHeight()),
    width: Math.min(spec.width, maxClearableWidth(speed)),
  }
}

// --- 連続パターンの「間で跳ぶ」保証（hop-between） ---
// 固定威力ジャンプでは狭い隙間に着地できないので、連続ブロックは「1つ越えて着地し、また跳ぶ」
// に足る間隔まで広げる。各ブロックは clampSpec 済み＝個別に越えられるので、間に着地できれば
// 必ずクリア可能。間隔は SPEED.max 基準（到達時に速くなっても保証されるよう最悪値）で見積もる。

const GAP_MARGIN = 24 // px 着地余裕
const CROSS_SAFETY = 1.5 // 横断項の安全係数（autopilot と揃える）

// 高さ h・幅 w のブロックを「最小ジャンプで越える」のに必要な滞空時間(s)。SPEED.max 基準。
function clearAirtime(h: number, w: number): number {
  const g = PHYSICS.gravity
  const overlapTime = (w + PLAYER.width + 10) / SPEED.max
  const apexNeeded = h + 6 + ((g * overlapTime * overlapTime) / 8) * CROSS_SAFETY
  return 2 * Math.sqrt((2 * apexNeeded) / g)
}

// 連続ブロックを着地して跳び直すのに必要な中心間隔(px)。D ≈ SPEED.max·滞空（1つ越えて降り、
// 次を踏み切るのが間に合う距離）＋着地余裕。
function requiredCenterGap(h: number, w: number): number {
  return SPEED.max * clearAirtime(h, w) + GAP_MARGIN
}

// 連続パターンのブロック間隔を「間で跳べる」最小中心間隔以上に広げる（狭ければ広げるだけ）。
// 広げる方向なので常にクリア可能になる。rng は消費しない（決定論を保つ）。
function clampPatternGaps(specs: SpawnSpec[]): SpawnSpec[] {
  if (specs.length <= 1) return specs
  const ordered = [...specs].sort((a, b) => a.dx - b.dx)
  const out: SpawnSpec[] = [{ ...ordered[0]!, dx: 0 }]
  for (let i = 1; i < ordered.length; i++) {
    const s = ordered[i]!
    const prev = out[i - 1]!
    const need = requiredCenterGap(Math.max(prev.height, s.height), Math.max(prev.width, s.width))
    const origCenterGap =
      ordered[i]!.dx + s.width / 2 - (ordered[i - 1]!.dx + ordered[i - 1]!.width / 2)
    const centerGap = Math.max(need, origCenterGap)
    const center = prev.dx + prev.width / 2 + centerGap
    out.push({ ...s, dx: center - s.width / 2 })
  }
  return out
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

// 2連リズム → 小ホップで1つ越え、間に着地してまた跳ぶ。低く細いブロック（hop-between 用）。
// 間隔は clampPatternGaps が「間で跳べる」最小値まで広げるので、ここは下限の目安でよい。
const double: Builder = (rng) => {
  const w1 = rng.range(16, 26)
  const gap = PATTERN.landingBufferPx + rng.range(0, 40)
  return [
    { dx: 0, width: w1, height: rng.range(22, 34), kind: 'block' },
    { dx: w1 + gap, width: rng.range(16, 26), height: rng.range(22, 34), kind: 'block' },
  ]
}

// 3連リズム → 同上の小ホップ連打。
const triple: Builder = (rng) => {
  const specs: SpawnSpec[] = []
  let x = 0
  for (let i = 0; i < 3; i++) {
    const w = rng.range(16, 24)
    specs.push({ dx: x, width: w, height: rng.range(22, 32), kind: 'block' })
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
  return clampPatternGaps(specs) // 連続パターンを「間で跳べる」間隔まで広げる
}
