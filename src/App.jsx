import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection, query, limit, addDoc, serverTimestamp, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Undo2, Redo2, Settings, XCircle, CheckCircle, ChevronDown, ChevronUp, Pencil, Sparkles, ArrowUp, ArrowDown,
    Plus, Trash2, Play, Pause, RotateCcw, Search, Filter, Dumbbell, Clock, History, NotebookText,
    LineChart as LineChartIcon, Target, TrendingUp, Award, Calendar, BarChart3, Moon, Sun,
    Zap, Download, Upload, Share, Eye, EyeOff, Maximize2, Minimize2, Activity
} from 'lucide-react';
import * as GenerativeAIModule from '@google/generative-ai';

// Import des services Firebase depuis firebase.js
import { auth, db } from './firebase.js';

// Import des composants
import Toast from './Toast.jsx';
import MainWorkoutView from './MainWorkoutView.jsx';
import HistoryView from './HistoryView.jsx';
import TimerView from './TimerView.jsx';
import StatsView from './StatsView.jsx';
import BottomNavigationBar from './BottomNavigationBar.jsx';

// Configuration Gemini AI
const genAI = new GenerativeAIModule.GoogleGenerativeAI(import.meta.env?.VITE_GEMINI_API_KEY || "demo-key");

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
    return date.toLocaleDateString('fr-FR', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
};

// Fonction de notification robuste
const showNotification = (message, type = 'info') => {
    // Notifications natives si supportées
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(message);
    }
    
    // Vibration si supportée
    if ('vibrate' in navigator) {
        navigator.vibrate(type === 'success' ? [100, 50, 100] : [200]);
    }
    
    console.log(`${type.toUpperCase()}: ${message}`);
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
                            { weight: "80", reps: "8" },
                            { weight: "85", reps: "6" },
                            { weight: "90", reps: "4" }
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
                            { weight: "0", reps: "10" },
                            { weight: "0", reps: "8" },
                            { weight: "0", reps: "6" }
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
                            { weight: "100", reps: "10" },
                            { weight: "110", reps: "8" },
                            { weight: "120", reps: "6" }
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

// Fonction de nettoyage des données
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
                        sanitized.days[dayName].categories[categoryName] = exercises.map(exercise => ({
                            id: exercise.id || generateUUID(),
                            name: exercise.name || "Exercice sans nom",
                            series: Array.isArray(exercise.series) ? exercise.series.map(serie => ({
                                weight: String(serie.weight || "0"),
                                reps: String(serie.reps || "0")
                            })) : [{ weight: "0", reps: "0" }],
                            isDeleted: Boolean(exercise.isDeleted),
                            notes: exercise.notes || "",
                            createdAt: exercise.createdAt || new Date().toISOString(),
                            deletedAt: exercise.deletedAt || null
                        }));
                    }
                });
            }
        });
    }

    return Object.keys(sanitized.days).length > 0 ? sanitized : baseInitialData;
};

// Composant principal App
const ImprovedWorkoutApp = () => {
    // États principaux
    const [workouts, setWorkouts] = useState(baseInitialData);
    const [currentView, setCurrentView] = useState('workout');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return localStorage.getItem('darkMode') === 'true' || 
               (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    
    // États Firebase
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // États du minuteur
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [customTimerMinutes, setCustomTimerMinutes] = useState(3);
    
    // États pour l'historique et statistiques
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
    
    // Refs
    const timerRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    
    // Fonctions utilitaires pour les notifications
    const requestPermission = useCallback(async () => {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                setToast({ message: "Notifications activées !", type: 'success' });
            }
        }
    }, []);

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
                        console.error("Erreur connexion anonyme:", error);
                        setToast({ message: "Erreur de connexion", type: 'error' });
                    }
                }
                setIsAuthReady(true);
            });
            
            return unsubscribe;
        } catch (error) {
            console.error("Erreur initialisation auth:", error);
            setToast({ message: "Erreur d'initialisation", type: 'error' });
            setIsAuthReady(true);
        }
    }, []);

    // Sauvegarde optimisée avec debouncing
    const saveWorkoutsOptimized = useCallback(
        debounce(async (workoutsToSave, message = null) => {
            if (!userId || !workoutsToSave) return;
            
            try {
                const workoutDocRef = doc(db, 'users', userId, 'workout', 'data');
                await setDoc(workoutDocRef, {
                    ...workoutsToSave,
                    lastUpdated: serverTimestamp()
                }, { merge: true });
                
                if (message) {
                    setToast({ message, type: 'success' });
                }
                console.log("Données sauvegardées avec succès");
            } catch (error) {
                console.error("Erreur sauvegarde:", error);
                setToast({ message: "Erreur de sauvegarde", type: 'error' });
            }
        }, AUTO_SAVE_DELAY),
        [userId]
    );

    // Chargement des données historiques
    const loadHistoricalData = useCallback(async () => {
        if (!userId) return;
        
        try {
            const historyRef = collection(db, 'users', userId, 'workoutHistory');
            const q = query(historyRef, limit(50));
            const snapshot = await getDocs(q);
            
            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate?.() || new Date(doc.data().date)
            }));
            
            setHistoricalData(history);
            generateStatsData(history);
        } catch (error) {
            console.error("Erreur chargement historique:", error);
        }
    }, [userId]);

    // Génération des statistiques
    const generateStatsData = useCallback((history) => {
        if (history.length === 0) return;
        
        const totalWorkouts = history.length;
        let totalVolume = 0;
        
        history.forEach(workout => {
            if (workout.days) {
                Object.values(workout.days).forEach(day => {
                    if (day.categories) {
                        Object.values(day.categories).forEach(exercises => {
                            if (Array.isArray(exercises)) {
                                exercises.forEach(exercise => {
                                    if (exercise.series) {
                                        exercise.series.forEach(serie => {
                                            const weight = parseFloat(serie.weight) || 0;
                                            const reps = parseFloat(serie.reps) || 0;
                                            totalVolume += weight * reps;
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        
        setStatsData({
            totalWorkouts,
            totalVolume,
            averageVolume: totalVolume / totalWorkouts,
            workoutFrequency: calculateWorkoutFrequency(history),
            progressData: generateProgressData(history)
        });
    }, []);

    // Calculer la fréquence d'entraînement
    const calculateWorkoutFrequency = (history) => {
        if (history.length < 2) return 0;
        
        const sortedDates = history
            .map(w => w.date)
            .sort((a, b) => a - b);
        
        const totalDays = (sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24);
        return totalDays > 0 ? (history.length / totalDays) * 7 : 0;
    };

    // Générer les données de progression
    const generateProgressData = (history) => {
        return history
            .slice(-10)
            .map(workout => {
                let volume = 0;
                if (workout.days) {
                    Object.values(workout.days).forEach(day => {
                        if (day.categories) {
                            Object.values(day.categories).forEach(exercises => {
                                if (Array.isArray(exercises)) {
                                    exercises.forEach(exercise => {
                                        if (exercise.series) {
                                            exercise.series.forEach(serie => {
                                                const weight = parseFloat(serie.weight) || 0;
                                                const reps = parseFloat(serie.reps) || 0;
                                                volume += weight * reps;
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
                return {
                    date: workout.date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
                    volume: volume
                };
            });
    };

    // Sauvegarder l'entraînement dans l'historique
    const saveWorkoutToHistory = useCallback(async () => {
        if (!userId || !workouts.days) return;
        
        try {
            let hasCompletedExercises = false;
            Object.values(workouts.days).forEach(day => {
                if (day.categories) {
                    Object.values(day.categories).forEach(exercises => {
                        if (Array.isArray(exercises)) {
                            exercises.forEach(exercise => {
                                if (exercise.series && exercise.series.length > 0) {
                                    hasCompletedExercises = true;
                                }
                            });
                        }
                    });
                }
            });
            
            if (!hasCompletedExercises) {
                setToast({ message: "Aucun exercice à sauvegarder", type: 'warning' });
                return;
            }
            
            const historyRef = collection(db, 'users', userId, 'workoutHistory');
            let totalVolume = 0;
            
            Object.values(workouts.days).forEach(day => {
                if (day.categories) {
                    Object.values(day.categories).forEach(exercises => {
                        if (Array.isArray(exercises)) {
                            exercises.forEach(exercise => {
                                if (exercise.series) {
                                    exercise.series.forEach(serie => {
                                        const weight = parseFloat(serie.weight) || 0;
                                        const reps = parseFloat(serie.reps) || 0;
                                        totalVolume += weight * reps;
                                    });
                                }
                            });
                        }
                    });
                }
            });
            
            await addDoc(historyRef, {
                ...workouts,
                date: serverTimestamp(),
                totalVolume: totalVolume
            });
            
            setToast({ message: "Entraînement sauvegardé dans l'historique", type: 'success' });
            loadHistoricalData();
        } catch (error) {
            console.error("Erreur sauvegarde historique:", error);
            setToast({ message: "Erreur sauvegarde historique", type: 'error' });
        }
    }, [workouts, userId, loadHistoricalData]);

    // Gestion du minuteur
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

    // Fonction d'application des changements avec undo/redo
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

    const handleSaveExercise = useCallback(() => {
        if (!editingExercise) return;
        
        setIsSavingExercise(true);
        
        const updatedWorkouts = { ...workouts };
        const { day, category, exerciseId } = editingExercise;
        
        const exercises = updatedWorkouts.days?.[day]?.categories?.[category];
        if (!exercises) return;
        
        const exerciseIndex = exercises.findIndex(ex => ex.id === exerciseId);
        if (exerciseIndex === -1) return;
        
        // Mettre à jour le nom si changé
        if (editingExerciseName.trim()) {
            exercises[exerciseIndex].name = editingExerciseName.trim();
        }
        
        // Mettre à jour les séries si spécifiées
        if (newWeight && newSets && newReps) {
            const setsNum = parseInt(newSets);
            exercises[exerciseIndex].series = Array(setsNum).fill(null).map(() => ({
                weight: newWeight.toString(),
                reps: newReps.toString()
            }));
        }
        
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

    // Fonctions de gestion des jours
    const handleAddDay = useCallback((dayName) => {
        const updatedWorkouts = { ...workouts };
        updatedWorkouts.days[dayName] = {
            categories: {},
            categoryOrder: []
        };
        updatedWorkouts.dayOrder = [...(updatedWorkouts.dayOrder || []), dayName];
        
        applyChanges(updatedWorkouts, `Jour "${dayName}" ajouté !`);
    }, [workouts, applyChanges]);

    const handleEditDay = useCallback((oldDayName, newDayName) => {
        const updatedWorkouts = { ...workouts };
        
        // Renommer le jour
        updatedWorkouts.days[newDayName] = updatedWorkouts.days[oldDayName];
        delete updatedWorkouts.days[oldDayName];
        
        // Mettre à jour l'ordre
        const dayIndex = updatedWorkouts.dayOrder.indexOf(oldDayName);
        if (dayIndex !== -1) {
            updatedWorkouts.dayOrder[dayIndex] = newDayName;
        }
        
        // Ajuster le filtre si nécessaire
        if (selectedDayFilter === oldDayName) {
            setSelectedDayFilter(newDayName);
        }
        
        applyChanges(updatedWorkouts, `Jour renommé en "${newDayName}" !`);
    }, [workouts, applyChanges, selectedDayFilter]);

    const handleDeleteDay = useCallback((dayName) => {
        const updatedWorkouts = { ...workouts };
        
        // Supprimer le jour
        delete updatedWorkouts.days[dayName];
        updatedWorkouts.dayOrder = updatedWorkouts.dayOrder.filter(day => day !== dayName);
        
        // Réinitialiser le filtre si nécessaire
        if (selectedDayFilter === dayName) {
            setSelectedDayFilter('');
        }
        
        applyChanges(updatedWorkouts, `Jour "${dayName}" supprimé !`);
    }, [workouts, applyChanges, selectedDayFilter]);

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
       }
    }, [workouts, applyChanges]);

    // Export des données
    const exportData = useCallback(() => {
        setIsExporting(true);
        try {
            const dataToExport = {
                workouts,
                exportDate: new Date().toISOString(),
                version: "2.0"
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
            console.error("Erreur export:", error);
            setToast({ message: "Erreur lors de l'export", type: 'error' });
        } finally {
            setIsExporting(false);
        }
    }, [workouts]);

    // Import des données
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
                console.error("Erreur import:", error);
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
                                if (exercise.series) {
                                    exercise.series.forEach(serie => {
                                        const weight = parseFloat(serie.weight) || 0;
                                        const reps = parseFloat(serie.reps) || 0;
                                        totalVolume += weight * reps;
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
                session.date && session.date >= oneWeekAgo
            ).length;
            
            return {
                totalExercises,
                totalSessions,
                thisWeekSessions,
                totalVolume,
                averageSessionsPerWeek: totalSessions > 0 ? (thisWeekSessions * 52) / totalSessions : 0
            };
        } catch (error) {
            console.error("Erreur calcul statistiques:", error);
            return {
                totalExercises: 0,
                totalSessions: 0,
                thisWeekSessions: 0,
                totalVolume: 0,
                averageSessionsPerWeek: 0
            };
        }
    }, [workouts, historicalData]);

    // Fonctions IA pour suggestions et analyses
    const generateAISuggestions = useCallback(async () => {
        if (!genAI || isLoadingAI) return;
        
        setIsLoadingAI(true);
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5" });
            
            const workoutContext = JSON.stringify(workouts, null, 2);
            const prompt = `
            Analyse ce programme d'entraînement et donne 3-5 suggestions courtes et pratiques pour l'améliorer :
            
            ${workoutContext}
            
            Focus sur :
            - Équilibre musculaire
            - Progression logique
            - Récupération
            - Variété des exercices
            
            Réponds en français avec des suggestions numérotées courtes.
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
            console.error("Erreur IA:", error);
            setToast({ message: "Erreur génération IA", type: 'error' });
        } finally {
            setIsLoadingAI(false);
        }
    }, [workouts, genAI, isLoadingAI]);

    const generateProgressionAnalysis = useCallback(async () => {
        if (!genAI || isLoadingAI || !historicalData.length) return;
        
        setIsLoadingAI(true);
        
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            
            const recentWorkouts = historicalData.slice(-5);
            const context = JSON.stringify(recentWorkouts, null, 2);
            
            const prompt = `
            Analyse ces 5 dernières séances d'entraînement et génère un rapport de progression personnalisé :
            
            ${context}
            
            Inclus :
            1. Tendances de progression (volume, intensité)
            2. Points forts identifiés
            3. Zones d'amélioration
            4. Recommandations spécifiques
            5. Objectifs suggérés pour les prochaines semaines
            
            Formatage : utilise des titres en **gras** et des listes à puces.
            Réponds en français de manière motivante et constructive.
            `;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            setProgressionAnalysisContent(text);
        } catch (error) {
            console.error("Erreur analyse progression:", error);
            setToast({ message: "Erreur analyse progression", type: 'error' });
        } finally {
            setIsLoadingAI(false);
        }
    }, [historicalData, genAI, isLoadingAI]);

    // Filtrage des exercices pour la recherche
    const filteredWorkouts = useMemo(() => {
        if (!workouts.days) return { days: {}, dayOrder: [] };
        
        const filtered = { ...workouts };
        
        Object.keys(filtered.days).forEach(dayName => {
            const day = filtered.days[dayName];
            
            // Filtre par jour
            if (selectedDayFilter && dayName !== selectedDayFilter) {
                delete filtered.days[dayName];
                return;
            }
            
            Object.keys(day.categories).forEach(categoryName => {
                const exercises = day.categories[categoryName];
                
                // Filtre par catégorie
                if (selectedCategoryFilter && categoryName !== selectedCategoryFilter) {
                    delete day.categories[categoryName];
                    return;
                }
                
                // Filtre par recherche et statut
                const filteredExercises = exercises.filter(exercise => {
                    const matchesSearch = !searchTerm || 
                        exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
                    
                    const matchesCompletion = !showOnlyCompleted || 
                        (exercise.series && exercise.series.length > 0);
                    
                    const notDeleted = !exercise.isDeleted;
                    
                    return matchesSearch && matchesCompletion && notDeleted;
                });
                
                if (filteredExercises.length === 0) {
                    delete day.categories[categoryName];
                } else {
                    day.categories[categoryName] = filteredExercises;
                }
            });
            
            // Supprimer le jour s'il n'a plus de catégories
            if (Object.keys(day.categories).length === 0) {
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

    // Gestion du statut en ligne
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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
                    console.log("Aucune donnée trouvée, initialisation avec données de base");
                    setWorkouts(baseInitialData);
                }
            } catch (error) {
                console.error("Erreur traitement données:", error);
                setToast({ message: "Erreur lors du chargement des données", type: 'error' });
                setWorkouts(baseInitialData);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("Erreur Firestore:", error);
            setToast({ message: `Erreur Firestore: ${error.message}`, type: 'error' });
            setLoading(false);
            setWorkouts(baseInitialData);
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
    }, [timerIsRunning, timerSeconds]);

    // Effet pour la sauvegarde automatique
    useEffect(() => {
        if (userId && workouts && Object.keys(workouts.days || {}).length > 0) {
            saveWorkoutsOptimized(workouts);
        }
    }, [workouts, userId, saveWorkoutsOptimized]);

    // Nettoyage lors du démontage
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    // Demander la permission pour les notifications
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Raccourcis clavier
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Ctrl/Cmd + Z pour undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            }
            // Ctrl/Cmd + Shift + Z pour redo
            else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                handleRedo();
            }
            // Ctrl/Cmd + S pour sauvegarder
            else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveWorkoutsOptimized(workouts, "Sauvegarde manuelle effectuée");
            }
            // Ctrl/Cmd + E pour exporter
            else if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                exportData();
            }
            // Ctrl/Cmd + N pour nouvel exercice
            else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (currentView === 'workout') {
                    setShowAddExerciseModal(true);
                }
            }
            // Espace pour minuteur (si vue minuteur active)
            else if (e.key === ' ' && currentView === 'timer') {
                e.preventDefault();
                if (timerIsRunning) {
                    pauseTimer();
                } else {
                    startTimer();
                }
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
    `;

    // Rendu conditionnel pour le chargement
    if (loading || !isAuthReady) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
            <style>{appStyles}</style>
            
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                {/* Indicateur de statut en ligne */}
                {!isOnline && (
                    <div className="bg-yellow-500 text-white px-4 py-2 text-center text-sm">
                        Mode hors ligne - Les données seront synchronisées à la reconnexion
                    </div>
                )}

                {/* En-tête avec navigation et contrôles */}
                <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            {/* Logo et titre */}
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                                    <Dumbbell className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                        FitTracker Pro
                                    </h1>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Votre coach personnel
                                    </p>
                                </div>
                            </div>

                            {/* Navigation principale */}
                            <div className="hidden md:flex items-center space-x-1">
                                {[
                                    { id: 'workout', label: 'Entraînement', icon: Dumbbell },
                                    { id: 'history', label: 'Historique', icon: History },
                                    { id: 'timer', label: 'Minuteur', icon: Clock },
                                    { id: 'stats', label: 'Statistiques', icon: BarChart3 }
                                ].map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => setCurrentView(id)}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                                            currentView === id
                                                ? 'bg-blue-500 text-white shadow-lg'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span className="hidden lg:inline">{label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Contrôles rapides */}
                            <div className="flex items-center space-x-2">
                                {/* Boutons undo/redo */}
                                <div className="hidden sm:flex items-center space-x-1">
                                    <button
                                        onClick={handleUndo}
                                        disabled={undoStack.length === 0}
                                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        title="Annuler (Ctrl+Z)"
                                    >
                                        <Undo2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={handleRedo}
                                        disabled={redoStack.length === 0}
                                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        title="Rétablir (Ctrl+Shift+Z)"
                                    >
                                        <Redo2 className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Bouton paramètres */}
                                <button
                                    onClick={() => setShowSettingsModal(true)}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                    title="Paramètres"
                                >
                                    <Settings className="h-4 w-4" />
                                </button>

                                {/* Bouton mode sombre */}
                                <button
                                    onClick={() => setIsDarkMode(!isDarkMode)}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                    title="Basculer le thème"
                                >
                                    {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contenu principal */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{/* Vue principale basée sur currentView */}
                {currentView === 'workout' && (
                    <div className="space-y-6">
                        {/* Barre de recherche et filtres */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Recherche */}
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher un exercice..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Filtres */}
                                <div className="flex gap-3">
                                    <select
                                        value={selectedDayFilter}
                                        onChange={(e) => setSelectedDayFilter(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Tous les jours</option>
                                        {(workouts.dayOrder || []).map(day => (
                                            <option key={day} value={day}>{day}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={selectedCategoryFilter}
                                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Toutes les catégories</option>
                                        {/* Extraction dynamique des catégories */}
                                        {Array.from(new Set(
                                            Object.values(workouts.days || {}).flatMap(day => 
                                                Object.keys(day.categories || {})
                                            )
                                        )).map(category => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>

                                    <button
                                        onClick={() => setShowOnlyCompleted(!showOnlyCompleted)}
                                        className={`px-4 py-2 rounded-lg border transition-all ${
                                            showOnlyCompleted
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        <Filter className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Actions rapides */}
                            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={() => setShowAddExerciseModal(true)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Ajouter exercice</span>
                                </button>

                                <button
                                    onClick={saveWorkoutToHistory}
                                    className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Terminer séance</span>
                                </button>

                                <button
                                    onClick={generateAISuggestions}
                                    disabled={isLoadingAI}
                                    className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-all"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    <span>{isLoadingAI ? 'Génération...' : 'Suggestions IA'}</span>
                                </button>
                            </div>

                            {/* Suggestions IA */}
                            {aiSuggestions.length > 0 && (
                                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4" />
                                        Suggestions IA
                                    </h4>
                                    <ul className="space-y-1 text-sm text-purple-800 dark:text-purple-200">
                                        {aiSuggestions.map((suggestion, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <span className="text-purple-500 mt-0.5">•</span>
                                                <span>{suggestion}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        onClick={() => setAiSuggestions([])}
                                        className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                                    >
                                        Masquer les suggestions
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Liste des exercices */}
                        <div className="space-y-6">
                            {(filteredWorkouts.dayOrder || []).map(dayName => {
                                const day = filteredWorkouts.days[dayName];
                                if (!day || Object.keys(day.categories).length === 0) return null;

                                return (
                                    <div key={dayName} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                                    <Calendar className="h-5 w-5 text-blue-500" />
                                                    {dayName}
                                                </h2>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const newName = prompt('Nouveau nom du jour:', dayName);
                                                            if (newName && newName !== dayName) {
                                                                handleEditDay(dayName, newName);
                                                            }
                                                        }}
                                                        className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
                                                        title="Renommer le jour"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Supprimer le jour "${dayName}" ?`)) {
                                                                handleDeleteDay(dayName);
                                                            }
                                                        }}
                                                        className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                                                        title="Supprimer le jour"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 space-y-6">
                                            {Object.entries(day.categories).map(([categoryName, exercises]) => (
                                                <div key={categoryName} className="space-y-4">
                                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                        <Target className="h-4 w-4 text-green-500" />
                                                        {categoryName}
                                                        <span className="text-sm text-gray-500 ml-2">
                                                            ({exercises.filter(ex => !ex.isDeleted).length} exercices)
                                                        </span>
                                                    </h3>

                                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                        {exercises.filter(ex => !ex.isDeleted).map(exercise => (
                                                            <div
                                                                key={exercise.id}
                                                                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all"
                                                            >
                                                                <div className="flex items-start justify-between mb-3">
                                                                    <h4 className="font-medium text-gray-900 dark:text-white">
                                                                        {exercise.name}
                                                                    </h4>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingExercise({
                                                                                    day: dayName,
                                                                                    category: categoryName,
                                                                                    exerciseId: exercise.id
                                                                                });
                                                                                setEditingExerciseName(exercise.name);
                                                                            }}
                                                                            className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                                                                            title="Modifier"
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setItemToDelete({
                                                                                    type: 'exercise',
                                                                                    day: dayName,
                                                                                    category: categoryName,
                                                                                    exerciseId: exercise.id,
                                                                                    name: exercise.name
                                                                                });
                                                                                setShowDeleteConfirm(true);
                                                                            }}
                                                                            className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                                                                            title="Supprimer"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {exercise.series?.map((serie, serieIndex) => (
                                                                        <div
                                                                            key={serieIndex}
                                                                            className="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded text-sm"
                                                                        >
                                                                            <span className="text-gray-600 dark:text-gray-300">
                                                                                Série {serieIndex + 1}
                                                                            </span>
                                                                            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                                                                                <span>{serie.weight}kg</span>
                                                                                <span className="text-gray-400">×</span>
                                                                                <span>{serie.reps}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Bouton de minuteur pour les séries */}
                                                                <button
                                                                    onClick={() => startTimer(90)} // 90 secondes par défaut
                                                                    className="w-full mt-3 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Clock className="h-4 w-4" />
                                                                    Repos (1:30)
                                                                </button>

                                                                {exercise.notes && (
                                                                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
                                                                        <NotebookText className="h-3 w-3 inline mr-1" />
                                                                        {exercise.notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Message si aucun exercice trouvé */}
                            {Object.keys(filteredWorkouts.days).length === 0 && (
                                <div className="text-center py-12">
                                    <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        Aucun exercice trouvé
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                                        {searchTerm || selectedDayFilter || selectedCategoryFilter
                                            ? "Aucun exercice ne correspond à vos filtres."
                                            : "Commencez par ajouter votre premier exercice !"}
                                    </p>
                                    <button
                                        onClick={() => setShowAddExerciseModal(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Ajouter un exercice
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Vue Historique */}
                {currentView === 'history' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                    <History className="h-6 w-6 text-blue-500" />
                                    Historique des séances
                                </h2>
                                <button
                                    onClick={generateProgressionAnalysis}
                                    disabled={isLoadingAI || historicalData.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-all"
                                >
                                    <TrendingUp className="h-4 w-4" />
                                    Analyser progression
                                </button>
                            </div>

                            {historicalData.length === 0 ? (
                                <div className="text-center py-12">
                                    <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        Aucune séance enregistrée
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Terminez votre première séance pour voir l'historique !
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historicalData.slice(0, 10).map((session, index) => (
                                        <div
                                            key={session.id}
                                            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                                                        <span className="text-white font-bold text-sm">
                                                            {index + 1}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-gray-900 dark:text-white">
                                                            Séance du {formatDate(session.date)}
                                                        </h3>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                                            Volume total: {session.totalVolume?.toLocaleString() || 0} kg
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Restaurer cette séance dans votre programme actuel ?')) {
                                                            applyChanges(session, 'Séance restaurée !');
                                                        }
                                                    }}
                                                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-all"
                                                >
                                                    Restaurer
                                                </button>
                                            </div>

                                            {/* Aperçu des exercices de la séance */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                                                {Object.entries(session.days || {}).map(([dayName, day]) =>
                                                    Object.entries(day.categories || {}).map(([categoryName, exercises]) =>
                                                        exercises.filter(ex => !ex.isDeleted).map(exercise => (
                                                            <div
                                                                key={exercise.id}
                                                                className="bg-gray-50 dark:bg-gray-700 rounded p-2"
                                                            >
                                                                <span className="font-medium text-gray-900 dark:text-white">
                                                                    {exercise.name}
                                                                </span>
                                                                <div className="text-gray-600 dark:text-gray-400">
                                                                    {exercise.series?.length || 0} séries
                                                                </div>
                                                            </div>
                                                        ))
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Vue Minuteur */}
                {currentView === 'timer' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 flex items-center justify-center gap-3">
                                    <Clock className="h-6 w-6 text-blue-500" />
                                    Minuteur de repos
                                </h2>

                                {/* Affichage du temps */}
                                <div className={`text-8xl font-mono font-bold mb-8 transition-colors ${
                                    timerIsFinished 
                                        ? 'text-green-500 animate-pulse' 
                                        : timerIsRunning 
                                            ? 'text-blue-500' 
                                            : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                    {formatTime(timerSeconds)}
                                </div>

                                {/* Message d'état */}
                                <div className="mb-8">
                                    {timerIsFinished && (
                                        <div className="text-green-500 font-medium text-lg mb-4">
                                            ✅ Temps de repos terminé !
                                        </div>
                                    )}
                                    {timerIsRunning && !timerIsFinished && (
                                        <div className="text-blue-500 font-medium">
                                            ⏱️ Minuteur en cours...
                                        </div>
                                    )}
                                    {!timerIsRunning && !timerIsFinished && timerSeconds === 0 && (
                                        <div className="text-gray-500 dark:text-gray-400">
                                            Choisissez un temps de repos
                                        </div>
                                    )}
                                </div>

                                {/* Contrôles du minuteur */}
                                <div className="flex items-center justify-center gap-4 mb-8">
                                    <button
                                        onClick={() => timerIsRunning ? pauseTimer() : startTimer()}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                                            timerIsRunning
                                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                                        }`}
                                    >
                                        {timerIsRunning ? (
                                            <>
                                                <Pause className="h-5 w-5" />
                                                Pause
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-5 w-5" />
                                                {timerSeconds > 0 ? 'Reprendre' : 'Démarrer'}
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={resetTimer}
                                        className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
                                    >
                                        <RotateCcw className="h-5 w-5" />
                                        Reset
                                    </button>
                                </div>

                                {/* Temps prédéfinis */}
                                <div className="mb-6">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                        Temps prédéfinis
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: '30s', seconds: 30 },
                                            { label: '1min', seconds: 60 },
                                            { label: '1min30', seconds: 90 },
                                            { label: '2min', seconds: 120 },
                                            { label: '3min', seconds: 180 },
                                            { label: '4min', seconds: 240 },
                                            { label: '5min', seconds: 300 },
                                            { label: '10min', seconds: 600 }
                                        ].map(({ label, seconds }) => (
                                            <button
                                                key={seconds}
                                                onClick={() => startTimer(seconds)}
                                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Minuteur personnalisé */}
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                        Temps personnalisé
                                    </h3>
                                    <div className="flex items-center justify-center gap-3">
                                        <input
                                            type="number"
                                            min="1"
                                            max="60"
                                            value={customTimerMinutes}
                                            onChange={(e) => setCustomTimerMinutes(parseInt(e.target.value) || 1)}
                                            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                        <span className="text-gray-600 dark:text-gray-400">minutes</span>
                                        <button
                                            onClick={() => startTimer(customTimerMinutes * 60)}
                                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all"
                                        >
                                            Démarrer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Vue Statistiques */}
                {currentView === 'stats' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                                <BarChart3 className="h-6 w-6 text-blue-500" />
                                Statistiques d'entraînement
                            </h2>

                            {!statsData || historicalData.length === 0 ? (
                                <div className="text-center py-12">
                                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        Pas encore de statistiques
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Terminez quelques séances pour voir vos statistiques !
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Métriques principales */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-blue-100 text-sm">Total séances</p>
                                                    <p className="text-2xl font-bold">{statsData.totalWorkouts}</p>
                                                </div>
                                                <Award className="h-8 w-8 text-blue-200" />
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-green-100 text-sm">Volume total</p>
                                                    <p className="text-2xl font-bold">{statsData.totalVolume.toLocaleString()}</p>
                                                    <p className="text-green-100 text-xs">kg</p>
                                                </div>
                                                <TrendingUp className="h-8 w-8 text-green-200" />
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-purple-100 text-sm">Fréquence</p>
                                                    <p className="text-2xl font-bold">{statsData.workoutFrequency.toFixed(1)}</p>
                                                    <p className="text-purple-100 text-xs">séances/semaine</p>
                                                </div>
                                                <Activity className="h-8 w-8 text-purple-200" />
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-orange-100 text-sm">Volume moyen</p>
                                                    <p className="text-2xl font-bold">{Math.round(statsData.averageVolume).toLocaleString()}</p>
                                                    <p className="text-orange-100 text-xs">kg/séance</p>
                                                </div>
                                                <Target className="h-8 w-8 text-orange-200" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Graphique de progression */}
                                    {statsData.progressData && statsData.progressData.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                                Évolution du volume d'entraînement
                                            </h3>
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={statsData.progressData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                                        <XAxis 
                                                            dataKey="date" 
                                                            stroke="#6B7280"
                                                            fontSize={12}
                                                        />
                                                        <YAxis 
                                                            stroke="#6B7280"
                                                            fontSize={12}
                                                        />
                                                        <Tooltip 
                                                            contentStyle={{
                                                                backgroundColor: '#1F2937',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                color: '#F9FAFB'
                                                            }}
                                                        />
                                                        <Line 
                                                            type="monotone" 
                                                            dataKey="volume" 
                                                            stroke="#3B82F6" 
                                                            strokeWidth={3}
                                                            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                                                            activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

                {/* Minuteur flottant */}
                {(timerIsRunning || timerIsFinished) && currentView !== 'timer' && (
                    <div className="fixed top-20 right-4 z-50">
                        <div className={`
                            px-4 py-3 rounded-lg shadow-lg border transition-all
                            ${timerIsFinished 
                                ? 'bg-green-500 text-white animate-pulse border-green-400' 
                                : 'bg-blue-500 text-white border-blue-400'
                            }
                        `}>
                            <div className="flex items-center space-x-3">
                                <Clock className="h-4 w-4" />
                                <span className="font-mono text-lg font-bold">{formatTime(timerSeconds)}</span>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => timerIsRunning ? pauseTimer() : startTimer()}
                                        className="hover:bg-white/20 rounded p-1 transition-colors"
                                        title={timerIsRunning ? "Pause" : "Reprendre"}
                                    >
                                        {timerIsRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    </button>
                                    <button 
                                        onClick={resetTimer}
                                        className="hover:bg-white/20 rounded p-1 transition-colors"
                                        title="Reset"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            {timerIsFinished && (
                                <div className="text-center text-sm mt-1 font-medium">
                                    Repos terminé !
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Navigation mobile */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
                    <div className="flex items-center justify-around">
                        {[
                            { id: 'workout', label: 'Exercices', icon: Dumbbell },
                            { id: 'history', label: 'Historique', icon: History },
                            { id: 'timer', label: 'Minuteur', icon: Clock },
                            { id: 'stats', label: 'Stats', icon: BarChart3 }
                        ].map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setCurrentView(id)}
                                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                                    currentView === id
                                        ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                <Icon className="h-5 w-5" />
                                <span className="text-xs">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modales */}
            
            {/* Modale d'ajout d'exercice */}
            {showAddExerciseModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-blue-500" />
                                    Nouvel exercice
                                </h3>
                                <button
                                    onClick={() => setShowAddExerciseModal(false)}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Nom de l'exercice *
                                    </label>
                                    <input
                                        type="text"
                                        value={newExerciseName}
                                        onChange={(e) => setNewExerciseName(e.target.value)}
                                        placeholder="Ex: Développé couché"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Jour
                                        </label>
                                        <select
                                            value={selectedDayForAdd}
                                            onChange={(e) => setSelectedDayForAdd(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Sélectionner</option>
                                            {(workouts.dayOrder || []).map(day => (
                                                <option key={day} value={day}>{day}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Catégorie
                                        </label>
                                        <select
                                            value={selectedCategoryForAdd}
                                            onChange={(e) => setSelectedCategoryForAdd(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Sélectionner</option>
                                            {selectedDayForAdd && workouts.days[selectedDayForAdd] ? 
                                                Object.keys(workouts.days[selectedDayForAdd].categories || {}).map(category => (
                                                    <option key={category} value={category}>{category}</option>
                                                )) : null
                                            }
                                            <option value="__new__">+ Nouvelle catégorie</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Poids (kg)
                                        </label>
                                        <input
                                            type="number"
                                            value={newWeight}
                                            onChange={(e) => setNewWeight(e.target.value)}
                                            placeholder="80"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Séries
                                        </label>
                                        <input
                                            type="number"
                                            value={newSets}
                                            onChange={(e) => setNewSets(e.target.value)}
                                            placeholder="3"
                                            min="1"
                                            max="10"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Répétitions
                                        </label>
                                        <input
                                            type="number"
                                            value={newReps}
                                            onChange={(e) => setNewReps(e.target.value)}
                                            placeholder="10"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddExerciseModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAddExercise}
                                    disabled={isAddingExercise || !newExerciseName.trim()}
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

            {/* Modale d'édition d'exercice */}
            {editingExercise && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Pencil className="h-5 w-5 text-blue-500" />
                                    Modifier l'exercice
                                </h3>
                                <button
                                    onClick={() => setEditingExercise(null)}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Nom de l'exercice
                                    </label>
                                    <input
                                        type="text"
                                        value={editingExerciseName}
                                        onChange={(e) => setEditingExerciseName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Nouveau poids
                                        </label>
                                        <input
                                            type="number"
                                            value={newWeight}
                                            onChange={(e) => setNewWeight(e.target.value)}
                                            placeholder="80"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Nouvelles séries
                                        </label>
                                        <input
                                            type="number"
                                            value={newSets}
                                            onChange={(e) => setNewSets(e.target.value)}
                                            placeholder="3"
                                            min="1"
                                            max="10"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Nouvelles reps
                                        </label>
                                        <input
                                            type="number"
                                            value={newReps}
                                            onChange={(e) => setNewReps(e.target.value)}
                                            placeholder="10"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                    💡 Laissez les champs vides pour ne modifier que le nom
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setEditingExercise(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSaveExercise}
                                    disabled={isSavingExercise}
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
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto scrollbar-thin">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-blue-500" />
                                    Paramètres
                                </h3>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Thème */}
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                                        Apparence
                                    </h4>
                                    <button
                                        onClick={() => setIsDarkMode(!isDarkMode)}
                                        className={`w-full p-3 rounded-lg border transition-all ${
                                            isDarkMode 
                                                ? 'bg-gray-700 border-gray-600 text-white' 
                                                : 'bg-white border-gray-300 text-gray-900'
                                        } hover:shadow-md`}
                                    >
                                        {isDarkMode ? '🌙 Mode sombre activé' : '☀️ Mode clair activé'}
                                    </button>
                                </div>

                                {/* Notifications */}
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Zap className="h-5 w-5" />
                                        Notifications
                                    </h4>
                                    <button
                                        onClick={requestPermission}
                                        className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:shadow-md transition-all"
                                    >
                                        🔔 Activer les notifications
                                    </button>
                                </div>

                                {/* Sauvegarde et restauration */}
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Download className="h-5 w-5" />
                                        Sauvegarde & Restauration
                                    </h4>
                                    
                                    <div className="space-y-3">
                                        <button
                                            onClick={exportData}
                                            disabled={isExporting}
                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isExporting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Export en cours...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4" />
                                                    Exporter mes données
                                                </>
                                            )}
                                        </button>
                                        
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isImporting}
                                            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isImporting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Import en cours...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="h-4 w-4" />
                                                    Importer des données
                                                </>
                                            )}
                                        </button>
                                        
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".json"
                                            onChange={importData}
                                            className="hidden"
                                        />
                                    </div>
                                </div>

                                {/* Raccourcis clavier */}
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                        ⌨️ Raccourcis clavier
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                            <span className="text-gray-700 dark:text-gray-300">Annuler</span>
                                            <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Ctrl+Z</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                            <span className="text-gray-700 dark:text-gray-300">Rétablir</span>
                                            <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Ctrl+Shift+Z</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                            <span className="text-gray-700 dark:text-gray-300">Sauvegarder</span>
                                            <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Ctrl+S</kbd>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                            <span className="text-gray-700 dark:text-gray-300">Nouvel exercice</span>
                                            <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">Ctrl+N</kbd>
                                        </div>
                                    </div>
                                </div>

                                {/* Statistiques rapides */}
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                                        📊 Aperçu rapide
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                                            <div className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                                                {getWorkoutStats().totalExercises}
                                            </div>
                                            <div className="text-blue-600 dark:text-blue-400">Exercices</div>
                                        </div>
                                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                                            <div className="text-green-600 dark:text-green-400 font-bold text-lg">
                                                {getWorkoutStats().totalSessions}
                                            </div>
                                            <div className="text-green-600 dark:text-green-400">Séances</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modale de confirmation de suppression */}
            {showDeleteConfirm && itemToDelete && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                                    <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Confirmer la suppression
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Cette action ne peut pas être annulée
                                    </p>
                                </div>
                            </div>

                            <p className="text-gray-700 dark:text-gray-300 mb-6">
                                Êtes-vous sûr de vouloir supprimer "{itemToDelete.name}" ?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setItemToDelete(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => {
                                        if (itemToDelete.type === 'exercise') {
                                            handleDeleteExercise(
                                                itemToDelete.day, 
                                                itemToDelete.category, 
                                                itemToDelete.exerciseId
                                            );
                                        }
                                    }}
                                    disabled={isDeletingExercise}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                                        isDeletingExercise
                                            ? 'bg-red-500/50 text-white cursor-wait'
                                            : 'bg-red-500 text-white hover:bg-red-600'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isDeletingExercise ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Suppression...
                                        </div>
                                    ) : (
                                        'Supprimer'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modale d'analyse de progression */}
            {progressionAnalysisContent && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto scrollbar-thin">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                    <TrendingUp className="h-6 w-6 text-purple-500" />
                                    Analyse de progression IA
                                </h3>
                                <button
                                    onClick={() => setProgressionAnalysisContent('')}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="prose prose-gray dark:prose-invert max-w-none">
                                <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                                    {progressionAnalysisContent}
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                <p className="text-sm text-purple-800 dark:text-purple-200">
                                    ⚠️ Cette analyse est générée par IA et est à titre indicatif uniquement. 
                                    Consultez un professionnel pour un programme personnalisé.
                                </p>
                            </div>

                            <button
                                onClick={() => setProgressionAnalysisContent('')}
                                className="w-full mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all"
                            >
                                Fermer l'analyse
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast notifications */}
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default ImprovedWorkoutApp;