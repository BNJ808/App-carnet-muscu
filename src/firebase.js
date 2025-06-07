import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration Firebase avec valeurs par défaut pour éviter les erreurs
const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "demo-key",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "demo-domain",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "demo-project",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "demo-bucket",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "demo-sender",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || "demo-app",
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);

// Exports des services Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;