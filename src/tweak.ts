import { Pane } from 'tweakpane'
import {
  AUDIO, JUICE, OBSTACLE, ORB, PARALLAX, PATTERN, PHYSICS, SCORE, SEED, SHAKE, SPEED, THEME, VFX,
} from './config'

// config の値を実行中に調整するための Tweakpane パネル。
// バインド先は config のオブジェクトそのものなので、スライダーを動かすと
// player / world の挙動に即座に反映される（次のランからのものは個別に注記）。
export function setupTweakPanel() {
  // 「デフォルトに戻す」用に初期値を控えておく。
  const defaults = {
    physics: { ...PHYSICS },
    speed: { ...SPEED },
    obstacle: { ...OBSTACLE },
    pattern: { ...PATTERN },
    score: { ...SCORE },
    shake: { ...SHAKE },
    audio: { ...AUDIO },
    squash: { ...JUICE.squash },
    deaths: { deathLinger: JUICE.deathLinger, deathOverlayFade: JUICE.deathOverlayFade },
    theme: { ...THEME },
    parallax: { ...PARALLAX },
    vfx: { ...VFX },
    orb: { ...ORB },
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

  const pattern = pane.addFolder({ title: '障害物 / パターン', expanded: false })
  pattern.addBinding(OBSTACLE, 'minGap', { label: '間隔min', min: 150, max: 800, step: 10 })
  pattern.addBinding(OBSTACLE, 'maxGap', { label: '間隔max', min: 200, max: 1000, step: 10 })
  pattern.addBinding(PATTERN, 'difficultyRampDist', { label: '難易度ramp', min: 2000, max: 20000, step: 500 })
  pattern.addBinding(PATTERN, 'landingBufferPx', { label: '連続の間隔', min: 40, max: 160, step: 5 })
  pattern.addBinding(PATTERN, 'safetyHeightRatio', { label: '高さ安全率', min: 0.5, max: 1, step: 0.05 })

  const score = pane.addFolder({ title: 'スコア / ニアミス', expanded: false })
  score.addBinding(SCORE, 'nearMissPx', { label: 'ニアミス幅', min: 6, max: 50, step: 1 })
  score.addBinding(SCORE, 'nearMissBonus', { label: 'ニアミス点', min: 0, max: 200, step: 10 })
  score.addBinding(SCORE, 'comboGain', { label: 'コンボ倍率増', min: 0, max: 1, step: 0.05 })
  score.addBinding(SCORE, 'maxMultiplier', { label: '倍率上限', min: 1, max: 10, step: 1 })
  score.addBinding(SCORE, 'nearMissSlowFactor', { label: 'スロー', min: 0.1, max: 1, step: 0.02 })

  const feel = pane.addFolder({ title: '演出: 手触り', expanded: false })
  feel.addBinding(SHAKE, 'maxPx', { label: 'シェイク強(0で無効)', min: 0, max: 20, step: 1 })
  feel.addBinding(SHAKE, 'recover', { label: 'シェイク戻り', min: 0.3, max: 3, step: 0.05 })
  feel.addBinding(SHAKE, 'death', { label: 'シェイク死亡', min: 0, max: 1, step: 0.05 })
  feel.addBinding(JUICE.squash, 'velStretch', { label: '伸び', min: 0, max: 0.001, step: 0.00005 })
  feel.addBinding(JUICE.squash, 'landSquash', { label: '潰れ', min: 0, max: 0.002, step: 0.0001 })
  feel.addBinding(JUICE.squash, 'spring', { label: 'バネ戻り', min: 5, max: 40, step: 1 })
  feel.addBinding(JUICE, 'deathLinger', { label: '死亡幕の遅延(s)', min: 0, max: 1.5, step: 0.05 })
  feel.addBinding(JUICE, 'deathOverlayFade', { label: '死亡幕フェード(s)', min: 0.1, max: 1.5, step: 0.05 })

  const scene = pane.addFolder({ title: '背景 / 速度', expanded: false })
  scene.addBinding(THEME, 'biomeDist', { label: 'シーン長', min: 1500, max: 12000, step: 500 })
  scene.addBinding(THEME, 'crossfadePx', { label: 'フェード幅', min: 200, max: 3000, step: 100 })
  scene.addBinding(VFX, 'vignetteMax', { label: 'ビネット', min: 0, max: 0.5, step: 0.02 })
  scene.addBinding(VFX, 'zoomOut', { label: 'カメラ引き', min: 0, max: 0.12, step: 0.005 })
  scene.addBinding(VFX, 'trailAlpha', { label: '残像', min: 0, max: 0.5, step: 0.02 })

  const sound = pane.addFolder({ title: 'サウンド (M でミュート)', expanded: false })
  sound.addBinding(AUDIO, 'muted', { label: 'ミュート' })
  sound.addBinding(AUDIO, 'master', { label: '音量', min: 0, max: 0.5, step: 0.01 })

  const extra = pane.addFolder({ title: 'オーブ / シード', expanded: false })
  extra.addBinding(ORB, 'spawnChance', { label: 'オーブ頻度', min: 0, max: 1, step: 0.05 })
  extra.addBinding(ORB, 'points', { label: 'オーブ点', min: 0, max: 200, step: 10 })
  extra.addBinding(SEED, 'daily', { label: 'デイリー(次回〜)' })

  pane.addBlade({ view: 'separator' })
  pane.addButton({ title: 'デフォルトに戻す' }).on('click', () => {
    Object.assign(PHYSICS, defaults.physics)
    Object.assign(SPEED, defaults.speed)
    Object.assign(OBSTACLE, defaults.obstacle)
    Object.assign(PATTERN, defaults.pattern)
    Object.assign(SCORE, defaults.score)
    Object.assign(SHAKE, defaults.shake)
    Object.assign(AUDIO, defaults.audio)
    Object.assign(JUICE.squash, defaults.squash)
    Object.assign(JUICE, defaults.deaths)
    Object.assign(THEME, defaults.theme)
    Object.assign(PARALLAX, defaults.parallax)
    Object.assign(VFX, defaults.vfx)
    Object.assign(ORB, defaults.orb)
    pane.refresh()
  })

  // H キーでパネルを開閉（ジャンプキーとは衝突しない）。
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') pane.hidden = !pane.hidden
  })
}
