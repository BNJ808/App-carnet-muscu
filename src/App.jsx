import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection, query, limit, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
    Undo2, Redo2, Settings, XCircle, ChevronDown, ChevronUp, Pencil, Sparkles, ArrowUp, ArrowDown,
    Plus, Trash2, Play, Pause, RotateCcw, Search, Filter, Dumbbell, Clock, History, NotebookText,
    LineChart as LineChartIcon, Target, TrendingUp, Award, Calendar, BarChart3, Moon, Sun,
    Zap, Download, Upload, Share, Eye, EyeOff, Maximize2, Minimize2, Activity, CheckCircle
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import des composants séparés. Veuillez vous assurer que ces fichiers (.jsx) sont tous dans le même répertoire que App.jsx
import Toast from './Toast.jsx';
import MainWorkoutView from './MainWorkoutView.jsx';
import HistoryView from './HistoryView.jsx';
import TimerView from './TimerView.jsx';
import BottomNavigationBar from './BottomNavigationBar.jsx';
import StatsView from './StatsView.jsx';

// Import des services Firebase depuis firebase.js
import { auth, db } from './firebase.js';

// Initialisation de l'API Google Generative AI
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
let genAI;
let geminiModel;
if (API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(API_KEY);
        geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    } catch (error) {
        console.error("Erreur d'initialisation de GoogleGenerativeAI:", error);
    }
} else {
    console.warn("VITE_GEMINI_API_KEY n'est pas défini. L'analyse IA ne sera pas disponible.");
}

// Fonction utilitaire pour formater le temps
const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const ImprovedWorkoutApp = () => {
    const [user, setUser] = useState(null);
    const [workouts, setWorkouts] = useState({ days: {}, dayOrder: [] });
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [currentView, setCurrentView] = useState('workout'); // 'workout', 'timer', 'history', 'stats'
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [isCompactView, setIsCompactView] = useState(false);
    const [theme, setTheme] = useState('dark'); // 'dark' or 'light'
    const [showSettings, setShowSettings] = useState(false);
    const [toast, setToast] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isSavingExercise, setIsSavingExercise] = useState(false);
    const [isDeletingExercise, setIsDeletingExercise] = useState(false);
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const timerIntervalRef = useRef(null);
    const [restTimeInput, setRestTimeInput] = useState('90'); // Default to 90 seconds
    const [showProgressionGraph, setShowProgressionGraph] = useState(false);
    const [progressionGraphExercise, setProgressionGraphExercise] = useState(null);
    const [globalNotes, setGlobalNotes] = useState('');
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);

    // Initialisation Firebase Auth et Firestore
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                console.log("Connecté anonymement:", currentUser.uid);
                // Charger les données de l'utilisateur
                const userDocRef = doc(db, 'users', currentUser.uid);
                onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setWorkouts(data.workouts || { days: {}, dayOrder: [] });
                        setHistoricalData(Array.isArray(data.historicalData) ? data.historicalData : []);
                        setIsAdvancedMode(data.settings?.isAdvancedMode || false);
                        setIsCompactView(data.settings?.isCompactView || false);
                        setTheme(data.settings?.theme || 'dark');
                        setRestTimeInput(data.settings?.restTimeInput || '90');
                        setGlobalNotes(data.globalNotes || '');
                        console.log("Données utilisateur chargées.");
                    } else {
                        // Créer un document utilisateur si inexistant
                        setDoc(userDocRef, {
                            workouts: { days: {}, dayOrder: [] },
                            historicalData: [],
                            settings: {
                                isAdvancedMode: false,
                                isCompactView: false,
                                theme: 'dark',
                                restTimeInput: '90'
                            },
                            globalNotes: ''
                        }, { merge: true }).then(() => {
                            console.log("Nouveau document utilisateur créé.");
                        }).catch(error => {
                            console.error("Erreur lors de la création du document utilisateur:", error);
                            showToast('Erreur lors de la création du profil utilisateur.', 'error');
                        });
                    }
                });
            } else {
                console.log("Utilisateur déconnecté, connexion anonyme...");
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Erreur de connexion anonyme ou par token:", error);
                    showToast(`Erreur de connexion: ${error.message}`, 'error');
                }
            }
        });

        return () => unsubscribe();
    }, []);

    // Sauvegarde des données Firebase
    const saveUserData = useCallback(async (dataToSave, message = "Données sauvegardées !") => {
        if (!user) {
            console.warn("Utilisateur non authentifié, impossible de sauvegarder.");
            return;
        }
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, dataToSave, { merge: true });
            showToast(message, 'success');
        } catch (error) {
            console.error("Erreur lors de la sauvegarde des données:", error);
            showToast(`Erreur de sauvegarde: ${error.message}`, 'error');
        }
    }, [user]);

    useEffect(() => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        // Sauvegarder le thème dans les settings utilisateur
        if (user) {
            saveUserData({ settings: { theme: theme } }, "Thème mis à jour.");
        }
    }, [theme, user, saveUserData]);

    // Calcul des meilleurs records personnels
    useEffect(() => {
        const calculatePersonalBests = () => {
            const pbs = {};
            if (Array.isArray(historicalData)) {
                historicalData.forEach(session => {
                    if (session?.exercises && Array.isArray(session.exercises)) {
                        session.exercises.forEach(exercise => {
                            if (exercise?.name && exercise?.series && Array.isArray(exercise.series)) {
                                if (!pbs[exercise.name]) {
                                    pbs[exercise.name] = { maxWeight: 0, maxReps: 0, maxVolume: 0 };
                                }
                                exercise.series.forEach(series => {
                                    if (series && typeof series === 'object') {
                                        const volume = (series.weight || 0) * (series.reps || 0);
                                        if ((series.weight || 0) > pbs[exercise.name].maxWeight) {
                                            pbs[exercise.name].maxWeight = series.weight || 0;
                                        }
                                        if ((series.reps || 0) > pbs[exercise.name].maxReps) {
                                            pbs[exercise.name].maxReps = series.reps || 0;
                                        }
                                        if (volume > pbs[exercise.name].maxVolume) {
                                            pbs[exercise.name].maxVolume = volume;
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            }
            setPersonalBests(pbs);
        };
        calculatePersonalBests();
    }, [historicalData]);

    // Fonctions de gestion du minuteur
    const startTimer = useCallback(() => {
        if (!timerIsRunning && timerSeconds > 0) {
            setTimerIsRunning(true);
            setTimerIsFinished(false);
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds((prevSeconds) => {
                    if (prevSeconds <= 1) {
                        clearInterval(timerIntervalRef.current);
                        setTimerIsRunning(false);
                        setTimerIsFinished(true);
                        showToast('Temps de repos terminé !', 'info');
                        return 0;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        }
    }, [timerIsRunning, timerSeconds]);

    const pauseTimer = useCallback(() => {
        clearInterval(timerIntervalRef.current);
        setTimerIsRunning(false);
    }, []);

    const resetTimer = useCallback(() => {
        clearInterval(timerIntervalRef.current);
        setTimerIsRunning(false);
        setTimerIsFinished(false);
        setTimerSeconds(parseInt(restTimeInput, 10) || 0);
    }, [restTimeInput]);

    const setTimerPreset = useCallback((preset) => {
        setRestTimeInput(String(preset));
        setTimerSeconds(preset);
        clearInterval(timerIntervalRef.current);
        setTimerIsRunning(false);
        setTimerIsFinished(false);
        if (user) {
            saveUserData({ settings: { restTimeInput: String(preset) } }, "Temps de repos mis à jour.");
        }
    }, [user, saveUserData]);

    useEffect(() => {
        // Mettre à jour le timerSeconds lorsque restTimeInput change (ex: via les settings)
        setTimerSeconds(parseInt(restTimeInput, 10) || 0);
    }, [restTimeInput]);

    // Fonctions utilitaires
    const showToast = useCallback((message, type = 'info', action = null, duration = 3000) => {
        setToast({ message, type, action, duration });
    }, []);

    const clearToast = useCallback(() => {
        setToast(null);
    }, []);

    const formatDate = useCallback((timestamp) => {
        if (!timestamp) return 'N/A';
        let date;
        // Firebase Timestamp object has toDate() method
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            // If it's a string or number, assume it's already a valid date string or milliseconds
            date = new Date(timestamp);
        } else {
            return 'N/A'; // Invalid timestamp format
        }

        if (isNaN(date.getTime())) {
            return 'Date invalide';
        }

        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('fr-FR', options);
    }, []);

    const getSeriesDisplay = useCallback((series) => {
        if (!series || !Array.isArray(series)) return '';
        const displaySeries = series.map(s => {
            const weight = s?.weight !== undefined && s?.weight !== null ? `${s.weight} kg` : 'N/A';
            const reps = s?.reps !== undefined && s?.reps !== null ? `${s.reps} reps` : 'N/A';
            return `${weight} x ${reps}`;
        });
        return displaySeries.join(', ');
    }, []);

    const getDayButtonColors = useCallback((dayName) => {
        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-red-500'];
        const index = (dayName || '').length % colors.length;
        return colors[index];
    }, []);

    // Fonctions de gestion des entraînements (passées aux vues)
    const handleAddDay = useCallback(async (newDayName) => {
        if (!user || !newDayName?.trim()) return;
        setLoadingMessage('Ajout du jour...');
        try {
            const updatedWorkouts = { ...workouts };
            if (!updatedWorkouts.days) updatedWorkouts.days = {};
            if (!updatedWorkouts.dayOrder) updatedWorkouts.dayOrder = [];

            if (updatedWorkouts.dayOrder.includes(newDayName)) {
                showToast('Ce jour existe déjà !', 'warning');
                return;
            }

            updatedWorkouts.days[newDayName] = { categories: {} };
            updatedWorkouts.dayOrder.push(newDayName);
            await saveUserData({ workouts: updatedWorkouts }, "Jour d'entraînement ajouté !");
            setWorkouts(updatedWorkouts);
        } finally {
            setLoadingMessage('');
        }
    }, [user, workouts, saveUserData, showToast]);

    const handleEditDay = useCallback(async (oldDayName, newDayName) => {
        if (!user || !newDayName?.trim() || oldDayName === newDayName) return;
        setLoadingMessage('Modification du jour...');
        try {
            const updatedWorkouts = { ...workouts };
            if (updatedWorkouts.dayOrder?.includes(newDayName)) {
                showToast('Un jour avec ce nom existe déjà !', 'warning');
                return;
            }

            const oldDayData = updatedWorkouts.days?.[oldDayName];
            if (oldDayData) {
                delete updatedWorkouts.days[oldDayName];
                updatedWorkouts.days[newDayName] = oldDayData;

                const dayIndex = updatedWorkouts.dayOrder?.indexOf(oldDayName);
                if (dayIndex > -1) {
                    updatedWorkouts.dayOrder[dayIndex] = newDayName;
                }

                await saveUserData({ workouts: updatedWorkouts }, "Jour d'entraînement modifié !");
                setWorkouts(updatedWorkouts);
            }
        } finally {
            setLoadingMessage('');
        }
    }, [user, workouts, saveUserData, showToast]);

    const handleDeleteDay = useCallback(async (dayName) => {
        if (!user) return;
        setLoadingMessage('Suppression du jour...');
        try {
            const updatedWorkouts = { ...workouts };
            const exercisesToMarkDeleted = [];

            // Mark all exercises within the day as deleted
            if (updatedWorkouts.days?.[dayName]?.categories) {
                Object.values(updatedWorkouts.days[dayName].categories).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(exercise => {
                            if (exercise?.id) {
                                exercisesToMarkDeleted.push(exercise.id);
                                exercise.isDeleted = true; // Mark as deleted in current state
                            }
                        });
                    }
                });
            }

            delete updatedWorkouts.days[dayName];
            updatedWorkouts.dayOrder = (updatedWorkouts.dayOrder || []).filter(name => name !== dayName);

            // Also mark as deleted in historical data for reactivation
            const updatedHistoricalData = (historicalData || []).map(session => {
                const newExercises = (session?.exercises || []).map(ex => {
                    if (exercisesToMarkDeleted.includes(ex?.id)) {
                        return { ...ex, isDeleted: true };
                    }
                    return ex;
                });
                return { ...session, exercises: newExercises };
            });

            await saveUserData({ workouts: updatedWorkouts, historicalData: updatedHistoricalData }, "Jour d'entraînement supprimé !");
            setWorkouts(updatedWorkouts);
            setHistoricalData(updatedHistoricalData);
        } finally {
            setLoadingMessage('');
        }
    }, [user, workouts, historicalData, saveUserData, showToast]);

    const handleAddExerciseClick = useCallback(async (dayName, categoryName, newExerciseName) => {
        if (!user || !dayName || !categoryName || !newExerciseName?.trim()) return;
        setIsAddingExercise(true);
        try {
            const updatedWorkouts = { ...workouts };
            if (!updatedWorkouts.days?.[dayName]) {
                updatedWorkouts.days[dayName] = { categories: {} };
            }
            if (!updatedWorkouts.days[dayName].categories[categoryName]) {
                updatedWorkouts.days[dayName].categories[categoryName] = [];
            }
            const newExercise = {
                id: `ex-${Date.now()}`,
                name: newExerciseName.trim(),
                series: [{ weight: 0, reps: 0, completed: false, id: `s-${Date.now()}-1` }],
                notes: '',
                isDeleted: false,
                createdAt: serverTimestamp()
            };
            updatedWorkouts.days[dayName].categories[categoryName].push(newExercise);
            await saveUserData({ workouts: updatedWorkouts }, "Exercice ajouté !");
            setWorkouts(updatedWorkouts);
        } finally {
            setIsAddingExercise(false);
        }
    }, [user, workouts, saveUserData]);

    const handleEditClick = useCallback(async (dayName, categoryName, exerciseId, updatedExercise) => {
        if (!user) return;
        setIsSavingExercise(true);
        try {
            const updatedWorkouts = { ...workouts };
            const exercises = updatedWorkouts.days?.[dayName]?.categories?.[categoryName];
            if (Array.isArray(exercises)) {
                const exerciseIndex = exercises.findIndex(ex => ex?.id === exerciseId);
                if (exerciseIndex > -1) {
                    updatedWorkouts.days[dayName].categories[categoryName][exerciseIndex] = { 
                        ...updatedWorkouts.days[dayName].categories[categoryName][exerciseIndex],
                        ...updatedExercise 
                    };
                    await saveUserData({ workouts: updatedWorkouts }, "Exercice mis à jour !");
                    setWorkouts(updatedWorkouts);
                }
            }
        } finally {
            setIsSavingExercise(false);
        }
    }, [user, workouts, saveUserData]);

    const handleDeleteExercise = useCallback(async (dayName, categoryName, exerciseId) => {
        if (!user) return;
        setIsDeletingExercise(true);
        try {
            const updatedWorkouts = { ...workouts };
            let exerciseToDelete = null;

            const exercises = updatedWorkouts.days?.[dayName]?.categories?.[categoryName];
            if (Array.isArray(exercises)) {
                updatedWorkouts.days[dayName].categories[categoryName] = exercises.map(ex => {
                    if (ex?.id === exerciseId) {
                        exerciseToDelete = { ...ex, isDeleted: true };
                        return exerciseToDelete;
                    }
                    return ex;
                });
            }

            // If the exercise was found and marked for deletion, update historical data
            if (exerciseToDelete) {
                const updatedHistoricalData = (historicalData || []).map(session => {
                    const newExercises = (session?.exercises || []).map(ex => {
                        if (ex?.id === exerciseId) {
                            return { ...ex, isDeleted: true };
                        }
                        return ex;
                    });
                    return { ...session, exercises: newExercises };
                });
                await saveUserData({ workouts: updatedWorkouts, historicalData: updatedHistoricalData }, "Exercice supprimé !");
                setHistoricalData(updatedHistoricalData);
            } else {
                await saveUserData({ workouts: updatedWorkouts }, "Exercice supprimé !");
            }
            setWorkouts(updatedWorkouts);
        } finally {
            setIsDeletingExercise(false);
        }
    }, [user, workouts, historicalData, saveUserData]);

    const handleReactivateExercise = useCallback(async (exerciseId) => {
        if (!user) return;
        setLoadingMessage('Réactivation de l\'exercice...');
        try {
            const updatedWorkouts = { ...workouts };
            let foundInWorkouts = false;

            // Check and reactivate in current workouts
            for (const dayName in updatedWorkouts.days || {}) {
                for (const categoryName in updatedWorkouts.days[dayName]?.categories || {}) {
                    const exercises = updatedWorkouts.days[dayName].categories[categoryName];
                    if (Array.isArray(exercises)) {
                        const exerciseIndex = exercises.findIndex(ex => ex?.id === exerciseId);
                        if (exerciseIndex > -1) {
                            updatedWorkouts.days[dayName].categories[categoryName][exerciseIndex].isDeleted = false;
                            foundInWorkouts = true;
                            break;
                        }
                    }
                }
                if (foundInWorkouts) break;
            }

            // Reactivate in historical data
            const updatedHistoricalData = (historicalData || []).map(session => {
                const newExercises = (session?.exercises || []).map(ex => {
                    if (ex?.id === exerciseId) {
                        return { ...ex, isDeleted: false };
                    }
                    return ex;
                });
                return { ...session, exercises: newExercises };
            });

            await saveUserData({ workouts: updatedWorkouts, historicalData: updatedHistoricalData }, "Exercice réactivé !");
            setWorkouts(updatedWorkouts);
            setHistoricalData(updatedHistoricalData);
        } finally {
            setLoadingMessage('');
        }
    }, [user, workouts, historicalData, saveUserData]);

    const handleAddSeries = useCallback(async (dayName, categoryName, exerciseId) => {
        if (!user) return;
        try {
            const updatedWorkouts = { ...workouts };
            const exercises = updatedWorkouts.days?.[dayName]?.categories?.[categoryName];
            if (Array.isArray(exercises)) {
                const exercise = exercises.find(ex => ex?.id === exerciseId);
                if (exercise && Array.isArray(exercise.series)) {
                    const newSeries = {
                        weight: 0,
                        reps: 0,
                        completed: false,
                        id: `s-${Date.now()}-${exercise.series.length + 1}`
                    };
                    exercise.series.push(newSeries);
                    await saveUserData({ workouts: updatedWorkouts }, "Série ajoutée !");
                    setWorkouts(updatedWorkouts);
                }
            }
        } catch (error) {
            console.error("Erreur lors de l'ajout de la série:", error);
            showToast("Erreur lors de l'ajout de la série.", 'error');
        }
    }, [user, workouts, saveUserData, showToast]);

    const handleUpdateSeries = useCallback(async (dayName, categoryName, exerciseId, seriesId, updatedData) => {
        if (!user) return;
        try {
            const updatedWorkouts = { ...workouts };
            const exercises = updatedWorkouts.days?.[dayName]?.categories?.[categoryName];
            if (Array.isArray(exercises)) {
                const exercise = exercises.find(ex => ex?.id === exerciseId);
                if (exercise && Array.isArray(exercise.series)) {
                    const seriesIndex = exercise.series.findIndex(s => s?.id === seriesId);
                    if (seriesIndex > -1) {
                        exercise.series[seriesIndex] = { ...exercise.series[seriesIndex], ...updatedData };
                        await saveUserData({ workouts: updatedWorkouts }, "Série mise à jour !");
                        setWorkouts(updatedWorkouts);
                    }
                }
            }
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la série:", error);
            showToast("Erreur lors de la mise à jour de la série.", 'error');
        }
    }, [user, workouts, saveUserData, showToast]);

    const handleDeleteSeries = useCallback(async (dayName, categoryName, exerciseId, seriesId) => {
        if (!user) return;
        try {
            const updatedWorkouts = { ...workouts };
            const exercises = updatedWorkouts.days?.[dayName]?.categories?.[categoryName];
            if (Array.isArray(exercises)) {
                const exercise = exercises.find(ex => ex?.id === exerciseId);
                if (exercise && Array.isArray(exercise.series) && exercise.series.length > 1) {
                    exercise.series = exercise.series.filter(s => s?.id !== seriesId);
                    await saveUserData({ workouts: updatedWorkouts }, "Série supprimée !");
                    setWorkouts(updatedWorkouts);
                } else if (exercise && Array.isArray(exercise.series) && exercise.series.length === 1) {
                    showToast("Vous ne pouvez pas supprimer la dernière série d'un exercice.", 'warning');
                }
            }
        } catch (error) {
            console.error("Erreur lors de la suppression de la série:", error);
            showToast("Erreur lors de la suppression de la série.", 'error');
        }
    }, [user, workouts, saveUserData, showToast]);

    const handleToggleSeriesCompleted = useCallback(async (dayName, categoryName, exerciseId, seriesId) => {
        if (!user) return;
        try {
            const updatedWorkouts = { ...workouts };
            const exercises = updatedWorkouts.days?.[dayName]?.categories?.[categoryName];
            if (Array.isArray(exercises)) {
                const exercise = exercises.find(ex => ex?.id === exerciseId);
                if (exercise && Array.isArray(exercise.series)) {
                    const seriesIndex = exercise.series.findIndex(s => s?.id === seriesId);
                    if (seriesIndex > -1) {
                        exercise.series[seriesIndex].completed = !exercise.series[seriesIndex].completed;
                        setWorkouts(updatedWorkouts); // Update UI immediately
                        // Save to DB (optional, could be batched for performance)
                        await saveUserData({ workouts: updatedWorkouts }, "Série complétée mise à jour !");
                    }
                }
            }
        } catch (error) {
            console.error("Erreur lors du basculement de l'état de la série:", error);
            showToast("Erreur lors de la mise à jour de la série.", 'error');
        }
    }, [user, workouts, saveUserData, showToast]);

    const handleCompleteWorkout = useCallback(async () => {
        if (!user || !workouts?.dayOrder) return;

        setLoadingMessage('Sauvegarde de la séance...');
        try {
            const completedExercises = [];
            let totalVolumeSession = 0;
            let totalExercisesSession = 0;

            (workouts.dayOrder || []).forEach(dayName => {
                const day = workouts.days?.[dayName];
                if (day?.categories) {
                    Object.values(day.categories).forEach(exercises => {
                        if (Array.isArray(exercises)) {
                            exercises.forEach(exercise => {
                                if (exercise?.series && Array.isArray(exercise.series)) {
                                    const completedSeries = exercise.series.filter(s => s?.completed);
                                    if (completedSeries.length > 0) {
                                        let exerciseVolume = 0;
                                        completedSeries.forEach(series => {
                                            exerciseVolume += (series.weight || 0) * (series.reps || 0);
                                        });
                                        completedExercises.push({
                                            id: exercise.id,
                                            name: exercise.name,
                                            category: Object.keys(day.categories).find(catKey => 
                                                day.categories[catKey].includes(exercise)
                                            ),
                                            series: completedSeries,
                                            notes: exercise.notes || '',
                                            isDeleted: exercise.isDeleted || false,
                                            volume: exerciseVolume
                                        });
                                        totalVolumeSession += exerciseVolume;
                                        totalExercisesSession++;
                                    }
                                }
                            });
                        }
                    });
                }
            });

            if (completedExercises.length === 0) {
                showToast("Aucun exercice complété dans cette séance.", 'warning');
                setLoadingMessage('');
                return;
            }

            const newSession = {
                id: `session-${Date.now()}`,
                timestamp: serverTimestamp(),
                exercises: completedExercises,
                totalVolume: totalVolumeSession,
                totalExercises: totalExercisesSession
            };

            const updatedHistoricalData = [...(historicalData || []), newSession];
            await saveUserData({ historicalData: updatedHistoricalData }, "Séance sauvegardée !");
            setHistoricalData(updatedHistoricalData);

            // Reset completed status for all series after saving
            const resetWorkouts = { ...workouts };
            (workouts.dayOrder || []).forEach(dayName => {
                const day = resetWorkouts.days?.[dayName];
                if (day?.categories) {
                    Object.values(day.categories).forEach(exercises => {
                        if (Array.isArray(exercises)) {
                            exercises.forEach(exercise => {
                                if (exercise?.series && Array.isArray(exercise.series)) {
                                    exercise.series.forEach(s => {
                                        if (s) s.completed = false;
                                    });
                                }
                            });
                        }
                    });
                }
            });
            setWorkouts(resetWorkouts);
            showToast("Séance d'entraînement complétée et sauvegardée !", 'success');
        } catch (error) {
            console.error("Erreur lors de la sauvegarde de la séance:", error);
            showToast(`Erreur lors de la sauvegarde de la séance: ${error.message}`, 'error');
        } finally {
            setLoadingMessage('');
        }
    }, [user, workouts, historicalData, saveUserData, showToast]);

    const analyzeProgressionWithAI = useCallback(async (exerciseName, dataPoints) => {
        if (!geminiModel) {
            showToast("Le modèle d'IA n'est pas initialisé. Veuillez vérifier votre clé API.", 'error');
            return;
        }
        setLoadingMessage('Analyse de la progression par l\'IA...');
        try {
            const prompt = `Analyse la progression de l'exercice "${exerciseName}" basée sur les points de données suivants. Chaque point inclut la date, le poids max, les répétitions max et le volume max. Fournis un résumé des tendances (augmentation, diminution, stagnation), identifie les records personnels récents et donne des conseils pour continuer à progresser.
            Données (format JSON): ${JSON.stringify(dataPoints)}
            Réponse:`;

            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            showToast(`Analyse IA pour ${exerciseName}`, 'info', { label: 'Voir l\'analyse', onClick: () => alert(text) }, 10000);
        } catch (error) {
            console.error("Erreur lors de l'analyse IA:", error);
            showToast("Erreur lors de l'analyse IA. Veuillez réessayer plus tard.", 'error');
        } finally {
            setLoadingMessage('');
        }
    }, [showToast]);

    const analyzeGlobalStatsWithAI = useCallback(async (statsData, bestsData, notes) => {
        if (!geminiModel) {
            showToast("Le modèle d'IA n'est pas initialisé. Veuillez vérifier votre clé API.", 'error');
            return;
        }
        setAiAnalysisLoading(true);
        try {
            const prompt = `En tant qu'entraîneur personnel expert, analyse les statistiques globales suivantes d'un utilisateur et ses records personnels. Basé sur ces données, fournis une analyse succincte des forces, des points à améliorer, et des conseils pratiques. Prends en compte les notes globales de l'utilisateur si elles sont pertinentes.
            
            Statistiques globales (totalExercises, totalSeries, totalVolume, totalSessions, avgExercisesPerSession, avgVolumePerSession, avgSeriesPerExercise): ${JSON.stringify(statsData)}
            Records personnels (par exercice, incluant maxWeight, maxReps, maxVolume): ${JSON.stringify(bestsData)}
            Notes globales de l'utilisateur: "${notes}"

            Structure ta réponse en paragraphes clairs, en mettant l'accent sur les conseils actionnables.`;

            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setGlobalNotes(text);
            showToast("Analyse globale par l'IA générée !", 'success');
            saveUserData({ globalNotes: text }, "Analyse IA sauvegardée.");
        } catch (error) {
            console.error("Erreur lors de l'analyse IA globale:", error);
            showToast("Erreur lors de l'analyse IA globale. Veuillez réessayer plus tard.", 'error');
        } finally {
            setAiAnalysisLoading(false);
        }
    }, [user, saveUserData, showToast]);

    const showProgressionGraphForExercise = useCallback((exerciseName, exerciseId) => {
        // Filter historical data for the specific exercise
        const relevantHistoricalData = (historicalData || []).flatMap(session =>
            (session?.exercises || [])
                .filter(ex => ex?.id === exerciseId)
                .map(ex => ({
                    date: session.timestamp,
                    maxWeight: Math.max(...(ex?.series || []).map(s => s?.weight || 0)),
                    maxReps: Math.max(...(ex?.series || []).map(s => s?.reps || 0)),
                    maxVolume: Math.max(...(ex?.series || []).map(s => (s?.weight || 0) * (s?.reps || 0)))
                }))
        );

        // Sort data by date
        const sortedData = relevantHistoricalData.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateA - dateB;
        });

        // Format dates for display on graph
        const formattedData = sortedData.map(data => ({
            ...data,
            date: formatDate(data.date)
        }));

        setProgressionGraphExercise({ name: exerciseName, data: formattedData });
        setShowProgressionGraph(true);
    }, [historicalData, formatDate]);

    return (
        <div className={`min-h-screen bg-gray-900 text-gray-100 flex flex-col ${theme === 'dark' ? 'dark' : 'light'}`}>
            {loadingMessage && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl flex items-center space-x-3">
                        <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-8 w-8 mb-0"></div>
                        <p className="text-white text-lg">{loadingMessage}</p>
                    </div>
                </div>
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={clearToast}
                    action={toast.action}
                    duration={toast.duration}
                />
            )}

            {/* Header */}
            <header className="bg-gray-900 text-white p-4 flex items-center justify-between shadow-md relative z-40">
                <h1 className="text-2xl font-bold text-blue-400">
                    {currentView === 'workout' && 'Mon Entraînement'}
                    {currentView === 'timer' && 'Minuteur de Repos'}
                    {currentView === 'history' && 'Historique'}
                    {currentView === 'stats' && 'Statistiques'}
                </h1>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-all text-gray-300"
                    aria-label="Paramètres"
                >
                    <Settings className="h-6 w-6" />
                </button>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="absolute top-0 right-0 w-full h-screen bg-gray-900 z-50 p-6 shadow-xl transform transition-transform duration-300 ease-out translate-x-0">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Paramètres</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300"
                                aria-label="Fermer les paramètres"
                            >
                                <XCircle className="h-7 w-7" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Mode Avancé */}
                            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-700">
                                <label htmlFor="advanced-mode" className="text-white text-lg font-medium">Mode Avancé</label>
                                <input
                                    type="checkbox"
                                    id="advanced-mode"
                                    checked={isAdvancedMode}
                                    onChange={(e) => {
                                        setIsAdvancedMode(e.target.checked);
                                        saveUserData({ settings: { isAdvancedMode: e.target.checked } }, "Mode avancé mis à jour.");
                                    }}
                                    className="toggle-switch"
                                />
                            </div>

                            {/* Vue Compacte */}
                            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-700">
                                <label htmlFor="compact-view" className="text-white text-lg font-medium">Vue Compacte</label>
                                <input
                                    type="checkbox"
                                    id="compact-view"
                                    checked={isCompactView}
                                    onChange={(e) => {
                                        setIsCompactView(e.target.checked);
                                        saveUserData({ settings: { isCompactView: e.target.checked } }, "Vue compacte mise à jour.");
                                    }}
                                    className="toggle-switch"
                                />
                            </div>

                            {/* Sélecteur de thème */}
                            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-700">
                                <span className="text-white text-lg font-medium">Thème</span>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`p-2 rounded-full ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'} transition-colors`}
                                        aria-label="Activer le thème clair"
                                    >
                                        <Sun className="h-6 w-6" />
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`p-2 rounded-full ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'} transition-colors`}
                                        aria-label="Activer le thème sombre"
                                    >
                                        <Moon className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Temps de repos par défaut */}
                            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-700">
                                <label htmlFor="rest-time-input" className="text-white text-lg font-medium">Temps de repos par défaut (secondes)</label>
                                <input
                                    type="number"
                                    id="rest-time-input"
                                    value={restTimeInput}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value) && value >= 0) {
                                            setRestTimeInput(String(value));
                                            saveUserData({ settings: { restTimeInput: String(value) } }, "Temps de repos par défaut mis à jour.");
                                        }
                                    }}
                                    className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Bouton de sauvegarde des notes globales */}
                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                                <h3 className="text-lg font-medium text-white mb-2">Notes Globales</h3>
                                <textarea
                                    className="w-full h-32 bg-gray-700 text-white p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ajoutez ici des notes générales sur votre entraînement, vos objectifs, etc."
                                    value={globalNotes}
                                    onChange={(e) => setGlobalNotes(e.target.value)}
                                ></textarea>
                                <button
                                    onClick={() => saveUserData({ globalNotes: globalNotes }, "Notes globales sauvegardées !")}
                                    className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                                >
                                    <Download className="h-5 w-5 mr-2" />
                                    Sauvegarder les notes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 pb-20">
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        selectedDayFilter={null}
                        setSelectedDayFilter={() => { }}
                        isAdvancedMode={isAdvancedMode}
                        isCompactView={isCompactView}
                        handleEditClick={handleEditClick}
                        handleAddExerciseClick={handleAddExerciseClick}
                        handleDeleteExercise={handleDeleteExercise}
                        handleToggleSeriesCompleted={handleToggleSeriesCompleted}
                        handleUpdateSeries={handleUpdateSeries}
                        handleDeleteSeries={handleDeleteSeries}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        showProgressionGraphForExercise={showProgressionGraphForExercise}
                        personalBests={personalBests}
                        getDayButtonColors={getDayButtonColors}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        isSavingExercise={isSavingExercise}
                        isDeletingExercise={isDeletingExercise}
                        isAddingExercise={isAddingExercise}
                        searchTerm={''}
                        setSearchTerm={() => { }}
                        days={workouts?.dayOrder || []}
                        categories={[]}
                        handleAddDay={handleAddDay}
                        handleEditDay={handleEditDay}
                        handleDeleteDay={handleDeleteDay}
                        handleAddSeries={handleAddSeries}
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
                        handleReactivateExercise={handleReactivateExercise}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        showProgressionGraphForExercise={showProgressionGraphForExercise}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        isAdvancedMode={isAdvancedMode}
                        searchTerm={''}
                        setSearchTerm={() => { }}
                        sortBy={'date-desc'}
                        setSortBy={() => { }}
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
                        aiAnalysisLoading={aiAnalysisLoading}
                    />
                )}

                {/* Bouton global pour compléter la séance */}
                {currentView === 'workout' && (
                    <div className="fixed bottom-20 left-0 right-0 p-4 z-40">
                        <button
                            onClick={handleCompleteWorkout}
                            className="w-full bg-green-600 text-white py-3 rounded-xl shadow-lg hover:bg-green-700 transition-all text-lg font-bold flex items-center justify-center active:scale-95"
                        >
                            <CheckCircle className="h-6 w-6 mr-2" />
                            Compléter la séance
                        </button>
                    </div>
                )}
            </main>

            {/* Bottom Navigation */}
            <BottomNavigationBar
                currentView={currentView}
                setCurrentView={setCurrentView}
            />

            {/* Progression Graph Modal */}
            {showProgressionGraph && progressionGraphExercise && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-lg p-6 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-blue-400">Progression pour "{progressionGraphExercise.name}"</h2>
                            <button
                                onClick={() => setShowProgressionGraph(false)}
                                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300"
                                aria-label="Fermer le graphique"
                            >
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="text-gray-300 mb-4">
                            <p className="text-sm">Ce graphique visualise votre performance (poids max, répétitions max, volume max) pour cet exercice au fil du temps.</p>
                        </div>

                        {progressionGraphExercise.data?.length > 1 ? (
                            <div className="h-80 w-full mb-6">
                                <p className="text-center text-gray-400">Graphique de progression disponible avec les bibliothèques de charts</p>
                            </div>
                        ) : (
                            <div className="bg-gray-700 rounded-lg p-8 text-center border border-gray-600">
                                <LineChartIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-400 mb-2">Pas assez de données pour afficher le graphique.</p>
                                <p className="text-sm text-gray-500">Enregistrez au moins deux sessions pour cet exercice pour voir votre progression.</p>
                            </div>
                        )}

                        <div className="text-xs text-gray-400 mb-4">
                            💡 Ce graphique représente votre progression en poids, répétitions et volume maximum pour cet exercice au fil du temps.
                        </div>

                        <button
                            onClick={() => setShowProgressionGraph(false)}
                            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                        >
                            Fermer le graphique
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImprovedWorkoutApp;