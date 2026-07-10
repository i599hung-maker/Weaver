import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import analyzePlugin from './server/analyzePlugin.js'
import storagePlugin from './server/storagePlugin.js'
import reportPlugin from './server/reportPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), analyzePlugin(), storagePlugin(), reportPlugin()],
})
