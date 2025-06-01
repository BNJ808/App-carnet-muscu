import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // ou vue, selon votre framework

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
})