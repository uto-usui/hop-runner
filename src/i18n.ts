// 表示テキストの単一の出所。Canvas / DOM のどちらの文言もここから引く（直書きしない）。
// 言語は navigator.language で自動判定し、手動切替を localStorage に保存する。
// 表示専用のモジュール。当たり判定・採点・地形/オーブの決定論（共有 Rng）には一切関与しない。

export type Locale = 'ja' | 'en'

const STORAGE_KEY = 'hop-runner.locale'
const LOCALES: Locale[] = ['ja', 'en']

// 表示文字列のキー。新しいテキストを足すときはここに加えて全ロケールを埋め、t() で引く。
interface Messages {
  title: string
  readySub: string
  gameover: string
  gameoverSub: string
  hudHi: string
  hudCombo: string
  hudDaily: string
  markerBest: string
  floaterNear: string
  meterUnit: string
  hint: string
  docTitle: string
  langSwitch: string // 言語トグルに出す「切替先」のラベル
}

type MessageKey = keyof Messages

// ja は現状の画面と 1:1 で一致させる（アーケード調の英語ラベルは据え置き）。
// 日↔英で実際に変わるのは操作説明の文（スタート / リトライ / hint）のみ。
const STRINGS: Record<Locale, Messages> = {
  ja: {
    title: 'HOP RUNNER',
    readySub: 'SPACE / タップ でスタート',
    gameover: 'GAME OVER',
    gameoverSub: 'SPACE / タップ でリトライ',
    hudHi: 'HI',
    hudCombo: 'NEAR COMBO',
    hudDaily: 'DAILY',
    markerBest: 'BEST',
    floaterNear: 'NEAR',
    meterUnit: 'm',
    hint: 'SPACE / タップ でジャンプ（長押しで高く） ・ H で調整パネル',
    docTitle: 'Hop Runner',
    langSwitch: 'EN',
  },
  en: {
    title: 'HOP RUNNER',
    readySub: 'SPACE / TAP to start',
    gameover: 'GAME OVER',
    gameoverSub: 'SPACE / TAP to retry',
    hudHi: 'HI',
    hudCombo: 'NEAR COMBO',
    hudDaily: 'DAILY',
    markerBest: 'BEST',
    floaterNear: 'NEAR',
    meterUnit: 'm',
    hint: 'SPACE / TAP to jump (hold to go higher) · H: tuning panel',
    docTitle: 'Hop Runner',
    langSwitch: '日本語',
  },
}

function isLocale(v: string | null): v is Locale {
  return v === 'ja' || v === 'en'
}

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (isLocale(saved)) return saved
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

let current: Locale = detectLocale()
const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return current
}

/** ロケールを設定し、保存・<html lang> 更新・購読者への通知まで行う */
export function setLocale(locale: Locale) {
  current = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
  for (const cb of listeners) cb()
}

/** 次のロケールへ循環（将来ロケールを足したら LOCALES を順に回る） */
export function cycleLocale() {
  const i = LOCALES.indexOf(current)
  setLocale(LOCALES[(i + 1) % LOCALES.length]!)
}

/** DOM 側テキスト（hint / title / トグル表示）の更新を購読する。
 *  Canvas 内テキストは毎フレーム t() を読むので購読不要。 */
export function onLocaleChange(cb: () => void) {
  listeners.add(cb)
}

/** 現在ロケールの文字列を引く */
export function t(key: MessageKey): string {
  return STRINGS[current][key]
}
