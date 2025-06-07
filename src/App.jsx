import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Undo2, Redo2, Settings, XCircle, CheckCircle, ChevronDown, ChevronUp, Pencil, Sparkles, ArrowUp, ArrowDown,
    Plus, Trash2, Play, Pause, RotateCcw, Search, Filter, Dumbbell, Clock, History, NotebookText,
    LineChart as LineChartIcon, Target, TrendingUp, Award, Calendar, BarChart3, Moon, Sun,
    Zap, Download, Upload, Share, Eye, EyeOff, Maximize2, Minimize2, Activity
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import des composants
import Toast from './Toast.jsx';
import MainWorkoutView from './MainWorkoutView.jsx';
import HistoryView from './HistoryView.jsx';
import TimerView from './TimerView.jsx';
import BottomNavigationBar from './BottomNavigationBar.jsx';

// Configuration Firebase sécurisée
const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "demo-key",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "demo-domain",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "demo-project",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "demo-bucket",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "demo-sender",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || "demo-app",
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Configuration Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env?.VITE_GEMINI_API_KEY || "demo-key");

// Constantes
const MAX_UNDO_STATES = 20;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 300;
const AUTO_SAVE_DELAY = 2000;

// Utilitaires optimisés
const generateUUID = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'Date invalide';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const getSeriesDisplay = (series) => {
    if (!Array.isArray(series) || series.length === 0) return 'Aucune série';
    return series.map(s => `${s.weight || '?'}kg × ${s.reps || '?'}`).join(' | ');
};

// Hook personnalisé pour le debouncing
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    
    return debouncedValue;
};

// Hook pour le localStorage avec fallback
const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Erreur localStorage ${key}:`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            setStoredValue(value);
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`Erreur écriture localStorage ${key}:`, error);
        }
    }, [key]);

    return [storedValue, setValue];
};

// Hook pour les notifications natives
const useNotifications = () => {
    const [permission, setPermission] = useState(Notification?.permission || 'default');

    const requestPermission = useCallback(async () => {
        if ('Notification' in window) {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result === 'granted';
        }
        return false;
    }, []);

    const showNotification = useCallback((title, options = {}) => {
        if (permission === 'granted') {
            return new Notification(title, {
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                ...options
            });
        }
        return null;
    }, [permission]);

    return { permission, requestPermission, showNotification };
};

// Stub pour Tone.js si non disponible
if (typeof window.Tone === 'undefined') {
    console.warn("Tone.js non trouvé. Fonctionnalités audio désactivées.");
    window.Tone = {
        Synth: () => ({
            toDestination: () => ({}),
            triggerAttackRelease: () => {},
            dispose: () => {}
        }),
        context: {
            state: 'suspended',
            resume: () => Promise.resolve()
        },
        start: () => Promise.resolve(),
        now: () => 0
    };
}

// Données de base optimisées
const baseInitialData = {
    days: {
        'Lundi + Jeudi': {
            categories: {
                PECS: [
                    { id: generateUUID(), name: 'D.Couché léger', series: [{ weight: '10', reps: '12' }], isDeleted: false, notes: '', createdAt: new Date().toISOString() },
                    { id: generateUUID(), name: 'D.Couché lourd', series: [{ weight: '14', reps: '8' }], isDeleted: false, notes: '', createdAt: new Date().toISOString() }
                ],
                EPAULES: [
                    { id: generateUUID(), name: 'D.Epaules léger', series: [{ weight: '8', reps: '15' }], isDeleted: false, notes: '', createdAt: new Date().toISOString() }
                ],
                TRICEPS: [
                    { id: generateUUID(), name: 'Haltere Front léger', series: [{ weight: '4', reps: '12' }], isDeleted: false, notes: '', createdAt: new Date().toISOString() }
                ]
            },
            categoryOrder: ['PECS', 'EPAULES', 'TRICEPS']
        },
        'Mardi + Vendredi': {
            categories: {
                DOS: [
                    { id: generateUUID(), name: 'R. Haltères Léger', series: [{ weight: '10', reps: '12' }], isDeleted: false, notes: '', createdAt: new Date().toISOString() }
                ],
                BICEPS: [
                    { id: generateUUID(), name: 'Curl Léger', series: [{ weight: '8', reps: '15' }], isDeleted: false, notes: '', createdAt: new Date().toISOString() }
                ]
            },
            categoryOrder: ['DOS', 'BICEPS']
        }
    },
    dayOrder: ['Lundi + Jeudi', 'Mardi + Vendredi']
};

// Composant principal amélioré
const ImprovedWorkoutApp = () => {
    // États de base optimisés
    const [isDarkMode, setIsDarkMode] = useLocalStorage('theme', true);
    const [isAdvancedMode, setIsAdvancedMode] = useLocalStorage('advanced-mode', false);
    const [currentView, setCurrentView] = useLocalStorage('current-view', 'workout');
    const [isCompactView, setIsCompactView] = useLocalStorage('compact-view', false);
    
    // États des données
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [workouts, setWorkouts] = useState({ days: {}, dayOrder: [] });
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    
    // États de l'interface
    const [toast, setToast] = useState(null);
    const [selectedDayFilter, setSelectedDayFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date');
    
    // États des modales
    const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    // États d'édition
    const [editingExercise, setEditingExercise] = useState(null);
    const [editingExerciseName, setEditingExerciseName] = useState('');
    const [newWeight, setNewWeight] = useState('');
    const [newSets, setNewSets] = useState('3');
    const [newReps, setNewReps] = useState('');
    const [selectedDayForAdd, setSelectedDayForAdd] = useState('');
    const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState('');
    const [newExerciseName, setNewExerciseName] = useState('');
    
    // États du minuteur
    const [timerSeconds, setTimerSeconds] = useState(90);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [restTimeInput, setRestTimeInput] = useState('90');
    
    // États pour l'analyse IA
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    
    // États pour l'historique Undo/Redo
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    
    // États de performance
    const [isSavingExercise, setIsSavingExercise] = useState(false);
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [isDeletingExercise, setIsDeletingExercise] = useState(false);
    const [lastSaveTime, setLastSaveTime] = useState(null);
    
    // Refs
    const timerRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const dropdownRef = useRef(null);
    
    // Hooks personnalisés
    const { showNotification, requestPermission } = useNotifications();
    const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY);
    
    // Couleurs des jours améliorées
    const getDayButtonColors = useCallback((index, isSelected) => {
        const colors = [
            { default: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700', selected: 'bg-gradient-to-r from-blue-700 to-blue-800 ring-2 ring-blue-400' },
            { default: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700', selected: 'bg-gradient-to-r from-green-700 to-green-800 ring-2 ring-green-400' },
            { default: 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700', selected: 'bg-gradient-to-r from-purple-700 to-purple-800 ring-2 ring-purple-400' },
            { default: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700', selected: 'bg-gradient-to-r from-red-700 to-red-800 ring-2 ring-red-400' },
            { default: 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700', selected: 'bg-gradient-to-r from-yellow-700 to-yellow-800 ring-2 ring-yellow-400' },
        ];
        const colorSet = colors[index % colors.length];
        return isSelected ? colorSet.selected : colorSet.default;
    }, []);
    
    // Effets d'initialisation optimisés
    useEffect(() => {
        const initAuth = async () => {
            try {
                await signInAnonymously(auth);
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        setUserId(user.uid);
                        setIsAuthReady(true);
                    } else {
                        setLoading(false);
                        setToast({ 
                            message: "Erreur d'authentification", 
                            type: 'error',
                            action: { label: 'Réessayer', onClick: () => window.location.reload() }
                        });
                    }
                });
            } catch (error) {
                console.error("Erreur d'authentification:", error);
                setLoading(false);
                setToast({ message: "Erreur de connexion", type: 'error' });
            }
        };
        initAuth();
    }, []);
    
    // Effet pour charger les données avec cache
    useEffect(() => {
        if (!userId || !isAuthReady) return;

        const workoutDocRef = doc(db, 'users', userId, 'workout', 'data');
        const unsubscribe = onSnapshot(workoutDocRef, (doc) => {
            try {
                if (doc.exists()) {
                    const data = doc.data();
                    const sanitizedWorkouts = sanitizeWorkoutData(data.workouts || baseInitialData);
                    setWorkouts(sanitizedWorkouts);
                } else {
                    console.log("Aucune donnée trouvée, initialisation avec données de base");
                    setWorkouts(baseInitialData);
                }
            } catch (error) {
                console.error("Erreur traitement données:", error);
                setToast({ message: "Erreur lors du chargement des données", type: 'error' });
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("Erreur Firestore:", error);
            setToast({ message: `Erreur Firestore: ${error.message}`, type: 'error' });
            setLoading(false);
        });

        loadHistoricalData();
        return () => unsubscribe();
    }, [userId, isAuthReady]);

    // Effet pour le minuteur avec optimisations
    useEffect(() => {
        if (timerIsRunning && timerSeconds > 0) {
            timerRef.current = setTimeout(() => {
                setTimerSeconds(prev => prev - 1);
            }, 1000);
        } else if (timerSeconds === 0 && timerIsRunning) {
            setTimerIsRunning(false);
            setTimerIsFinished(true);
            
            // Notifications améliorées
            showNotification('Temps de repos terminé !', {
                body: 'Il est temps de reprendre votre entraînement',
                tag: 'workout-timer'
            });
            
            // Vibration pour mobile
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            }
        }
        return () => clearTimeout(timerRef.current);
    }, [timerSeconds, timerIsRunning, showNotification]);

    // Effet pour sélection automatique du jour
    useEffect(() => {
        if (currentView === 'workout' && workouts.dayOrder?.length > 0) {
            if (!selectedDayFilter || !workouts.dayOrder.includes(selectedDayFilter)) {
                setSelectedDayFilter(workouts.dayOrder[0]);
            }
        }
    }, [currentView, workouts.dayOrder, selectedDayFilter]);

    // Fonctions utilitaires optimisées
    const sanitizeWorkoutData = useCallback((data) => {
        if (!data || typeof data !== 'object') return baseInitialData;
        
        const sanitizedDays = {};
        const dayOrder = Array.isArray(data.dayOrder) ? data.dayOrder : Object.keys(data.days || {});
        
        Object.entries(data.days || {}).forEach(([dayKey, dayData]) => {
            if (!dayData || typeof dayData !== 'object') return;
            
            const sanitizedCategories = {};
            const categoryOrder = Array.isArray(dayData.categoryOrder) 
                ? dayData.categoryOrder 
                : Object.keys(dayData.categories || {});
            
            Object.entries(dayData.categories || {}).forEach(([categoryKey, exercises]) => {
                if (!Array.isArray(exercises)) return;
                
                sanitizedCategories[categoryKey] = exercises.map(exercise => ({
                    id: exercise.id || generateUUID(),
                    name: exercise.name || 'Exercice sans nom',
                    series: Array.isArray(exercise.series) 
                        ? exercise.series.map(s => ({
                            weight: String(s.weight || ''),
                            reps: String(s.reps || '')
                        }))
                        : [{ weight: '', reps: '' }],
                    isDeleted: Boolean(exercise.isDeleted),
                    notes: String(exercise.notes || ''),
                    createdAt: exercise.createdAt || new Date().toISOString()
                }));
            });
            
            sanitizedDays[dayKey] = {
                categories: sanitizedCategories,
                categoryOrder
            };
        });
        
        return { days: sanitizedDays, dayOrder };
    }, []);

    const loadHistoricalData = useCallback(async () => {
        if (!userId) return;
        
        try {
            const sessionsRef = collection(db, 'users', userId, 'sessions');
            const q = query(sessionsRef, orderBy('timestamp', 'desc'), limit(100));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => {
                    const docData = doc.data();
                    let timestamp;
                    
                    if (docData.timestamp instanceof Timestamp) {
                        timestamp = docData.timestamp.toDate();
                    } else if (docData.timestamp) {
                        timestamp = new Date(docData.timestamp);
                    } else {
                        timestamp = new Date();
                    }
                    
                    return {
                        id: doc.id,
                        timestamp,
                        workoutData: docData.workoutData
                    };
                }).filter(item => item.timestamp);
                
                setHistoricalData(data);
                calculatePersonalBests(data);
            });
            
            return unsubscribe;
        } catch (error) {
            console.error("Erreur chargement historique:", error);
            setToast({ message: "Erreur lors du chargement de l'historique", type: 'error' });
        }
    }, [userId]);

    const calculatePersonalBests = useCallback((data) => {
        const bests = {};
        
        data.forEach(session => {
            const workoutData = session.workoutData;
            if (!workoutData?.days) return;
            
            Object.values(workoutData.days).forEach(day => {
                if (!day.categories) return;
                
                Object.values(day.categories).forEach(exercises => {
                    if (!Array.isArray(exercises)) return;
                    
                    exercises.forEach(exercise => {
                        if (!exercise.series || exercise.isDeleted) return;
                        
                        exercise.series.forEach(serie => {
                            const weight = parseFloat(serie.weight) || 0;
                            const reps = parseInt(serie.reps) || 0;
                            const volume = weight * reps;
                            
                            if (weight === 0 && reps === 0) return;
                            
                            if (!bests[exercise.id]) {
                                bests[exercise.id] = {
                                    name: exercise.name,
                                    maxWeight: weight,
                                    maxReps: reps,
                                    maxVolume: volume,
                                    totalVolume: volume,
                                    sessions: 1,
                                    lastPerformed: session.timestamp
                                };
                            } else {
                                const best = bests[exercise.id];
                                best.maxWeight = Math.max(best.maxWeight, weight);
                                best.maxReps = Math.max(best.maxReps, reps);
                                best.maxVolume = Math.max(best.maxVolume, volume);
                                best.totalVolume += volume;
                                best.sessions++;
                                if (session.timestamp > best.lastPerformed) {
                                    best.lastPerformed = session.timestamp;
                                }
                            }
                        });
                    });
                });
            });
        });
        
        setPersonalBests(bests);
    }, []);

    const saveWorkoutsOptimized = useCallback(async (workoutsData, successMessage = "Sauvegardé !") => {
        if (!userId) {
            setToast({ message: "Utilisateur non connecté", type: 'error' });
            return;
        }
        
        // Annuler la sauvegarde précédente si en cours
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Sauvegarder après un délai pour éviter les sauvegardes multiples
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const workoutDocRef = doc(db, 'users', userId, 'workout', 'data');
                await setDoc(workoutDocRef, { 
                    workouts: workoutsData,
                    lastModified: serverTimestamp()
                }, { merge: true });
                
                const sessionsRef = collection(db, 'users', userId, 'sessions');
                await addDoc(sessionsRef, {
                    timestamp: serverTimestamp(),
                    workoutData: workoutsData,
                    version: '2.0'
                });
                
                setLastSaveTime(new Date());
                setToast({ message: successMessage, type: 'success' });
            } catch (error) {
                console.error("Erreur sauvegarde:", error);
                setToast({ 
                    message: "Erreur de sauvegarde", 
                    type: 'error',
                    action: { 
                        label: 'Réessayer', 
                        onClick: () => saveWorkoutsOptimized(workoutsData, successMessage) 
                    }
                });
            }
        }, AUTO_SAVE_DELAY);
    }, [userId]);

    const applyChanges = useCallback((newWorkoutsState, message = "Modification effectuée") => {
        setUndoStack(prev => {
            const newStack = [...prev, workouts];
            return newStack.length > MAX_UNDO_STATES 
                ? newStack.slice(-MAX_UNDO_STATES) 
                : newStack;
        });
        setRedoStack([]);
        setWorkouts(newWorkoutsState);
        saveWorkoutsOptimized(newWorkoutsState, message);
    }, [workouts, saveWorkoutsOptimized]);

    // Fonctions d'exercices optimisées
    const handleAddExercise = useCallback(() => {
        if (!newExerciseName.trim()) {
            setToast({ message: "Le nom de l'exercice est requis", type: 'error' });
            return;
        }
        
        if (!selectedDayForAdd || !selectedCategoryForAdd) {
            setToast({ message: "Sélectionnez un jour et une catégorie", type: 'error' });
            return;
        }
        
        setIsAddingExercise(true);
        
        const setsNum = parseInt(newSets) || 1;
        const updatedWorkouts = { ...workouts };
        
        // S'assurer que la structure existe
        if (!updatedWorkouts.days[selectedDayForAdd]) {
            updatedWorkouts.days[selectedDayForAdd] = { categories: {}, categoryOrder: [] };
        }
        if (!updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd]) {
            updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd] = [];
        }
        
        const newExercise = {
            id: generateUUID(),
            name: newExerciseName.trim(),
            series: Array(setsNum).fill(null).map(() => ({
                weight: newWeight.toString(),
                reps: newReps.toString()
            })),
            isDeleted: false,
            notes: '',
            createdAt: new Date().toISOString()
        };
        
        updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd].push(newExercise);
        
        applyChanges(updatedWorkouts, `Exercice "${newExerciseName}" ajouté !`);
        
        // Réinitialiser le formulaire
        setNewExerciseName('');
        setNewWeight('');
        setNewSets('3');
        setNewReps('');
        setShowAddExerciseModal(false);
        setIsAddingExercise(false);
    }, [newExerciseName, selectedDayForAdd, selectedCategoryForAdd, newSets, newWeight, newReps, workouts, applyChanges]);

    const handleEditClick = useCallback((day, category, exerciseId, exercise) => {
        setEditingExercise({ day, category, exerciseId });
        setEditingExerciseName(exercise.name);
        
        if (exercise.series && exercise.series.length > 0) {
            setNewWeight(exercise.series[0].weight);
            setNewSets(exercise.series.length.toString());
            setNewReps(exercise.series[0].reps);
        } else {
            setNewWeight('');
            setNewSets('1');
            setNewReps('');
        }
    }, []);

    const handleSaveEdit = useCallback(() => {
        if (!editingExercise) return;
        
        setIsSavingExercise(true);
        
        const { day, category, exerciseId } = editingExercise;
        const updatedWorkouts = { ...workouts };
        const exercises = updatedWorkouts.days?.[day]?.categories?.[category];
        
        if (!exercises) {
            setToast({ message: "Exercice non trouvé", type: 'error' });
            setIsSavingExercise(false);
            return;
        }
        
        const exerciseIndex = exercises.findIndex(ex => ex.id === exerciseId);
        if (exerciseIndex === -1) {
            setToast({ message: "Exercice non trouvé", type: 'error' });
            setIsSavingExercise(false);
            return;
        }
        
        // Validation
        if (!editingExerciseName.trim()) {
            setToast({ message: "Le nom de l'exercice ne peut pas être vide", type: 'error' });
            setIsSavingExercise(false);
            return;
        }
        
        const weightNum = parseFloat(newWeight);
        const setsNum = parseInt(newSets);
        const repsNum = parseInt(newReps);
        
        if (newWeight !== '' && isNaN(weightNum)) {
            setToast({ message: "Le poids doit être un nombre", type: 'error' });
            setIsSavingExercise(false);
            return;
        }
        
        if (newSets !== '' && (isNaN(setsNum) || setsNum <= 0)) {
            setToast({ message: "Les séries doivent être un nombre positif", type: 'error' });
            setIsSavingExercise(false);
            return;
        }
        
        if (newReps !== '' && (isNaN(repsNum) || repsNum < 0)) {
            setToast({ message: "Les répétitions doivent être un nombre positif ou nul", type: 'error' });
            setIsSavingExercise(false);
            return;
        }
        
        // Créer les nouvelles séries
        const newSeriesArray = Array(setsNum || 1).fill(null).map(() => ({
            weight: newWeight,
            reps: newReps
        }));
        
        exercises[exerciseIndex] = {
            ...exercises[exerciseIndex],
            name: editingExerciseName.trim(),
            series: newSeriesArray,
            lastModified: new Date().toISOString()
        };
        
        applyChanges(updatedWorkouts, "Exercice modifié !");
        setEditingExercise(null);
        setEditingExerciseName('');
        setIsSavingExercise(false);
    }, [editingExercise, workouts, editingExerciseName, newWeight, newSets, newReps, applyChanges]);

    const handleDeleteExercise = useCallback((day, category, exerciseId) => {
        setIsDeletingExercise(true);
        
        const updatedWorkouts = { ...workouts };
       const exercises = updatedWorkouts.days?.[day]?.categories?.[category];
       
       if (!exercises) {
           setToast({ message: "Exercice non trouvé", type: 'error' });
           setIsDeletingExercise(false);
           return;
       }
       
       const exerciseIndex = exercises.findIndex(ex => ex.id === exerciseId);
       if (exerciseIndex === -1) {
           setToast({ message: "Exercice non trouvé", type: 'error' });
           setIsDeletingExercise(false);
           return;
       }
       
       exercises[exerciseIndex].isDeleted = true;
       exercises[exerciseIndex].deletedAt = new Date().toISOString();
       
       applyChanges(updatedWorkouts, "Exercice supprimé");
       setShowDeleteConfirm(false);
       setIsDeletingExercise(false);
   }, [workouts, applyChanges]);

   const handleReactivateExercise = useCallback((exerciseId) => {
       const updatedWorkouts = { ...workouts };
       let found = false;
       
       // Rechercher l'exercice dans toutes les catégories et jours
       Object.values(updatedWorkouts.days).forEach(day => {
           Object.values(day.categories).forEach(exercises => {
               if (Array.isArray(exercises)) {
                   const exerciseIndex = exercises.findIndex(ex => ex.id === exerciseId);
                   if (exerciseIndex !== -1) {
                       exercises[exerciseIndex].isDeleted = false;
                       delete exercises[exerciseIndex].deletedAt;
                       found = true;
                   }
               }
           });
       });
       
       if (found) {
           applyChanges(updatedWorkouts, "Exercice réactivé !");
       } else {
           setToast({ message: "Exercice non trouvé", type: 'error' });
       }
   }, [workouts, applyChanges]);

   // Fonctions de minuteur optimisées
   const startTimer = useCallback(() => {
       setTimerIsRunning(true);
       setTimerIsFinished(false);
   }, []);

   const pauseTimer = useCallback(() => {
       setTimerIsRunning(false);
   }, []);

   const resetTimer = useCallback(() => {
       const seconds = parseInt(restTimeInput) || 90;
       setTimerSeconds(seconds);
       setTimerIsRunning(false);
       setTimerIsFinished(false);
   }, [restTimeInput]);

   const setTimerPreset = useCallback((seconds) => {
       setRestTimeInput(seconds.toString());
       setTimerSeconds(seconds);
       setTimerIsRunning(false);
       setTimerIsFinished(false);
   }, []);

   // Analyse IA améliorée
   const analyzeProgressionWithAI = useCallback(async (exerciseData) => {
       if (!exerciseData) return;
       
       setAiAnalysisLoading(true);
       
       try {
           const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
           
           const recentSeries = exerciseData.series?.slice(-20) || [];
           const prompt = `Analyse cette progression d'exercice de musculation et donne des conseils personnalisés en français:
               
               Nom de l'exercice: ${exerciseData.name}
               Historique récent (20 dernières séries): ${JSON.stringify(recentSeries)}
               Record personnel (poids): ${personalBests[exerciseData.id]?.maxWeight || 'N/A'}kg
               Record personnel (reps): ${personalBests[exerciseData.id]?.maxReps || 'N/A'}
               Volume total: ${personalBests[exerciseData.id]?.totalVolume || 'N/A'}kg
               Nombre de sessions: ${personalBests[exerciseData.id]?.sessions || 'N/A'}
               
               Fournis une analyse concise et pratique avec:
               1. 📈 Tendance de progression (positive/stagnation/régression)
               2. 💪 Points forts identifiés
               3. 🎯 Axes d'amélioration spécifiques
               4. 📋 Recommandations concrètes (charge, répétitions, fréquence)
               5. 🏆 Objectifs à court terme (2-4 semaines)
               
               Limite la réponse à 300 mots maximum. Utilise des émojis pour structurer.`;
           
           const result = await model.generateContent(prompt);
           const analysis = result.response.text();
           
           setProgressionAnalysisContent(analysis);
           setToast({ message: "Analyse IA terminée !", type: 'success' });
       } catch (error) {
           console.error("Erreur analyse IA:", error);
           setProgressionAnalysisContent("❌ Erreur lors de l'analyse. Veuillez vérifier votre clé API Gemini et réessayer.");
           setToast({ message: "Erreur lors de l'analyse IA", type: 'error' });
       } finally {
           setAiAnalysisLoading(false);
       }
   }, [personalBests]);

   // Fonctions d'export/import optimisées
   const exportData = useCallback(() => {
       try {
           const dataToExport = {
               workouts,
               personalBests,
               historicalSample: historicalData.slice(0, 10), // Échantillon pour réduire la taille
               exportDate: new Date().toISOString(),
               version: "2.0",
               appName: "Carnet Muscu Pro"
           };
           
           const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
               type: 'application/json'
           });
           
           const url = URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = `carnet-muscu-${new Date().toISOString().split('T')[0]}.json`;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           URL.revokeObjectURL(url);
           
           setToast({ message: "Données exportées avec succès !", type: 'success' });
       } catch (error) {
           console.error("Erreur export:", error);
           setToast({ message: "Erreur lors de l'export", type: 'error' });
       }
   }, [workouts, personalBests, historicalData]);

   const importData = useCallback((event) => {
       const file = event.target.files[0];
       if (!file) return;
       
       const reader = new FileReader();
       reader.onload = (e) => {
           try {
               const importedData = JSON.parse(e.target.result);
               
               if (importedData.workouts) {
                   const sanitizedWorkouts = sanitizeWorkoutData(importedData.workouts);
                   setWorkouts(sanitizedWorkouts);
                   saveWorkoutsOptimized(sanitizedWorkouts, "Données importées avec succès !");
                   
                   setToast({ 
                       message: "Import réussi !", 
                       type: 'success'
                   });
               } else {
                   setToast({ message: "Format de fichier invalide", type: 'error' });
               }
           } catch (error) {
               console.error("Erreur import:", error);
               setToast({ message: "Erreur lors de l'import", type: 'error' });
           }
       };
       reader.readAsText(file);
       
       // Reset input
       event.target.value = '';
   }, [sanitizeWorkoutData, saveWorkoutsOptimized]);

   // Fonctions d'undo/redo corrigées
   const handleUndo = useCallback(() => {
       setUndoStack(prevUndoStack => {
           if (prevUndoStack.length === 0) {
               setToast({ message: "Rien à annuler", type: 'warning' });
               return prevUndoStack;
           }
           
           const previousState = prevUndoStack[prevUndoStack.length - 1];
           
           // Sauvegarder l'état actuel dans redo avant de changer
           setRedoStack(prevRedoStack => [...prevRedoStack, workouts]);
           setWorkouts(previousState);
           setToast({ message: "Action annulée", type: 'success' });
           
           return prevUndoStack.slice(0, -1);
       });
   }, [workouts]);

   const handleRedo = useCallback(() => {
       setRedoStack(prevRedoStack => {
           if (prevRedoStack.length === 0) {
               setToast({ message: "Rien à rétablir", type: 'warning' });
               return prevRedoStack;
           }
           
           const nextState = prevRedoStack[prevRedoStack.length - 1];
           
           // Sauvegarder l'état actuel dans undo avant de changer
           setUndoStack(prevUndoStack => [...prevUndoStack, workouts]);
           setWorkouts(nextState);
           setToast({ message: "Action rétablie", type: 'success' });
           
           return prevRedoStack.slice(0, -1);
       });
   }, [workouts]);

   // Calculs mémorisés pour les statistiques
   // Calculs mémorisés pour les statistiques - VERSION SIMPLIFIÉE SANS useMemo
const getWorkoutStats = useCallback(() => {
    if (!workouts?.days || !historicalData) {
        return {
            totalExercises: 0,
            totalSessions: 0,
            thisWeekSessions: 0,
            totalVolume: 0,
            averageSessionsPerWeek: 0
        };
    }

    let totalExercises = 0;
    try {
        Object.values(workouts.days).forEach(day => {
            Object.values(day.categories || {}).forEach(exercises => {
                if (Array.isArray(exercises)) {
                    totalExercises += exercises.filter(ex => !ex.isDeleted).length;
                }
            });
        });
    } catch (error) {
        console.warn("Erreur calcul exercices:", error);
        totalExercises = 0;
    }

    const totalSessions = historicalData.length || 0;
    
    let thisWeekSessions = 0;
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        thisWeekSessions = historicalData.filter(session => {
            return session.timestamp && session.timestamp > weekAgo;
        }).length;
    } catch (error) {
        console.warn("Erreur calcul sessions semaine:", error);
        thisWeekSessions = 0;
    }

    let totalVolume = 0;
    try {
        Object.values(personalBests || {}).forEach(best => {
            totalVolume += (best.totalVolume || 0);
        });
    } catch (error) {
        console.warn("Erreur calcul volume:", error);
        totalVolume = 0;
    }

    const averageSessionsPerWeek = totalSessions > 0 ? Math.round((totalSessions / 12) * 10) / 10 : 0;

    return {
        totalExercises,
        totalSessions,
        thisWeekSessions,
        totalVolume: Math.round(totalVolume),
        averageSessionsPerWeek
    };
}, []); // Aucune dépendance !

// Calculer les stats à chaque rendu (sans useMemo)
const workoutStats = getWorkoutStats();

   // Gestion des raccourcis clavier
   useEffect(() => {
       const handleKeyPress = (e) => {
           if (e.ctrlKey || e.metaKey) {
               switch (e.key) {
                   case 'z':
                       e.preventDefault();
                       if (e.shiftKey) {
                           handleRedo();
                       } else {
                           handleUndo();
                       }
                       break;
                   case 's':
                       e.preventDefault();
                       if (Object.keys(workouts.days).length > 0) {
                           saveWorkoutsOptimized(workouts, "Sauvegarde manuelle effectuée");
                       }
                       break;
                   case 'e':
                       e.preventDefault();
                       exportData();
                       break;
               }
           }
           
           // Raccourcis sans modificateur
           switch (e.key) {
               case 'Escape':
                   setEditingExercise(null);
                   setShowAddExerciseModal(false);
                   setShowDeleteConfirm(false);
                   setShowStatsModal(false);
                   setShowExportModal(false);
                   setShowSettingsModal(false);
                   break;
               case ' ':
                   if (currentView === 'timer' && !e.target.tagName.match(/INPUT|TEXTAREA|SELECT/)) {
                       e.preventDefault();
                       if (timerIsRunning) {
                           pauseTimer();
                       } else {
                           startTimer();
                       }
                   }
                   break;
           }
       };

       document.addEventListener('keydown', handleKeyPress);
       return () => document.removeEventListener('keydown', handleKeyPress);
   }, [handleUndo, handleRedo, workouts, saveWorkoutsOptimized, exportData, currentView, timerIsRunning, startTimer, pauseTimer]);

   // Demande de permission pour les notifications au démarrage
   useEffect(() => {
       if ('Notification' in window && Notification.permission === 'default') {
           requestPermission();
       }
   }, [requestPermission]);

   // Styles CSS améliorés
   const appStyles = `
       .animate-fade-in-up {
           animation: fadeInUp 0.5s ease-out forwards;
       }

       @keyframes fadeInUp {
           from {
               opacity: 0;
               transform: translateY(20px) translateX(-50%);
           }
           to {
               opacity: 1;
               transform: translateY(0) translateX(-50%);
           }
       }

       .saved-animation {
           animation: saved-flash 0.7s ease-out;
       }

       @keyframes saved-flash {
           0% { background-color: rgb(31 41 55); }
           25% { background-color: rgb(59 130 246); }
           100% { background-color: rgb(31 41 55); }
       }

       .button-saving, .button-deleting, .button-adding {
           opacity: 0.7;
           cursor: wait;
           pointer-events: none;
       }

       .glass-effect {
           backdrop-filter: blur(10px);
           background: rgba(31, 41, 55, 0.8);
       }

       .scrollbar-thin {
           scrollbar-width: thin;
           scrollbar-color: rgb(75 85 99) rgb(31 41 55);
       }

       .scrollbar-thin::-webkit-scrollbar {
           width: 6px;
       }

       .scrollbar-thin::-webkit-scrollbar-track {
           background: rgb(31 41 55);
       }

       .scrollbar-thin::-webkit-scrollbar-thumb {
           background: rgb(75 85 99);
           border-radius: 3px;
       }

       .scrollbar-thin::-webkit-scrollbar-thumb:hover {
           background: rgb(107 114 128);
       }

       @media (max-width: 640px) {
           .mobile-optimized {
               font-size: 14px;
           }
       }
   `;

   // Rendu conditionnel de chargement amélioré
   if (loading || !isAuthReady) {
       return (
           <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
               <div className="text-center max-w-md mx-auto p-8">
                   <div className="relative">
                       <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-blue-500 mx-auto mb-6"></div>
                       <Dumbbell className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-400" />
                   </div>
                   <h2 className="text-2xl font-bold mb-2">Carnet Muscu Pro</h2>
                   <p className="text-lg font-medium mb-2">Chargement de vos données...</p>
                   <p className="text-sm text-gray-400">Synchronisation en cours</p>
                   <div className="mt-6 w-full bg-gray-700 rounded-full h-2">
                       <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: '70%'}}></div>
                   </div>
               </div>
           </div>
       );
   }

   // Rendu principal amélioré
   return (
       <div className={`min-h-screen transition-all duration-300 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white' : 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900'}`}>
           <style>{appStyles}</style>
           
           {/* Toast notifications */}
           {toast && (
               <Toast
                   message={toast.message}
                   type={toast.type}
                   onClose={() => setToast(null)}
                   action={toast.action}
               />
           )}

           {/* Header amélioré avec navigation fixe */}
           <header className="sticky top-0 z-40 glass-effect border-b border-gray-700/50 px-4 py-3">
               <div className="flex items-center justify-between max-w-7xl mx-auto">
                   <div className="flex items-center gap-3">
                       <div className="relative">
                           <Dumbbell className="h-8 w-8 text-blue-400" />
                           {isSavingExercise && (
                               <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                           )}
                       </div>
                       <div>
                           <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                               Carnet Muscu Pro
                           </h1>
                           {lastSaveTime && (
                               <p className="text-xs text-gray-400">
                                   Dernière sync: {formatTime(Math.floor((Date.now() - lastSaveTime.getTime()) / 1000))}
                               </p>
                           )}
                       </div>
                       <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
                           v2.0
                       </span>
                   </div>

                   <div className="flex items-center gap-2">
                       {/* Mode avancé */}
                       <button
                           onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                           className={`p-2 rounded-lg transition-all ${isAdvancedMode ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                           title="Mode avancé (plus de fonctionnalités)"
                       >
                           <Settings className="h-5 w-5" />
                       </button>

                       {/* Vue compacte */}
                       <button
                           onClick={() => setIsCompactView(!isCompactView)}
                           className={`p-2 rounded-lg transition-all ${isCompactView ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                           title="Vue compacte"
                       >
                           {isCompactView ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                       </button>

                       {/* Undo/Redo avec compteurs */}
                       <div className="flex gap-1">
                           <button
                               onClick={handleUndo}
                               disabled={undoStack.length === 0}
                               className="relative p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                               title={`Annuler (${undoStack.length} actions disponibles)`}
                           >
                               <Undo2 className="h-5 w-5" />
                               {undoStack.length > 0 && (
                                   <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                       {Math.min(undoStack.length, 9)}
                                   </span>
                               )}
                           </button>
                           <button
                               onClick={handleRedo}
                               disabled={redoStack.length === 0}
                               className="relative p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                               title={`Rétablir (${redoStack.length} actions disponibles)`}
                           >
                               <Redo2 className="h-5 w-5" />
                               {redoStack.length > 0 && (
                                   <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                       {Math.min(redoStack.length, 9)}
                                   </span>
                               )}
                           </button>
                       </div>

                       {/* Menu actions */}
                       <button
                           onClick={() => setShowSettingsModal(true)}
                           className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                           title="Paramètres et export/import"
                       >
                           <Download className="h-5 w-5" />
                       </button>
                   </div>
               </div>
           </header>

           {/* Contenu principal */}
           <main className="p-4 pb-20 max-w-7xl mx-auto">
               {/* Statistiques rapides en mode avancé */}
               {isAdvancedMode && (
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                       <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-800/70 transition-all">
                           <div className="flex items-center justify-between mb-2">
                               <div className="p-2 rounded-lg bg-blue-500/20">
                                   <Activity className="h-5 w-5 text-blue-400" />
                               </div>
                           </div>
                           <div className="text-2xl font-bold text-white mb-1">{workoutStats.totalExercises}</div>
                           <div className="text-xs text-gray-400">Exercices actifs</div>
                       </div>

                       <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-800/70 transition-all">
                           <div className="flex items-center justify-between mb-2">
                               <div className="p-2 rounded-lg bg-green-500/20">
                                   <Calendar className="h-5 w-5 text-green-400" />
                               </div>
                           </div>
                           <div className="text-2xl font-bold text-white mb-1">{workoutStats.totalSessions}</div>
                           <div className="text-xs text-gray-400">Sessions totales</div>
                       </div>

                       <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-800/70 transition-all">
                           <div className="flex items-center justify-between mb-2">
                               <div className="p-2 rounded-lg bg-purple-500/20">
                                   <Zap className="h-5 w-5 text-purple-400" />
                               </div>
                           </div>
                           <div className="text-2xl font-bold text-white mb-1">{workoutStats.thisWeekSessions}</div>
                           <div className="text-xs text-gray-400">Cette semaine</div>
                       </div>

                       <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-800/70 transition-all">
                           <div className="flex items-center justify-between mb-2">
                               <div className="p-2 rounded-lg bg-yellow-500/20">
                                   <Target className="h-5 w-5 text-yellow-400" />
                               </div>
                           </div>
                           <div className="text-2xl font-bold text-white mb-1">{workoutStats.totalVolume}</div>
                           <div className="text-xs text-gray-400">Volume total (kg)</div>
                       </div>
                   </div>
               )}

               {/* Contenu des vues */}
               {currentView === 'workout' && (
                   <MainWorkoutView
                       workouts={workouts}
                       selectedDayFilter={selectedDayFilter}
                       setSelectedDayFilter={setSelectedDayFilter}
                       isAdvancedMode={isAdvancedMode}
                       isCompactView={isCompactView}
                       handleEditClick={handleEditClick}
                       handleAddExerciseClick={(day, category) => {
                           setSelectedDayForAdd(day);
                           setSelectedCategoryForAdd(category);
                           setShowAddExerciseModal(true);
                       }}
                       handleDeleteExercise={handleDeleteExercise}
                       analyzeProgressionWithAI={analyzeProgressionWithAI}
                       personalBests={personalBests}
                       getDayButtonColors={getDayButtonColors}
                       formatDate={formatDate}
                       getSeriesDisplay={getSeriesDisplay}
                       isSavingExercise={isSavingExercise}
                       isDeletingExercise={isDeletingExercise}
                       isAddingExercise={isAddingExercise}
                       searchTerm={debouncedSearchTerm}
                       setSearchTerm={setSearchTerm}
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
                       isAdvancedMode={isAdvancedMode}
                   />
               )}

               {currentView === 'history' && (
                   <HistoryView
                       historicalData={historicalData}
                       personalBests={personalBests}
                       handleReactivateExercise={handleReactivateExercise}
                       analyzeProgressionWithAI={analyzeProgressionWithAI}
                       formatDate={formatDate}
                       getSeriesDisplay={getSeriesDisplay}
                       isAdvancedMode={isAdvancedMode}
                       searchTerm={debouncedSearchTerm}
                       setSearchTerm={setSearchTerm}
                       sortBy={sortBy}
                       setSortBy={setSortBy}
                   />
               )}
           </main>

           {/* Navigation inférieure mobile */}
           <BottomNavigationBar 
               currentView={currentView} 
               setCurrentView={setCurrentView} 
           />

           {/* Modales */}
           {/* Modale d'ajout d'exercice améliorée */}
           {showAddExerciseModal && (
               <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                   <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto scrollbar-thin">
                       <div className="p-6">
                           <div className="flex items-center justify-between mb-6">
                               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                   <Plus className="h-5 w-5 text-blue-400" />
                                   Nouvel Exercice
                               </h3>
                               <button
                                   onClick={() => setShowAddExerciseModal(false)}
                                   className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                               >
                                   <XCircle className="h-5 w-5" />
                               </button>
                           </div>

                           <div className="space-y-4">
                               <div>
                                   <label className="block text-sm font-medium text-gray-300 mb-2">
                                       Nom de l'exercice *
                                   </label>
                                   <input
                                       type="text"
                                       value={newExerciseName}
                                       onChange={(e) => setNewExerciseName(e.target.value)}
                                       className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="Ex: Développé couché"
                                       autoFocus
                                   />
                               </div>

                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       <label className="block text-sm font-medium text-gray-300 mb-2">
                                           Poids (kg)
                                       </label>
                                       <input
                                           type="number"
                                           value={newWeight}
                                           onChange={(e) => setNewWeight(e.target.value)}
                                           className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="10"
                                           step="0.5"
                                           min="0"
                                       />
                                   </div>
                                   <div>
                                       <label className="block text-sm font-medium text-gray-300 mb-2">
                                           Répétitions
                                       </label>
                                       <input
                                           type="number"
                                           value={newReps}
                                           onChange={(e) => setNewReps(e.target.value)}
                                           className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="12"
                                           min="0"
                                       />
                                   </div>
                               </div>

                               <div>
                                   <label className="block text-sm font-medium text-gray-300 mb-2">
                                       Nombre de séries
                                   </label>
                                   <input
                                       type="number"
                                       value={newSets}
                                       onChange={(e) => setNewSets(e.target.value)}
                                       className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="3"
                                       min="1"
                                       max="10"
                                   />
                               </div>

                               <div className="text-sm text-gray-400 bg-gray-700/50 p-3 rounded-lg">
                                   <p className="font-medium mb-1">Aperçu:</p>
                                   <p>{newSets || '3'} série(s) de {newWeight || '?'}kg × {newReps || '?'} reps</p>
                               </div>
                           </div>

                           <div className="flex gap-3 mt-6">
                               <button
                                   onClick={() => setShowAddExerciseModal(false)}
                                   className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                               >
                                   Annuler
                               </button>
                               <button
                                   onClick={handleAddExercise}
                                   disabled={!newExerciseName.trim() || isAddingExercise}
                                   className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                                       isAddingExercise
                                           ? 'bg-blue-500/50 text-white cursor-wait'
                                           : 'bg-blue-500 text-white hover:bg-blue-600'
                                   } disabled:opacity-50 disabled:cursor-not-allowed`}
                               >
                                   {isAddingExercise ? (
                                       <div className="flex items-center justify-center gap-2">
                                           <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                           Ajout...
                                       </div>
                                   ) : (
                                       'Ajouter'
                                   )}
                               </button>
                           </div>
                       </div>
                   </div>
               </div>
           )}

           {/* Modale d'édition d'exercice améliorée */}
           {editingExercise && (
               <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                   <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto scrollbar-thin">
                       <div className="p-6">
                           <div className="flex items-center justify-between mb-6">
                               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                   <Pencil className="h-5 w-5 text-yellow-400" />
                                   Modifier l'exercice
                               </h3>
                               <button
                                   onClick={() => setEditingExercise(null)}
                                   className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                               >
                                   <XCircle className="h-5 w-5" />
                               </button>
                           </div>

                           <div className="space-y-4">
                               <div>
                                   <label className="block text-sm font-medium text-gray-300 mb-2">
                                       Nom de l'exercice *
                                   </label>
                                   <input
                                       type="text"
                                       value={editingExerciseName}
                                       onChange={(e) => setEditingExerciseName(e.target.value)}
                                       className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="Nom de l'exercice"
                                   />
                               </div>

                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       <label className="block text-sm font-medium text-gray-300 mb-2">
                                           Poids (kg)
                                       </label>
                                       <input
                                           type="number"
                                           value={newWeight}
                                           onChange={(e) => setNewWeight(e.target.value)}
                                           className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="10"
                                           step="0.5"
                                           min="0"
                                       />
                                   </div>
                                   <div>
                                       <label className="block text-sm font-medium text-gray-300 mb-2">
                                           Répétitions
                                       </label>
                                       <input
                                           type="number"
                                           value={newReps}
                                           onChange={(e) => setNewReps(e.target.value)}
                                           className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           placeholder="12"
                                           min="0"
                                       />
                                   </div>
                               </div>

                               <div>
                                   <label className="block text-sm font-medium text-gray-300 mb-2">
                                       Nombre de séries
                                   </label>
                                   <input
                                       type="number"
                                       value={newSets}
                                       onChange={(e) => setNewSets(e.target.value)}
                                       className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       placeholder="3"
                                       min="1"
                                       max="10"
                                   />
                               </div>

                               {personalBests[editingExercise.exerciseId] && (
                                   <div className="text-sm text-gray-400 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                                       <p className="font-medium mb-1 text-blue-400">🏆 Record personnel:</p>
                                       <p>Poids max: {personalBests[editingExercise.exerciseId].maxWeight}kg</p>
                                       <p>Reps max: {personalBests[editingExercise.exerciseId].maxReps}</p>
                                       <p>Volume total: {Math.round(personalBests[editingExercise.exerciseId].totalVolume)}kg</p>
                                   </div>
                               )}
                           </div>

                           <div className="flex gap-3 mt-6">
                               <button
                                   onClick={() => setEditingExercise(null)}
                                   className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                               >
                                   Annuler
                               </button>
                               <button
                                   onClick={handleSaveEdit}
                                   disabled={!editingExerciseName.trim() || isSavingExercise}
                                   className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                                       isSavingExercise
                                           ? 'bg-green-500/50 text-white cursor-wait'
                                           : 'bg-green-500 text-white hover:bg-green-600'
                                   } disabled:opacity-50 disabled:cursor-not-allowed`}
                               >
                                   {isSavingExercise ? (
                                       <div className="flex items-center justify-center gap-2">
                                           <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                           Sauvegarde...
                                       </div>
                                   ) : (
                                       'Sauvegarder'
                                   )}
                               </button>
                           </div>
                       </div>
                   </div>
               </div>
           )}

           {/* Modale de paramètres et export/import */}
           {showSettingsModal && (
               <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                   <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto scrollbar-thin">
                       <div className="p-6">
                           <div className="flex items-center justify-between mb-6">
                               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                   <Settings className="h-5 w-5 text-blue-400" />
                                   Paramètres
                               </h3>
                               <button
                                   onClick={() => setShowSettingsModal(false)}
                                   className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                               >
                                   <XCircle className="h-5 w-5" />
                               </button>
                           </div>

                           <div className="space-y-6">
                               {/* Thème */}
                               <div>
                                   <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                       {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                                       Apparence
                                   </h4>
                                   <button
                                       onClick={() => setIsDarkMode(!isDarkMode)}
                                       className={`w-full p-3 rounded-lg border transition-all ${
                                           isDarkMode 
                                               ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' 
                                               : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-900'
                                       }`}
                                   >
                                       Basculer vers le thème {isDarkMode ? 'clair' : 'sombre'}
                                   </button>
                               </div>

                               {/* Export/Import */}
                               <div>
                                   <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                       <Share className="h-5 w-5" />
                                       Données
                                   </h4>
                                   <div className="space-y-3">
                                       <button
                                           onClick={exportData}
                                           className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                                       >
                                           <Download className="h-4 w-4" />
                                           Exporter mes données
                                       </button>
                                       
                                       <label className="w-full p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2 cursor-pointer">
                                           <Upload className="h-4 w-4" />
                                           Importer des données
                                           <input
                                               type="file"
                                               accept=".json"
                                               onChange={importData}
                                               className="hidden"
                                           />
                                       </label>
                                   </div>
                               </div>

                               {/* Raccourcis clavier */}
                               <div>
                                   <h4 className="text-lg font-semibold text-white mb-3">
                                       ⌨️ Raccourcis clavier
                                   </h4>
                                   <div className="text-sm text-gray-400 space-y-2">
                                       <div className="flex justify-between">
                                           <span>Annuler:</span>
                                           <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+Z</kbd>
                                       </div>
                                       <div className="flex justify-between">
                                           <span>Rétablir:</span>
                                           <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+Shift+Z</kbd>
                                       </div>
                                       <div className="flex justify-between">
                                           <span>Sauvegarder:</span>
                                           <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+S</kbd>
                                       </div>
                                       <div className="flex justify-between">
                                           <span>Exporter:</span>
                                           <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Ctrl+E</kbd>
                                       </div>
                                       <div className="flex justify-between">
                                           <span>Fermer modales:</span>
                                           <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Échap</kbd>
                                       </div>
                                       <div className="flex justify-between">
                                           <span>Play/Pause minuteur:</span>
                                           <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Espace</kbd>
                                       </div>
                                   </div>
                               </div>

                               {/* Informations */}
                               <div>
                                   <h4 className="text-lg font-semibold text-white mb-3">
                                       ℹ️ Informations
                                   </h4>
                                   <div className="text-sm text-gray-400 space-y-2">
                                       <p>Version: 2.0 Pro</p>
                                       <p>Dernière sync: {lastSaveTime ? formatDate(lastSaveTime) : 'Jamais'}</p>
                                       <p>Utilisateur: {userId?.substring(0, 8)}...</p>
                                       <p>Notifications: {Notification?.permission || 'Non supportées'}</p>
                                   </div>
                               </div>
                           </div>

                           <div className="mt-6">
                               <button
                                   onClick={() => setShowSettingsModal(false)}
                                   className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                               >
                                   Fermer
                               </button>
                           </div>
                       </div>
                   </div>
               </div>
           )}

           {/* Modale d'analyse IA */}
           {progressionAnalysisContent && (
               <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                   <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto scrollbar-thin">
                       <div className="p-6">
                           <div className="flex items-center justify-between mb-6">
                               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                   <Sparkles className="h-5 w-5 text-purple-400" />
                                   Analyse IA de progression
                               </h3>
                               <button
                                   onClick={() => setProgressionAnalysisContent('')}
                                   className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
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