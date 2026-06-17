# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Hop Runner は Canvas 2D + TypeScript + Vite 製の、ジャンプ1入力だけのオートランナー。
ゲーム性・操作・遊びの要素は `README.md` に詳しい。ここでは「コードを触るために必要な構造と不変条件」に絞る。

## コマンド

パッケージマネージャは **pnpm**（`npm`/`yarn` 不可）。

```sh
pnpm dev        # 開発サーバー (http://localhost:5173)、base は /
pnpm build      # tsc（型チェック）→ vite build。dist/ へ。base は /hop-runner/
pnpm preview    # ビルド結果をローカル確認
pnpm typecheck  # tsc --noEmit（型チェックのみ）
```

- **テストランナーもリンターも無い。唯一の自動ゲートが `tsc`。** lefthook の pre-commit が、`*.ts` をステージしたコミットで `pnpm typecheck` を走らせる（`tsc` はプロジェクト全体を見るため glob はトリガー判定だけ）。コミット前に手元で `pnpm typecheck` を通すこと。
- tsconfig は strict + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`。未使用変数・引数も型エラーになる。
- デプロイは `main` への push で GitHub Pages へ自動（`.github/workflows/deploy.yml`）。`vite.config.ts` が本番ビルドだけ `base` を `/hop-runner/` に切り替えるので、ホスティング先パスを変えるならここ。

## アーキテクチャの要点

### Game が唯一のオーケストレータ、他はほぼ純粋なシミュレーション
`game.ts`（最大のファイル）が requestAnimationFrame ループ・状態機械・当たり判定・採点の配線・**全描画**を持つ。
他モジュールは状態を持つが描画しない: `player`（可変ジャンプ物理）/ `world`（地面スクロール＋障害物列）/ `patterns`（障害物形状の生成）/ `score`（スコア・コンボ）/ `collectibles`（オーブ）/ `theme`（配色補間）/ `rng` / `i18n`（表示テキストの単一の出所）。`juice/`（`camera`・`particles`・`audio`）は手触り演出。新しい描画は基本 `game.ts` の `draw*` 群に足す。

### 2つの時計（最重要の不変条件）
ループには通常の `dt` とは別に演出用の時間レイヤーがある。混同すると挙動が壊れる:
- **`freeze`（死亡ヒットストップ）**: `>0` の間はゲームもパーティクルも止め、`camera.update` と `render` だけ走らせて衝撃を焼き付ける。
- **`slow`（ニアミスのスロー）**: ゲーム時間 `gameDt` だけ `nearMissSlowFactor` で遅くし、パーティクルとカメラは実時間 `dt` のまま。
- `dt` は `0.05` でクランプ（タブ離脱対策）。`update(gameDt)` に渡るのはスロー適用後、`particles.update(dt)`/`camera.update(dt)` は実時間、という区別を守る。

### config.ts は「ライブ可変なシングルトン」
`PHYSICS`/`SPEED`/`OBSTACLE`/`SCORE`/`JUICE` などは **あえて `as const` にしていない可変オブジェクト**。`tweak.ts` の Tweakpane がこのオブジェクトに直接バインドし、`player`/`world` は毎フレーム読むのでスライダーが即反映される。手触り・難易度・演出の調整は基本ここの数字だけで完結する。
- 値を足したら `tweak.ts` のバインドと「デフォルトに戻す」のスナップショット（`defaults`）にも反映する。
- `SPEED.start` や `SEED.daily` など一部は「次のラン」から反映（ラン中は `beginRun` で確定するため）。
- `VIEW`・`GROUND_Y`・`PLAYER` は `as const`（実行中に変えない）。

### 座標系と「描画は当たり判定に影響しない」原則
内部解像度は固定 `VIEW = 900×300`。CSS で画面幅へスケールする。
当たり判定は AABB を**実座標**で計算し、見た目より少し小さくして甘めにする（`collides()`）。
squash & stretch・トレイル・shake・zoom・パララックスは**描画専用**で、当たり判定・採点には絶対に影響させない。描画は `背景(camera外=全面塗りでフレームクリア兼用) → camera(shake/zoom)内で 地面・障害物・オーブ・プレイヤー・パーティクル → ビネット/フラッシュ/浮遊点/HUD(camera外)` の順。HUD やフラッシュを camera 内に入れると揺れて読めなくなる。

### クリア可能エンベロープ（理不尽を出さない不変条件）
`patterns.ts` は現在の `PHYSICS`/`speed` から「標準ジャンプ（早離し/float なしの素のジャンプ、`standardApex`/`standardAirtime`）で越えられる最大の高さ・幅」(`maxClearableHeight`/`maxClearableWidth`) を算出し、全 SpawnSpec を `clampSpec` で必ずその範囲に収める。難易度は距離 `p=distance/difficultyRampDist` による重み付き抽選（`TABLE`）でパターン種別が変わるだけで、個々の障害物は常に越えられる。**新しいパターンビルダーを足すときも必ず `clampSpec` を通す。**
**サイズだけでなく「間隔×速度」も不変条件**: 連続障害物を着地→再ジャンプで越えるには間隔が滞空時間ぶん必要なので、`maxClearableSpeed()`(= `OBSTACLE.minGap / tapAirtime`) を算出し、`world` が実速度を `min(SPEED.max, maxClearableSpeed())` にクランプする。これを超えると高速域で間隔が詰まり腕に関係なく避けられない＝運ゲーになるため。`SPEED.max` や `OBSTACLE.minGap` を変えるとこの上限も連動する。
**連続パターン（double/triple）の間隔も不変条件**: 早離しの小ホップ（後述）があるので、連続パターンは「間に着地して跳び直す（hop-between）」で越える前提。`clampPatternGaps` がブロックの中心間隔を `SPEED.max · clearAirtime + 余裕`（= 1つ越えて着地し次を踏み切るのに足る距離、到達時に速くなっても保証されるよう SPEED.max 基準）以上に**広げる**。各ブロックは `clampSpec` 済みで個別に越えられ、間に着地できる＝常にクリア可能（広げる方向なので fallback 不要）。`pickPattern` の `clampSpec` 後に必ず通す。double/triple は低く細いリズムブロック（高さ22-34）にしてある。

### 決定論と乱数
`rng.ts` は xorshift32。`World` と `Collectibles` がこの Rng を共有シードで初期化し、`SEED.daily` のときは日付文字列 (`seedFromString`) から固定シードを作る＝同じ日は同じ地形。
**注意:** スピードライン・まばたき等の純演出は `Math.random()` を直接使う。これらはシミュレーション・採点・地形に影響しないので決定論を壊さないが、**地形/オーブ/採点に効く乱数は必ず共有 `Rng` を使う**こと（`Math.random` を混ぜるとデイリーシードが壊れる）。

### 採点まわり
距離点は倍率込みで積算 (`Scorer.addDistance`)。ニアミスは障害物と水平に重なっている間 `minClear`（プレイヤー下端と障害物上端の最小隙間）を追跡し、通過し終えた瞬間に1回だけ `registerCleared` で採点（`game.ts` の `trackScoring`）。コンボ倍率は**死亡（`reset`）でのみ途切れる**＝攻めて稼ぐ設計。ハイスコア・自己ベスト距離は localStorage (`hop-runner.hiscore` / `hop-runner.bestdist`)。

### 入力は1つだけ（不変）
`input.ts` はキー/マウス/タッチを区別せず「押した瞬間 (`takePress`)」と「押し続けているか (`holding`)」の2つだけを公開する。可変ジャンプは `holding` を `player.update` に渡して実現: **上昇中に早離しすると上向き速度を `PHYSICS.cutVelocity` で頭打ち（＝小ホップ）、押し続けると重力を弱めて高く飛ぶ**。ちょん押し＝小さくきびきび、長押し＝大ジャンプ。これで「ブロックの間で跳ぶ」帯が生まれる（クリア可能性の基準は早離し/float なしの「標準ジャンプ」）。`M`（ミュート）・`H`（Tweakpane 開閉）・`L`（言語）はジャンプキーと衝突しないよう別途登録。**操作のシンプルさ（ジャンプ1入力）は変えない。**

### 表示テキストは i18n.ts 経由（直書きしない）
ユーザー向けの文言（Canvas 描画・`index.html` の hint/title）は **`i18n.ts` の `STRINGS` テーブルに足して `t(key)` で引く**。日本語/英語対応で、`navigator.language` で自動判定 + 手動切替（`L` キー / 画面下のトグル）し、選択は localStorage (`hop-runner.locale`) に保存する。Canvas 内テキストは毎フレーム `t()` を読むので切替が即反映、DOM 側は `onLocaleChange` で更新する。`ja` は現状の画面と一致するよう値を据え置く（差分は操作説明の文だけ）。
- これは**表示専用**で、当たり判定・採点・地形/オーブの決定論（共有 `Rng`）には一切関与しない（`navigator.language`/localStorage はシードに使わない）。
- タップ＝ジャンプの入力系から UI を隔離するため、クリックさせたい DOM 要素には `data-no-jump` を付ける（`input.ts` がこの属性配下の `pointerdown` を無視する）。

### オート（アトラクト / 眺める）モード
タイトル/ゲームオーバーで `AUTO.attractDelay` 秒無操作だと `beginRun(true)` で自動プレイに入る（`game.ts` の `auto` フラグ）。`autopilot.ts` の `autoInput` が最寄りの未通過障害物に対し**それを越えられる最小のジャンプ**を出す純関数で、その出力（jump / hold）を実入力の代わりに `player.update` へ流す。低い壁＝小ホップ、高い/広い壁＝大きく（早離しカットを使い、必要 apex に届くまで hold→達したら release）と出し分けて滞空を最小化し、連続のリズムを保つ。auto は単体障害物のみ生成する（`world.reset(seed, auto)` → `pickPattern(..., auto=true)` → `AUTO_TABLE`）ので、空中で狙う対象が切り替わらず無状態で成立する。**auto 中は当たり判定をスキップ（無敗）し、`endRun` に到達しない＝ハイスコア/自己ベストを保存しない**。何か入力すると `beginRun(false)` で手動ランに引き継ぐ。表示・体験専用で、採点ロジックも地形の決定論（共有 `Rng`）も変えない。

### dev フック
`import.meta.env.DEV` のときだけ `window.game` に Game インスタンスを公開（手動チューニング・デバッグ用）。本番ビルドには出さない。

### メタ情報・ブランディング（OGP / favicon）
シェア時の見た目（OGP カード・favicon・apple-touch・PWA マニフェスト）は `index.html` の `<head>` と `public/` の静的アセットで持つ。
- **SVG が唯一のソース**: `branding/icon.svg`（アプリアイコン＝フルブリード正方形）と `branding/og.svg`（OGP 1200×630）。配色・キャラ・障害物・オーブは実ゲーム（`theme.ts` の夕暮れシーン・`PLAYER_COLOR`・`ORB_COLOR`）に対応させている。**PNG/ICO は生成物なので手編集しない。** `branding/icon.svg` を直す → `sh branding/build-assets.sh`（要 `rsvg-convert` + `magick`）で `public/` のアイコン群と `og.png` を再生成する。`public/favicon.svg` はタブ用の角丸・簡潔版で、これ自体が配信されるソース。
- **パス解決の不変条件**: `index.html` の favicon/manifest は `/favicon.svg` のように **`/` 始まりで書く**（Vite が本番ビルドで base=`/hop-runner/` を前置する）。一方 **OGP/Twitter の `og:image`・`og:url`・`canonical` はクローラが base を解釈できないので絶対 URL を直書き**（`https://uto-usui.github.io/hop-runner/...`）。デプロイ先 URL を変えたら `vite.config.ts` の base に加えてこの絶対 URL も直す。
- 表示専用。当たり判定・採点・地形/オーブの決定論には一切関与しない。
