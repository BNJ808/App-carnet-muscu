import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Importez directement les plugins PostCSS
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindcssPostcss from '@tailwindcss/postcss'; // Renommé pour éviter le conflit de nom

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss, // Utilisez l'import direct
        autoprefixer, // Utilisez l'import direct
        tailwindcssPostcss, // Utilisez l'import direct
      ],
    },
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  },
  optimizeDeps: {
    include: ['@google/generative-ai']
  },
  resolve: {
    alias: {
      'node:path': 'path-browserify',
      'node:fs': 'browserify-fs',
      'node:util': 'util',
      'node:process': 'process',
    },
  },
});