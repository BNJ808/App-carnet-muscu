import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    collection, 
    query, 
    limit, 
    getDocs, 
    addDoc, 
    serverTimestamp,
    orderBy 
} from 'firebase/firestore';

// Configuration Firebase avec valeurs par défaut pour éviter les erreurs
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-domain",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-bucket",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "demo-sender",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app",
};

// Vérifier si nous avons une vraie configuration Firebase
const hasValidConfig = import.meta.env.VITE_FIREBASE_API_KEY && 
                      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
                      !import.meta.env.VITE_FIREBASE_API_KEY.includes('demo');

console.log('Firebase config loaded:', {
    hasValidConfig,
    apiKey: firebaseConfig.apiKey?.substring(0, 10) + '...',
    projectId: firebaseConfig.projectId
});

// Initialisation Firebase
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    
    // Créer des objets mock pour éviter les erreurs si Firebase n'est pas configuré
    auth = {
        currentUser: null,
        onAuthStateChanged: () => () => {},
        signInAnonymously: () => Promise.reject(new Error('Firebase not configured'))
    };
    
    db = {
        collection: () => ({
            doc: () => ({
                set: () => Promise.reject(new Error('Firebase not configured')),
                get: () => Promise.reject(new Error('Firebase not configured'))
            })
        })
    };
}

// Exports des services Firebase
export { 
    auth, 
    db,
    onAuthStateChanged,
    signInAnonymously,
    doc,
    setDoc,
    onSnapshot,
    collection,
    query,
    limit,
    getDocs,
    addDoc,
    serverTimestamp,
    orderBy
};

export default app;