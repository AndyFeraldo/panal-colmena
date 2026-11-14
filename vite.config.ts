import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' = rutas relativas: funciona en GitHub Pages con cualquier nombre de repositorio
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
