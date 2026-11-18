import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Não usamos proxy: em dev o api.ts aponta direto para http://localhost:3000
// (o server.ts libera o CORS) e, no build, a própria API serve o front.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
