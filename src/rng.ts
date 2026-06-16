// シード可能な擬似乱数（xorshift32）。デイリーシードのために決定論的にできる。
// シードを渡さなければ Math.random で初期化＝毎回ランダム（従来挙動と同等）。
export class Rng {
  private state: number

  constructor(seed?: number) {
    this.state = (seed ?? Math.floor(Math.random() * 0x7fffffff)) >>> 0
    if (this.state === 0) this.state = 0x9e3779b9 // 0 は縮退するので回避
  }

  /** [0, 1) */
  next(): number {
    let x = this.state
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.state = x >>> 0
    return (this.state & 0xffffff) / 0x1000000
  }

  /** [min, max) の実数 */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** 確率 p (0..1) で true */
  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!
  }
}

/** YYYY-MM-DD などの文字列から安定なシード値を作る（デイリーシード用） */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
