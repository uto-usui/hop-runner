import { autoInput } from './autopilot'
import { Collectibles } from './collectibles'
import { AUTO, GROUND_Y, JUICE, ORB, PARALLAX, SCORE, SEED, SHAKE, SPEED, VFX, VIEW } from './config'
import { t } from './i18n'
import { Input } from './input'
import { Camera } from './juice/camera'
import { Particles } from './juice/particles'
import { Sound } from './juice/audio'
import { Player } from './player'
import { seedFromString } from './rng'
import { Scorer } from './score'
import { themeAt, type Palette } from './theme'
import { World } from './world'

type State = 'ready' | 'playing' | 'gameover'

const HI_KEY = 'hop-runner.hiscore'
const BEST_KEY = 'hop-runner.bestdist'
const PLAYER_COLOR = '#3a6df0'
const ORB_COLOR = '#f5c518'

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private input: Input
  private player = new Player()
  private world = new World()
  private camera = new Camera()
  private particles = new Particles()
  private sound = new Sound()
  private scorer = new Scorer()
  private state: State = 'ready'
  private last = 0
  private score = 0
  private hiScore = 0
  private freeze = 0 // >0 の間は全体を凍結（死亡ヒットストップ）
  private slow = 0 // >0 の間はゲーム時間をスロー（ニアミス）
  private retryLock = 0 // >0 の間はリトライ入力を無視
  private flash = 0 // 0..1 のフルスクリーンフラッシュ量
  private flashColor = '#ffffff'
  private sinceDeath = 0 // 死亡からの経過秒（GAME OVER 幕の遅延フェード用）
  private pal: Palette = themeAt(0) // 現在のシーン配色（毎フレーム更新）
  private trail: { y: number }[] = [] // プレイヤー残像（縦の動きが主）
  private speedLineAccum = 0 // スピードライン生成の端数
  private collectibles = new Collectibles()
  private bestDistance = 0 // 自己ベスト距離（マーカー表示と更新に使う）
  private dailyDate = '' // デイリーシード用の日付文字列
  private auto = false // 自動プレイ（アトラクト / 眺めるモード）中か
  private idle = 0 // 非プレイ中の無操作経過秒（アトラクト開始の判定に使う）

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context is not available')
    this.ctx = ctx
    this.resize() // 描画バッファを devicePixelRatio に合わせ、高解像度ディスプレイでボケないように
    window.addEventListener('resize', this.resize) // ウィンドウ幅 / モニタ間移動での DPR 変化に追従
    this.input = new Input()
    this.hiScore = Number(localStorage.getItem(HI_KEY) ?? 0)
    this.bestDistance = Number(localStorage.getItem(BEST_KEY) ?? 0)
    this.dailyDate = new Date().toISOString().slice(0, 10)
    this.player.reset()
    this.world.reset()

    // M キーでミュート切替（ジャンプ入力とは衝突しない）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.sound.toggleMute()
    })
  }

  // 描画バッファを論理解像度 VIEW × devicePixelRatio で確保し、コンテキストを dpr 倍にする。
  // 以降の描画はすべて VIEW 座標のまま書け、表示サイズ（CSS）も変わらない。当たり判定にも無影響。
  private resize = () => {
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.round(VIEW.width * dpr)
    this.canvas.height = Math.round(VIEW.height * dpr)
    // canvas.width/height への代入で変換は identity に戻るので、基準変換を dpr 倍に張り直す。
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  start() {
    this.last = performance.now()
    requestAnimationFrame(this.loop)
  }

  private loop = (now: number) => {
    let dt = (now - this.last) / 1000
    this.last = now
    if (dt > 0.05) dt = 0.05 // タブ離脱などで dt が跳ねたときの保険

    // 死亡からの経過（凍結中も含めて進める。GAME OVER 幕の遅延フェードに使う）
    if (this.state === 'gameover') this.sinceDeath += dt

    // 死亡ヒットストップ: ゲーム・パーティクルを凍結しつつ shake だけ走らせ、衝撃を焼き付ける
    if (this.freeze > 0) {
      this.freeze = Math.max(0, this.freeze - dt)
      this.camera.update(dt)
      this.render()
      requestAnimationFrame(this.loop)
      return
    }

    if (this.retryLock > 0) this.retryLock = Math.max(0, this.retryLock - dt)
    if (this.slow > 0) this.slow = Math.max(0, this.slow - dt)
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 0.18)

    // ニアミス中はゲーム時間だけスロー（演出 particles / camera は実時間）
    const gameDt = this.slow > 0 ? dt * SCORE.nearMissSlowFactor : dt
    this.update(gameDt)
    this.particles.update(dt)
    this.camera.update(dt)
    this.render()
    requestAnimationFrame(this.loop)
  }

  private update(dt: number) {
    const pressed = this.input.takePress()

    if (this.state !== 'playing') {
      if (pressed && this.retryLock <= 0) {
        this.beginRun(false) // 入力でスタート（手動ラン）
      } else if (this.retryLock <= 0) {
        // タイトル / ゲームオーバーで無操作が続いたらアトラクト（自動プレイ）に入る
        this.idle += dt
        if (this.idle >= AUTO.attractDelay) this.beginRun(true)
      }
      return
    }

    // 自動プレイ中に入力が入ったら操作を引き継ぎ、手動ランを新しく始める
    if (this.auto && pressed) {
      this.beginRun(false)
      return
    }

    // 入力の出どころ: auto なら自動操縦、通常は実入力
    let jumpPressed = pressed
    let holding = this.input.holding
    if (this.auto) {
      const a = autoInput(this.player, this.world.obstacles, this.world.speed)
      jumpPressed = a.jump
      holding = a.hold
    }

    // 接地中の押下だけが実ジャンプ（空中の押しでは音も塵も出さない）
    if (jumpPressed && this.player.grounded) {
      this.player.jump()
      this.sound.jump()
      this.particles.jumpKick(this.player.x + this.player.width / 2, GROUND_Y)
    }

    this.player.update(dt, holding)

    if (this.player.justLanded) {
      const impact = this.player.landingImpact
      this.camera.addShake(SHAKE.landMin + impact * SHAKE.landScale)
      this.particles.landingDust(
        this.player.x + this.player.width / 2,
        GROUND_Y,
        Math.min(1, impact / 700),
      )
      this.sound.land(impact)
    }

    const distBefore = this.world.distance
    this.world.update(dt)
    const move = this.world.distance - distBefore
    this.scorer.addDistance(this.world.distance)
    this.scorer.updateFloaters(dt)
    this.trackScoring()

    // 収集オーブ: 移動・取得
    this.collectibles.update(move)
    const grabbed = this.collectibles.collect(
      this.player.x + this.player.width / 2,
      this.player.y + this.player.height / 2,
    )
    for (const o of grabbed) {
      this.scorer.addPoints(ORB.points)
      this.scorer.addFloater(o.x, o.y, `+${ORB.points}`, ORB_COLOR)
      this.particles.landingDust(o.x, o.y + 10, 0.3, ORB_COLOR)
      this.sound.coin()
    }

    this.score = this.scorer.total()

    // 速度連動: 残像とスピードライン
    this.trail.push({ y: this.player.y })
    if (this.trail.length > VFX.trailFrames) this.trail.shift()
    const s = this.speedNorm()
    if (s > VFX.speedLineThreshold) {
      this.speedLineAccum += VFX.speedLineRate * s * dt
      while (this.speedLineAccum >= 1) {
        this.speedLineAccum -= 1
        const y = 20 + Math.random() * (GROUND_Y - 50)
        this.particles.speedLine(VIEW.width + 10, y, 30 + Math.random() * 60, this.world.speed * 1.2)
      }
    }

    if (!this.auto && this.collides()) this.endRun() // 自動プレイは無敗（当たり判定オフ）
  }

  private speedNorm(): number {
    const range = SPEED.max - SPEED.start
    return range <= 0 ? 0 : Math.max(0, Math.min(1, (this.world.speed - SPEED.start) / range))
  }

  // 障害物を越えた瞬間にニアミス/通常クリアを採点し、ニアミスなら手触り演出を出す。
  private trackScoring() {
    const p = this.player
    const pBottom = p.y + p.height
    for (const o of this.world.obstacles) {
      const oTop = GROUND_Y - o.height
      // 水平に重なっている間、プレイヤー下端と障害物上端の隙間の最小値を追跡
      if (o.x < p.x + p.width && o.x + o.width > p.x) {
        const gap = oTop - pBottom
        if (gap >= 0 && gap < o.minClear) o.minClear = gap
      }
      // プレイヤーを通過し終えた瞬間に1回だけ採点
      if (!o.passed && o.x + o.width < p.x) {
        o.passed = true
        const near = o.minClear < SCORE.nearMissPx
        this.scorer.registerCleared(near, p.x + p.width / 2, p.y - 6)
        if (near) {
          this.flash = 1
          this.flashColor = '#ffffff'
          this.slow = JUICE.hitStopNearMiss
          this.camera.addShake(SHAKE.nearMiss)
          this.sound.nearMiss()
        } else {
          this.sound.scoreTick()
        }
      }
    }

    if (this.scorer.checkMilestone(this.world.distance, VIEW.width / 2, 76)) {
      this.flash = 1
      this.flashColor = '#cfe0ff'
      this.sound.milestone()
    }
  }

  private beginRun(auto = false) {
    this.auto = auto // true=アトラクト自動プレイ（無敗・記録非保存）
    this.idle = 0
    // デイリーシード on なら当日固定の地形、off なら毎回ランダム
    const seed = SEED.daily ? seedFromString(this.dailyDate) : undefined
    this.player.reset()
    this.world.reset(seed, auto)
    this.collectibles.reset(seed)
    this.camera.reset()
    this.particles.clear()
    this.scorer.reset()
    this.trail = []
    this.speedLineAccum = 0
    this.camera.scale = 1
    this.freeze = 0
    this.slow = 0
    this.flash = 0
    this.sinceDeath = 0
    this.score = 0
    this.state = 'playing'
  }

  private endRun() {
    this.state = 'gameover'
    this.sinceDeath = 0
    this.idle = 0 // ゲームオーバー後もここからアトラクト待機の時間を数える
    const final = Math.floor(this.score)
    if (final > this.hiScore) {
      this.hiScore = final
      localStorage.setItem(HI_KEY, String(final))
    }
    if (this.world.distance > this.bestDistance) {
      this.bestDistance = this.world.distance
      localStorage.setItem(BEST_KEY, String(Math.round(this.bestDistance)))
    }
    // 死亡演出: フリーズ + 大きめシェイク + 破片 + 効果音、入力を少しロック
    this.freeze = JUICE.hitStopDeath
    this.retryLock = JUICE.retryLock
    this.camera.addShake(SHAKE.death)
    this.particles.deathShards(
      this.player.x + this.player.width / 2,
      this.player.y + this.player.height / 2,
      PLAYER_COLOR,
    )
    this.sound.death()
  }

  /** プレイヤーと障害物の AABB 判定。当たり判定は見た目より少し小さくして甘めに */
  private collides(): boolean {
    const p = this.player
    const px = p.x + 4
    const pw = p.width - 8
    const py = p.y + 4
    const ph = p.height - 6
    for (const o of this.world.obstacles) {
      const oy = GROUND_Y - o.height
      if (
        px < o.x + o.width &&
        px + pw > o.x &&
        py < oy + o.height &&
        py + ph > oy
      ) {
        return true
      }
    }
    return false
  }

  // ---- 描画 ----

  private render() {
    const p = this.player
    const s = this.speedNorm()
    this.pal = themeAt(this.world.distance) // シーン配色（毎フレーム1回）
    this.camera.scale = 1 - s * VFX.zoomOut // 高速ほどわずかに引く

    this.drawBackground() // 背景は camera の外（全面塗り＝フレームクリア兼用、揺れの隙間を防ぐ）

    // world 空間（地面・障害物・プレイヤー）は camera(shake/zoom) の中で描く
    this.camera.begin(this.ctx, p.x + p.width / 2, p.y + p.height / 2)
    this.drawGround()
    this.drawBestMarker()
    this.particles.draw(this.ctx, 'back') // 土埃・スピードラインは背面
    this.drawObstacles()
    this.drawOrbs()
    this.drawPlayer()
    this.particles.draw(this.ctx, 'front') // 破片は前面
    this.camera.end(this.ctx)

    this.drawVignette(s) // 画面端の暗がり（速度で濃く）

    // フラッシュ・浮遊加点・HUD は camera の外（揺れると読みにくい・酔う）
    if (this.flash > 0) {
      this.ctx.save()
      this.ctx.globalAlpha = this.flash * 0.5
      this.ctx.fillStyle = this.flashColor
      this.ctx.fillRect(0, 0, VIEW.width, VIEW.height)
      this.ctx.restore()
    }
    this.drawFloaters()
    this.drawHud()
    if (this.state === 'playing' && this.auto) this.drawAutoOverlay()
    if (this.state === 'ready') {
      this.drawCenterText(t('title'), t('readySub'))
    } else if (this.state === 'gameover') {
      // まず破片の飛散を見せ（deathLinger）、そのあと幕を遅れてフェードインする
      const fadeIn = (this.sinceDeath - JUICE.deathLinger) / JUICE.deathOverlayFade
      const alpha = Math.max(0, Math.min(1, fadeIn))
      if (alpha > 0) this.drawCenterText(t('gameover'), t('gameoverSub'), alpha)
    }
  }

  private drawBackground() {
    const ctx = this.ctx
    const pal = this.pal

    // 空のグラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
    grad.addColorStop(0, pal.skyTop)
    grad.addColorStop(1, pal.skyBottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, VIEW.width, VIEW.height)

    // 多層パララックスの丘（奥ほど遅く・淡く）
    this.drawHillLayer(pal.hillFar, PARALLAX.far, GROUND_Y - 18, 120, 190)
    this.drawHillLayer(pal.hillMid, PARALLAX.mid, GROUND_Y - 6, 80, 150)
    this.drawHillLayer(pal.hillNear, PARALLAX.near, GROUND_Y + 4, 52, 110)
  }

  private drawHillLayer(color: string, factor: number, baseY: number, radius: number, spacing: number) {
    const ctx = this.ctx
    ctx.fillStyle = color
    const offset = (this.world.distance * factor) % spacing
    for (let x = -offset; x < VIEW.width + radius; x += spacing) {
      ctx.beginPath()
      ctx.arc(x, baseY, radius, Math.PI, 0) // 上半分の丸い丘
      ctx.fill()
    }
  }

  private drawGround() {
    const ctx = this.ctx
    const pal = this.pal

    // 地面の帯
    ctx.fillStyle = pal.ground
    ctx.fillRect(0, GROUND_Y, VIEW.width, VIEW.height - GROUND_Y)

    ctx.strokeStyle = pal.groundLine
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y)
    ctx.lineTo(VIEW.width, GROUND_Y)
    ctx.stroke()

    // 流れる破線でスピード感を出す
    ctx.fillStyle = pal.dash
    const spacing = 44
    const offset = this.world.distance % spacing
    for (let x = -offset; x < VIEW.width; x += spacing) {
      ctx.fillRect(x, GROUND_Y + 12, 22, 4)
    }
  }

  private drawObstacles() {
    const ctx = this.ctx
    ctx.fillStyle = this.pal.obstacle
    for (const o of this.world.obstacles) {
      // 高い障害物は少し濃く（読みやすさのヒント）
      ctx.globalAlpha = o.kind === 'tall' ? 1 : o.kind === 'low' ? 0.82 : 0.92
      ctx.fillRect(o.x, GROUND_Y - o.height, o.width, o.height)
    }
    ctx.globalAlpha = 1
  }

  private drawOrbs() {
    const ctx = this.ctx
    for (const o of this.collectibles.orbs) {
      if (o.taken) continue
      const pulse = 1 + 0.18 * Math.sin(this.world.distance * 0.03 + o.x * 0.05)
      const r = ORB.radius * pulse
      ctx.fillStyle = ORB_COLOR
      ctx.globalAlpha = 0.25 // 外側のグロー
      ctx.beginPath()
      ctx.arc(o.x, o.y, r * 1.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(o.x, o.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff8e0' // ハイライト
      ctx.beginPath()
      ctx.arc(o.x - r * 0.3, o.y - r * 0.3, r * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 自己ベスト距離の地点を地面に流す。currentDist が bestDistance に近づくと右から迫る。
  private drawBestMarker() {
    if (this.bestDistance <= 0) return
    const ctx = this.ctx
    const x = this.player.x + (this.bestDistance - this.world.distance)
    if (x < -30 || x > VIEW.width + 30) return
    ctx.save()
    ctx.strokeStyle = '#f5a623'
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(x, GROUND_Y - 92)
    ctx.lineTo(x, GROUND_Y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.fillStyle = '#f5a623'
    ctx.font = '700 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(t('markerBest'), x, GROUND_Y - 98)
    ctx.restore()
  }

  private drawPlayer() {
    const ctx = this.ctx
    const p = this.player

    // 残像（高速時のみ目立つ）。縦の動きが主なので y だけ過去位置を使う
    const s = this.speedNorm()
    if (s > 0.05 && this.state === 'playing') {
      ctx.save()
      ctx.fillStyle = PLAYER_COLOR
      for (let i = 0; i < this.trail.length - 1; i++) {
        ctx.globalAlpha = VFX.trailAlpha * s * ((i + 1) / this.trail.length)
        this.roundRect(p.x, this.trail[i]!.y, p.width, p.height, 8)
        ctx.fill()
      }
      ctx.restore()
    }

    ctx.save()
    // 足元を基準に伸縮（地面にめり込ませない）
    const cx = p.x + p.width / 2
    const footY = p.y + p.height
    ctx.translate(cx, footY)
    ctx.scale(p.scaleX, p.scaleY)
    ctx.translate(-cx, -footY)

    ctx.fillStyle = this.state === 'gameover' ? '#c0455b' : PLAYER_COLOR
    this.roundRect(p.x, p.y, p.width, p.height, 8)
    ctx.fill()

    // 目（表情つき）。進行方向側に置き、視線で少し上下する
    const ex = p.x + p.width - 12
    const ey = p.y + 14 + p.eyeLook * 2
    if (this.state === 'gameover') {
      // ✕ の目
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ex - 4, ey - 4)
      ctx.lineTo(ex + 4, ey + 4)
      ctx.moveTo(ex + 4, ey - 4)
      ctx.lineTo(ex - 4, ey + 4)
      ctx.stroke()
    } else {
      // 開き具合に応じて縦に潰れる楕円（見開き / 通常 / 細め / まばたき）
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(ex, ey, 4, 4 * p.eyeOpen, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawVignette(s: number) {
    const ctx = this.ctx
    const strength = VFX.vignetteBase + s * VFX.vignetteMax
    if (strength <= 0) return
    const g = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
      VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.62,
    )
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${strength})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, VIEW.width, VIEW.height)
  }

  private drawHud() {
    const ctx = this.ctx
    ctx.textAlign = 'right'
    ctx.fillStyle = this.pal.text
    ctx.font = '600 18px system-ui, sans-serif'
    ctx.fillText(this.score.toString().padStart(5, '0'), VIEW.width - 16, 30)
    ctx.fillStyle = this.pal.subText
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`${t('hudHi')} ${this.hiScore.toString().padStart(5, '0')}`, VIEW.width - 16, 50)

    // コンボ倍率（1倍より大きいときだけ、左上に強調表示）
    if (this.scorer.multiplier > 1.001) {
      ctx.textAlign = 'left'
      ctx.fillStyle = '#f5a623'
      ctx.font = '700 22px system-ui, sans-serif'
      ctx.fillText(`x${this.scorer.multiplier.toFixed(2)}`, 16, 32)
      ctx.fillStyle = '#cf9b4e'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText(`${t('hudCombo')} ${this.scorer.combo}`, 16, 50)
    }

    // デイリーシード表示（on のときだけ、上部中央）
    if (SEED.daily) {
      ctx.textAlign = 'center'
      ctx.fillStyle = this.pal.subText
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillText(`${t('hudDaily')} ${this.dailyDate}`, VIEW.width / 2, 20)
    }
  }

  // 自動プレイ中の表示: 上部に「AUTO」バッジ、下部に操作を引き継げる旨の控えめなヒント。
  private drawAutoOverlay() {
    const ctx = this.ctx
    ctx.save()
    ctx.textAlign = 'center'
    ctx.fillStyle = this.pal.subText
    // デイリー表示と重ならないよう、daily on のときは少し下げる
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.fillText(t('autoBadge'), VIEW.width / 2, SEED.daily ? 38 : 20)
    ctx.globalAlpha = 0.45 + 0.3 * Math.sin(this.world.distance * 0.02) // ゆっくり明滅
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(t('autoHint'), VIEW.width / 2, VIEW.height - 18)
    ctx.restore()
  }

  private drawFloaters() {
    const ctx = this.ctx
    ctx.textAlign = 'center'
    ctx.font = '700 16px system-ui, sans-serif'
    for (const f of this.scorer.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.maxLife))
      ctx.fillStyle = f.color
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
  }

  private drawCenterText(title: string, sub: string, alpha = 1) {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = 0.72 * alpha
    ctx.fillStyle = this.pal.overlay
    ctx.fillRect(0, 0, VIEW.width, VIEW.height)

    ctx.globalAlpha = alpha
    ctx.textAlign = 'center'
    ctx.fillStyle = this.pal.text
    ctx.font = '700 34px system-ui, sans-serif'
    ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 6)
    ctx.fillStyle = this.pal.subText
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 26)
    ctx.restore()
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
}
