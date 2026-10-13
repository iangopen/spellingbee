import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, resolveTheme } from './lib/theme.ts'
import { applyReduceMotion, isReduceMotionOn } from './lib/motion.ts'

// Resolve before the first React paint so a stored "light" never flashes past
// the dark palette that index.css puts on :root until data-theme exists.
applyTheme(resolveTheme())
applyReduceMotion(isReduceMotionOn())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
