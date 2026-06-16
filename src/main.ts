import './style.css'
import { Game } from './game'
import { setupTweakPanel } from './tweak'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('#game canvas not found')

const game = new Game(canvas)
game.start()

setupTweakPanel()

// 開発時のみ: デバッグ/手動チューニング用にゲームインスタンスを公開する
if (import.meta.env.DEV) {
  ;(window as unknown as { game: Game }).game = game
}
