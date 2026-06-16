import { Pane } from 'tweakpane'
import { OBSTACLE, PHYSICS, SPEED } from './config'

// config の値を実行中に調整するための Tweakpane パネル。
// バインド先は config のオブジェクトそのものなので、スライダーを動かすと
// player / world の挙動に即座に反映される（次のランからのものは個別に注記）。
export function setupTweakPanel() {
  // 「デフォルトに戻す」用に初期値を控えておく。
  const defaults = {
    physics: { ...PHYSICS },
    speed: { ...SPEED },
    obstacle: { ...OBSTACLE },
  }

  const pane = new Pane({ title: 'Tune ⚙ (H で開閉)' })

  const jump = pane.addFolder({ title: 'ジャンプ' })
  jump.addBinding(PHYSICS, 'gravity', { min: 1000, max: 5000, step: 50 })
  jump.addBinding(PHYSICS, 'jumpVelocity', { label: 'jumpVel', min: 400, max: 1200, step: 10 })
  jump.addBinding(PHYSICS, 'holdGravityScale', { label: 'holdScale', min: 0, max: 1, step: 0.01 })
  jump.addBinding(PHYSICS, 'maxHoldTime', { label: 'maxHold', min: 0, max: 0.6, step: 0.01 })

  const speed = pane.addFolder({ title: 'スピード' })
  speed.addBinding(SPEED, 'start', { min: 150, max: 700, step: 10 })
  speed.addBinding(SPEED, 'max', { min: 300, max: 1200, step: 10 })
  speed.addBinding(SPEED, 'accel', { min: 0, max: 40, step: 1 })

  const obstacle = pane.addFolder({ title: '障害物' })
  obstacle.addBinding(OBSTACLE, 'minGap', { min: 150, max: 800, step: 10 })
  obstacle.addBinding(OBSTACLE, 'maxGap', { min: 200, max: 1000, step: 10 })
  obstacle.addBinding(OBSTACLE, 'minWidth', { min: 8, max: 80, step: 1 })
  obstacle.addBinding(OBSTACLE, 'maxWidth', { min: 8, max: 80, step: 1 })
  obstacle.addBinding(OBSTACLE, 'minHeight', { min: 10, max: 100, step: 1 })
  obstacle.addBinding(OBSTACLE, 'maxHeight', { min: 10, max: 120, step: 1 })

  pane.addBlade({ view: 'separator' })
  pane.addButton({ title: 'デフォルトに戻す' }).on('click', () => {
    Object.assign(PHYSICS, defaults.physics)
    Object.assign(SPEED, defaults.speed)
    Object.assign(OBSTACLE, defaults.obstacle)
    pane.refresh()
  })

  // H キーでパネルを開閉（ジャンプキーとは衝突しない）。
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') pane.hidden = !pane.hidden
  })
}
