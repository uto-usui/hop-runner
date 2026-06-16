import { PATTERN, PHYSICS } from './config'
import { Rng } from './rng'

export type ObstacleKind = 'block' | 'low' | 'tall'

export interface SpawnSpec {
  dx: number // パターン先頭からの相対 x
  width: number
  height: number
  kind: ObstacleKind
}

// --- クリア可能エンベロープ（現在の PHYSICS / speed から算出） ---
// 「最低でもタップジャンプで越えられる」ことを保証し、理不尽な壁を出さない。

/** タップ（押しっぱなしなし）ジャンプの最高到達点(px) */
function tapApex(): number {
  return (PHYSICS.jumpVelocity * PHYSICS.jumpVelocity) / (2 * PHYSICS.gravity)
}

/** タップジャンプの滞空時間(s) */
function tapAirtime(): number {
  return (2 * PHYSICS.jumpVelocity) / PHYSICS.gravity
}

export function maxClearableHeight(): number {
  return tapApex() * PATTERN.safetyHeightRatio
}

export function maxClearableWidth(speed: number): number {
  return speed * tapAirtime() * PATTERN.safetyWidthRatio
}

function clampSpec(spec: SpawnSpec, speed: number): SpawnSpec {
  return {
    ...spec,
    height: Math.min(spec.height, maxClearableHeight()),
    width: Math.min(spec.width, maxClearableWidth(speed)),
  }
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

/** 距離に応じて重み付きでパターンを選び、安全な SpawnSpec[] を返す */
export function pickPattern(distance: number, speed: number, rng: Rng): SpawnSpec[] {
  const p = Math.min(1, distance / PATTERN.difficultyRampDist)
  const weights = TABLE.map((w) => Math.max(0, w.weight(p)))
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = rng.next() * sum
  let chosen = TABLE[0]!
  for (let i = 0; i < TABLE.length; i++) {
    r -= weights[i]!
    if (r <= 0) {
      chosen = TABLE[i]!
      break
    }
  }
  return chosen.build(rng, speed).map((s) => clampSpec(s, speed))
}
