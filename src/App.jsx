import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, limit, addDoc, serverTimestamp, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Undo2, Redo2, Settings, XCircle, CheckCircle, ChevronDown, ChevronUp, Pencil, Sparkles, ArrowUp, ArrowDown,
    Plus, Trash2, Play, Pause, RotateCcw, Search, Filter, Dumbbell, Clock, History, NotebookText,
    LineChart as LineChartIcon, Target, TrendingUp, Award, Calendar, BarChart3, Moon, Sun,
    Zap, Download, Upload, Share, Eye, EyeOff, Maximize2, Minimize2, Activity
} from 'lucide-react';
import * as GenerativeAIModule from '@google/generative-ai'; // Corrected import syntax

// Import des composants
import Toast from './components/Toast.jsx';
import MainWorkoutView from './components/MainWorkoutView.jsx';
import HistoryView from './components/HistoryView.jsx';
import TimerView from './components/TimerView.jsx';
import StatsView from './components/StatsView.jsx';
import BottomNavigationBar from './components/BottomNavigationBar.jsx';
import TimerModal from './components/TimerModal.jsx';

// Configuration Firebase
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialisation Firebase (si les clés sont valides)
let app;
let auth;
let db;
let hasValidFirebaseConfig = false;

try {
    if (firebaseConfig.apiKey && firebaseConfig.projectId && !firebaseConfig.apiKey.includes('demo')) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        hasValidFirebaseConfig = true;
        console.log('Firebase initialized successfully with valid config.');
    } else {
        console.warn('Firebase not initialized: Missing or demo API keys. Functionality will be limited to local storage.');
        // Mock Firebase objects for graceful degradation
        auth = {
            currentUser: null,
            onAuthStateChanged: (callback) => {
                callback(null); // Immediately call with null user
                return () => { }; // Return an unsubscribe function
            },
            signInAnonymously: () => Promise.reject(new Error('Firebase not configured')),
            signInWithCustomToken: () => Promise.reject(new Error('Firebase not configured'))
        };
        db = {
            collection: () => ({
                doc: () => ({
                    set: () => Promise.reject(new Error('Firebase not configured')),
                    onSnapshot: (callback) => {
                        callback({ exists: () => false, data: () => ({}) }); // Call with empty data
                        return () => { };
                    },
                    update: () => Promise.reject(new Error('Firebase not configured'))
                })
            }),
            runTransaction: (callback) => {
                return Promise.reject(new Error('Firebase not configured for transactions'));
            },
            writeBatch: () => ({
                set: () => { },
                update: () => { },
                delete: () => { },
                commit: () => Promise.reject(new Error('Firebase not configured for batch writes'))
            })
        };
    }
} catch (error) {
    console.error('Firebase initialization error:', error);
    hasValidFirebaseConfig = false;
    // Fallback to mock objects in case of any initialization error
    auth = {
        currentUser: null,
        onAuthStateChanged: (callback) => {
            callback(null);
            return () => { };
        },
        signInAnonymously: () => Promise.reject(new Error('Firebase not configured')),
        signInWithCustomToken: () => Promise.reject(new Error('Firebase not configured'))
    };
    db = {
        collection: () => ({
            doc: () => ({
                set: () => Promise.reject(new Error('Firebase not configured')),
                onSnapshot: (callback) => {
                    callback({ exists: () => false, data: () => ({}) });
                    return () => { };
                },
                update: () => Promise.reject(new Error('Firebase not configured'))
            })
        }),
        runTransaction: (callback) => {
            return Promise.reject(new Error('Firebase not configured for transactions'));
        },
        writeBatch: () => ({
            set: () => { },
            update: () => { },
            delete: () => { },
            commit: () => Promise.reject(new Error('Firebase not configured for batch writes'))
        })
    };
}


// Configuration de l'API Gemini
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
let generativeModel = null;
if (GEMINI_API_KEY) {
    try {
        const genAI = new GenerativeAIModule.GoogleGenerativeAI(GEMINI_API_KEY);
        generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });
        console.log("Gemini model initialized.");
    } catch (error) {
        console.error("Failed to initialize Gemini model:", error);
    }
} else {
    console.warn("Gemini API key not found. AI features will be disabled.");
}

const ImprovedWorkoutApp = () => {
    const [workouts, setWorkouts] = useState({
        days: {
            'monday': {
                name: 'Lundi',
                exercises: []
            }
        },
        dayOrder: ['monday']
    });
    const [currentView, setCurrentView] = useState('workout'); // 'workout', 'timer', 'history', 'stats'
    const [userId, setUserId] = useState(null);
    const [toast, setToast] = useState(null); // { message, type, action }
    const [showSettings, setShowSettings] = useState(false);
    const [theme, setTheme] = useState('dark'); // 'light', 'dark', 'system'
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [restTimeInput, setRestTimeInput] = useState('90'); // Default 90 seconds rest time
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [timerModalOpen, setTimerModalOpen] = useState(false);
    const [globalNotes, setGlobalNotes] = useState('');
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState(''); // State pour l'analyse de progression
    const [aiSuggestions, setAiSuggestions] = useState([]); // Pour les suggestions globales de l'IA
    const [historyChanges, setHistoryChanges] = useState([]);
    const [futureChanges, setFutureChanges] = useState([]);

    const timerRef = useRef(null);
    const workoutsRef = useRef(workouts);

    // Mettre à jour la ref lorsque les workouts changent
    useEffect(() => {
        workoutsRef.current = workouts;
    }, [workouts]);

    // Authentification anonyme et chargement des données
    useEffect(() => {
        if (!hasValidFirebaseConfig) {
            // Load from local storage immediately if Firebase is not configured
            console.log('Loading data from local storage (Firebase not configured).');
            loadWorkoutsFromLocal();
            loadSettingsFromLocal();
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                console.log('Firebase user authenticated:', user.uid);
                // Charger les données de Firestore
                const userDocRef = doc(db, 'users', user.uid);
                onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        console.log('Firestore data loaded:', data);
                        if (data.workouts) setWorkouts(data.workouts);
                        if (data.settings) {
                            if (data.settings.theme) setTheme(data.settings.theme);
                            if (data.settings.isAdvancedMode !== undefined) setIsAdvancedMode(data.settings.isAdvancedMode);
                            if (data.settings.restTimeInput) setRestTimeInput(data.settings.restTimeInput);
                            if (data.settings.globalNotes) setGlobalNotes(data.settings.globalNotes);
                        }
                    } else {
                        console.log('No user data in Firestore, initializing...');
                        // Initialiser les données pour un nouvel utilisateur
                        setDoc(userDocRef, {
                            workouts: { days: { 'monday': { name: 'Lundi', exercises: [] } }, dayOrder: ['monday'] },
                            settings: { theme: 'dark', isAdvancedMode: false, restTimeInput: '90', globalNotes: '' },
                            createdAt: serverTimestamp()
                        }, { merge: true });
                    }
                }, (error) => {
                    console.error('Error fetching Firestore data:', error);
                    showToast('Erreur de chargement des données. Vérifiez votre connexion.', 'error');
                });
            } else {
                console.log('No Firebase user, signing in anonymously...');
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error('Error signing in anonymously:', error);
                    showToast('Erreur de connexion anonyme. Fonctionnalité limitée.', 'error');
                    // Fallback to local storage if anonymous sign-in fails
                    loadWorkoutsFromLocal();
                    loadSettingsFromLocal();
                }
            }
        });

        return () => unsubscribe();
    }, []);

    // Synchronisation des workouts vers Firebase ou Local Storage
    useEffect(() => {
        if (userId && hasValidFirebaseConfig) {
            console.log('Saving workouts to Firestore for user:', userId);
            const userDocRef = doc(db, 'users', userId);
            setDoc(userDocRef, { workouts }, { merge: true })
                .catch(error => console.error('Error saving workouts to Firestore:', error));
        } else if (!hasValidFirebaseConfig) {
            console.log('Saving workouts to local storage.');
            localStorage.setItem('workouts', JSON.stringify(workouts));
        }
    }, [workouts, userId, hasValidFirebaseConfig]);

    // Synchronisation des settings vers Firebase ou Local Storage
    useEffect(() => {
        const settings = { theme, isAdvancedMode, restTimeInput, globalNotes };
        if (userId && hasValidFirebaseConfig) {
            console.log('Saving settings to Firestore for user:', userId);
            const userDocRef = doc(db, 'users', userId);
            setDoc(userDocRef, { settings }, { merge: true })
                .catch(error => console.error('Error saving settings to Firestore:', error));
        } else if (!hasValidFirebaseConfig) {
            console.log('Saving settings to local storage.');
            localStorage.setItem('settings', JSON.stringify(settings));
        }
    }, [theme, isAdvancedMode, restTimeInput, globalNotes, userId, hasValidFirebaseConfig]);

    const loadWorkoutsFromLocal = () => {
        try {
            const storedWorkouts = localStorage.getItem('workouts');
            if (storedWorkouts) {
                setWorkouts(JSON.parse(storedWorkouts));
            } else {
                // Initialisation par défaut si rien n'est trouvé
                setWorkouts({
                    days: {
                        'monday': { name: 'Lundi', exercises: [] }
                    },
                    dayOrder: ['monday']
                });
            }
        } catch (error) {
            console.error('Error loading workouts from local storage:', error);
            showToast('Erreur de chargement des données locales.', 'error');
        }
    };

    const loadSettingsFromLocal = () => {
        try {
            const storedSettings = localStorage.getItem('settings');
            if (storedSettings) {
                const settings = JSON.parse(storedSettings);
                setTheme(settings.theme || 'dark');
                setIsAdvancedMode(settings.isAdvancedMode !== undefined ? settings.isAdvancedMode : false);
                setRestTimeInput(settings.restTimeInput || '90');
                setGlobalNotes(settings.globalNotes || '');
            }
        } catch (error) {
            console.error('Error loading settings from local storage:', error);
            showToast('Erreur de chargement des paramètres locaux.', 'error');
        }
    };

    // Gestion de l'historique (Undo/Redo)
    const saveStateToHistory = useCallback(() => {
        setHistoryChanges(prev => {
            const newHistory = [...prev, workoutsRef.current];
            // Limiter l'historique pour éviter une consommation excessive de mémoire
            return newHistory.slice(-50); // Garde les 50 dernières modifications
        });
        setFutureChanges([]); // Effacer l'historique futur à chaque nouvelle action
    }, []);

    const undo = useCallback(() => {
        if (historyChanges.length > 0) {
            const previousWorkouts = historyChanges[historyChanges.length - 1];
            setHistoryChanges(prev => prev.slice(0, prev.length - 1));
            setFutureChanges(prev => [workouts, ...prev]);
            setWorkouts(previousWorkouts);
            showToast('Annulé !', 'info', { label: 'Rétablir', onClick: redo });
        } else {
            showToast('Rien à annuler.', 'warning');
        }
    }, [historyChanges, workouts]);

    const redo = useCallback(() => {
        if (futureChanges.length > 0) {
            const nextWorkouts = futureChanges[0];
            setFutureChanges(prev => prev.slice(1));
            setHistoryChanges(prev => [...prev, workouts]);
            setWorkouts(nextWorkouts);
            showToast('Rétabli !', 'info', { label: 'Annuler', onClick: undo });
        } else {
            showToast('Rien à rétablir.', 'warning');
        }
    }, [futureChanges, workouts]);


    // Appliquer le thème au document
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
            root.classList.toggle('light', !prefersDark);
        } else {
            root.classList.toggle('dark', theme === 'dark');
            root.classList.toggle('light', theme === 'light');
        }
    }, [theme]);

    const showToast = useCallback((message, type = 'info', action = null, duration = 3000) => {
        setToast({ message, type, action, duration });
    }, []);

    const closeToast = useCallback(() => {
        setToast(null);
    }, []);


    // Fonctions utilitaires partagées
    const formatDate = (date) => {
        if (!date) return 'N/A';
        let d;
        if (date instanceof Timestamp) {
            d = date.toDate();
        } else if (typeof date === 'string' || typeof date === 'number') {
            d = new Date(date);
        } else if (date instanceof Date) {
            d = date;
        } else {
            return 'Date invalide';
        }

        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleDateString('fr-FR', options);
    };

    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const getSeriesDisplay = (serie) => {
        let display = '';
        if (serie.reps !== null && serie.reps !== undefined) {
            display += `${serie.reps} reps`;
        }
        if (serie.weight !== null && serie.weight !== undefined) {
            if (display) display += ' x ';
            display += `${serie.weight} kg`;
        }
        return display || 'Nouvelle série';
    };

    // Fonctions de gestion du minuteur
    const startTimer = useCallback((seconds) => {
        setTimerSeconds(seconds);
        setTimerIsRunning(true);
        setTimerIsFinished(false);
        setTimerModalOpen(true);

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        timerRef.current = setInterval(() => {
            setTimerSeconds(prevSeconds => {
                if (prevSeconds <= 1) {
                    clearInterval(timerRef.current);
                    setTimerIsRunning(false);
                    setTimerIsFinished(true);
                    // Jouer un son ou vibrer
                    if (window.navigator && window.navigator.vibrate) {
                        window.navigator.vibrate([200, 100, 200]);
                    }
                    try {
                        const audio = new Audio('/ding.mp3'); // Assurez-vous que le chemin est correct
                        audio.play();
                    } catch (e) {
                        console.warn("Audio playback failed:", e);
                    }
                    return 0;
                }
                return prevSeconds - 1;
            });
        }, 1000);
    }, []);

    const pauseTimer = useCallback(() => {
        setTimerIsRunning(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
    }, []);

    const resetTimer = useCallback(() => {
        pauseTimer();
        setTimerSeconds(0);
        setTimerIsFinished(false);
        setTimerModalOpen(false); // Fermer la modal lors du reset complet
    }, [pauseTimer]);

    const setTimerPreset = useCallback((seconds) => {
        setRestTimeInput(String(seconds));
        setTimerSeconds(seconds);
        pauseTimer(); // Mettre en pause si un preset est sélectionné
    }, [pauseTimer]);


    // Fonctions de gestion des entraînements
    const addDay = useCallback(() => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const newDayKey = `day${Object.keys(prevWorkouts.days).length + 1}`;
            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [newDayKey]: { name: `Nouveau Jour ${Object.keys(prevWorkouts.days).length + 1}`, exercises: [] }
                },
                dayOrder: [...prevWorkouts.dayOrder, newDayKey]
            };
        });
        showToast('Jour d\'entraînement ajouté !', 'success');
    }, [saveStateToHistory, showToast]);

    const addExercise = useCallback((dayKey) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            updatedDays[dayKey].exercises.push({
                id: Date.now(),
                name: 'Nouvel Exercice',
                category: 'Autre',
                series: [{ id: Date.now() + 1, reps: null, weight: null, completed: false }]
            });
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Exercice ajouté !', 'success');
    }, [saveStateToHistory, showToast]);

    const addSerie = useCallback((dayKey, exerciseId) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const exerciseIndex = updatedDays[dayKey].exercises.findIndex(ex => ex.id === exerciseId);
            if (exerciseIndex > -1) {
                updatedDays[dayKey].exercises[exerciseIndex].series.push({ id: Date.now(), reps: null, weight: null, completed: false });
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Série ajoutée !', 'info');
    }, [saveStateToHistory, showToast]);

    const removeSerie = useCallback((dayKey, exerciseId, serieId) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const exercise = updatedDays[dayKey].exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                exercise.series = exercise.series.filter(s => s.id !== serieId);
                // Si plus de séries, supprimer l'exercice
                if (exercise.series.length === 0) {
                    updatedDays[dayKey].exercises = updatedDays[dayKey].exercises.filter(ex => ex.id !== exerciseId);
                    showToast('Série et exercice supprimés !', 'warning');
                } else {
                    showToast('Série supprimée !', 'info');
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [saveStateToHistory, showToast]);

    const updateSerie = useCallback((dayKey, exerciseId, serieId, updates) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const exercise = updatedDays[dayKey].exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                const serie = exercise.series.find(s => s.id === serieId);
                if (serie) {
                    // Si reps ou weight changent, marquer la série comme non complétée
                    if ((updates.reps !== undefined && updates.reps !== serie.reps) ||
                        (updates.weight !== undefined && updates.weight !== serie.weight)) {
                        serie.completed = false;
                    }
                    Object.assign(serie, updates);
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, []);

    const toggleSerieCompleted = useCallback((dayKey, exerciseId, serieId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const exercise = updatedDays[dayKey].exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                const serie = exercise.series.find(s => s.id === serieId);
                if (serie) {
                    const newCompletedState = !serie.completed;
                    serie.completed = newCompletedState;
                    if (newCompletedState) {
                        startTimer(parseInt(restTimeInput, 10)); // Démarrer le minuteur
                    } else {
                        pauseTimer(); // Mettre en pause si on dévalide
                    }
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [restTimeInput, startTimer, pauseTimer]);

    const updateExerciseNotes = useCallback((dayKey, exerciseId, notes) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const exercise = updatedDays[dayKey].exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                exercise.notes = notes;
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, []);

    const editExercise = useCallback((dayKey, exerciseId, newName, newCategory) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const exercise = updatedDays[dayKey].exercises.find(ex => ex.id === exerciseId);
            if (exercise) {
                exercise.name = newName;
                exercise.category = newCategory;
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Exercice mis à jour !', 'success');
    }, [saveStateToHistory, showToast]);

    const deleteExercise = useCallback((dayKey, exerciseId) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            updatedDays[dayKey].exercises = updatedDays[dayKey].exercises.filter(ex => ex.id !== exerciseId);
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Exercice supprimé !', 'warning');
    }, [saveStateToHistory, showToast]);

    const renameDay = useCallback((dayKey, newName) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            if (updatedDays[dayKey]) {
                updatedDays[dayKey].name = newName;
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Nom du jour mis à jour !', 'success');
    }, [saveStateToHistory, showToast]);

    const deleteDay = useCallback((dayKey) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            delete updatedDays[dayKey];
            const updatedDayOrder = prevWorkouts.dayOrder.filter(key => key !== dayKey);
            return {
                days: updatedDays,
                dayOrder: updatedDayOrder
            };
        });
        showToast('Jour d\'entraînement supprimé !', 'warning');
    }, [saveStateToHistory, showToast]);

    const moveDay = useCallback((fromIndex, toIndex) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const newDayOrder = [...prevWorkouts.dayOrder];
            const [movedDay] = newDayOrder.splice(fromIndex, 1);
            newDayOrder.splice(toIndex, 0, movedDay);
            return {
                ...prevWorkouts,
                dayOrder: newDayOrder
            };
        });
    }, [saveStateToHistory]);

    const moveExercise = useCallback((dayKey, fromIndex, toIndex) => {
        saveStateToHistory();
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const newExercises = [...updatedDays[dayKey].exercises];
            const [movedExercise] = newExercises.splice(fromIndex, 1);
            newExercises.splice(toIndex, 0, movedExercise);
            return {
                ...prevWorkouts,
                days: {
                    ...updatedDays,
                    [dayKey]: { ...updatedDays[dayKey], exercises: newExercises }
                }
            };
        });
    }, [saveStateToHistory]);


    // Fonctions de gestion de l'historique des séances
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});

    useEffect(() => {
        if (!userId || !hasValidFirebaseConfig) {
            // Load from local storage for history if Firebase is not configured
            try {
                const storedHistory = localStorage.getItem('historicalData');
                if (storedHistory) {
                    setHistoricalData(JSON.parse(storedHistory).map(session => ({
                        ...session,
                        date: new Date(session.date) // Convert date string back to Date object
                    })));
                }
            } catch (error) {
                console.error('Error loading historical data from local storage:', error);
                showToast('Erreur de chargement de l\'historique local.', 'error');
            }
            return;
        }

        const q = query(collection(db, `users/${userId}/history`), limit(500)); // Limite à 500 entrées pour des raisons de performance
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date instanceof Timestamp ? doc.data().date.toDate() : new Date(doc.data().date) // Assurer que la date est un objet Date
            }));
            data.sort((a, b) => b.date.getTime() - a.date.getTime()); // Trier par date décroissante
            setHistoricalData(data);
        }, (error) => {
            console.error('Error fetching historical data from Firestore:', error);
            showToast('Erreur de chargement de l\'historique. Vérifiez votre connexion.', 'error');
        });

        return () => unsubscribe();
    }, [userId, hasValidFirebaseConfig]);

    useEffect(() => {
        if (!hasValidFirebaseConfig) {
            // Save to local storage for history if Firebase is not configured
            try {
                localStorage.setItem('historicalData', JSON.stringify(historicalData));
            } catch (error) {
                console.error('Error saving historical data to local storage:', error);
            }
        }
    }, [historicalData, hasValidFirebaseConfig]);

    const calculatePersonalBests = useCallback((history) => {
        const bests = {};
        history.forEach(session => {
            session.exercises.forEach(exercise => {
                if (!bests[exercise.name]) {
                    bests[exercise.name] = { volume: 0, maxWeight: 0, maxRepsAtWeight: {}, oneRepMax: 0 };
                }

                // Calculate volume for the session
                const sessionVolume = exercise.series.reduce((sum, serie) => sum + (serie.weight || 0) * (serie.reps || 0), 0);
                if (sessionVolume > bests[exercise.name].volume) {
                    bests[exercise.name].volume = sessionVolume;
                }

                exercise.series.forEach(serie => {
                    const weight = serie.weight || 0;
                    const reps = serie.reps || 0;

                    // Max weight lifted
                    if (weight > bests[exercise.name].maxWeight) {
                        bests[exercise.name].maxWeight = weight;
                    }

                    // Max reps at a given weight
                    if (weight > 0) {
                        if (!bests[exercise.name].maxRepsAtWeight[weight] || reps > bests[exercise.name].maxRepsAtWeight[weight]) {
                            bests[exercise.name].maxRepsAtWeight[weight] = reps;
                        }
                    }

                    // One Rep Max (Brzycki Formula: Weight * (36 / (37 - Reps)))
                    if (reps > 0 && reps <= 15 && weight > 0) { // Limit reps for 1RM calculation
                        const oneRM = weight * (36 / (37 - reps));
                        if (oneRM > bests[exercise.name].oneRepMax) {
                            bests[exercise.name].oneRepMax = oneRM;
                        }
                    }
                });
            });
        });
        setPersonalBests(bests);
    }, []);

    useEffect(() => {
        calculatePersonalBests(historicalData);
    }, [historicalData, calculatePersonalBests]);


    const saveWorkoutSession = async (completedDay) => {
        if (!completedDay || !completedDay.exercises || completedDay.exercises.length === 0) {
            showToast('Aucun exercice complété pour sauvegarder.', 'warning');
            return;
        }

        const session = {
            date: serverTimestamp(),
            dayName: completedDay.name,
            exercises: completedDay.exercises.map(ex => ({
                name: ex.name,
                category: ex.category,
                notes: ex.notes,
                series: ex.series.map(s => ({
                    reps: s.reps,
                    weight: s.weight,
                    completed: s.completed, // Garder l'état complété dans l'historique
                    id: s.id
                }))
            })).filter(ex => ex.series.some(s => s.completed && (s.reps > 0 || s.weight > 0))) // Filtrer les exercices sans séries complétées ou non renseignées
        };

        if (session.exercises.length === 0) {
            showToast('Veuillez compléter au moins une série avec des reps/poids pour sauvegarder.', 'warning');
            return;
        }

        try {
            if (userId && hasValidFirebaseConfig) {
                await addDoc(collection(db, `users/${userId}/history`), session);
            } else {
                // Fallback to local storage
                const currentHistory = JSON.parse(localStorage.getItem('historicalData') || '[]');
                // Add a local timestamp for local storage
                const sessionToSave = { ...session, date: new Date().toISOString() };
                currentHistory.push(sessionToSave);
                localStorage.setItem('historicalData', JSON.stringify(currentHistory));
            }
            showToast('Séance sauvegardée dans l\'historique !', 'success');

            // Réinitialiser les séries complétées dans le workout actuel
            setWorkouts(prevWorkouts => {
                const newWorkouts = JSON.parse(JSON.stringify(prevWorkouts)); // Deep copy
                const dayToReset = newWorkouts.days[completedDay.id];
                if (dayToReset) {
                    dayToReset.exercises.forEach(exercise => {
                        exercise.series.forEach(serie => {
                            serie.completed = false; // Remettre à faux toutes les séries
                            // Optionnel: Réinitialiser reps/weight à null si vous voulez un "fresh start"
                            // serie.reps = null;
                            // serie.weight = null;
                        });
                    });
                }
                return newWorkouts;
            });
            resetTimer(); // Réinitialiser le minuteur après la sauvegarde
        } catch (error) {
            console.error('Error saving workout session:', error);
            showToast('Erreur lors de la sauvegarde de la séance.', 'error');
        }
    };


    const reactivateExercise = useCallback(async (sessionId, exerciseName) => {
        if (!userId || !hasValidFirebaseConfig) {
            showToast('Fonctionnalité non disponible hors ligne.', 'error');
            return;
        }
        try {
            const historyRef = doc(db, `users/${userId}/history`, sessionId);
            const batch = writeBatch(db);

            batch.update(historyRef, {
                exercises: historicalData.find(s => s.id === sessionId).exercises.map(ex =>
                    ex.name === exerciseName ? { ...ex, isDeleted: false } : ex
                )
            });

            await batch.commit();
            showToast('Exercice réactivé dans l\'historique !', 'success');
        } catch (error) {
            console.error('Error reactivating exercise:', error);
            showToast('Erreur lors de la réactivation de l\'exercice.', 'error');
        }
    }, [userId, historicalData, hasValidFirebaseConfig, showToast]);

    const deleteHistoricalSession = useCallback(async (sessionId) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cette séance de l\'historique ? Cette action est irréversible.')) {
            try {
                if (userId && hasValidFirebaseConfig) {
                    const sessionRef = doc(db, `users/${userId}/history`, sessionId);
                    await setDoc(sessionRef, { isDeleted: true }, { merge: true }); // Marquer comme supprimé
                } else {
                    // Fallback local storage
                    const currentHistory = JSON.parse(localStorage.getItem('historicalData') || '[]');
                    const updatedHistory = currentHistory.map(session =>
                        session.id === sessionId ? { ...session, isDeleted: true } : session
                    );
                    localStorage.setItem('historicalData', JSON.stringify(updatedHistory));
                }
                showToast('Séance marquée comme supprimée.', 'warning');
            } catch (error) {
                console.error('Error deleting historical session:', error);
                showToast('Erreur lors de la suppression de la séance.', 'error');
            }
        }
    }, [userId, hasValidFirebaseConfig, showToast]);

    const analyzeProgressionWithAI = useCallback(async (exerciseName, history) => {
        if (!generativeModel) {
            showToast('Fonctionnalité IA non disponible (clé API manquante ou invalide).', 'error');
            return;
        }
        if (!exerciseName || !history || history.length === 0) {
            setProgressionAnalysisContent('Veuillez sélectionner un exercice ou assurez-vous qu\'il y a des données d\'historique pour l\'analyse.');
            return;
        }

        setIsLoadingAI(true);
        setProgressionAnalysisContent('Analyse de votre progression par l\'IA en cours...');

        try {
            const exerciseHistory = history.filter(session =>
                session.exercises.some(ex => ex.name === exerciseName)
            ).map(session => {
                const exerciseData = session.exercises.find(ex => ex.name === exerciseName);
                const seriesData = exerciseData.series.map(s => `(${s.reps} reps @ ${s.weight}kg)`).join(', ');
                return `Date: ${formatDate(session.date)}, Séries: ${seriesData}`;
            }).join('\n');

            if (!exerciseHistory) {
                setProgressionAnalysisContent(`Aucune donnée d'historique trouvée pour l'exercice "${exerciseName}".`);
                setIsLoadingAI(false);
                return;
            }

            const prompt = `Voici l'historique des entraînements pour l'exercice "${exerciseName}" :\n${exerciseHistory}\n\nAnalysez cette progression. Identifiez les tendances (augmentation/diminution du poids, des répétitions), les pics de performance, les plateaux ou les baisses. Fournissez une analyse concise et des suggestions basées sur les données. Utilisez des phrases courtes et claires, en français. Structurez la réponse avec des points clés pour la lisibilité.`;

            const result = await generativeModel.generateContent(prompt);
            const responseText = result.response.text();
            setProgressionAnalysisContent(responseText);
            showToast('Analyse de progression IA terminée !', 'success');
        } catch (error) {
            console.error('Error analyzing progression with AI:', error);
            setProgressionAnalysisContent('Erreur lors de l\'analyse de la progression. Veuillez réessayer.');
            showToast('Erreur lors de l\'analyse IA.', 'error');
        } finally {
            setIsLoadingAI(false);
        }
    }, [generativeModel, showToast, formatDate]);

    const analyzeGlobalStatsWithAI = useCallback(async (globalNotesContent, workoutsData, historicalData) => {
        if (!generativeModel) {
            showToast('Fonctionnalité IA non disponible (clé API manquante ou invalide).', 'error');
            return;
        }

        setIsLoadingAI(true);
        setProgressionAnalysisContent('Analyse générale de vos statistiques par l\'IA en cours...'); // Réutiliser le même état pour l'affichage

        try {
            const workoutSummary = Object.values(workoutsData.days).map(day =>
                `Jour: ${day.name}\n` +
                day.exercises.map(ex =>
                    `  - ${ex.name} (${ex.category}): ${ex.series.length} séries`
                ).join('\n')
            ).join('\n\n');

            const historySummary = historicalData.slice(0, 10).map(session => // Limite à 10 sessions pour le prompt
                `Séance du ${formatDate(session.date)}: ${session.exercises.map(ex => `${ex.name} (${ex.series.length} séries)`).join(', ')}`
            ).join('\n');

            const prompt = `Je cherche une analyse de mes habitudes d'entraînement et des suggestions d'amélioration. Voici un résumé de mes entraînements actuels et de mon historique :\n\n--- Entraînements Actuels ---\n${workoutSummary}\n\n--- Dernières Séances Historiques (10 dernières) ---\n${historySummary}\n\n--- Mes Notes Générales ---\n${globalNotesContent || 'Pas de notes générales fournies.'}\n\nEn vous basant sur ces informations, pouvez-vous :\n1. Fournir une analyse concise de mes habitudes d'entraînement (fréquence, types d'exercices, etc.).\n2. Identifier des points forts ou des points faibles (par exemple, déséquilibre, manque de variété).\n3. Proposer 2-3 suggestions concrètes pour améliorer mon programme ou ma performance. Soyez direct et clair.`;

            const result = await generativeModel.generateContent(prompt);
            const responseText = result.response.text();
            setProgressionAnalysisContent(responseText);
            showToast('Analyse IA globale terminée !', 'success');
        } catch (error) {
            console.error('Error analyzing global stats with AI:', error);
            setProgressionAnalysisContent('Erreur lors de l\'analyse globale. Veuillez réessayer.');
            showToast('Erreur lors de l\'analyse IA globale.', 'error');
        } finally {
            setIsLoadingAI(false);
        }
    }, [generativeModel, showToast, formatDate]);


    const getWorkoutStats = useCallback((workoutsData, historicalData) => {
        const stats = {
            totalExercises: 0,
            totalSeries: 0,
            totalCompletedWorkouts: historicalData.length,
            uniqueExercises: new Set(),
            exercisesByCategory: {},
            topExercises: {}, // Pour les exercices les plus fréquents dans l'historique
        };

        // Current workouts stats
        Object.values(workoutsData.days).forEach(day => {
            stats.totalExercises += day.exercises.length;
            day.exercises.forEach(ex => {
                stats.totalSeries += ex.series.length;
                stats.uniqueExercises.add(ex.name);
                stats.exercisesByCategory[ex.category] = (stats.exercisesByCategory[ex.category] || 0) + 1;
            });
        });

        // Historical data stats
        historicalData.forEach(session => {
            session.exercises.forEach(ex => {
                stats.uniqueExercises.add(ex.name);
                stats.topExercises[ex.name] = (stats.topExercises[ex.name] || 0) + 1;
            });
        });

        stats.uniqueExercisesCount = stats.uniqueExercises.size;

        // Sort top exercises
        stats.sortedTopExercises = Object.entries(stats.topExercises)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5); // Top 5

        return stats;
    }, []);

    const showProgressionGraphForExercise = useCallback((exerciseData) => {
        // Cette fonction ne fait que rediriger vers la vue Stats et passe les données
        // L'affichage du graphique se fera dans StatsView
        setCurrentView('stats');
        // Dans une application plus complexe, vous pourriez stocker exerciseData
        // dans un état global ou un contexte pour que StatsView puisse le récupérer.
        // Pour cet exemple, on peut imaginer que StatsView aura un moyen de filtrer par exercice
        // ou que les données de l'exercice seront passées explicitement via un état.
        // Puisque StatsView a accès à historicalData, il peut filtrer par exerciseName.
        showToast(`Affichage des stats pour : ${exerciseData.name}`, 'info');
    }, [setCurrentView, showToast]);


    return (
        <div className="relative min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700 shadow-md">
                <div className="flex items-center gap-3">
                    <Dumbbell className="h-8 w-8 text-blue-400" />
                    <h1 className="text-2xl font-bold text-white tracking-tight">LiftLog</h1>
                    {isAdvancedMode && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded-full animate-pulse">
                            Mode Avancé
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors duration-200"
                    aria-label="Paramètres"
                >
                    <Settings className="h-6 w-6" />
                </button>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 pb-20 no-scrollbar"> {/* Ajout pb-20 pour laisser de la place à la nav bar */}
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        setWorkouts={setWorkouts}
                        onToggleSerieCompleted={toggleSerieCompleted}
                        onUpdateSerie={updateSerie}
                        onAddSerie={addSerie}
                        onRemoveSerie={removeSerie}
                        onUpdateExerciseNotes={updateExerciseNotes}
                        onEditClick={editExercise}
                        onDeleteExercise={deleteExercise}
                        addDay={addDay}
                        renameDay={renameDay}
                        deleteDay={deleteDay}
                        moveDay={moveDay}
                        moveExercise={moveExercise}
                        saveWorkoutSession={saveWorkoutSession}
                        showToast={showToast}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        isAdvancedMode={isAdvancedMode}
                        personalBests={personalBests}
                        startRestTimer={startTimer}
                        restTimeInput={restTimeInput}
                        hasValidFirebaseConfig={hasValidFirebaseConfig}
                        saveStateToHistory={saveStateToHistory}
                    />
                )}
                {currentView === 'timer' && (
                    <TimerView
                        timerSeconds={timerSeconds}
                        timerIsRunning={timerIsRunning}
                        timerIsFinished={timerIsFinished}
                        startTimer={startTimer}
                        pauseTimer={pauseTimer}
                        resetTimer={resetTimer}
                        setTimerSeconds={setTimerSeconds}
                        restTimeInput={restTimeInput}
                        setRestTimeInput={setRestTimeInput}
                        formatTime={formatTime}
                        setTimerPreset={setTimerPreset}
                    />
                )}
                {currentView === 'history' && (
                    <HistoryView
                        historicalData={historicalData}
                        personalBests={personalBests}
                        handleReactivateExercise={reactivateExercise}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        showProgressionGraphForExercise={showProgressionGraphForExercise}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        isAdvancedMode={isAdvancedMode}
                        deleteHistoricalSession={deleteHistoricalSession}
                        isLoadingAI={isLoadingAI}
                    />
                )}
                {currentView === 'stats' && (
                    <StatsView
                        workouts={workouts}
                        historicalData={historicalData}
                        personalBests={personalBests}
                        formatDate={formatDate}
                        globalNotes={globalNotes}
                        setGlobalNotes={setGlobalNotes}
                        analyzeGlobalStatsWithAI={analyzeGlobalStatsWithAI}
                        aiAnalysisLoading={isLoadingAI} // Use isLoadingAI for all AI analysis loading
                        progressionAnalysisContent={progressionAnalysisContent} // Pass this down
                        getWorkoutStats={getWorkoutStats}
                    />
                )}
            </main>

            {/* Bottom Navigation Bar */}
            <BottomNavigationBar
                currentView={currentView}
                setCurrentView={setCurrentView}
            />

            {/* Timer Modal */}
            <TimerModal
                isOpen={timerModalOpen}
                onClose={() => setTimerModalOpen(false)}
                timerSeconds={timerSeconds}
                timerIsRunning={timerIsRunning}
                timerIsFinished={timerIsFinished}
                startTimer={startTimer}
                pauseTimer={pauseTimer}
                resetTimer={resetTimer}
                setTimerSeconds={setTimerSeconds}
                formatTime={formatTime}
                setTimerPreset={setTimerPreset}
                restTimeInput={restTimeInput} // Passer la valeur de restTimeInput
            />

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={closeToast}
                    action={toast.action}
                    duration={toast.duration}
                />
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl border border-gray-700 transform animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Settings className="h-6 w-6 text-blue-400" />
                                Paramètres
                            </h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-2 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                                aria-label="Fermer les paramètres"
                            >
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Thème */}
                            <div>
                                <label htmlFor="theme-select" className="block text-gray-300 text-sm font-medium mb-2">Thème</label>
                                <select
                                    id="theme-select"
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none"
                                    style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                >
                                    <option value="system">Système</option>
                                    <option value="dark">Sombre</option>
                                    <option value="light">Clair</option>
                                </select>
                            </div>

                            {/* Mode Avancé */}
                            <div className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                <span className="text-gray-300 font-medium flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-purple-400" /> Mode Avancé
                                    <span className="text-xs text-gray-400 ml-2">(Fonctionnalités expérimentales)</span>
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isAdvancedMode}
                                        onChange={() => setIsAdvancedMode(!isAdvancedMode)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                </label>
                            </div>

                            {/* Temps de repos par défaut */}
                            <div>
                                <label htmlFor="rest-time-input" className="block text-gray-300 text-sm font-medium mb-2">
                                    Temps de repos par défaut (secondes)
                                </label>
                                <input
                                    type="number"
                                    id="rest-time-input"
                                    value={restTimeInput}
                                    onChange={(e) => setRestTimeInput(e.target.value)}
                                    min="0"
                                    step="15"
                                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 text-sm focus:ring-green-500 focus:border-green-500 transition-all"
                                    placeholder="Ex: 90"
                                />
                            </div>

                            {/* Notes Générales */}
                            <div>
                                <label htmlFor="global-notes" className="block text-gray-300 text-sm font-medium mb-2">
                                    Notes Générales
                                </label>
                                <textarea
                                    id="global-notes"
                                    value={globalNotes}
                                    onChange={(e) => setGlobalNotes(e.target.value)}
                                    rows="4"
                                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 transition-all resize-y"
                                    placeholder="Vos objectifs, rappels, etc."
                                ></textarea>
                            </div>

                            {/* Boutons Undo/Redo (dans les paramètres pour le moment) */}
                            <div className="flex justify-around gap-4 mt-6">
                                <button
                                    onClick={undo}
                                    disabled={historyChanges.length === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Undo2 className="h-5 w-5" />
                                    Annuler
                                </button>
                                <button
                                    onClick={redo}
                                    disabled={futureChanges.length === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Redo2 className="h-5 w-5" />
                                    Rétablir
                                </button>
                            </div>


                            <div className="text-sm text-gray-400 mt-6 text-center">
                                Application version 1.0.0
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modale d'analyse de progression AI */}
            {progressionAnalysisContent && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60] animate-fade-in">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl border border-gray-700 transform animate-scale-in">
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Sparkles className="h-6 w-6 text-yellow-400" />
                                    Analyse IA
                                </h2>
                                <button
                                    onClick={() => setProgressionAnalysisContent('')}
                                    className="p-2 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4 mb-4">
                                <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                                    {progressionAnalysisContent}
                                </div>
                            </div>

                            <div className="text-xs text-gray-400 mb-4">
                                💡 Cette analyse est générée par IA et doit être considérée comme un conseil général.
                                Consultez un professionnel pour un programme personnalisé.
                            </div>

                            <button
                                onClick={() => setProgressionAnalysisContent('')}
                                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all"
                            >
                                Fermer l'analyse
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImprovedWorkoutApp;