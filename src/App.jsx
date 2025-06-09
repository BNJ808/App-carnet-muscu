import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
    Settings, 
    Download, 
    Upload, 
    Plus, 
    RotateCcw, 
    RotateCw, 
    Search,
    Filter,
    Clock,
    Play,
    Pause,
    RotateCcw as Reset,
    Sun,
    Moon,
    Sparkles,
    TrendingUp,
    Calendar,
    Target,
    Wifi,
    WifiOff,
    Bell,
    X,
    Check,
    AlertCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

// Composants
import MainWorkoutView from './components/MainWorkoutView';
import StatsView from './components/StatsView';
import Toast from './components/Toast';
import BottomNavigationBar from './components/BottomNavigationBar';
import TimerView from './components/TimerView.jsx';
import StatsView from './components/StatsView.jsx';

// Firebase
import { 
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
} from './firebase';

// IA Gemini
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configuration
const AUTO_SAVE_DELAY = 2000;
const MAX_UNDO_STATES = 20;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Utilitaires
const generateUUID = () => Math.random().toString(36).substr(2, 9);

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const logError = (type, message, error = null) => {
    if (error) {
        console.error(`${type.toUpperCase()}: ${message}`, error);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
};

// Données de base pour initialisation
const baseInitialData = {
    days: {
        "Lundi": {
            categories: {
                "Pectoraux": [
                    {
                        id: generateUUID(),
                        name: "Développé couché",
                        series: [
                            { id: generateUUID(), weight: "80", reps: "8", completed: false },
                            { id: generateUUID(), weight: "85", reps: "6", completed: false },
                            { id: generateUUID(), weight: "90", reps: "4", completed: false }
                        ],
                        isDeleted: false,
                        notes: "",
                        createdAt: new Date().toISOString()
                    }
                ],
                "Triceps": [
                    {
                        id: generateUUID(),
                        name: "Dips",
                        series: [
                            { id: generateUUID(), weight: "0", reps: "10", completed: false },
                            { id: generateUUID(), weight: "0", reps: "8", completed: false },
                            { id: generateUUID(), weight: "0", reps: "6", completed: false }
                        ],
                        isDeleted: false,
                        notes: "",
                        createdAt: new Date().toISOString()
                    }
                ]
            },
            categoryOrder: ["Pectoraux", "Triceps"]
        },
        "Mardi": {
            categories: {
                "Jambes": [
                    {
                        id: generateUUID(),
                        name: "Squat",
                        series: [
                            { id: generateUUID(), weight: "100", reps: "10", completed: false },
                            { id: generateUUID(), weight: "110", reps: "8", completed: false },
                            { id: generateUUID(), weight: "120", reps: "6", completed: false }
                        ],
                        isDeleted: false,
                        notes: "",
                        createdAt: new Date().toISOString()
                    }
                ]
            },
            categoryOrder: ["Jambes"]
        }
    },
    dayOrder: ["Lundi", "Mardi"],
    lastUpdated: new Date().toISOString()
};

// Fonction de nettoyage des données améliorée
const sanitizeWorkoutData = (data) => {
    if (!data || typeof data !== 'object') return baseInitialData;
    
    const sanitized = {
        days: {},
        dayOrder: Array.isArray(data.dayOrder) ? data.dayOrder : [],
        lastUpdated: data.lastUpdated || new Date().toISOString()
    };

    if (data.days && typeof data.days === 'object') {
        Object.entries(data.days).forEach(([dayName, dayData]) => {
            if (dayData && typeof dayData === 'object' && dayData.categories) {
                sanitized.days[dayName] = {
                    categories: {},
                    categoryOrder: Array.isArray(dayData.categoryOrder) ? dayData.categoryOrder : []
                };

                Object.entries(dayData.categories).forEach(([categoryName, exercises]) => {
                    if (Array.isArray(exercises)) {
                        sanitized.days[dayName].categories[categoryName] = exercises
                            .filter(exercise => exercise && typeof exercise === 'object' && exercise.name)
                            .map(exercise => ({
                                id: exercise.id || generateUUID(),
                                name: exercise.name,
                                series: Array.isArray(exercise.series) ? exercise.series.map(serie => ({
                                    id: serie.id || generateUUID(),
                                    weight: serie.weight || "0",
                                    reps: serie.reps || "0",
                                    completed: Boolean(serie.completed)
                                })) : [],
                                isDeleted: Boolean(exercise.isDeleted),
                                notes: exercise.notes || "",
                                createdAt: exercise.createdAt || new Date().toISOString()
                            }));
                    }
                });
            }
        });
    }

    return Object.keys(sanitized.days).length > 0 ? sanitized : baseInitialData;
};

function App() {
    // États principaux
    const [workouts, setWorkouts] = useState(baseInitialData);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentView, setCurrentView] = useState('workout');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return localStorage.getItem('darkMode') !== 'false';
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // États pour les notifications et toasts
    const [toast, setToast] = useState(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);

    // États pour les données historiques et statistiques
    const [historicalData, setHistoricalData] = useState([]);
    const [statsData, setStatsData] = useState(null);
    
    // États pour undo/redo
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    
    // États pour l'édition d'exercices
    const [editingExercise, setEditingExercise] = useState(null);
    const [editingExerciseName, setEditingExerciseName] = useState('');
    const [isSavingExercise, setIsSavingExercise] = useState(false);
    const [isDeletingExercise, setIsDeletingExercise] = useState(false);
    
    // États pour l'ajout d'exercices
    const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newWeight, setNewWeight] = useState('');
    const [newSets, setNewSets] = useState('3');
    const [newReps, setNewReps] = useState('');
    const [selectedDayForAdd, setSelectedDayForAdd] = useState('');
    const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState('');
    
    // États pour les modales
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    
    // États pour la recherche et filtres
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDayFilter, setSelectedDayFilter] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);
    
    // États pour l'IA et analyses
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    
    // États pour import/export
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    
    // États pour le minuteur
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [customTimerMinutes, setCustomTimerMinutes] = useState(2);
    const [showTimerModal, setShowTimerModal] = useState(false);
    
    // Refs
    const timerRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    
    // Configuration Gemini IA
    const genAI = useMemo(() => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        return apiKey ? new GoogleGenerativeAI(apiKey) : null;
    }, []);

    // Formatage du temps pour le minuteur
    const formatTime = useCallback((seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Fonctions utilitaires pour les notifications
    const requestPermission = useCallback(async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                setToast({ message: "Notifications activées !", type: 'success' });
                setNotificationsEnabled(true);
            }
        }
    }, []);

    const showNotification = useCallback((message, type = 'info') => {
        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(message, {
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: 'workout-timer'
            });
        }
    }, [notificationsEnabled]);

    // Initialisation de l'authentification
    const initAuth = useCallback(async () => {
        try {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUser(user);
                    setUserId(user.uid);
                } else {
                    try {
                        const userCredential = await signInAnonymously(auth);
                        setUser(userCredential.user);
                        setUserId(userCredential.user.uid);
                    } catch (error) {
                        logError("auth", "Erreur connexion anonyme", error);
                        setToast({ message: "Erreur de connexion", type: 'error' });
                        // Mode hors ligne
                        setWorkouts(baseInitialData);
                        setLoading(false);
                    }
                }
                setIsAuthReady(true);
            });
            
            return unsubscribe;
        } catch (error) {
            logError("auth", "Erreur initialisation auth", error);
            setToast({ message: "Mode hors ligne activé", type: 'warning' });
            setIsAuthReady(true);
            setWorkouts(baseInitialData);
            setLoading(false);
        }
    }, []);

    // Sauvegarde optimisée avec debouncing et gestion hors ligne
    const saveWorkoutsOptimized = useCallback(
        debounce(async (workoutsToSave, message = null) => {
            if (!userId || !workoutsToSave || !isOnline) {
                if (!isOnline) {
                    localStorage.setItem('workout-offline-data', JSON.stringify(workoutsToSave));
                    setToast({ message: "Sauvegardé en local (mode hors ligne)", type: 'warning' });
                }
                return;
            }
            
            try {
                const workoutDocRef = doc(db, 'users', userId, 'workout', 'data');
                await setDoc(workoutDocRef, {
                    ...workoutsToSave,
                    lastUpdated: serverTimestamp()
                }, { merge: true });
                
                if (message) {
                    setToast({ message, type: 'success' });
                }
                logError("save", "Données sauvegardées avec succès");
            } catch (error) {
                logError("save", "Erreur sauvegarde", error);
                setToast({ message: "Erreur de sauvegarde", type: 'error' });
                // Sauvegarde locale en cas d'erreur
                localStorage.setItem('workout-offline-data', JSON.stringify(workoutsToSave));
            }
        }, AUTO_SAVE_DELAY),
        [userId, isOnline]
    );

    // Chargement des données historiques amélioré
    const loadHistoricalData = useCallback(async () => {
        if (!userId || !isOnline) return;
        
        try {
            const historyRef = collection(db, 'users', userId, 'workoutHistory');
            const q = query(historyRef, orderBy('date', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            
            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(doc.data().date)
            }));
            
            setHistoricalData(history);
            logError("data", `${history.length} séances historiques chargées`);
        } catch (error) {
            logError("data", "Erreur chargement historique", error);
        }
    }, [userId, isOnline]);

    // Fonction d'application des changements avec undo/redo améliorée
    const applyChanges = useCallback((newWorkoutsState, message = null) => {
        setUndoStack(prevStack => {
            const newStack = [...prevStack, JSON.parse(JSON.stringify(workouts))];
            return newStack.length > MAX_UNDO_STATES ? 
                newStack.slice(-MAX_UNDO_STATES) 
                : newStack;
        });
        setRedoStack([]);
        setWorkouts(newWorkoutsState);
        saveWorkoutsOptimized(newWorkoutsState, message);
    }, [workouts, saveWorkoutsOptimized]);

    // Gestion des séries d'exercices - CORRECTION MAJEURE
    const toggleSerieCompleted = useCallback((dayName, categoryName, exerciseId, serieIndex) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days?.[dayName]?.categories?.[categoryName]?.find(ex => ex.id === exerciseId);
        
        if (exercise?.series?.[serieIndex]) {
            exercise.series[serieIndex].completed = !exercise.series[serieIndex].completed;
            applyChanges(updatedWorkouts, "Série mise à jour !");
        }
    }, [workouts, applyChanges]);

    // Modification d'une série - NOUVELLE FONCTIONNALITÉ
    const updateSerie = useCallback((dayName, categoryName, exerciseId, serieIndex, weight, reps) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days?.[dayName]?.categories?.[categoryName]?.find(ex => ex.id === exerciseId);
        
        if (exercise?.series?.[serieIndex]) {
            exercise.series[serieIndex].weight = weight.toString();
            exercise.series[serieIndex].reps = reps.toString();
            applyChanges(updatedWorkouts, "Série modifiée !");
        }
    }, [workouts, applyChanges]);

    // Ajout d'une série - NOUVELLE FONCTIONNALITÉ
    const addSerie = useCallback((dayName, categoryName, exerciseId) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days?.[dayName]?.categories?.[categoryName]?.find(ex => ex.id === exerciseId);
        
        if (exercise) {
            const newSerie = {
                id: generateUUID(),
                weight: exercise.series[exercise.series.length - 1]?.weight || "0",
                reps: exercise.series[exercise.series.length - 1]?.reps || "0",
                completed: false
            };
            exercise.series.push(newSerie);
            applyChanges(updatedWorkouts, "Série ajoutée !");
        }
    }, [workouts, applyChanges]);

    // Suppression d'une série - NOUVELLE FONCTIONNALITÉ
    const removeSerie = useCallback((dayName, categoryName, exerciseId, serieIndex) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days?.[dayName]?.categories?.[categoryName]?.find(ex => ex.id === exerciseId);
        
        if (exercise?.series?.length > 1) {
            exercise.series.splice(serieIndex, 1);
            applyChanges(updatedWorkouts, "Série supprimée !");
        } else {
            setToast({ message: "Impossible de supprimer la dernière série", type: 'warning' });
        }
    }, [workouts, applyChanges]);

    // Modification des notes d'un exercice - CORRECTION
    const updateExerciseNotes = useCallback((dayName, categoryName, exerciseId, notes) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days?.[dayName]?.categories?.[categoryName]?.find(ex => ex.id === exerciseId);
        
        if (exercise) {
            exercise.notes = notes;
            applyChanges(updatedWorkouts, "Notes mises à jour !");
        }
    }, [workouts, applyChanges]);

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
                id: generateUUID(),
                weight: newWeight.toString() || "0",
                reps: newReps.toString() || "0",
                completed: false
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

    // Gestion de l'édition d'exercices - CORRECTION
    const handleEditClick = useCallback((dayName, categoryName, exerciseId, exercise) => {
        setEditingExercise({ day: dayName, category: categoryName, exerciseId });
        setEditingExerciseName(exercise.name);
    }, []);

    const handleSaveExercise = useCallback(() => {
        if (!editingExercise || !editingExerciseName.trim()) return;
        
        setIsSavingExercise(true);
        
        const updatedWorkouts = { ...workouts };
        const { day, category, exerciseId } = editingExercise;
        
        const exercise = updatedWorkouts.days?.[day]?.categories?.[category]?.find(ex => ex.id === exerciseId);
        
        if (exercise) {
            exercise.name = editingExerciseName.trim();
            applyChanges(updatedWorkouts, "Exercice modifié !");
        }
        
        setEditingExercise(null);
        setEditingExerciseName('');
        setIsSavingExercise(false);
    }, [editingExercise, editingExerciseName, workouts, applyChanges]);

    // Suppression d'exercices - CORRECTION
    const handleDeleteExercise = useCallback((dayName, categoryName, exerciseId) => {
        setItemToDelete({ type: 'exercise', dayName, categoryName, exerciseId });
        setShowDeleteConfirm(true);
    }, []);

    const confirmDelete = useCallback(() => {
        if (!itemToDelete) return;
        
        setIsDeletingExercise(true);
        const updatedWorkouts = { ...workouts };
        
        if (itemToDelete.type === 'exercise') {
            const { dayName, categoryName, exerciseId } = itemToDelete;
            const exercises = updatedWorkouts.days?.[dayName]?.categories?.[categoryName];
            
            if (exercises) {
                const exerciseIndex = exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    exercises.splice(exerciseIndex, 1);
                    applyChanges(updatedWorkouts, "Exercice supprimé !");
                }
            }
        }
        
        setShowDeleteConfirm(false);
        setItemToDelete(null);
        setIsDeletingExercise(false);
    }, [itemToDelete, workouts, applyChanges]);

    // Sauvegarde dans l'historique - AMÉLIORATION
    const saveToHistory = useCallback(async () => {
        if (!userId || !isOnline) {
            setToast({ message: "Impossible de sauvegarder en mode hors ligne", type: 'warning' });
            return;
        }
        
        try {
            const historyRef = collection(db, 'users', userId, 'workoutHistory');
            
            let totalVolume = 0;
            Object.values(workouts.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(exercise => {
                            if (exercise.series && Array.isArray(exercise.series)) {
                                exercise.series.forEach(serie => {
                                    if (serie.completed) {
                                        const weight = parseFloat(serie.weight) || 0;
                                        const reps = parseInt(serie.reps) || 0;
                                        totalVolume += weight * reps;
                                    }
                                });
                            }
                        });
                    }
                });
            });
            
            await addDoc(historyRef, {
                ...workouts,
                date: serverTimestamp(),
                totalVolume: totalVolume
            });
            
            setToast({ message: "Séance sauvegardée dans l'historique !", type: 'success' });
            loadHistoricalData();
        } catch (error) {
            logError("history", "Erreur sauvegarde historique", error);
            setToast({ message: "Erreur sauvegarde historique", type: 'error' });
        }
    }, [workouts, userId, isOnline, loadHistoricalData]);

    // Gestion du minuteur - AMÉLIORATIONS
    const startTimer = useCallback((seconds = null) => {
        const timerSeconds = seconds || customTimerMinutes * 60;
        setTimerSeconds(timerSeconds);
        setTimerIsRunning(true);
        setTimerIsFinished(false);
    }, [customTimerMinutes]);

    const pauseTimer = useCallback(() => {
        setTimerIsRunning(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    const resetTimer = useCallback(() => {
        setTimerIsRunning(false);
        setTimerSeconds(0);
        setTimerIsFinished(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    // Export des données - AMÉLIORATION
    const exportData = useCallback(() => {
        setIsExporting(true);
        try {
            const dataToExport = {
                workouts,
                historicalData: historicalData.slice(0, 10), // Limiter l'export
                exportDate: new Date().toISOString(),
                version: "2.1"
            };
            
            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `workout-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setToast({ message: "Données exportées avec succès !", type: 'success' });
        } catch (error) {
            logError("export", "Erreur export", error);
            setToast({ message: "Erreur lors de l'export", type: 'error' });
        } finally {
            setIsExporting(false);
        }
    }, [workouts, historicalData]);

    // Import des données - AMÉLIORATION
    const importData = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (importedData.workouts && typeof importedData.workouts === 'object') {
                    const sanitizedData = sanitizeWorkoutData(importedData.workouts);
                    applyChanges(sanitizedData, "Import réussi !");
                    setToast({ message: "Import réussi !", type: 'success' });
                } else {
                    setToast({ message: "Format de fichier invalide", type: 'error' });
                }
            } catch (error) {
                logError("import", "Erreur import", error);
                setToast({ message: "Erreur lors de l'import", type: 'error' });
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
        
        // Reset input
        event.target.value = '';
    }, [sanitizeWorkoutData, applyChanges]);

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
        let totalVolume = 0;
        
        try {
            Object.values(workouts.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(exercise => {
                            if (!exercise.isDeleted) {
                                totalExercises++;
                                if (exercise.series && Array.isArray(exercise.series)) {
                                    exercise.series.forEach(serie => {
                                        if (serie.completed) {
                                            const weight = parseFloat(serie.weight) || 0;
                                            const reps = parseInt(serie.reps) || 0;
                                            totalVolume += weight * reps;
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
            });

            const totalSessions = historicalData.length;
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            const thisWeekSessions = historicalData.filter(session => 
                new Date(session.date) >= oneWeekAgo
            ).length;

            const averageSessionsPerWeek = totalSessions > 0 ? 
                (totalSessions / Math.max(1, Math.ceil(totalSessions / 4))) : 0;

            return {
                totalExercises,
                totalSessions,
                thisWeekSessions,
                totalVolume: Math.round(totalVolume),
                averageSessionsPerWeek: Math.round(averageSessionsPerWeek * 10) / 10
            };
        } catch (error) {
            logError("stats", "Erreur calcul statistiques", error);
            return {
                totalExercises: 0,
                totalSessions: 0,
                thisWeekSessions: 0,
                totalVolume: 0,
                averageSessionsPerWeek: 0
            };
        }
    }, [workouts, historicalData]);

    // Génération de suggestions IA - AMÉLIORATION
    const generateAISuggestions = useCallback(async () => {
        if (!genAI || isLoadingAI) return;
        
        setIsLoadingAI(true);
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const workoutSummary = JSON.stringify({
                days: Object.keys(workouts.days || {}),
                totalExercises: getWorkoutStats().totalExercises,
                recentSessions: historicalData.slice(0, 3)
            });
            
            const prompt = `
            Analyse ce programme d'entraînement et génère 5 suggestions d'amélioration courtes et précises :
            
            ${workoutSummary}
            
            Concentre-toi sur :
            - L'équilibre musculaire
            - La progression
            - La récupération
            - Les exercices manquants
            
            Réponds avec des suggestions numérotées, une par ligne, en français.
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Parser les suggestions
            const suggestions = text.split('\n')
                .filter(line => line.trim() && (line.match(/^\d+\./) || line.match(/^-/)))
                .slice(0, 5)
                .map(suggestion => suggestion.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim());
            
            setAiSuggestions(suggestions);
            setToast({ message: "Suggestions IA générées !", type: 'success' });
        } catch (error) {
            logError("ai", "Erreur IA", error);
            setToast({ message: "Erreur génération IA", type: 'error' });
        } finally {
            setIsLoadingAI(false);
        }
    }, [workouts, genAI, isLoadingAI, getWorkoutStats, historicalData]);

    // Analyse de progression avec IA - NOUVELLE FONCTIONNALITÉ
    const analyzeProgressionWithAI = useCallback(async (exercise) => {
        if (!genAI || isLoadingAI) return;
        
        setIsLoadingAI(true);
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            // Récupérer l'historique de cet exercice
            const exerciseHistory = historicalData
                .map(session => {
                    const exerciseData = Object.values(session.days || {})
                        .flatMap(day => Object.values(day.categories || {}))
                        .flat()
                        .find(ex => ex.name === exercise.name);
                    return exerciseData ? {
                        date: session.date,
                        series: exerciseData.series
                    } : null;
                })
                .filter(Boolean)
                .slice(0, 10);

            const prompt = `
            Analyse la progression de cet exercice : "${exercise.name}"
            
            Données actuelles : ${JSON.stringify(exercise.series)}
            Historique (10 dernières séances) : ${JSON.stringify(exerciseHistory)}
            
            Fournis :
            1. Analyse de la progression
            2. Points forts
            3. Recommandations d'amélioration
            4. Objectif pour la prochaine séance
            
            Réponds en français, de manière motivante et constructive.
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            setProgressionAnalysisContent(text);
            setToast({ message: `Analyse générée pour ${exercise.name}`, type: 'success' });
        } catch (error) {
            logError("ai", "Erreur analyse progression", error);
            setToast({ message: "Erreur analyse IA", type: 'error' });
        } finally {
            setIsLoadingAI(false);
        }
    }, [genAI, isLoadingAI, historicalData]);

    // Filtrage des données avec mémorisation
    const filteredWorkouts = useMemo(() => {
        if (!workouts?.days) return { days: {}, dayOrder: [] };
        
        const filtered = {
            days: {},
            dayOrder: workouts.dayOrder || []
        };
        
        Object.entries(workouts.days).forEach(([dayName, day]) => {
            // Filtrer par jour sélectionné
            if (selectedDayFilter && dayName !== selectedDayFilter) {
                return;
            }
            
            filtered.days[dayName] = {
                categories: {},
                categoryOrder: day.categoryOrder || []
            };
            
            Object.entries(day.categories || {}).forEach(([categoryName, exercises]) => {
                // Filtrer par catégorie sélectionnée
                if (selectedCategoryFilter && categoryName !== selectedCategoryFilter) {
                    return;
                }
                
                const filteredExercises = exercises.filter(exercise => {
                    const matchesSearch = !searchTerm || 
                        exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
                    
                    const matchesCompletion = !showOnlyCompleted || 
                        (exercise.series && exercise.series.some(serie => serie.completed));
                    
                    const notDeleted = !exercise.isDeleted;
                    
                    return matchesSearch && matchesCompletion && notDeleted;
                });
                
                if (filteredExercises.length === 0) {
                    delete filtered.days[dayName].categories[categoryName];
                } else {
                    filtered.days[dayName].categories[categoryName] = filteredExercises;
                }
            });
            
            // Supprimer le jour s'il n'a plus de catégories
            if (Object.keys(filtered.days[dayName].categories).length === 0) {
                delete filtered.days[dayName];
            }
        });
        
        return filtered;
    }, [workouts, searchTerm, selectedDayFilter, selectedCategoryFilter, showOnlyCompleted]);

    // Gestion du mode sombre
    useEffect(() => {
        localStorage.setItem('darkMode', isDarkMode.toString());
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Gestion du statut en ligne avec synchronisation
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Synchroniser les données locales si disponibles
            const offlineData = localStorage.getItem('workout-offline-data');
            if (offlineData && userId) {
                try {
                    const data = JSON.parse(offlineData);
                    saveWorkoutsOptimized(data, "Synchronisation des données hors ligne");
                    localStorage.removeItem('workout-offline-data');
                } catch (error) {
                    logError("sync", "Erreur synchronisation", error);
                }
            }
        };
        
        const handleOffline = () => {
            setIsOnline(false);
            setToast({ message: "Mode hors ligne activé", type: 'warning' });
        };
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [userId, saveWorkoutsOptimized]);

    // Initialisation de l'authentification
    useEffect(() => {
        initAuth();
    }, [initAuth]);
    
    // Effet pour charger les données avec cache
    useEffect(() => {
        if (!userId || !isAuthReady) return;

        const workoutDocRef = doc(db, 'users', userId, 'workout', 'data');
        const unsubscribe = onSnapshot(workoutDocRef, (doc) => {
            try {
                if (doc.exists()) {
                    const data = doc.data();
                    const sanitizedWorkouts = sanitizeWorkoutData(data || baseInitialData);
                    setWorkouts(sanitizedWorkouts);
                } else {
                    logError("data", "Aucune donnée trouvée, initialisation avec données de base");
                    setWorkouts(baseInitialData);
                }
            } catch (error) {
                logError("data", "Erreur traitement données", error);
                setToast({ message: "Erreur lors du chargement des données", type: 'error' });
                setWorkouts(baseInitialData);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            logError("firestore", "Erreur Firestore", error);
            setToast({ message: `Erreur Firestore: ${error.message}`, type: 'error' });
            setLoading(false);
            
            // Charger les données locales en cas d'erreur
            const offlineData = localStorage.getItem('workout-offline-data');
            if (offlineData) {
                try {
                    setWorkouts(JSON.parse(offlineData));
                } catch {
                    setWorkouts(baseInitialData);
                }
            } else {
                setWorkouts(baseInitialData);
            }
        });

        loadHistoricalData();
        return () => unsubscribe();
    }, [userId, isAuthReady, loadHistoricalData]);

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
            showNotification('Temps de repos terminé !', 'success');
            setToast({ message: "Temps de repos terminé !", type: 'success' });
        }
        
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [timerIsRunning, timerSeconds, showNotification]);

    // Nettoyage des timeouts
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    // Interface de chargement
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-300">Chargement de votre carnet...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
            {/* Header principal */}
            <header className="bg-gray-800 shadow-lg border-b border-gray-700 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold text-white">💪 Carnet Muscu</h1>
                            {!isOnline && (
                                <div className="flex items-center gap-1 text-amber-400 text-sm">
                                    <WifiOff className="h-4 w-4" />
                                    <span>Hors ligne</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {/* Minuteur */}
                            <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span className={`text-sm font-mono ${timerIsFinished ? 'text-red-400' : 'text-gray-300'}`}>
                                    {formatTime(timerSeconds)}
                                </span>
                                <div className="flex gap-1">
                                    {!timerIsRunning ? (
                                        <button
                                            onClick={() => startTimer()}
                                            className="p-1 text-green-400 hover:text-green-300 transition-colors"
                                            title="Démarrer minuteur"
                                        >
                                            <Play className="h-3 w-3" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={pauseTimer}
                                            className="p-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                                            title="Pause minuteur"
                                        >
                                            <Pause className="h-3 w-3" />
                                        </button>
                                    )}
                                    <button
                                        onClick={resetTimer}
                                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                        title="Reset minuteur"
                                    >
                                        <Reset className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>

                            {/* Boutons d'action */}
                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                title={isDarkMode ? "Mode clair" : "Mode sombre"}
                            >
                                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                            </button>

                            <button
                                onClick={handleUndo}
                                disabled={undoStack.length === 0}
                                className="p-2 text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Annuler"
                            >
                                <RotateCcw className="h-5 w-5" />
                            </button>

                            <button
                                onClick={handleRedo}
                                disabled={redoStack.length === 0}
                                className="p-2 text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Rétablir"
                            >
                                <RotateCw className="h-5 w-5" />
                            </button>

                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                title="Paramètres"
                            >
                                <Settings className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Navigation des vues */}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => setCurrentView('workout')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                currentView === 'workout'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            Entraînement
                        </button>
                        <button
                            onClick={() => setCurrentView('stats')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                currentView === 'stats'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            Statistiques
                        </button>
                    </div>
                </div>
            </header>

            {/* Contenu principal */}
            <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={filteredWorkouts}
                        onToggleSerieCompleted={toggleSerieCompleted}
                        onUpdateSerie={updateSerie}
                        onAddSerie={addSerie}
                        onRemoveSerie={removeSerie}
                        onUpdateExerciseNotes={updateExerciseNotes}
                        onEditClick={handleEditClick}
                        onDeleteExercise={handleDeleteExercise}
                        onAnalyzeProgression={analyzeProgressionWithAI}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        selectedDayFilter={selectedDayFilter}
                        onDayFilterChange={setSelectedDayFilter}
                        selectedCategoryFilter={selectedCategoryFilter}
                        onCategoryFilterChange={setSelectedCategoryFilter}
                        showOnlyCompleted={showOnlyCompleted}
                        onToggleCompletedFilter={setShowOnlyCompleted}
                        onAddExercise={() => setShowAddExerciseModal(true)}
                        onSaveToHistory={saveToHistory}
                        isCompactView={false}
                        historicalData={historicalData}
                    />
                )}

                {currentView === 'stats' && (
                    <StatsView
                        workouts={workouts}
                        historicalData={historicalData}
                        onGenerateAISuggestions={generateAISuggestions}
                        aiSuggestions={aiSuggestions}
                        isLoadingAI={isLoadingAI}
                        progressionAnalysisContent={progressionAnalysisContent}
                        getWorkoutStats={getWorkoutStats}
                    />
                )}
            </main>

            {/* Modales */}
            {showAddExerciseModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-white">Nouvel Exercice</h2>
                                <button
                                    onClick={() => setShowAddExerciseModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nom de l'exercice
                                    </label>
                                    <input
                                        type="text"
                                        value={newExerciseName}
                                        onChange={(e) => setNewExerciseName(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                        placeholder="Ex: Développé couché"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Jour
                                        </label>
                                        <select
                                            value={selectedDayForAdd}
                                            onChange={(e) => setSelectedDayForAdd(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="">Sélectionner...</option>
                                            {Object.keys(workouts.days || {}).map(day => (
                                                <option key={day} value={day}>{day}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Catégorie
                                        </label>
                                        <select
                                            value={selectedCategoryForAdd}
                                            onChange={(e) => setSelectedCategoryForAdd(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="">Sélectionner...</option>
                                            {selectedDayForAdd && Object.keys(workouts.days[selectedDayForAdd]?.categories || {}).map(category => (
                                                <option key={category} value={category}>{category}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Poids (kg)
                                        </label>
                                        <input
                                            type="number"
                                            value={newWeight}
                                            onChange={(e) => setNewWeight(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Séries
                                        </label>
                                        <input
                                            type="number"
                                            value={newSets}
                                            onChange={(e) => setNewSets(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            min="1"
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
                                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddExerciseModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAddExercise}
                                    disabled={isAddingExercise || !newExerciseName.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {isAddingExercise ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Ajout...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            Ajouter
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-white">Paramètres</h2>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Minuteur */}
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-3">Minuteur</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Durée par défaut (minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={customTimerMinutes}
                                                onChange={(e) => setCustomTimerMinutes(parseInt(e.target.value) || 2)}
                                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                                min="1"
                                                max="30"
                                            />
                                        </div>
                                        <button
                                            onClick={requestPermission}
                                            disabled={notificationsEnabled}
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Bell className="h-4 w-4" />
                                            {notificationsEnabled ? 'Notifications activées' : 'Activer les notifications'}
                                        </button>
                                    </div>
                                </div>

                                {/* Import/Export */}
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-3">Sauvegarde</h3>
                                    <div className="space-y-3">
                                        <button
                                            onClick={exportData}
                                            disabled={isExporting}
                                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isExporting ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Export...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4" />
                                                    Exporter les données
                                                </>
                                            )}
                                        </button>
                                        
                                        <div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".json"
                                                onChange={importData}
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isImporting}
                                                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                            >
                                                {isImporting ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        Import...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="h-4 w-4" />
                                                        Importer les données
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <button
                                            onClick={saveToHistory}
                                            disabled={!isOnline}
                                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Calendar className="h-4 w-4" />
                                            Sauvegarder dans l'historique
                                        </button>
                                    </div>
                                </div>

                                {/* IA */}
                                {genAI && (
                                    <div>
                                        <h3 className="text-lg font-medium text-white mb-3">Intelligence Artificielle</h3>
                                        <div className="space-y-3">
                                            <button
                                                onClick={generateAISuggestions}
                                                disabled={isLoadingAI}
                                                className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                            >
                                                {isLoadingAI ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        Génération...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="h-4 w-4" />
                                                        Générer des suggestions
                                                    </>
                                                )}
                                            </button>
                                            
                                            {aiSuggestions.length > 0 && (
                                                <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                                    <h4 className="text-sm font-medium text-yellow-400 mb-2">Suggestions IA :</h4>
                                                    <ul className="space-y-1 text-sm text-gray-300">
                                                        {aiSuggestions.map((suggestion, index) => (
                                                            <li key={index} className="flex items-start gap-2">
                                                                <span className="text-yellow-400 mt-1">•</span>
                                                                <span>{suggestion}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Thème */}
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-3">Apparence</h3>
                                    <button
                                        onClick={() => setIsDarkMode(!isDarkMode)}
                                        className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                        {isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmation de suppression */}
            {showDeleteConfirm && itemToDelete && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl max-w-sm w-full">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                </div>
                                <h2 className="text-lg font-semibold text-white">Confirmer la suppression</h2>
                            </div>
                            
                            <p className="text-gray-300 mb-6">
                                Êtes-vous sûr de vouloir supprimer cet exercice ? Cette action est irréversible.
                            </p>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setItemToDelete(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={isDeletingExercise}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {isDeletingExercise ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Suppression...
                                        </>
                                    ) : (
                                        'Supprimer'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal d'édition d'exercice */}
            {editingExercise && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-white">Modifier l'exercice</h2>
                                <button
                                    onClick={() => {
                                        setEditingExercise(null);
                                        setEditingExerciseName('');
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nom de l'exercice
                                    </label>
                                    <input
                                        type="text"
                                        value={editingExerciseName}
                                        onChange={(e) => setEditingExerciseName(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                                        placeholder="Nom de l'exercice"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setEditingExercise(null);
                                        setEditingExerciseName('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSaveExercise}
                                    disabled={isSavingExercise || !editingExerciseName.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSavingExercise ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Sauvegarde...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Sauvegarder
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal d'analyse de progression IA */}
            {progressionAnalysisContent && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-yellow-400" />
                                    Analyse de Progression IA
                                </h2>
                                <button
                                    onClick={() => setProgressionAnalysisContent('')}
                                    className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="overflow-y-auto max-h-96 prose prose-invert max-w-none">
                                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {progressionAnalysisContent}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

               {/* Toast de notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            
            {/* BottomNavigationBar (toujours visible) */}
            <BottomNavigationBar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
            />
        </div>
    );
}

export default App;