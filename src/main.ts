import './style.css'
import { Game } from './game'
import { setupTweakPanel } from './tweak'
import { cycleLocale, getLocale, onLocaleChange, setLocale, t } from './i18n'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('#game canvas not found')

const game = new Game(canvas)
game.start()

setupTweakPanel()

// 言語: DOM 側テキスト（hint / ページタイトル / トグル表示）を現在ロケールに同期する。
// Canvas 内テキストは game / score が毎フレーム t() を読むので、ここでの更新は不要。
const hintEl = document.querySelector<HTMLElement>('.hint')
const langButton = document.querySelector<HTMLButtonElement>('#lang')

function syncDomText() {
  document.title = t('docTitle')
  if (hintEl) hintEl.textContent = t('hint')
  if (langButton) langButton.textContent = t('langSwitch')
}
onLocaleChange(syncDomText)
setLocale(getLocale()) // 初期適用: 自動判定 / 保存値を <html lang> と DOM テキストに反映

langButton?.addEventListener('click', () => {
  cycleLocale()
  langButton.blur() // フォーカスを外し、以後の SPACE がボタンを再操作しないように
})
// L キーで言語切替（M=ミュート / H=パネルと同じ隠しショートカット）
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL') cycleLocale()
})

// 開発時のみ: デバッグ/手動チューニング用にゲームインスタンスを公開する
if (import.meta.env.DEV) {
  ;(window as unknown as { game: Game }).game = game
}
