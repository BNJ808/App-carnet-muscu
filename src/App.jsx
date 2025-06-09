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
    }, []); // Removed showToast as dependency, it's not used here

    const getSeriesDisplay = useCallback((series) => {
        return series.map(s => `${s.reps}x${s.weight}kg`).join(' / ');
    }, []);

    // Calcul des statistiques générales du workout
    const getWorkoutStats = useCallback((workoutsData, historicalDataParam) => {
        const stats = {
            totalWorkouts: historicalDataParam.length,
            totalExercises: 0,
            totalSets: 0,
            totalReps: 0,
            totalVolume: 0, // En kg
            exercisesByMuscleGroup: {},
            lastWorkoutDate: null,
            averageWorkoutDuration: 0, // En minutes
            mostFrequentExercise: null,
            averageSetsPerExercise: 0,
            daysActive: new Set()
        };

        // Calcul des stats basées sur les entraînements planifiés (workoutsData)
        let plannedExerciseCount = 0;
        let plannedSetCount = 0;
        for (const dayName of workoutsData.dayOrder) {
            const day = workoutsData.days[dayName];
            if (day && day.exercises) {
                plannedExerciseCount += day.exercises.length;
                day.exercises.forEach(exercise => {
                    plannedSetCount += exercise.series.length;
                    exercise.muscleGroups.forEach(group => {
                        stats.exercisesByMuscleGroup[group] = (stats.exercisesByMuscleGroup[group] || 0) + 1;
                    });
                });
            }
        }
        stats.totalExercises = plannedExerciseCount; // C'est le nombre d'exercices *distincts* dans le programme
        stats.totalSets = plannedSetCount; // Nombre total de séries planifiées

        // Calcul des stats basées sur l'historique (historicalData)
        if (historicalDataParam && historicalDataParam.length > 0) {
            let totalDurationSeconds = 0;
            const exerciseFrequency = {};
            let totalCompletedSets = 0;
            let totalCompletedReps = 0;

            historicalDataParam.forEach(session => {
                if (session.date && session.date.toDate) {
                    const sessionDate = session.date.toDate();
                    if (!stats.lastWorkoutDate || sessionDate > stats.lastWorkoutDate) {
                        stats.lastWorkoutDate = sessionDate;
                    }
                    stats.daysActive.add(sessionDate.toDateString());
                }

                if (session.duration) {
                    totalDurationSeconds += session.duration;
                }

                session.exercises.forEach(exercise => {
                    exerciseFrequency[exercise.name] = (exerciseFrequency[exercise.name] || 0) + 1;
                    exercise.series.forEach(serie => {
                        if (serie.completed) {
                            totalCompletedSets++;
                            totalCompletedReps += serie.reps;
                            stats.totalVolume += (serie.reps * serie.weight);
                        }
                    });
                });
            });

            if (stats.totalWorkouts > 0) {
                stats.averageWorkoutDuration = Math.round((totalDurationSeconds / stats.totalWorkouts) / 60); // En minutes
            }

            stats.mostFrequentExercise = Object.keys(exerciseFrequency).reduce((a, b) => exerciseFrequency[a] > exerciseFrequency[b] ? a : b, null);
            
            stats.averageSetsPerExercise = totalCompletedSets / (historicalDataParam.reduce((acc, sess) => acc + sess.exercises.length, 0) || 1);
        }

        return stats;
    }, [formatDate]); // Added formatDate as a dependency as it's used inside

    // Prépare les données pour le graphique de volume par exercice
    const getExerciseVolumeData = useCallback((exerciseName, history) => {
        const volumeMap = new Map(); // Map pour stocker le volume par date
        const sortedHistory = [...(history || [])].sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const dateB = b.date.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return dateA - dateB;
        });

        sortedHistory.forEach(session => {
            const sessionDate = session.date.toDate ? session.date.toDate() : new Date(session.date);
            const formattedDate = sessionDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

            session.exercises.forEach(exercise => {
                if (exercise.name === exerciseName) {
                    let sessionVolume = 0;
                    exercise.series.forEach(serie => {
                        if (serie.completed) {
                            sessionVolume += serie.reps * serie.weight;
                        }
                    });
                    volumeMap.set(formattedDate, (volumeMap.get(formattedDate) || 0) + sessionVolume);
                }
            });
        });

        return Array.from(volumeMap).map(([date, volume]) => ({ name: date, volume }));
    }, []);

    // Prépare les données pour le graphique de volume quotidien
    const getDailyVolumeData = useCallback((history) => {
        const dailyVolumeMap = new Map();
        const sortedHistory = [...(history || [])].sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
            const dateB = b.date.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
            return dateA - dateB;
        });

        sortedHistory.forEach(session => {
            const sessionDate = session.date.toDate ? session.date.toDate() : new Date(session.date);
            const formattedDate = sessionDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            let sessionVolume = 0;
            session.exercises.forEach(exercise => {
                exercise.series.forEach(serie => {
                    if (serie.completed) {
                        sessionVolume += serie.reps * serie.weight;
                    }
                });
            });
            dailyVolumeMap.set(formattedDate, (dailyVolumeMap.get(formattedDate) || 0) + sessionVolume);
        });
        return Array.from(dailyVolumeMap).map(([date, volume]) => ({ date, volume }));
    }, []);

    // Prépare les données pour le graphique de fréquence d'exercice
    const getExerciseFrequencyData = useCallback((history) => {
        const frequencyMap = new Map();
        (history || []).forEach(session => {
            const sessionDate = session.date.toDate ? session.date.toDate() : new Date(session.date);
            const formattedDate = sessionDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
            session.exercises.forEach(exercise => {
                const key = `${exercise.name} - ${formattedDate}`;
                frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
            });
        });

        const data = Array.from(frequencyMap).map(([key, count]) => {
            const [exerciseName, date] = key.split(' - ');
            return { exerciseName, date, count };
        });

        // Agréger par exercice pour le graphique de fréquence des exercices
        const aggregatedData = {};
        data.forEach(item => {
            if (!aggregatedData[item.exerciseName]) {
                aggregatedData[item.exerciseName] = 0;
            }
            aggregatedData[item.exerciseName] += item.count;
        });

        return Object.keys(aggregatedData).map(name => ({ name, frequency: aggregatedData[name] }));
    }, []);

    // Fonctions de logique métier et interactions
    const addDay = useCallback((dayName) => {
        setWorkouts(prevWorkouts => {
            if (prevWorkouts.dayOrder.includes(dayName)) {
                showToast(`Le jour "${dayName}" existe déjà.`, 'warning');
                return prevWorkouts;
            }
            const newWorkouts = {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [dayName]: { exercises: [] }
                },
                dayOrder: [...prevWorkouts.dayOrder, dayName]
            };
            showToast(`Jour "${dayName}" ajouté.`, 'success');
            return newWorkouts;
        });
    }, [showToast]);

    const renameDay = useCallback((oldName, newName) => {
        setWorkouts(prevWorkouts => {
            if (oldName === newName) return prevWorkouts;
            if (prevWorkouts.dayOrder.includes(newName)) {
                showToast(`Le jour "${newName}" existe déjà.`, 'warning');
                return prevWorkouts;
            }

            const newDays = { ...prevWorkouts.days };
            newDays[newName] = newDays[oldName];
            delete newDays[oldName];

            const newDayOrder = prevWorkouts.dayOrder.map(name =>
                name === oldName ? newName : name
            );

            showToast(`Jour "${oldName}" renommé en "${newName}".`, 'success');
            return { ...prevWorkouts, days: newDays, dayOrder: newDayOrder };
        });
    }, [showToast]);

    const deleteDay = useCallback((dayName) => {
        setWorkouts(prevWorkouts => {
            const { [dayName]: _, ...remainingDays } = prevWorkouts.days;
            const newDayOrder = prevWorkouts.dayOrder.filter(name => name !== dayName);
            showToast(`Jour "${dayName}" supprimé.`, 'info');
            return { ...prevWorkouts, days: remainingDays, dayOrder: newDayOrder };
        });
    }, [showToast]);

    const addExercise = useCallback((dayName, newExercise) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day) {
                showToast(`Jour "${dayName}" introuvable.`, 'error');
                return prevWorkouts;
            }

            // Assurez-vous que newExercise a une structure de série valide
            const exerciseWithSeries = {
                ...newExercise,
                series: newExercise.series && newExercise.series.length > 0
                    ? newExercise.series
                    : [{ reps: 0, weight: 0, completed: false }] // Série par défaut
            };

            const updatedWorkouts = {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [dayName]: {
                        ...day,
                        exercises: [...day.exercises, exerciseWithSeries]
                    }
                }
            };
            showToast(`Exercice "${newExercise.name}" ajouté au jour "${dayName}".`, 'success');
            return updatedWorkouts;
        });
    }, [showToast]);

    const updateExercise = useCallback((dayName, exerciseIndex, updatedExercise) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
                showToast(`Exercice introuvable pour la mise à jour.`, 'error');
                return prevWorkouts;
            }

            const updatedExercises = [...day.exercises];
            updatedExercises[exerciseIndex] = updatedExercise;

            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [dayName]: {
                        ...day,
                        exercises: updatedExercises
                    }
                }
            };
        });
    }, [showToast]);

    const deleteExercise = useCallback((dayName, exerciseIndex) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
                showToast(`Exercice introuvable pour la suppression.`, 'error');
                return prevWorkouts;
            }

            const exerciseToDelete = day.exercises[exerciseIndex];
            const updatedExercises = day.exercises.filter((_, idx) => idx !== exerciseIndex);

            showToast(`Exercice "${exerciseToDelete.name}" supprimé.`, 'info');
            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [dayName]: {
                        ...day,
                        exercises: updatedExercises
                    }
                }
            };
        });
    }, [showToast]);

    const onToggleSerieCompleted = useCallback((dayName, exerciseIndex, serieIndex) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day || !day.exercises[exerciseIndex] || !day.exercises[exerciseIndex].series[serieIndex]) {
                showToast("Série introuvable.", 'error');
                return prevWorkouts;
            }

            const updatedWorkouts = { ...prevWorkouts };
            const series = [...updatedWorkouts.days[dayName].exercises[exerciseIndex].series];
            series[serieIndex] = {
                ...series[serieIndex],
                completed: !series[serieIndex].completed
            };
            updatedWorkouts.days[dayName].exercises[exerciseIndex].series = series;

            return updatedWorkouts;
        });
    }, [showToast]);

    const onUpdateSerie = useCallback((dayName, exerciseIndex, serieIndex, updatedSerie) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day || !day.exercises[exerciseIndex] || !day.exercises[exerciseIndex].series[serieIndex]) {
                showToast("Série introuvable pour la mise à jour.", 'error');
                return prevWorkouts;
            }

            const updatedWorkouts = { ...prevWorkouts };
            const series = [...updatedWorkouts.days[dayName].exercises[exerciseIndex].series];
            series[serieIndex] = { ...series[serieIndex], ...updatedSerie }; // Merge existing with updated
            updatedWorkouts.days[dayName].exercises[exerciseIndex].series = series;

            return updatedWorkouts;
        });
    }, [showToast]);

    const onAddSerie = useCallback((dayName, exerciseIndex) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day || !day.exercises[exerciseIndex]) {
                showToast("Exercice introuvable pour ajouter une série.", 'error');
                return prevWorkouts;
            }

            const updatedWorkouts = { ...prevWorkouts };
            const exercise = updatedWorkouts.days[dayName].exercises[exerciseIndex];
            exercise.series = [...exercise.series, { reps: 0, weight: 0, completed: false }];
            showToast("Série ajoutée.", 'success', null, 1000);
            return updatedWorkouts;
        });
    }, [showToast]);

    const onRemoveSerie = useCallback((dayName, exerciseIndex, serieIndex) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day || !day.exercises[exerciseIndex] || !day.exercises[exerciseIndex].series[serieIndex]) {
                showToast("Série introuvable pour suppression.", 'error');
                return prevWorkouts;
            }

            const updatedWorkouts = { ...prevWorkouts };
            const exercise = updatedWorkouts.days[dayName].exercises[exerciseIndex];
            if (exercise.series.length > 1) {
                exercise.series = exercise.series.filter((_, idx) => idx !== serieIndex);
                showToast("Série supprimée.", 'info', null, 1000);
            } else {
                showToast("Un exercice doit avoir au moins une série.", 'warning');
            }
            return updatedWorkouts;
        });
    }, [showToast]);

    const onUpdateExerciseNotes = useCallback((dayName, exerciseIndex, notes) => {
        setWorkouts(prevWorkouts => {
            const day = prevWorkouts.days[dayName];
            if (!day || !day.exercises[exerciseIndex]) {
                showToast("Exercice introuvable pour mettre à jour les notes.", 'error');
                return prevWorkouts;
            }

            const updatedWorkouts = { ...prevWorkouts };
            updatedWorkouts.days[dayName].exercises[exerciseIndex] = {
                ...updatedWorkouts.days[dayName].exercises[exerciseIndex],
                notes: notes
            };
            showToast("Notes de l'exercice mises à jour.", 'success', null, 1000);
            return updatedWorkouts;
        });
    }, [showToast]);

    const onEditClick = useCallback((dayName, exerciseIndex) => {
        // Cette fonction sera probablement gérée par le composant enfant directement
        // Pour l'instant, elle n'a pas de logique de state globale ici.
        console.log(`Edit clicked for ${dayName}, exercise ${exerciseIndex}`);
    }, []);

    const saveCurrentWorkoutSession = useCallback(() => {
        setHistoricalData(prevData => {
            const currentSession = {
                id: Date.now(), // Utiliser un timestamp comme ID unique
                date: Timestamp.now(), // Firebase Timestamp
                duration: 0, // Placeholder, à calculer si un timer global est implémenté
                notes: '',
                exercises: []
            };

            // Parcourir tous les jours et exercices pour collecter les séries complétées
            let anyExerciseCompleted = false;
            for (const dayName of workouts.dayOrder) {
                const day = workouts.days[dayName];
                if (day && day.exercises) {
                    day.exercises.forEach(exercise => {
                        const completedSeries = exercise.series.filter(s => s.completed);
                        if (completedSeries.length > 0) {
                            currentSession.exercises.push({
                                name: exercise.name,
                                muscleGroups: exercise.muscleGroups,
                                series: completedSeries,
                                notes: exercise.notes
                            });
                            anyExerciseCompleted = true;
                        }
                    });
                }
            }

            if (!anyExerciseCompleted) {
                showToast("Aucune série terminée dans la session actuelle. Rien à sauvegarder.", 'warning');
                return prevData;
            }

            // Calculer les nouveaux records personnels
            const updatedPersonalBests = { ...personalBests };
            currentSession.exercises.forEach(exercise => {
                exercise.series.forEach(serie => {
                    const exerciseName = exercise.name;
                    const volume = serie.reps * serie.weight;

                    // Mettre à jour le PB de volume
                    if (!updatedPersonalBests[exerciseName] || volume > (updatedPersonalBests[exerciseName].maxVolume || 0)) {
                        updatedPersonalBests[exerciseName] = {
                            ...updatedPersonalBests[exerciseName],
                            maxVolume: volume,
                            maxVolumeSeries: { ...serie, date: currentSession.date },
                        };
                    }
                    // Mettre à jour le PB de poids (1RM estimé ou juste le poids max si les reps sont proches)
                    if (!updatedPersonalBests[exerciseName] || serie.weight > (updatedPersonalBests[exerciseName].maxWeight || 0)) {
                        updatedPersonalBests[exerciseName] = {
                            ...updatedPersonalBests[exerciseName],
                            maxWeight: serie.weight,
                            maxWeightSeries: { ...serie, date: currentSession.date },
                        };
                    }
                });
            });
            setPersonalBests(updatedPersonalBests);

            showToast("Séance sauvegardée avec succès !", 'success');
            return [...prevData, currentSession];
        });

        // Réinitialiser les séries complétées après la sauvegarde
        setWorkouts(prevWorkouts => {
            const resetWorkouts = { ...prevWorkouts };
            for (const dayName of resetWorkouts.dayOrder) {
                if (resetWorkouts.days[dayName] && resetWorkouts.days[dayName].exercises) {
                    resetWorkouts.days[dayName].exercises = resetWorkouts.days[dayName].exercises.map(exercise => ({
                        ...exercise,
                        series: exercise.series.map(serie => ({ ...serie, completed: false }))
                    }));
                }
            }
            return resetWorkouts;
        });
    }, [workouts, personalBests, showToast]);

    const handleReactivateExercise = useCallback((exercise) => {
        // Logique pour réactiver un exercice supprimé ou désactivé
        // Cela devrait probablement demander à l'utilisateur quel jour le réactiver
        showToast(`Exercice "${exercise.name}" réactivé. (Fonctionnalité complète à implémenter)`, 'info');
        console.log("Reactivate exercise:", exercise);
    }, [showToast]);

    const deleteHistoricalSession = useCallback(async (sessionId) => {
        setHistoricalData(prevData => {
            const updatedData = prevData.filter(session => session.id !== sessionId);
            showToast("Séance historique supprimée.", 'info');
            return updatedData;
        });
    }, [showToast]);

    const analyzeProgressionWithAI = useCallback(async (exerciseName, exerciseHistory, workoutNotes) => {
        setIsLoadingAIProgression(true);
        setProgressionAnalysisContent(''); // Clear previous analysis

        if (!import.meta.env.VITE_GEMINI_API_KEY) {
            showToast("Clé API Gemini manquante. Impossible d'utiliser l'IA.", 'error');
            setIsLoadingAIProgression(false);
            return;
        }

        try {
            const genAI = new GenerativeAIModule.GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const historyText = exerciseHistory.map(h => {
                const date = formatDate(h.date);
                const seriesData = h.series.map(s => `${s.reps} reps @ ${s.weight}kg`).join(', ');
                return `Date: ${date}, Séries: ${seriesData}`;
            }).join('\n');

            const prompt = `Je suis un coach sportif. Analyse la progression de cet exercice basé sur l'historique suivant. Identifie les tendances, les forces, les faiblesses, et donne des conseils pour améliorer la progression (e.g., ajuster les charges, varier les répétitions, focus sur la technique). Tiens compte de mes notes générales d'entraînement si fournies.

            Nom de l'exercice: ${exerciseName}
            Historique des séries (format: "Date: JJ/MM/AAAA, Séries: X reps @ Y kg"):
            ${historyText}

            Notes générales d'entraînement (si disponibles):
            ${workoutNotes || "Aucune note générale."}

            Fournis une analyse concise et actionable, en français. Structure la réponse avec des titres clairs et des tirets pour les conseils.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setProgressionAnalysisContent(text);
            showToast("Analyse IA de progression générée !", 'success', null, 3000);
        } catch (error) {
            console.error("Erreur lors de l'analyse de progression par l'IA:", error);
            showToast("Erreur lors de la génération de l'analyse IA. Réessayez plus tard.", 'error');
        } finally {
            setIsLoadingAIProgression(false);
        }
    }, [formatDate, showToast]);

    const analyzeGlobalStatsWithAI = useCallback(async (notes, workoutStats, pbData) => {
        setIsLoadingAIProgression(true); // Utilisez la même variable de chargement pour la cohérence
        setProgressionAnalysisContent(''); // Clear previous analysis

        if (!import.meta.env.VITE_GEMINI_API_KEY) {
            showToast("Clé API Gemini manquante. Impossible d'utiliser l'IA.", 'error');
            setIsLoadingAIProgression(false);
            return;
        }

        try {
            const genAI = new GenerativeAIModule.GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const statsText = `
            Nombre total de séances: ${workoutStats.totalWorkouts}
            Nombre total d'exercices planifiés: ${workoutStats.totalExercises}
            Nombre total de séries planifiées: ${workoutStats.totalSets}
            Volume total soulevé: ${workoutStats.totalVolume} kg
            Dernière séance: ${workoutStats.lastWorkoutDate ? formatDate(workoutStats.lastWorkoutDate) : 'N/A'}
            Durée moyenne des séances: ${workoutStats.averageWorkoutDuration} minutes
            Exercice le plus fréquent: ${workoutStats.mostFrequentExercise || 'N/A'}
            Moyenne de séries par exercice terminé: ${workoutStats.averageSetsPerExercise.toFixed(1)}
            Groupes musculaires ciblés: ${Object.keys(workoutStats.exercisesByMuscleGroup).join(', ') || 'N/A'}
            `;

            const pbText = Object.keys(pbData).map(exerciseName => {
                const pb = pbData[exerciseName];
                let pbStr = `  - ${exerciseName}: `;
                if (pb.maxVolume) pbStr += `Volume max: ${pb.maxVolume} kg (${pb.maxVolumeSeries.reps}x${pb.maxVolumeSeries.weight}kg le ${formatDate(pb.maxVolumeSeries.date)})`;
                if (pb.maxWeight) pbStr += `, Poids max: ${pb.maxWeight} kg (${pb.maxWeightSeries.reps}x${pb.maxWeightSeries.weight}kg le ${formatDate(pb.maxWeightSeries.date)})`;
                return pbStr;
            }).join('\n');

            const prompt = `Je suis un coach sportif. Analyse mes statistiques d'entraînement globales et mes records personnels.
            Identifie les points forts, les points faibles, suggère des domaines d'amélioration ou des ajustements de programme.
            Tiens compte de mes notes générales d'entraînement.

            Statistiques globales:
            ${statsText}

            Records Personnels (PB):
            ${pbText || "Aucun record personnel enregistré."}

            Notes générales d'entraînement:
            ${notes || "Aucune note générale fournie."}

            Fournis une analyse complète et actionable, en français. Structure la réponse avec des titres clairs et des tirets pour les conseils.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setProgressionAnalysisContent(text);
            showToast("Analyse IA des statistiques globales générée !", 'success', null, 3000);
        } catch (error) {
            console.error("Erreur lors de l'analyse globale par l'IA:", error);
            showToast("Erreur lors de la génération de l'analyse IA. Réessayez plus tard.", 'error');
        } finally {
            setIsLoadingAIProgression(false);
        }
    }, [formatDate, showToast]);

    const onGenerateAISuggestions = useCallback(async (notes, currentWorkouts) => {
        setIsLoadingAI(true);
        setAiSuggestions([]);

        if (!import.meta.env.VITE_GEMINI_API_KEY) {
            showToast("Clé API Gemini manquante. Impossible d'utiliser l'IA.", 'error');
            setIsLoadingAI(false);
            return;
        }

        try {
            const genAI = new GenerativeAIModule.GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const workoutPlanText = JSON.stringify(currentWorkouts, null, 2);

            const prompt = `En tant que coach sportif, sur la base de mes notes générales d'entraînement et de mon programme actuel, propose 3 suggestions d'amélioration ou de variation. Sois concis pour chaque suggestion.
            Exemples de suggestions: "Ajouter un exercice de finition pour les bras le jour X", "Varier les prises sur le développé couché", "Faire plus de travail unilatéral".

            Notes générales:
            ${notes || "Aucune note générale."}

            Mon programme actuel:
            ${workoutPlanText}

            Réponds en format liste, avec une suggestion par ligne. Ne fournis rien d'autre que la liste de suggestions.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const suggestionsArray = text.split('\n').filter(s => s.trim() !== '');
            setAiSuggestions(suggestionsArray);
            showToast("Suggestions IA générées !", 'success', null, 3000);
        } catch (error) {
            console.error("Erreur lors de la génération des suggestions AI:", error);
            showToast("Erreur lors de la génération des suggestions IA. Réessayez plus tard.", 'error');
        } finally {
            setIsLoadingAI(false);
        }
    }, [showToast]);

    const startTimer = useCallback((seconds) => {
        // Clear any existing interval to prevent multiple timers running
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        setTimerSeconds(seconds);
        setTimerIsRunning(true);
        setTimerIsFinished(false);
        
        timerIntervalRef.current = setInterval(() => {
            setTimerSeconds(prevSeconds => {
                if (prevSeconds <= 1) { // Use 1 to ensure it hits 0 and then clears
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null; // Important to reset the ref
                    setTimerIsRunning(false);
                    setTimerIsFinished(true);
                    showToast("Temps de repos terminé !", 'info', null, 5000);
                    return 0;
                }
                return prevSeconds - 1;
            });
        }, 1000);

        showToast(`Minuteur démarré pour ${formatTime(seconds)}.`, 'info');
    }, [showToast, formatTime]);

    const pauseTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimerIsRunning(false);
        showToast("Minuteur en pause.", 'info');
    }, [showToast]);

    const resetTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimerSeconds(0);
        setTimerIsRunning(false);
        setTimerIsFinished(false);
        showToast("Minuteur réinitialisé.", 'info');
    }, [showToast]);

    // Cleanup interval on component unmount
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

    const importData = useCallback(async (jsonString) => {
        try {
            const importedData = JSON.parse(jsonString);
            if (importedData.workouts && importedData.historicalData && importedData.personalBests && importedData.globalNotes !== undefined) {
                setWorkouts(importedData.workouts);
                setHistoricalData(importedData.historicalData);
                setPersonalBests(importedData.personalBests);
                setGlobalNotes(importedData.globalNotes);
                showToast("Données importées avec succès !", 'success');
                // Optionnel: sauvegarder immédiatement dans Firestore après import
                if (currentUserRef.current && dbRef.current) {
                    await setDoc(doc(dbRef.current, "users", currentUserRef.current.uid), {
                        workouts: importedData.workouts,
                        historicalData: importedData.historicalData,
                        personalBests: importedData.personalBests,
                        globalNotes: importedData.globalNotes,
                        lastUpdated: serverTimestamp()
                    }, { merge: true });
                    showToast("Données importées et sauvegardées sur le cloud.", 'success');
                }
            } else {
                showToast("Format de données importées invalide.", 'error');
            }
        } catch (error) {
            console.error("Erreur d'importation des données:", error);
            showToast("Erreur lors de l'importation des données. Le format JSON est peut-être incorrect.", 'error');
        }
    }, [showToast]);

    const exportData = useCallback(() => {
        const data = {
            workouts: workouts,
            historicalData: historicalData,
            personalBests: personalBests,
            globalNotes: globalNotes,
        };
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `workout_app_data_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Données exportées avec succès !", 'success');
    }, [workouts, historicalData, personalBests, globalNotes, showToast]);

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
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        setWorkouts={setWorkouts}
                        onToggleSerieCompleted={onToggleSerieCompleted}
                        onUpdateSerie={onUpdateSerie}
                        onAddSerie={onAddSerie}
                        onRemoveSerie={onRemoveSerie}
                        onUpdateExerciseNotes={onUpdateExerciseNotes}
                        onEditClick={onEditClick}
                        onDeleteExercise={deleteExercise}
                        addDay={addDay}
                        renameDay={renameDay}
                        deleteDay={deleteDay}
                        addExercise={addExercise}
                        updateExercise={updateExercise}
                        saveCurrentWorkoutSession={saveCurrentWorkoutSession}
                        showToast={showToast}
                        formatTime={formatTime}
                        isTimerModalOpen={isTimerModalOpen}
                        setIsTimerModalOpen={setIsTimerModalOpen}
                        startTimer={startTimer}
                        restTimeInput={restTimeInput}
                        setRestTimeInput={setRestTimeInput}
                        timerIsRunning={timerIsRunning}
                        timerSeconds={timerSeconds}
                        theme={theme}
                        undo={undo}
                        redo={redo}
                        undoStack={undoStack}
                        redoStack={redoStack}
                    />
                )}
                {currentView === 'history' && (
                    <HistoryView
                        historicalData={historicalData}
                        personalBests={personalBests}
                        handleReactivateExercise={handleReactivateExercise}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        progressionAnalysisContent={progressionAnalysisContent}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        isAdvancedMode={true} // Assumé pour le moment
                        deleteHistoricalSession={deleteHistoricalSession}
                        isLoadingAI={isLoadingAIProgression}
                        showToast={showToast}
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
                        aiAnalysisLoading={isLoadingAIProgression}
                        onGenerateAISuggestions={onGenerateAISuggestions}
                        aiSuggestions={aiSuggestions}
                        isLoadingAI={isLoadingAI}
                        progressionAnalysisContent={progressionAnalysisContent} // Now consistently passed for AI analysis display
                        getWorkoutStats={getWorkoutStats}
                        getExerciseVolumeData={getExerciseVolumeData}
                        getDailyVolumeData={getDailyVolumeData}
                        getExerciseFrequencyData={getExerciseFrequencyData}
                        showToast={showToast}
                    />
                )}
            </main>

            <BottomNavigationBar
                currentView={currentView}
                setCurrentView={setCurrentView}
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                    action={toast.action}
                    duration={toast.duration}
                />
            )}

            {/* Timer Modal (décommenté car il est maintenant utilisé globalement) */}
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

            {/* AI Analysis Modal (maintenant rendu via progressionAnalysisContent dans MainWorkoutView et StatsView) */}
            {/* Ce bloc n'est plus nécessaire ici si l'affichage de l'analyse est géré dans les vues spécifiques */}
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