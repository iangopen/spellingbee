import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { licenseNotices } from './scripts/licenseNotices.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), licenseNotices(import.meta.dirname)],
  base: '/spellingbee/',
})
