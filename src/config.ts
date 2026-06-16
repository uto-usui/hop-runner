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

// 障害物の個々のサイズは patterns.ts が距離に応じて決める。
// ここはパターンとパターンの「間隔」だけを持つ。
export const OBSTACLE = {
  minGap: 290, // px パターン間の最小間隔
  maxGap: 580, // px 最大間隔
}

// ---- 演出（juice）系のチューニング値 ----

// 画面シェイク（trauma 方式）。maxPx=0 で完全オフ（酔い対策にもなる）。
export const SHAKE = {
  maxPx: 8, // 最大変位(px)。trauma=1 のとき
  recover: 1.1, // trauma が 1→0 に戻るのにかかる秒
  landMin: 0.1, // 着地の最小トラウマ（小ホップはほぼ無感）
  landScale: 0.0006, // 着地トラウマの落下速度係数（landMin + |vy|*landScale）
  death: 0.9, // 死亡時のトラウマ
  nearMiss: 0.08, // ニアミス時のトラウマ（極小）
}

// プレイヤーの伸縮・パーティクル・ヒットストップ等のまとめ。
export const JUICE = {
  squash: {
    velStretch: 0.00045, // 上下速度に対する伸び係数（空中での躍動）
    landSquash: 0.0009, // 着地の潰れ係数（|着地速度| に対して）
    maxStretch: 0.38, // 伸縮の上限
    spring: 22, // 元の形へ戻る硬さ（大きいほど速く戻る）
  },
  particles: {
    max: 180, // パーティクル上限（固定長プール）
    landDustBase: 5, // 着地土埃の基本数（着地の勢いで増える）
    jumpKick: 4, // ジャンプ蹴り出しの数
    deathShards: 18, // 死亡破片の数
  },
  hitStopDeath: 0.1, // s 死亡時のフリーズ（衝撃を焼き付ける）
  hitStopNearMiss: 0.04, // s ニアミス時のスロー（Phase 2 で使用）
  retryLock: 0.25, // s 死亡後の入力ロック（連打事故と GAME OVER の見落とし防止）
  // 死亡後、破片の飛散を見せてから GAME OVER 幕を出すための余韻。
  deathLinger: 0.2, // s この間は幕を出さず破片を見せる
  deathOverlayFade: 0.15, // s 余韻のあと幕をこの時間でフェードイン
}

// サウンド（WebAudio 手続き生成）。muted で全体オフ。
export const AUDIO = {
  master: 0.18, // マスター音量（クリップ防止に控えめ）
  muted: false,
}

// スコア・コンボ・ニアミス。腕（攻めの近接通過）が報われる設計。
export const SCORE = {
  pointsPerMeter: 1, // 距離スコアの基本係数（距離/10 × これ × 倍率）
  nearMissPx: 22, // この隙間(px)未満で障害物を越えるとニアミス
  nearMissBonus: 60, // ニアミス1回の基本ボーナス（× 倍率）
  comboGain: 0.25, // 倍率 = 1 + ニアミス連続数 × これ
  maxMultiplier: 5, // 倍率上限
  nearMissSlowFactor: 0.32, // ニアミス時のスロー倍率（0..1、小さいほど遅い）
  milestoneDist: 5000, // px ごとのマイルストーン
  milestoneBonus: 300, // マイルストーンのボーナス
  floaterLife: 0.9, // 浮遊加点テキストの寿命(s)
}

// 障害物パターン生成。可変ジャンプ（高さ/距離の出し分け）の習熟を要求する地形を作る。
export const PATTERN = {
  safetyHeightRatio: 0.85, // タップジャンプ最高到達点に対する、許容する最大障害物高さの比
  safetyWidthRatio: 0.5, // 滞空中に進める距離に対する、許容する最大障害物幅の比
  landingBufferPx: 80, // 連続障害物の間に必要な着地猶予（px）
  difficultyRampDist: 7000, // この距離で難易度の重みが後半カーブへ移行
}

// 多層パララックス背景の流れる速さ（地面=1.0 に対する比。奥ほど遅い）。
export const PARALLAX = {
  far: 0.15,
  mid: 0.4,
  near: 0.7,
}

// 時間帯×バイオームのシーン切替。
export const THEME = {
  biomeDist: 4000, // px ごとにシーン（時間帯/バイオーム）が変わる
  crossfadePx: 1000, // シーン境界手前で次へクロスフェードする幅
}

// 速度連動の演出（トレイル・ビネット・カメラ引き・スピードライン）。
export const VFX = {
  trailFrames: 6, // プレイヤー残像の枚数
  trailAlpha: 0.22, // 残像の最大不透明度
  vignetteBase: 0.04, // 画面端ビネットの基本濃さ
  vignetteMax: 0.2, // 最高速での追加濃さ
  zoomOut: 0.04, // 最高速でのカメラ引き量（4%）
  speedLineThreshold: 0.45, // この正規化速度を超えるとスピードライン
  speedLineRate: 22, // 1秒あたりのスピードライン本数（最高速時）
}

// 収集オーブ。特定の高さで取る＝ジャンプ高さ精度に意味を持たせる。取れなくても死なない。
export const ORB = {
  minGap: 520, // px オーブ出現の最小間隔
  maxGap: 1100, // px 最大間隔
  spawnChance: 0.7, // 間隔到達時に実際に出す確率
  minHeight: 55, // 地面からの最小高さ（低い＝小ジャンプで取れる）
  maxHeight: 116, // 最大高さ（高い＝長押しの高ジャンプが要る、到達可能範囲内）
  radius: 9, // 見た目の半径
  grabRadius: 30, // 取得判定の半径（甘め）
  points: 50, // 取得スコア
}

// シードモード。daily を on にすると当日の地形が固定され、毎日みんな同じ地形で競える。
export const SEED = {
  daily: false,
}
