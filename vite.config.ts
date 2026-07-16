import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import analyzePlugin from './server/analyzePlugin.js'
import storagePlugin from './server/storagePlugin.js'
import reportPlugin from './server/reportPlugin.js'
import aiTestPlugin from './server/aiTestPlugin.js'

// Windows 專屬設定：Vite 預設只綁 IPv6([::1])，但 Windows 版 Chrome 優先試 IPv4，
// 且會把 http://localhost 自動升級成 https → 連不上。因此 Windows 上綁 127.0.0.1 並自簽 HTTPS。
// Mac／Linux 沒這問題，維持 Vite 預設(http://localhost)，兩邊同一份程式碼即可通用。
const isWin = process.platform === 'win32'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(isWin ? [basicSsl()] : []),
    analyzePlugin(),
    storagePlugin(),
    reportPlugin(),
    aiTestPlugin(),
  ],
  server: isWin ? { host: '127.0.0.1', https: {} } : {},
})
