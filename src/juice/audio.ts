import { AUDIO } from '../config'

// WebAudio による手続き生成サウンド（アセット不要）。Oscillator + Gain のエンベロープで鳴らす。
// クラス名を Sound にしているのは、グローバルの Audio(HTMLAudioElement) と衝突させないため。
export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  constructor() {
    // 自動再生ポリシー対策: 最初のユーザー操作で AudioContext を resume する。
    // （input.ts には手を入れず、独立した一度きりのリスナーで対応）
    const unlock = () => {
      this.ensure()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  toggleMute() {
    AUDIO.muted = !AUDIO.muted
  }

  /** 単発音。slideTo を渡すと freq を指数的にスライドさせる */
  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ) {
    if (AUDIO.muted) return
    this.ensure()
    if (!this.ctx || !this.master) return

    this.master.gain.value = AUDIO.master
    const t0 = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur)

    // attack(数ms) → decay/release。exponentialRamp は 0 不可なので 0.0001 を使う。
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    osc.connect(env).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.03)
  }

  jump() {
    this.blip(320, 0.14, 'square', 0.14, 560) // 上昇スライドで「跳ぶ」感
  }

  land(impact: number) {
    const g = Math.min(0.22, 0.05 + impact * 0.0002)
    this.blip(150, 0.1, 'sine', g, 80)
  }

  death() {
    this.blip(420, 0.5, 'sawtooth', 0.2, 55)
  }

  nearMiss() {
    this.blip(1250, 0.09, 'triangle', 0.11, 1750) // 高く短い「キラッ」
  }

  coin() {
    this.blip(1320, 0.06, 'square', 0.09, 1980) // オーブ取得の軽い高音
  }

  scoreTick() {
    this.blip(880, 0.04, 'square', 0.05)
  }

  /** マイルストーン到達のアルペジオ */
  milestone() {
    if (AUDIO.muted) return
    this.ensure()
    if (!this.ctx) return
    const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.16, 'triangle', 0.12), i * 70)
    })
  }
}
