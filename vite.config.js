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
});