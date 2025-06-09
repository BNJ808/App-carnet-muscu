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
import * as GenerativeAIModule from '@google/generative-ai';

// Import des composants
import Toast from './components/Toast.jsx';
import MainWorkoutView from './components/MainWorkoutView.jsx';
import HistoryView from './components/HistoryView.jsx';
import TimerView from './components/TimerView.jsx';
import StatsView from './components/StatsView.jsx';
import BottomNavigationBar from './components/BottomNavigationBar.jsx';
import TimerModal from './components/TimerModal.jsx';

// --- Firebase Configuration ---
// Remplacez par vos propres informations de configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Vérifiez que la clé API est présente
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing. Please set VITE_FIREBASE_API_KEY in your .env file.");
}

const ImprovedWorkoutApp = () => {
    // Déclarations useState
    const [workouts, setWorkouts] = useState(() => {
        const savedWorkouts = localStorage.getItem('workouts');
        return savedWorkouts ? JSON.parse(savedWorkouts) : { days: {}, dayOrder: [] };
    });
    const [currentView, setCurrentView] = useState('workout');
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [globalNotes, setGlobalNotes] = useState('');
    const [toast, setToast] = useState(null);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [isLoadingAIProgression, setIsLoadingAIProgression] = useState(false);
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
    const [restTimeInput, setRestTimeInput] = useState('90');
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [theme, setTheme] = useState('dark'); // 'dark' ou 'light'
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    // Déclarations useRef
    const authRef = useRef(null);
    const dbRef = useRef(null);
    const currentUserRef = useRef(null);
    const unsubscribeFirestoreRef = useRef(null);
    const authUnsubscribeRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const isUpdatingFirestoreRef = useRef(false); // Pour éviter les boucles infinies de mise à jour Firestore

    // Fonctions utilitaires
    const showToast = useCallback((message, type = 'info', action = null, duration = 3000) => {
        setToast({ message, type, action, duration });
    }, []);

    const formatTime = useCallback((seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, []);

    const formatDate = useCallback((timestamp) => {
        if (!timestamp) return 'N/A';
        let date;
        // Si c'est un objet Timestamp de Firebase
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            // Si c'est une chaîne ou un nombre, tentez de créer une date
            date = new Date(timestamp);
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            return 'Date invalide';
        }

        if (isNaN(date.getTime())) {
            return 'Date invalide';
        }

        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString('fr-FR', options);
    }, []);


    // Effet pour l'initialisation de Firebase et la gestion de l'authentification (déjà décommenté)
    useEffect(() => {
        if (!firebaseConfig.apiKey) {
            console.error("Firebase API Key is missing. Please set VITE_FIREBASE_API_KEY in your .env file.");
            showToast("Erreur: Clé API Firebase manquante.", 'error');
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            authRef.current = getAuth(app);
            dbRef.current = getFirestore(app);

            authUnsubscribeRef.current = onAuthStateChanged(authRef.current, async (user) => {
                if (user) {
                    currentUserRef.current = user;
                    if (unsubscribeFirestoreRef.current) {
                        unsubscribeFirestoreRef.current();
                    }

                    unsubscribeFirestoreRef.current = onSnapshot(doc(dbRef.current, "users", user.uid), (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            setWorkouts(data.workouts || { days: {}, dayOrder: [] });
                            setHistoricalData(data.historicalData || []);
                            setPersonalBests(data.personalBests || {});
                            setGlobalNotes(data.globalNotes || '');
                        } else {
                            setDoc(doc(dbRef.current, "users", user.uid), {
                                workouts: { days: {}, dayOrder: [] },
                                historicalData: [],
                                personalBests: {},
                                globalNotes: '',
                                createdAt: serverTimestamp()
                            }, { merge: true }).catch(e => console.error("Error setting initial user data:", e));
                        }
                        setIsInitialLoad(false);
                    }, (error) => {
                        console.error("Erreur de lecture Firestore:", error);
                        showToast("Erreur de chargement des données. Veuillez recharger.", 'error');
                        setIsInitialLoad(false);
                    });
                } else {
                    signInAnonymously(authRef.current).catch((error) => {
                        console.error("Erreur de connexion anonyme:", error);
                        showToast("Impossible de se connecter anonymement. Veuillez vérifier votre connexion.", 'error');
                    });
                }
            });
        } catch (error) {
            console.error("Erreur lors de l'initialisation de Firebase ou de l'authentification:", error);
            showToast("Erreur critique d'initialisation de l'application.", 'error');
        }

        return () => {
            if (authUnsubscribeRef.current) authUnsubscribeRef.current();
            if (unsubscribeFirestoreRef.current) unsubscribeFirestoreRef.current();
        };
    }, []);

    // Effet pour la sauvegarde des données dans Firestore et localStorage (déjà décommenté)
    useEffect(() => {
        if (currentUserRef.current && dbRef.current && !isInitialLoad) {
            if (isUpdatingFirestoreRef.current) {
                return;
            }

            const saveData = async () => {
                isUpdatingFirestoreRef.current = true;
                try {
                    const userDocRef = doc(dbRef.current, "users", currentUserRef.current.uid);
                    await setDoc(userDocRef, {
                        workouts: workouts,
                        historicalData: historicalData,
                        personalBests: personalBests,
                        globalNotes: globalNotes,
                        lastUpdated: serverTimestamp()
                    }, { merge: true });
                    // showToast("Données sauvegardées sur le cloud.", 'success', null, 1500); // Désactivé temporairement pour éviter spam toast
                } catch (error) {
                    console.error("Erreur de sauvegarde des données Firestore:", error);
                    showToast("Erreur de sauvegarde des données sur le cloud.", 'error');
                } finally {
                    isUpdatingFirestoreRef.current = false;
                }
            };

            const saveToLocalStorage = () => {
                localStorage.setItem('workouts', JSON.stringify(workouts));
                localStorage.setItem('historicalData', JSON.stringify(historicalData));
                localStorage.setItem('personalBests', JSON.stringify(personalBests));
                localStorage.setItem('globalNotes', JSON.stringify(globalNotes));
            };

            const handler = setTimeout(() => {
                saveData();
                saveToLocalStorage();
            }, 1000);

            return () => {
                clearTimeout(handler);
            };
        }
    }, [workouts, historicalData, personalBests, globalNotes, isInitialLoad, showToast]);

    // Effet pour la logique du minuteur
    useEffect(() => {
        if (timerIsRunning) {
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds((prevSeconds) => {
                    if (prevSeconds <= 1) {
                        clearInterval(timerIntervalRef.current);
                        setTimerIsRunning(false);
                        setTimerIsFinished(true);
                        showToast("Le minuteur est terminé !", 'info');
                        // Optionnel: jouer un son ou une vibration
                        return 0;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        } else {
            clearInterval(timerIntervalRef.current);
        }

        return () => clearInterval(timerIntervalRef.current);
    }, [timerIsRunning, showToast]);

    // Effet pour gérer le changement de thème
    useEffect(() => {
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Effet pour la gestion de l'historique undo/redo
    useEffect(() => {
        // Sauvegarder l'état actuel pour l'undo, sauf si c'est une action de redo
        const currentState = { workouts, historicalData, personalBests, globalNotes };
        // Vérifier si l'état actuel est différent du dernier état dans l'undoStack pour éviter les duplications
        // Une comparaison profonde serait idéale, mais une comparaison superficielle peut suffire pour les tests
        if (undoStack.length === 0 || JSON.stringify(undoStack[undoStack.length - 1]) !== JSON.stringify(currentState)) {
            setUndoStack(prev => [...prev, currentState]);
            setRedoStack([]); // Effacer le redoStack après une nouvelle action
        }
    }, [workouts, historicalData, personalBests, globalNotes]); // Déclenche sur les changements majeurs de l'état


    // // Fonctions de logique métier et interactions (commentées pour l'instant)
    // const getSeriesDisplay = useCallback((series) => { /* ... */ }, []);
    // const getWorkoutStats = useCallback((workoutsData, historicalData) => { /* ... */ }, []);
    // const getExerciseVolumeData = useCallback((exerciseName, history) => { /* ... */ }, []);
    // const getDailyVolumeData = useCallback((history) => { /* ... */ }, []);
    // const getExerciseFrequencyData = useCallback((history) => { /* ... */ }, []);

    // const addDay = useCallback((dayName) => { /* ... */ }, []);
    // const renameDay = useCallback((oldName, newName) => { /* ... */ }, []);
    // const deleteDay = useCallback((dayName) => { /* ... */ }, []);
    // const addExercise = useCallback((dayName, newExercise) => { /* ... */ }, []);
    // const updateExercise = useCallback((dayName, exerciseIndex, updatedExercise) => { /* ... */ }, []);
    // const deleteExercise = useCallback((dayName, exerciseIndex) => { /* ... */ }, []);
    // const onToggleSerieCompleted = useCallback((dayName, exerciseIndex, serieIndex) => { /* ... */ }, []);
    // const onUpdateSerie = useCallback((dayName, exerciseIndex, serieIndex, updatedSerie) => { /* ... */ }, []);
    // const onAddSerie = useCallback((dayName, exerciseIndex) => { /* ... */ }, []);
    // const onRemoveSerie = useCallback((dayName, exerciseIndex, serieIndex) => { /* ... */ }, []);
    // const onUpdateExerciseNotes = useCallback((dayName, exerciseIndex, notes) => { /* ... */ }, []);
    // const onEditClick = useCallback((dayName, exerciseIndex) => { /* ... */ }, []);
    // const saveCurrentWorkoutSession = useCallback(() => { /* ... */ }, []);
    // const handleReactivateExercise = useCallback((exercise) => { /* ... */ }, []);
    // const deleteHistoricalSession = useCallback(async (sessionId) => { /* ... */ }, []);
    // const analyzeProgressionWithAI = useCallback(async (exerciseName, exerciseHistory, workoutNotes) => { /* ... */ }, []);
    // const analyzeGlobalStatsWithAI = useCallback(async (notes, workoutStats, pbData) => { /* ... */ }, []);
    // const onGenerateAISuggestions = useCallback(async (notes, currentWorkouts) => { /* ... */ }, []);
    // const startTimer = useCallback((seconds) => { /* ... */ }, []);
    // const pauseTimer = useCallback(() => { /* ... */ }, []);
    // const resetTimer = useCallback(() => { /* ... */ }, []);
    // const importData = useCallback(async (jsonString) => { /* ... */ }, []);
    // const exportData = useCallback(() => { /* ... */ }, []);
    const undo = useCallback(() => {
        if (undoStack.length > 1) { // Il faut au moins un état précédent pour annuler
            const previousState = undoStack[undoStack.length - 2]; // Le dernier état valide
            const currentState = undoStack[undoStack.length - 1]; // L'état actuel que nous allons annuler

            setRedoStack(prev => [...prev, currentState]); // Sauvegarder l'état actuel pour le redo
            setWorkouts(previousState.workouts);
            setHistoricalData(previousState.historicalData);
            setPersonalBests(previousState.personalBests);
            setGlobalNotes(previousState.globalNotes);
            setUndoStack(prev => prev.slice(0, prev.length - 1)); // Retirer le dernier état
            showToast("Action annulée.", 'info', null, 1000);
        } else {
            showToast("Impossible d'annuler davantage.", 'warning', null, 1000);
        }
    }, [undoStack, showToast]);

    const redo = useCallback(() => {
        if (redoStack.length > 0) {
            const nextState = redoStack[redoStack.length - 1]; // Le prochain état à refaire
            
            // Ajouter l'état actuel à l'undoStack avant de le remplacer par le nextState du redoStack
            setUndoStack(prev => [...prev, { workouts, historicalData, personalBests, globalNotes }]);

            setWorkouts(nextState.workouts);
            setHistoricalData(nextState.historicalData);
            setPersonalBests(nextState.personalBests);
            setGlobalNotes(nextState.globalNotes);
            setRedoStack(prev => prev.slice(0, prev.length - 1)); // Retirer l'état du redoStack
            showToast("Action rétablie.", 'info', null, 1000);
        } else {
            showToast("Impossible de refaire davantage.", 'warning', null, 1000);
        }
    }, [redoStack, workouts, historicalData, personalBests, globalNotes, showToast]);


    return (
        <div className={`App ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} min-h-screen flex flex-col transition-colors duration-300`}>
            <header className={`${theme === 'dark' ? 'bg-gray-800 shadow-md border-b border-gray-700/50' : 'bg-white shadow-md border-b border-gray-200'} py-4 px-6 text-center text-xl font-bold`}>
                Mon App d'Entraînement
            </header>

            <main className="flex-grow p-4 overflow-y-auto pb-20">
                {/* Contenu principal minimal pour le test */}
                <div className="text-center p-8">
                    <h1 className="text-2xl font-bold mb-4">Application en cours de chargement...</h1>
                    <p className="text-gray-400">Si cette page reste affichée, vérifiez la console pour des erreurs.</p>
                    {isInitialLoad && <p className="text-blue-400 mt-2">Chargement des données initiales...</p>}
                    {!isInitialLoad && <p className="text-green-400 mt-2">Données chargées ou initialisées. Prêt à commencer !</p>}
                </div>

                {/* Les composants de vue et la navigation sont commentés pour l'instant */}
                {/*
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        setWorkouts={setWorkouts}
                        onToggleSerieCompleted={onToggleSerieCompleted}
                        // ... toutes les autres props
                    />
                )}
                {currentView === 'history' && (
                    <HistoryView
                        historicalData={historicalData}
                        // ... toutes les autres props
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
                        setTimerPreset={() => {}} // Placeholder for now
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
                        analyzeGlobalStatsWithAI={() => {}} // Placeholder
                        aiAnalysisLoading={isLoadingAIProgression}
                        onGenerateAISuggestions={() => {}} // Placeholder
                        aiSuggestions={aiSuggestions}
                        isLoadingAI={isLoadingAI}
                        progressionAnalysisContent={progressionAnalysisContent}
                        getWorkoutStats={() => {}} // Placeholder
                        getExerciseVolumeData={() => []} // Placeholder
                        getDailyVolumeData={() => []} // Placeholder
                        getExerciseFrequencyData={() => []} // Placeholder
                        showToast={showToast}
                    />
                )}
                */}
            </main>

            {/* Barre de navigation inférieure (commentée pour l'instant) */}
            {/*
            <BottomNavigationBar
                currentView={currentView}
                setCurrentView={setCurrentView}
            />
            */}

            {/* Toast notification - Décommenté car showToast est utilisé */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                    action={toast.action}
                    duration={toast.duration}
                />
            )}

            {/* Timer Modal (commenté pour l'instant) */}
            {/*
            <TimerModal
                isOpen={isTimerModalOpen}
                onClose={() => setIsTimerModalOpen(false)}
                timerSeconds={timerSeconds}
                timerIsRunning={timerIsRunning}
                timerIsFinished={timerIsFinished}
                startTimer={startTimer}
                pauseTimer={pauseTimer}
                resetTimer={resetTimer}
                setTimerSeconds={setTimerSeconds}
                formatTime={formatTime}
            />
            */}

            {/* AI Analysis Modal (commenté pour l'instant) */}
            {/*
            {progressionAnalysisContent && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex justify-center items-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-700 animate-slide-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                                <Sparkles className="h-6 w-6" /> Analyse de Progression
                            </h3>
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
            )}
            */}
        </div>
    );
};

export default ImprovedWorkoutApp;