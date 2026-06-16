// ジャンプ入力をまとめる。キー・マウス・タッチを区別せず「押した瞬間」と
// 「押し続けているか」の2つだけを公開する。

const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW'])

export class Input {
  /** ジャンプ入力が押されている間 true（長押し判定に使う） */
  holding = false
  /** 押し始めたフレームだけ true。takePress() で1回だけ取り出す */
  private pressed = false

  constructor(target: HTMLElement) {
    const press = () => {
      if (!this.holding) this.pressed = true
      this.holding = true
    }
    const release = () => {
      this.holding = false
    }

    window.addEventListener('keydown', (e) => {
      if (!JUMP_CODES.has(e.code)) return
      e.preventDefault()
      if (!e.repeat) press()
    })
    window.addEventListener('keyup', (e) => {
      if (!JUMP_CODES.has(e.code)) return
      release()
    })

    target.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      press()
    })
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
  }

  /** 押下を1回だけ消費する。押された瞬間に true を返し、フラグをクリアする */
  takePress(): boolean {
    if (this.pressed) {
      this.pressed = false
      return true
    }
    return false
  }
}
