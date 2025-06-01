/** @type {import('tailwindcss').Config} */
module.exports = {
  // Le tableau 'content' est crucial. Il indique à Tailwind où trouver vos classes.
  // Assurez-vous que ces chemins correspondent à l'emplacement de vos fichiers React.
  content: [
    "./index.html", // Si vous avez un fichier index.html à la racine de votre projet
    "./src/**/*.{js,ts,jsx,tsx}", // Ce chemin indique à Tailwind de scanner tous les fichiers .js, .ts, .jsx, .tsx dans le dossier 'src' et ses sous-dossiers. C'est là que se trouve votre 'App.jsx'.
  ],
  theme: {
    extend: {
      // Vous pouvez définir des polices personnalisées ici.
      // Assurez-vous que 'Inter' est bien importée dans votre CSS ou via Google Fonts si vous l'utilisez.
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [], // Ajoutez des plugins Tailwind ici si vous en utilisez (par exemple, @tailwindcss/forms pour des styles de formulaires améliorés)
}