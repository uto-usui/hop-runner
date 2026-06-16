import { defineConfig } from 'vite'

// GitHub Pages のプロジェクトサイト（https://<user>.github.io/hop-runner/）で
// アセットパスが正しく解決されるよう、本番ビルドだけ base を /hop-runner/ にする。
// 開発サーバー（pnpm dev）はルート / のまま。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/hop-runner/' : '/',
}))
