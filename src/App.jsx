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
import TimerModal from './components/TimerModal.jsx'; // Import du TimerModal


// --- Firebase Configuration ---
// Remplacez par vos propres informations de configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSaging_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialisation de l'IA générative
const genAI = GenerativeAIModule.getGenerativeContent({ apiKey: "YOUR_GEMINI_API_KEY" });

const ImprovedWorkoutApp = () => {
    // États de l'application
    // Initialisation robuste des états pour éviter 'undefined'
    const [currentView, setCurrentView] = useState('workout');
    const [workouts, setWorkouts] = useState({ days: {}, dayOrder: [] });
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [globalNotes, setGlobalNotes] = useState('');
    const [toast, setToast] = useState(null);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [isLoadingAIProgression, setIsLoadingAIProgression] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [restTimeInput, setRestTimeInput] = useState('90');
    const timerIntervalRef = useRef(null);
    const [theme, setTheme] = useState('dark'); // 'dark' ou 'light'

    // Fonctions de gestion du minuteur
    const startTimer = useCallback(() => {
        if (!timerIsRunning && timerSeconds > 0) {
            setTimerIsRunning(true);
            setTimerIsFinished(false);
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(timerIntervalRef.current);
                        setTimerIsRunning(false);
                        setTimerIsFinished(true);
                        // showToast('Temps de repos terminé !', 'info'); // Afficher un toast
                        return 0;
                    }
                    return prev - 1;
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
        setTimerSeconds(parseInt(restTimeInput, 10) || 0); // Réinitialise au temps de repos par défaut
    }, [restTimeInput]);

    useEffect(() => {
        setTimerSeconds(parseInt(restTimeInput, 10) || 0);
    }, [restTimeInput]);

    useEffect(() => {
        return () => clearInterval(timerIntervalRef.current);
    }, []);

    const setTimerPreset = useCallback((seconds) => {
        setRestTimeInput(String(seconds));
        setTimerSeconds(seconds);
        if (timerIsRunning) { // Si le minuteur tourne, on le redémarre avec le nouveau preset
            pauseTimer();
            startTimer();
        }
    }, [pauseTimer, startTimer, timerIsRunning]);

    // Fonction d'affichage des toasts
    const showToast = useCallback((message, type = 'info', duration = 3000, action = null) => {
        setToast({ message, type, duration, action });
    }, []);

    // Fonction utilitaire pour formater le temps
    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // Fonction utilitaire pour formater la date
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('fr-FR', options);
    };

    // Authentification anonyme et chargement des données
    useEffect(() => {
        signInAnonymously(auth)
            .catch((error) => {
                console.error("Authentication error:", error);
                showToast('Erreur d\'authentification. Veuillez réessayer.', 'error');
            });

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        // Assurez-vous que workouts est un objet et dayOrder un tableau
                        const fetchedWorkouts = userData.workouts && typeof userData.workouts === 'object'
                            ? {
                                days: userData.workouts.days || {},
                                dayOrder: Array.isArray(userData.workouts.dayOrder) ? userData.workouts.dayOrder : []
                            }
                            : { days: {}, dayOrder: [] };

                        setWorkouts(fetchedWorkouts);
                        setHistoricalData(Array.isArray(userData.historicalData) ? userData.historicalData : []);
                        setPersonalBests(userData.personalBests && typeof userData.personalBests === 'object' ? userData.personalBests : {});
                        setGlobalNotes(typeof userData.globalNotes === 'string' ? userData.globalNotes : '');
                        showToast('Données chargées !', 'success');
                    } else {
                        console.log("No user document found, initializing new user data.");
                        // Initialize with default empty structure if user document doesn't exist
                        setWorkouts({ days: {}, dayOrder: [] });
                        setHistoricalData([]);
                        setPersonalBests({});
                        setGlobalNotes('');
                        setDoc(userDocRef, {
                            workouts: { days: {}, dayOrder: [] },
                            historicalData: [],
                            personalBests: {},
                            globalNotes: '',
                            createdAt: serverTimestamp()
                        }).then(() => {
                            showToast('Nouveau profil créé !', 'success');
                        }).catch(e => {
                            console.error("Error setting initial document:", e);
                            showToast('Erreur lors de la création du profil.', 'error');
                        });
                    }
                }, (error) => {
                    console.error("Error fetching user data:", error);
                    showToast('Erreur lors du chargement des données.', 'error');
                });
                return () => unsubscribeSnapshot();
            } else {
                console.log("User logged out or not authenticated.");
            }
        });

        return () => unsubscribeAuth();
    }, [showToast]);


    // Sauvegarde des données dans Firebase (déclenchée par les changements d'état)
    useEffect(() => {
        const saveUserData = async () => {
            if (auth.currentUser) {
                const userDocRef = doc(db, 'users', auth.currentUser.uid);
                try {
                    await setDoc(userDocRef, {
                        workouts,
                        historicalData,
                        personalBests,
                        globalNotes,
                        lastUpdated: serverTimestamp()
                    }, { merge: true });
                    // showToast('Données sauvegardées !', 'success'); // Désactivé pour éviter trop de toasts
                } catch (e) {
                    console.error("Error saving document: ", e);
                    showToast('Erreur de sauvegarde !', 'error');
                }
            }
        };

        const debounceSave = setTimeout(() => {
            saveUserData();
        }, 1000); // Sauvegarde après 1 seconde d'inactivité

        return () => clearTimeout(debounceSave);
    }, [workouts, historicalData, personalBests, globalNotes, auth.currentUser, showToast]);


    // Fonctions de gestion des entraînements
    const handleAddDay = useCallback((newDayName) => {
        const newDayId = Date.now().toString();
        setWorkouts(prevWorkouts => ({
            ...prevWorkouts,
            days: {
                ...prevWorkouts.days,
                [newDayId]: { id: newDayId, name: newDayName, exercises: [], createdAt: Date.now() }
            },
            dayOrder: [...prevWorkouts.dayOrder, newDayId]
        }));
        showToast(`Jour "${newDayName}" ajouté !`, 'success');
    }, [showToast]);

    const handleRenameDay = useCallback((dayId, newName) => {
        setWorkouts(prevWorkouts => ({
            ...prevWorkouts,
            days: {
                ...prevWorkouts.days,
                [dayId]: { ...prevWorkouts.days[dayId], name: newName }
            }
        }));
        showToast(`Jour renommé en "${newName}"`, 'info');
    }, [showToast]);

    const handleDeleteDay = useCallback((dayId) => {
        setWorkouts(prevWorkouts => {
            const newDays = { ...prevWorkouts.days };
            delete newDays[dayId];
            const newDayOrder = prevWorkouts.dayOrder.filter(id => id !== dayId);
            return { days: newDays, dayOrder: newDayOrder };
        });
        showToast('Jour d\'entraînement supprimé.', 'info');
    }, [showToast]);

    const handleCopyDay = useCallback((dayId) => {
        setWorkouts(prevWorkouts => {
            const originalDay = prevWorkouts.days[dayId];
            if (!originalDay) return prevWorkouts;

            const newDayId = Date.now().toString();
            const newExercises = originalDay.exercises.map(ex => ({
                ...ex,
                id: Date.now().toString() + Math.random(), // Nouvel ID unique pour chaque exercice copié
                series: ex.series.map(s => ({ ...s, completed: false })) // Réinitialiser les séries à non complétées
            }));

            const newDay = {
                ...originalDay,
                id: newDayId,
                name: `${originalDay.name} (Copie)`,
                exercises: newExercises,
                createdAt: Date.now()
            };

            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [newDayId]: newDay
                },
                dayOrder: [...prevWorkouts.dayOrder, newDayId]
            };
        });
        showToast('Jour d\'entraînement copié !', 'success');
    }, [showToast]);


    const handleAddExercise = useCallback((dayId, newExercise) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            if (updatedDays[dayId]) {
                const newExerciseWithId = {
                    ...newExercise,
                    id: Date.now().toString() + Math.random().toString().substring(2, 8)
                };
                updatedDays[dayId] = {
                    ...updatedDays[dayId],
                    exercises: [...updatedDays[dayId].exercises, newExerciseWithId]
                };
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Exercice ajouté !', 'success');
    }, [showToast]);

    const handleUpdateExerciseNotes = useCallback((dayId, exerciseId, newNotes) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                day.exercises = day.exercises.map(ex =>
                    ex.id === exerciseId ? { ...ex, notes: newNotes } : ex
                );
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, []);

    const handleToggleSerieCompleted = useCallback((dayId, exerciseId, serieIndex) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                const exercise = day.exercises.find(ex => ex.id === exerciseId);
                if (exercise && exercise.series && exercise.series[serieIndex]) { // Added check for exercise.series
                    exercise.series[serieIndex].completed = !exercise.series[serieIndex].completed;
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, []);

    const handleUpdateSerie = useCallback((dayId, exerciseId, serieIndex, updatedSerie) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                const exercise = day.exercises.find(ex => ex.id === exerciseId);
                if (exercise && exercise.series && exercise.series[serieIndex]) { // Added check for exercise.series
                    exercise.series[serieIndex] = { ...exercise.series[serieIndex], ...updatedSerie };
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, []);

    const handleAddSerie = useCallback((dayId, exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                const exercise = day.exercises.find(ex => ex.id === exerciseId);
                if (exercise) {
                    // Ensure exercise.series is an array before pushing
                    exercise.series = Array.isArray(exercise.series) ? exercise.series : [];
                    const newSerie = exercise.series.length > 0
                        ? { ...exercise.series[exercise.series.length - 1], completed: false }
                        : { reps: 8, weight: 60, completed: false };
                    exercise.series.push(newSerie);
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, []);

    const handleRemoveSerie = useCallback((dayId, exerciseId, serieIndex) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                const exercise = day.exercises.find(ex => ex.id === exerciseId);
                if (exercise && exercise.series) { // Added check for exercise.series
                    exercise.series.splice(serieIndex, 1);
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, []);

    const handleEditExercise = useCallback((dayId, updatedExercise) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                day.exercises = day.exercises.map(ex =>
                    ex.id === updatedExercise.id ? updatedExercise : ex
                );
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Exercice mis à jour !', 'info');
    }, [showToast]);


    const handleDeleteExercise = useCallback((dayId, exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                day.exercises = day.exercises.map(ex =>
                    ex.id === exerciseId ? { ...ex, isDeleted: true, deletedAt: Date.now() } : ex
                );
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Exercice marqué comme supprimé.', 'info');
    }, [showToast]);


    const handleReactivateExercise = useCallback((dayId, exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const day = updatedDays[dayId];
            if (day) {
                day.exercises = day.exercises.map(ex =>
                    ex.id === exerciseId ? { ...ex, isDeleted: false, deletedAt: null } : ex
                );
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast('Exercice réactivé !', 'success');
    }, [showToast]);


    const handleCompleteWorkout = useCallback(async (dayId) => {
        const completedDay = workouts.days[dayId];
        if (!completedDay) {
            showToast('Jour d\'entraînement non trouvé.', 'error');
            return;
        }

        const sessionDate = new Date().toISOString().split('T')[0];
        const newSession = {
            id: Date.now().toString(),
            date: sessionDate,
            dayName: completedDay.name,
            exercises: completedDay.exercises?.filter(ex => !ex.isDeleted)?.map(ex => ({ // Added optional chaining
                ...ex,
                series: ex.series?.filter(s => s.completed) || [] // Added optional chaining and default to empty array
            }))?.filter(ex => ex.series.length > 0) || [] // Added optional chaining and default to empty array
        };

        if (newSession.exercises.length === 0) {
            showToast('Aucune série complétée pour enregistrer la séance.', 'warning');
            return;
        }

        setHistoricalData(prevData => {
            const updatedData = [...prevData, newSession];
            return updatedData.sort((a, b) => new Date(a.date) - new Date(b.date)); // Tri chronologique
        });
        showToast('Séance enregistrée dans l\'historique !', 'success');

        // Mettre à jour les records personnels
        setPersonalBests(prevBests => {
            const updatedBests = { ...prevBests };
            newSession.exercises.forEach(ex => {
                ex.series.forEach(s => {
                    const currentPB = updatedBests[ex.name];
                    if (!currentPB || (s.weight * s.reps > (currentPB.weight * currentPB.reps || 0))) { // Added null/undefined check
                        updatedBests[ex.name] = {
                            weight: s.weight,
                            reps: s.reps,
                            date: sessionDate
                        };
                    }
                });
            });
            return updatedBests;
        });

        // Réinitialiser les séries complétées après la sauvegarde
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            if (updatedDays[dayId]) {
                updatedDays[dayId].exercises = updatedDays[dayId].exercises?.map(ex => ({ // Added optional chaining
                    ...ex,
                    series: ex.series?.map(s => ({ ...s, completed: false })) || [] // Added optional chaining and default to empty array
                })) || []; // Default to empty array
            }
            return { ...prevWorkouts, days: updatedDays };
        });

    }, [workouts, setHistoricalData, setPersonalBests, setWorkouts, showToast]);


    const handleDeleteHistoricalSession = useCallback((sessionId) => {
        setHistoricalData(prevData => {
            const updatedData = prevData.filter(session => session.id !== sessionId);
            showToast('Séance historique supprimée.', 'info');
            return updatedData;
        });
    }, [showToast]);

    // Fonctions d'analyse IA
    const analyzeProgressionWithAI = useCallback(async (exerciseName, exerciseData) => {
        setIsLoadingAIProgression(true);
        setProgressionAnalysisContent('');
        try {
            const prompt = `Analyse la progression de l'exercice "${exerciseName}" basée sur les données suivantes et donne des conseils pour améliorer la progression : ${JSON.stringify(exerciseData)}. Concentre-toi sur l'évolution du volume, de la force et de la fréquence. Donne des conseils précis et des prochaines étapes claires pour la personne. Réponds en français.`;
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setProgressionAnalysisContent(text);
        } catch (error) {
            console.error("Error analyzing progression with AI:", error);
            setProgressionAnalysisContent("Désolé, une erreur est survenue lors de l'analyse de la progression.");
            showToast('Erreur lors de l\'analyse IA.', 'error');
        } finally {
            setIsLoadingAIProgression(false);
        }
    }, [showToast]);


    const analyzeGlobalStatsWithAI = useCallback(async (stats, history, bests, workoutDays) => {
        setIsLoadingAIProgression(true);
        setProgressionAnalysisContent(''); // Clear previous analysis
        try {
            const prompt = `En tant que coach sportif IA, analyse ces statistiques d'entraînement globales et donne des conseils personnalisés à l'utilisateur pour l'aider à atteindre ses objectifs. Utilise les données suivantes:
            - Statistiques globales: ${JSON.stringify(stats)}
            - Données historiques (résumé): ${JSON.stringify(history.map(s => ({ date: s.date, dayName: s.dayName, exercisesCount: s.exercises.length })))}
            - Records personnels: ${JSON.stringify(bests)}
            - Jours d'entraînement actuels: ${JSON.stringify(Object.values(workoutDays).map(d => d.name))}
            
            Concentre-toi sur les tendances, les points forts et les faiblesses potentielles. Propose des actions concrètes et motivantes. Réponds en français.`;

            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setProgressionAnalysisContent(text);
        } catch (error) {
            console.error("Error analyzing global stats with AI:", error);
            setProgressionAnalysisContent("Désolé, une erreur est survenue lors de l'analyse globale.");
            showToast('Erreur lors de l\'analyse globale IA.', 'error');
        } finally {
            setIsLoadingAIProgression(false);
        }
    }, [showToast]);

    const handleGenerateAISuggestions = useCallback(async (currentDayExercises) => {
        setIsLoadingAIProgression(true);
        setAiSuggestions([]); // Clear previous suggestions
        try {
            const prompt = `En tant que coach sportif IA, propose des suggestions d'exercices ou de modifications de séries pour améliorer la séance d'entraînement actuelle. Les exercices actuels sont: ${JSON.stringify(currentDayExercises.map(ex => ({ name: ex.name, series: ex.series })))}. Tiens compte de la variété, de la progression et de l'équilibre musculaire. Propose 3 à 5 suggestions concrètes. Réponds en français.`;
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            // Parse text into an array of suggestions (assuming bullet points or numbered list)
            const suggestionsArray = text.split('\n').filter(line => line.trim().length > 0 && (line.includes('-') || line.includes('.'))).map(line => line.replace(/^-+\s*|^[0-9]+\.\s*/, '').trim());
            setAiSuggestions(suggestionsArray);
            showToast('Suggestions IA générées !', 'success');
        } catch (error) {
            console.error("Error generating AI suggestions:", error);
            setAiSuggestions(["Désolé, une erreur est survenue lors de la génération des suggestions IA."]);
            showToast('Erreur lors de la génération des suggestions IA.', 'error');
        } finally {
            setIsLoadingAIProgression(false);
        }
    }, [showToast]);


    // Fonctions pour les StatsView props
    // Ajout de vérifications défensives pour les paramètres dayOrder et days
    const getWorkoutStats = useCallback((dayOrder = [], days = {}) => {
        let totalWorkouts = 0;
        let totalExercises = new Set();
        let totalVolume = 0;
        let volumeByExercise = {};

        dayOrder.forEach(dayId => {
            const day = days[dayId];
            if (day && Array.isArray(day.exercises)) {
                totalWorkouts++;
                day.exercises.forEach(ex => {
                    if (!ex.isDeleted) {
                        totalExercises.add(ex.name);
                        // Assurez-vous que ex.series est un tableau avant de l'itérer
                        (ex.series || []).forEach(s => {
                            if (s.completed) {
                                const volume = (s.weight || 0) * (s.reps || 0); // Defensive checks for s.weight, s.reps
                                totalVolume += volume;
                                volumeByExercise[ex.name] = (volumeByExercise[ex.name] || 0) + volume;
                            }
                        });
                    }
                });
            }
        });

        const averageVolume = totalWorkouts > 0 ? totalVolume / totalWorkouts : 0;
        const favoriteExercise = Object.keys(volumeByExercise).length > 0
            ? Object.keys(volumeByExercise).reduce((a, b) => volumeByExercise[a] > volumeByExercise[b] ? a : b)
            : 'N/A';

        return {
            totalWorkouts,
            totalExercises: totalExercises.size,
            averageVolume,
            favoriteExercise
        };
    }, []);

    const getExerciseVolumeData = useCallback((dayOrder = [], days = {}) => {
        const data = {};
        dayOrder.forEach(dayId => {
            const day = days[dayId];
            if (day && Array.isArray(day.exercises)) {
                day.exercises.forEach(ex => {
                    if (!ex.isDeleted) {
                        (ex.series || []).forEach(s => {
                            if (s.completed) {
                                const volume = (s.weight || 0) * (s.reps || 0);
                                data[ex.name] = (data[ex.name] || 0) + volume;
                            }
                        });
                    }
                });
            }
        });
        return Object.entries(data).map(([name, totalVolume]) => ({ exerciseName: name, totalVolume }));
    }, []);

    const getDailyVolumeData = useCallback((history = []) => {
        const dailyVolumes = {};
        history.forEach(session => {
            const date = session.date;
            let sessionVolume = 0;
            if (Array.isArray(session.exercises)) {
                session.exercises.forEach(ex => {
                    if (!ex.isDeleted && Array.isArray(ex.series)) {
                        ex.series.forEach(s => {
                            if (s.completed) {
                                sessionVolume += (s.weight || 0) * (s.reps || 0);
                            }
                        });
                    }
                });
            }
            dailyVolumes[date] = (dailyVolumes[date] || 0) + sessionVolume;
        });

        return Object.keys(dailyVolumes)
            .sort((a, b) => new Date(a) - new Date(b))
            .map(date => ({ date, totalVolume: dailyVolumes[date] }));
    }, []);

    const getExerciseFrequencyData = useCallback((history = []) => {
        const frequency = {};
        history.forEach(session => {
            if (Array.isArray(session.exercises)) {
                session.exercises.forEach(ex => {
                    if (!ex.isDeleted && Array.isArray(ex.series) && ex.series.some(s => s.completed)) {
                        frequency[ex.name] = (frequency[ex.name] || 0) + 1;
                    }
                });
            }
        });
        return Object.entries(frequency).map(([name, count]) => ({ name, count }));
    }, []);


    // Fonction pour l'import/export de données (simple JSON)
    const handleExportData = useCallback(() => {
        const dataToExport = {
            workouts,
            historicalData,
            personalBests,
            globalNotes,
        };
        const jsonString = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workout_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Données exportées avec succès !', 'success');
    }, [workouts, historicalData, personalBests, globalNotes, showToast]);

    const handleImportData = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                // Validation simple des données importées
                if (importedData.workouts && importedData.historicalData && importedData.personalBests) {
                    // Ensure proper type before setting state
                    setWorkouts(importedData.workouts);
                    setHistoricalData(Array.isArray(importedData.historicalData) ? importedData.historicalData : []);
                    setPersonalBests(importedData.personalBests && typeof importedData.personalBests === 'object' ? importedData.personalBests : {});
                    setGlobalNotes(typeof importedData.globalNotes === 'string' ? importedData.globalNotes : '');
                    showToast('Données importées avec succès !', 'success');
                } else {
                    throw new Error('Fichier JSON invalide ou incomplet.');
                }
            } catch (error) {
                console.error("Error importing data:", error);
                showToast(`Erreur lors de l'importation: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }, [showToast]);

    // Thème
    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
    };

    useEffect(() => {
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        // Applique des styles spécifiques au body si nécessaire
        document.body.style.backgroundColor = theme === 'dark' ? '#111827' : '#f9fafb';
        document.body.style.color = theme === 'dark' ? '#f3f4f6' : '#1f2937';
    }, [theme]);


    return (
        <div className={`app-container min-h-screen flex flex-col ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
            <header className={`py-4 px-4 sm:px-6 flex justify-between items-center shadow-md z-10 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    💪 WorkoutApp
                </h1>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setIsTimerModalOpen(true)}
                            className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center"
                            aria-label="Open Timer"
                        >
                            <Clock className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow pb-20"> {/* Ajout de padding-bottom pour la barre de navigation */}
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        setWorkouts={setWorkouts}
                        onToggleSerieCompleted={handleToggleSerieCompleted}
                        onUpdateSerie={handleUpdateSerie}
                        onAddSerie={handleAddSerie}
                        onRemoveSerie={handleRemoveSerie}
                        onUpdateExerciseNotes={handleUpdateExerciseNotes}
                        onEditClick={handleEditExercise}
                        onDeleteExercise={handleDeleteExercise}
                        addDay={handleAddDay}
                        renameDay={handleRenameDay}
                        deleteDay={handleDeleteDay}
                        copyDay={handleCopyDay}
                        addExercise={handleAddExercise}
                        completeWorkout={handleCompleteWorkout}
                        formatDate={formatDate}
                        personalBests={personalBests}
                        getWorkoutStats={getWorkoutStats} // Pass to MainWorkoutView
                        globalNotes={globalNotes}
                        setGlobalNotes={setGlobalNotes}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        progressionAnalysisContent={progressionAnalysisContent}
                        setProgressionAnalysisContent={setProgressionAnalysisContent}
                        isLoadingAI={isLoadingAIProgression}
                        onGenerateAISuggestions={handleGenerateAISuggestions}
                        aiSuggestions={aiSuggestions}
                        showToast={showToast}
                        handleReactivateExercise={handleReactivateExercise}
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
                        deleteHistoricalSession={handleDeleteHistoricalSession}
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
                        setTimerPreset={setTimerPreset}
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
                        isLoadingAI={isLoadingAIProgression}
                        progressionAnalysisContent={progressionAnalysisContent}
                        getWorkoutStats={getWorkoutStats}
                        getExerciseVolumeData={getExerciseVolumeData}
                        getDailyVolumeData={getDailyVolumeData}
                        getExerciseFrequencyData={getExerciseFrequencyData}
                        showToast={showToast}
                    />
                )}
            </main>

            {/* Barre de navigation inférieure */}
            <BottomNavigationBar
                currentView={currentView}
                setCurrentView={setCurrentView}
            />

            {/* Toast notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                    action={toast.action}
                    duration={toast.duration}
                />
            )}

            {/* Timer Modal */}
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
        </div>
    );
};

export default ImprovedWorkoutApp;