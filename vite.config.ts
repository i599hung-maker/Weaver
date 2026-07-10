import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import analyzePlugin from './server/analyzePlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), analyzePlugin()],
})
