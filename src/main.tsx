import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, loadSettings } from './store/settings.ts'

applyTheme(loadSettings().theme) // 首次繪製前先套配色，避免閃色

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
