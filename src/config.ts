// ゲーム全体のチューニング値。数字をいじるだけで手触りが変わるので、
// まずはここを触って気持ちいいジャンプを探すのがおすすめ。

/** 内部解像度（描画はこの座標系で行い、CSS で画面幅にスケールする） */
export const VIEW = { width: 900, height: 300 } as const

/** 地面の上面の y 座標 */
export const GROUND_Y = 252

export const PLAYER = {
  x: 90, // プレイヤーは画面左寄りに固定
  width: 38,
  height: 44,
} as const

// PHYSICS / SPEED / OBSTACLE は Tweakpane から実行中に書き換えるため、
// あえて readonly（as const）にせず可変オブジェクトにしている。
// player / world は毎フレームこれらを読むので、値を変えると即座に反映される。

export const PHYSICS = {
  gravity: 2600, // px/s^2 通常の重力（落下中・ジャンプを離した後）
  jumpVelocity: 780, // px/s ジャンプ開始時の上向き初速
  holdGravityScale: 0.42, // 上昇中に押し続けている間の重力倍率（小さいほど高く飛べる）
  maxHoldTime: 0.22, // s この時間を超えると長押しの効果は切れる
}

export const SPEED = {
  start: 320, // px/s 初期スクロール速度（次のランから反映）
  max: 640, // px/s 最高速
  accel: 9, // px/s 1秒あたりに増える速度（難易度の上がり方）
}

export const OBSTACLE = {
  minGap: 290, // px 障害物どうしの最小間隔
  maxGap: 580, // px 最大間隔
  minWidth: 18,
  maxWidth: 42,
  minHeight: 28,
  maxHeight: 62, // jumpVelocity/gravity で越えられる高さに収めること
}
