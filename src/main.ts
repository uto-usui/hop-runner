import './style.css'
import { Game } from './game'
import { setupTweakPanel } from './tweak'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('#game canvas not found')

const game = new Game(canvas)
game.start()

setupTweakPanel()
