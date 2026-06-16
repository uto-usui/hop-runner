import { THEME } from './config'

// 距離に応じて切り替わる配色（時間帯×バイオームを兼ねた「シーン」の列）。
// 各シーンは完全なパレット。境界付近でクロスフェードして滑らかに移り変わる＝旅してる感。
export interface Palette {
  skyTop: string
  skyBottom: string
  hillFar: string
  hillMid: string
  hillNear: string
  ground: string
  groundLine: string
  dash: string
  obstacle: string
  text: string
  subText: string
  overlay: string
}

// 朝 → 砂漠の昼 → 夕暮れ → 夜 → 霧の森 → トワイライト → (ループ)
const SCENES: Palette[] = [
  {
    skyTop: '#eaf2fb', skyBottom: '#f6f8fb', hillFar: '#dde6f0', hillMid: '#cdd9e8',
    hillNear: '#bcccdd', ground: '#eef2f7', groundLine: '#3a3f47', dash: '#aab4c0',
    obstacle: '#2f8f4e', text: '#2a2f37', subText: '#9098a3', overlay: '#f4f7fb',
  },
  {
    skyTop: '#bfe3f2', skyBottom: '#eaf7fb', hillFar: '#f0e3c0', hillMid: '#e8d39c',
    hillNear: '#dcc079', ground: '#f3ecdb', groundLine: '#6b5a3a', dash: '#cdbb98',
    obstacle: '#c2683a', text: '#4a3b22', subText: '#998a6a', overlay: '#f6efe0',
  },
  {
    skyTop: '#5b4b8a', skyBottom: '#f3a26b', hillFar: '#6e5a86', hillMid: '#8a5f72',
    hillNear: '#b5705f', ground: '#5c4a54', groundLine: '#2a1f33', dash: '#7a5f63',
    obstacle: '#e8a13a', text: '#fbeede', subText: '#d9bfa9', overlay: '#3a2c45',
  },
  {
    skyTop: '#0e1430', skyBottom: '#1c2750', hillFar: '#1a2348', hillMid: '#232f5e',
    hillNear: '#2c3a70', ground: '#161d3a', groundLine: '#0a0f22', dash: '#3a4774',
    obstacle: '#46d6a0', text: '#e8eefb', subText: '#8a96bd', overlay: '#0c1228',
  },
  {
    skyTop: '#cdd6cf', skyBottom: '#e8efe6', hillFar: '#b9c9b3', hillMid: '#9fb597',
    hillNear: '#82a079', ground: '#dde6d8', groundLine: '#36452f', dash: '#a7b8a0',
    obstacle: '#357a3e', text: '#2c3a26', subText: '#7d8a76', overlay: '#e6ece2',
  },
  {
    skyTop: '#2a3b66', skyBottom: '#f3b7c2', hillFar: '#4a5a86', hillMid: '#7a6f9e',
    hillNear: '#b07f9e', ground: '#50465e', groundLine: '#221b2e', dash: '#6e6080',
    obstacle: '#f06a8a', text: '#fbeef2', subText: '#d7c0cb', overlay: '#322843',
  },
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

const KEYS: (keyof Palette)[] = [
  'skyTop', 'skyBottom', 'hillFar', 'hillMid', 'hillNear', 'ground',
  'groundLine', 'dash', 'obstacle', 'text', 'subText', 'overlay',
]

function lerpPalette(a: Palette, b: Palette, t: number): Palette {
  const out = {} as Palette
  for (const k of KEYS) out[k] = lerpColor(a[k], b[k], t)
  return out
}

/** 距離に応じたパレットを返す。バイオーム境界の手前 crossfadePx で次のシーンへ補間する */
export function themeAt(distance: number): Palette {
  const i = Math.floor(distance / THEME.biomeDist) % SCENES.length
  const next = (i + 1) % SCENES.length
  const within = distance % THEME.biomeDist
  const fadeStart = THEME.biomeDist - THEME.crossfadePx
  if (within <= fadeStart) return SCENES[i]!
  const t = (within - fadeStart) / THEME.crossfadePx
  return lerpPalette(SCENES[i]!, SCENES[next]!, t)
}
