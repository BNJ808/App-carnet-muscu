import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, limit, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
    Undo2, Redo2, Settings, XCircle, ChevronDown, ChevronUp, Pencil, Sparkles, ArrowUp, ArrowDown,
    Plus, Trash2, Play, Pause, RotateCcw, Search, Filter, Dumbbell, Clock, History, NotebookText,
    LineChart as LineChartIcon, Target, TrendingUp, Award, Calendar, BarChart3, Moon, Sun,
    Zap, Download, Upload, Share, Eye, EyeOff, Maximize2, Minimize2, Activity
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Import de l'API Google Generative AI
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // Import de recharts ici pour le graphique

// Import des composants séparés. Veuillez vous assurer que ces fichiers (.jsx) sont tous dans le même répertoire que App.jsx
import Toast from './Toast.jsx';
import MainWorkoutView from './MainWorkoutView.jsx';
import HistoryView from './HistoryView.jsx';
import TimerView from './TimerView.jsx';
import BottomNavigationBar from './BottomNavigationBar.jsx';
import StatsView from './StatsView.jsx';

// Configuration Firebase sécurisée
// Utilisation de __firebase_config et __initial_auth_token fournis par l'environnement Canvas
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "demo-key",
    authDomain: "demo-project.firebaseapp.com",
    projectId: "demo-project",
    storageBucket: "demo-project.appspot.com",
    messagingSenderId: "demo-sender-id",
    appId: "demo-app-id",
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialisation de Google Generative AI
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY;
let us; // Déclaration de 'us' à un niveau de portée supérieur
let geminiModel; // Déclaration du modèle Gemini

if (GEMINI_API_KEY) {
    try {
        us = new GoogleGenerativeAI(GEMINI_API_KEY);
        geminiModel = us.getGenerativeModel({ model: "gemini-pro" });
    } catch (error) {
        console.error("Erreur lors de l'initialisation de Google Generative AI :", error);
        // Gérer l'erreur, par exemple en désactivant les fonctionnalités IA
        us = null;
        geminiModel = null;
    }
} else {
    console.warn("Clé API Gemini non définie. Les fonctionnalités IA seront désactivées.");
    us = null;
    geminiModel = null;
}

const ImprovedWorkoutApp = () => {
    const [user, setUser] = useState(null);
    const [workouts, setWorkouts] = useState({ days: {}, dayOrder: [] });
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [currentView, setCurrentView] = useState('workout'); // 'workout', 'timer', 'history', 'stats'
    const [toast, setToast] = useState(null);
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [isCompactView, setIsCompactView] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [globalNotes, setGlobalNotes] = useState('');
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false); // État pour le chargement de l'analyse IA
    const [showProgressionGraph, setShowProgressionGraph] = useState(false);
    const [progressionGraphData, setProgressionGraphData] = useState([]);
    const [progressionGraphExerciseName, setProgressionGraphExerciseName] = useState('');

    // Timer States
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const timerIntervalRef = useRef(null);

    const showToast = useCallback((message, type = 'info', duration = 3000, action = null) => {
        setToast({ message, type, duration, action });
    }, []);

    const hideToast = useCallback(() => {
        setToast(null);
    }, []);

    const toggleAdvancedMode = () => {
        setIsAdvancedMode(prev => {
            const newState = !prev;
            localStorage.setItem('isAdvancedMode', JSON.stringify(newState));
            showToast(`Mode avancé ${newState ? 'activé' : 'désactivé'}`, 'info');
            return newState;
        });
    };

    const toggleCompactView = () => {
        setIsCompactView(prev => {
            const newState = !prev;
            localStorage.setItem('isCompactView', JSON.stringify(newState));
            showToast(`Vue compacte ${newState ? 'activée' : 'désactivée'}`, 'info');
            return newState;
        });
    };

    useEffect(() => {
        const storedAdvancedMode = localStorage.getItem('isAdvancedMode');
        if (storedAdvancedMode !== null) {
            setIsAdvancedMode(JSON.parse(storedAdvancedMode));
        }
        const storedCompactView = localStorage.getItem('isCompactView');
        if (storedCompactView !== null) {
            setIsCompactView(JSON.parse(storedCompactView));
        }
    }, []);

    // Firebase Auth et Firestore listeners
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setIsLoading(true); // Commencer le chargement des données
                const userDocRef = doc(db, 'users', currentUser.uid);

                // Listener pour les données d'entraînement
                const unsubscribeWorkouts = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setWorkouts(data.workouts || { days: {}, dayOrder: [] });
                        setPersonalBests(data.personalBests || {});
                        setGlobalNotes(data.globalNotes || '');
                        setHistoricalData(data.historicalData || []); // Assurez-vous que historicalData est toujours un tableau
                    } else {
                        // Document n'existe pas, initialiser avec des données vides
                        setWorkouts({ days: {}, dayOrder: [] });
                        setPersonalBests({});
                        setGlobalNotes('');
                        setHistoricalData([]);
                        // Créer le document utilisateur si inexistant
                        setDoc(userDocRef, {
                            workouts: { days: {}, dayOrder: [] },
                            personalBests: {},
                            globalNotes: '',
                            historicalData: [],
                            createdAt: serverTimestamp()
                        }, { merge: true }).catch(e => console.error("Error creating user doc:", e));
                    }
                    setIsLoading(false);
                }, (error) => {
                    console.error("Error fetching user data:", error);
                    showToast("Erreur de chargement des données.", "error");
                    setIsLoading(false);
                });

                return () => unsubscribeWorkouts();
            } else {
                // Tenter de se connecter anonymement si non connecté
                try {
                    // Utiliser signInWithCustomToken si disponible, sinon signInAnonymously
                    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Erreur de connexion anonyme ou par token:", error);
                    showToast("Erreur de connexion. Réessayez.", "error");
                    setIsLoading(false);
                }
            }
        });

        return () => unsubscribeAuth();
    }, []);

    // Fonction pour sauvegarder les données dans Firestore
    const saveUserData = useCallback(async (dataToSave, successMessage = null, errorMessage = "Erreur de sauvegarde.") => {
        if (!user) return;
        const userDocRef = doc(db, 'users', user.uid);
        try {
            await setDoc(userDocRef, dataToSave, { merge: true });
            if (successMessage) {
                showToast(successMessage, 'success');
            }
        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            showToast(errorMessage, 'error');
        }
    }, [user, showToast]);

    // Fonctions de gestion des entraînements (jour, catégorie, exercice, série)
    // --- Gestion des Jours ---
    const handleAddDay = useCallback(async (dayName) => {
        if (!dayName.trim() || Object.values(workouts.days).some(day => day.name.toLowerCase() === dayName.toLowerCase())) {
            showToast("Nom de jour invalide ou déjà existant.", "warning");
            return;
        }

        const newDayId = `day-${Date.now()}`;
        const updatedWorkouts = {
            ...workouts,
            days: {
                ...workouts.days,
                [newDayId]: { id: newDayId, name: dayName, categories: {} }
            },
            dayOrder: [...workouts.dayOrder, newDayId]
        };
        setWorkouts(updatedWorkouts);
        await saveUserData({ workouts: updatedWorkouts }, "Jour ajouté !");
    }, [workouts, saveUserData, showToast]);

    const handleEditDay = useCallback(async (dayId, newDayName) => {
        if (!newDayName.trim()) {
            showToast("Le nom du jour ne peut pas être vide.", "warning");
            return;
        }
        const updatedWorkouts = { ...workouts };
        if (updatedWorkouts.days[dayId]) {
            updatedWorkouts.days[dayId].name = newDayName;
            setWorkouts(updatedWorkouts);
            await saveUserData({ workouts: updatedWorkouts }, "Jour modifié !");
        }
    }, [workouts, saveUserData, showToast]);

    const handleDeleteDay = useCallback(async (dayId) => {
        const updatedWorkouts = { ...workouts };
        const dayToDelete = updatedWorkouts.days[dayId];
        if (!dayToDelete) return;

        // Collect all exercises from the day to mark them as deleted
        const exercisesToDelete = [];
        Object.values(dayToDelete.categories || {}).forEach(exercises => {
            exercises.forEach(exercise => {
                exercisesToDelete.push({ ...exercise, isDeleted: true, deletedAt: serverTimestamp() });
            });
        });

        delete updatedWorkouts.days[dayId];
        updatedWorkouts.dayOrder = updatedWorkouts.dayOrder.filter(id => id !== dayId);

        // Update historicalData to mark exercises as deleted
        const updatedHistoricalData = historicalData.map(session => ({
            ...session,
            exercises: session.exercises.map(ex => {
                const foundDeleted = exercisesToDelete.find(delEx => delEx.id === ex.id);
                return foundDeleted ? { ...ex, isDeleted: true, deletedAt: foundDeleted.deletedAt } : ex;
            })
        }));

        setWorkouts(updatedWorkouts);
        setHistoricalData(updatedHistoricalData);
        await saveUserData({ workouts: updatedWorkouts, historicalData: updatedHistoricalData }, "Jour et exercices supprimés !");
    }, [workouts, historicalData, saveUserData, showToast]);

    // --- Gestion des Exercices ---
    const handleAddExerciseClick = useCallback(async (dayId, categoryName, newExerciseName) => {
        if (!newExerciseName.trim()) {
            showToast("Le nom de l'exercice ne peut pas être vide.", "warning");
            return;
        }

        const newExercise = {
            id: `exercise-${Date.now()}`,
            name: newExerciseName,
            isCompleted: false, // L'exercice lui-même n'a pas de concept de complété
            series: [],
            notes: '',
            isDeleted: false,
            createdAt: serverTimestamp()
        };

        const updatedWorkouts = { ...workouts };
        if (!updatedWorkouts.days[dayId].categories[categoryName]) {
            updatedWorkouts.days[dayId].categories[categoryName] = [];
        }
        updatedWorkouts.days[dayId].categories[categoryName].push(newExercise);

        setWorkouts(updatedWorkouts);
        await saveUserData({ workouts: updatedWorkouts }, "Exercice ajouté !");
    }, [workouts, saveUserData, showToast]);


    const handleEditClick = useCallback(async (dayId, categoryName, exerciseId, updatedExercise) => {
        const updatedWorkouts = { ...workouts };
        const exercises = updatedWorkouts.days[dayId]?.categories[categoryName];
        if (exercises) {
            const index = exercises.findIndex(ex => ex.id === exerciseId);
            if (index !== -1) {
                // Ensure series are only updated if provided, otherwise keep existing
                if (updatedExercise.series) {
                    updatedExercise.series = updatedExercise.series.map(series => ({
                        ...series,
                        completed: series.completed ?? false // Ensure 'completed' is always a boolean
                    }));
                }

                updatedWorkouts.days[dayId].categories[categoryName][index] = {
                    ...exercises[index],
                    ...updatedExercise
                };
                setWorkouts(updatedWorkouts);
                await saveUserData({ workouts: updatedWorkouts }, "Exercice mis à jour !");
            }
        }
    }, [workouts, saveUserData, showToast]);

    const handleDeleteExercise = useCallback(async (dayId, categoryName, exerciseId) => {
        const updatedWorkouts = { ...workouts };
        const exercises = updatedWorkouts.days[dayId]?.categories[categoryName];
        if (exercises) {
            const index = exercises.findIndex(ex => ex.id === exerciseId);
            if (index !== -1) {
                const exerciseToDelete = exercises[index];
                exerciseToDelete.isDeleted = true;
                exerciseToDelete.deletedAt = serverTimestamp();

                // Remove from active view, but keep in data with isDeleted flag
                updatedWorkouts.days[dayId].categories[categoryName] = exercises.filter(ex => ex.id !== exerciseId);

                // Update historicalData to mark the corresponding exercises as deleted
                const updatedHistoricalData = historicalData.map(session => ({
                    ...session,
                    exercises: session.exercises.map(ex =>
                        (ex.name === exerciseToDelete.name && !ex.isDeleted) ? { ...ex, isDeleted: true, deletedAt: exerciseToDelete.deletedAt } : ex
                    )
                }));

                setWorkouts(updatedWorkouts);
                setHistoricalData(updatedHistoricalData);
                await saveUserData({ workouts: updatedWorkouts, historicalData: updatedHistoricalData }, "Exercice supprimé !");
            }
        }
    }, [workouts, historicalData, saveUserData, showToast]);

    const handleReactivateExercise = useCallback(async (exerciseName) => {
        const updatedWorkouts = { ...workouts };
        let reactivated = false;

        // Chercher l'exercice supprimé dans les jours et le réactiver
        for (const dayId in updatedWorkouts.days) {
            const day = updatedWorkouts.days[dayId];
            for (const categoryName in day.categories) {
                const exercises = day.categories[categoryName];
                const index = exercises.findIndex(ex => ex.name === exerciseName && ex.isDeleted);
                if (index !== -1) {
                    exercises[index].isDeleted = false;
                    delete exercises[index].deletedAt; // Remove deletedAt timestamp
                    // Move reactivated exercise to the end of its category if it was the only one
                    // or re-add it to the main list if it was completely removed from the category
                    const reactivatedExercise = exercises.splice(index, 1)[0];
                    exercises.push(reactivatedExercise);
                    reactivated = true;
                    break; // Exercise found and reactivated, break from inner loop
                }
            }
            if (reactivated) break; // Break from outer loop if reactivated
        }

        if (reactivated) {
            // Also update historical data if necessary, by marking related entries as not deleted
            const updatedHistoricalData = historicalData.map(session => ({
                ...session,
                exercises: session.exercises.map(ex =>
                    (ex.name === exerciseName && ex.isDeleted) ? { ...ex, isDeleted: false, deletedAt: null } : ex
                )
            }));

            setWorkouts(updatedWorkouts);
            setHistoricalData(updatedHistoricalData);
            await saveUserData({ workouts: updatedWorkouts, historicalData: updatedHistoricalData }, "Exercice réactivé !");
        } else {
            showToast("L'exercice n'a pas pu être réactivé.", "warning");
        }
    }, [workouts, historicalData, saveUserData, showToast]);


    // --- Gestion des Séries ---
    const handleAddSeries = useCallback(async (dayId, categoryName, exerciseId) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days[dayId]?.categories[categoryName]?.find(ex => ex.id === exerciseId);

        if (exercise) {
            const newSeries = {
                id: `series-${Date.now()}`,
                reps: 0,
                weight: 0,
                completed: false, // Nouvelle série est par défaut non complétée
            };
            exercise.series.push(newSeries);
            setWorkouts(updatedWorkouts);
            await saveUserData({ workouts: updatedWorkouts }); // Pas de toast ici pour éviter le spam
        }
    }, [workouts, saveUserData]);


    const handleUpdateSeries = useCallback(async (dayId, categoryName, exerciseId, seriesId, updatedValues) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days[dayId]?.categories[categoryName]?.find(ex => ex.id === exerciseId);

        if (exercise) {
            const seriesIndex = exercise.series.findIndex(s => s.id === seriesId);
            if (seriesIndex !== -1) {
                exercise.series[seriesIndex] = { ...exercise.series[seriesIndex], ...updatedValues };
                setWorkouts(updatedWorkouts);
                await saveUserData({ workouts: updatedWorkouts }); // Pas de toast ici
            }
        }
    }, [workouts, saveUserData]);

    const handleDeleteSeries = useCallback(async (dayId, categoryName, exerciseId, seriesId) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days[dayId]?.categories[categoryName]?.find(ex => ex.id === exerciseId);

        if (exercise) {
            exercise.series = exercise.series.filter(s => s.id !== seriesId);
            setWorkouts(updatedWorkouts);
            await saveUserData({ workouts: updatedWorkouts }); // Pas de toast ici
        }
    }, [workouts, saveUserData]);

    const handleToggleSeriesCompleted = useCallback(async (dayId, categoryName, exerciseId, seriesId, isCompleted) => {
        const updatedWorkouts = { ...workouts };
        const exercise = updatedWorkouts.days[dayId]?.categories[categoryName]?.find(ex => ex.id === exerciseId);

        if (exercise) {
            const series = exercise.series.find(s => s.id === seriesId);
            if (series) {
                series.completed = isCompleted;
                setWorkouts(updatedWorkouts);
                await saveUserData({ workouts: updatedWorkouts });
            }
        }
    }, [workouts, saveUserData]);


    // Fonction pour ajouter un workout terminé à l'historique et mettre à jour les records
    const addWorkoutToHistoryAndSave = useCallback(async () => {
        const completedSession = {
            id: `session-${Date.now()}`,
            timestamp: serverTimestamp(),
            exercises: []
        };

        let updatedPersonalBests = { ...personalBests };

        Object.values(workouts.days).forEach(day => {
            Object.values(day.categories).forEach(exercises => {
                exercises.forEach(exercise => {
                    const completedSeries = exercise.series.filter(s => s.completed);
                    if (completedSeries.length > 0) {
                        completedSession.exercises.push({
                            id: exercise.id,
                            name: exercise.name,
                            category: Object.keys(day.categories).find(cat => day.categories[cat].includes(exercise)), // Trouver la catégorie
                            notes: exercise.notes,
                            series: completedSeries.map(s => ({ reps: s.reps, weight: s.weight })),
                            isDeleted: exercise.isDeleted || false, // Conserver l'état de suppression
                            deletedAt: exercise.deletedAt || null
                        });

                        // Mettre à jour les records personnels
                        const exerciseName = exercise.name.toLowerCase();
                        if (!updatedPersonalBests[exerciseName]) {
                            updatedPersonalBests[exerciseName] = { maxWeight: 0, maxReps: 0, maxVolume: 0, lastAchieved: null, bestWeightSeries: null, bestRepsSeries: null, bestVolumeSeries: null };
                        }

                        completedSeries.forEach(s => {
                            const volume = s.reps * s.weight;

                            // Max Weight
                            if (s.weight > updatedPersonalBests[exerciseName].maxWeight) {
                                updatedPersonalBests[exerciseName].maxWeight = s.weight;
                                updatedPersonalBests[exerciseName].bestWeightSeries = { reps: s.reps, weight: s.weight, date: Timestamp.now() };
                            } else if (s.weight === updatedPersonalBests[exerciseName].maxWeight && s.reps > (updatedPersonalBests[exerciseName].bestWeightSeries?.reps || 0)) {
                                // If same weight, update if reps are higher
                                updatedPersonalBests[exerciseName].bestWeightSeries = { reps: s.reps, weight: s.weight, date: Timestamp.now() };
                            }


                            // Max Reps
                            if (s.reps > updatedPersonalBests[exerciseName].maxReps) {
                                updatedPersonalBests[exerciseName].maxReps = s.reps;
                                updatedPersonalBests[exerciseName].bestRepsSeries = { reps: s.reps, weight: s.weight, date: Timestamp.now() };
                            } else if (s.reps === updatedPersonalBests[exerciseName].maxReps && s.weight > (updatedPersonalBests[exerciseName].bestRepsSeries?.weight || 0)) {
                                // If same reps, update if weight is higher
                                updatedPersonalBests[exerciseName].bestRepsSeries = { reps: s.reps, weight: s.weight, date: Timestamp.now() };
                            }

                            // Max Volume
                            if (volume > updatedPersonalBests[exerciseName].maxVolume) {
                                updatedPersonalBests[exerciseName].maxVolume = volume;
                                updatedPersonalBests[exerciseName].bestVolumeSeries = { reps: s.reps, weight: s.weight, date: Timestamp.now() };
                            }
                        });
                        updatedPersonalBests[exerciseName].lastAchieved = Timestamp.now();
                    }
                });
            });
        });

        // Add to historicalData only if there are completed exercises
        if (completedSession.exercises.length > 0) {
            const updatedHistoricalData = [...historicalData, completedSession];
            setHistoricalData(updatedHistoricalData);
            setPersonalBests(updatedPersonalBests);
            await saveUserData({ historicalData: updatedHistoricalData, personalBests: updatedPersonalBests }, "Séance sauvegardée et records mis à jour !");
        } else {
            showToast("Aucune série complétée pour sauvegarder la séance.", "warning");
        }

        // Reset completed state for all series
        const workoutsAfterSave = JSON.parse(JSON.stringify(workouts)); // Deep copy
        Object.values(workoutsAfterSave.days).forEach(day => {
            Object.values(day.categories).forEach(exercises => {
                exercises.forEach(exercise => {
                    exercise.series.forEach(s => {
                        s.completed = false;
                    });
                });
            });
        });
        setWorkouts(workoutsAfterSave);
        await saveUserData({ workouts: workoutsAfterSave }); // Sauvegarder l'état reset des séries
    }, [workouts, historicalData, personalBests, saveUserData, showToast]);


    // Timer functions
    const startTimer = useCallback(() => {
        if (!timerIsRunning) {
            setTimerIsRunning(true);
            setTimerIsFinished(false);
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds(prevSeconds => {
                    if (prevSeconds <= 1) {
                        clearInterval(timerIntervalRef.current);
                        setTimerIsRunning(false);
                        setTimerIsFinished(true);
                        showToast("Temps de repos terminé !", "success");
                        return 0;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        }
    }, [timerIsRunning, showToast]);

    const pauseTimer = useCallback(() => {
        clearInterval(timerIntervalRef.current);
        setTimerIsRunning(false);
    }, []);

    const resetTimer = useCallback(() => {
        clearInterval(timerIntervalRef.current);
        setTimerIsRunning(false);
        setTimerSeconds(0);
        setTimerIsFinished(false);
    }, []);

    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const setTimerPreset = useCallback((seconds) => {
        resetTimer();
        setTimerSeconds(seconds);
    }, [resetTimer]);


    // AI Integration (Gemini)
    const analyzeProgressionWithAI = useCallback(async (exerciseName, history) => {
        if (!geminiModel) {
            showToast("Service d'IA non disponible. Clé API Gemini manquante ou erreur d'initialisation.", "error");
            return;
        }

        setAiAnalysisLoading(true);
        showToast("Analyse de progression IA en cours...", "info", 0); // Durée 0 pour un toast persistant

        try {
            let prompt = `Analyse ma progression pour l'exercice "${exerciseName}" basée sur l'historique suivant. Pour chaque entrée, il y a le poids (kg) et les répétitions: \n\n`;

            history.forEach(session => {
                prompt += `Date: ${formatDate(session.timestamp?.toDate ? session.timestamp.toDate() : session.timestamp)}, Séries: `;
                session.series.forEach((s, idx) => {
                    prompt += `${s.weight}kg x ${s.reps}${idx < session.series.length - 1 ? ', ' : ''}`;
                });
                prompt += '\n';
            });

            prompt += `\nFournis une analyse concise de la progression (ex: augmentation du poids, des répétitions, stagnation, etc.), identifie les tendances, et offre un ou deux conseils spécifiques pour améliorer la progression. Rédige en français et garde la réponse à environ 3-5 phrases, sans inclure de salutation ou de clôture.`;

            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            showToast(text, 'success', 10000); // Afficher le résultat pour 10 secondes
        } catch (error) {
            console.error("Erreur lors de l'analyse IA de progression:", error);
            showToast("Échec de l'analyse IA de progression. Réessayez.", "error");
        } finally {
            setAiAnalysisLoading(false);
            hideToast(); // Masquer le toast de chargement
        }
    }, [showToast, geminiModel]);

    const analyzeGlobalStatsWithAI = useCallback(async () => {
        if (!geminiModel) {
            showToast("Service d'IA non disponible. Clé API Gemini manquante ou erreur d'initialisation.", "error");
            return;
        }

        setAiAnalysisLoading(true);
        showToast("Analyse globale IA en cours...", "info", 0);

        try {
            let prompt = `Analyse les statistiques globales d'entraînement suivantes et fournis des insights et des conseils. Concentre-toi sur l'équilibre, la cohérence et les opportunités d'amélioration. Rédige en français et garde la réponse à environ 5-7 phrases, sans inclure de salutation ou de clôture.

            Statistiques actuelles:
            - Nombre total de séances enregistrées : ${historicalData.length}
            - Nombre d'exercices actifs : ${Object.values(workouts.days).flatMap(day => Object.values(day.categories)).flat().filter(ex => !ex.isDeleted).length}
            - Exercices avec records personnels: ${Object.keys(personalBests).length}

            Dernières 5 séances (dates et nombre d'exercices):
            ${historicalData.slice(-5).map(session => `- ${formatDate(session.timestamp?.toDate ? session.timestamp.toDate() : session.timestamp)}: ${session.exercises.length} exercices`).join('\n')}

            Principaux groupes musculaires entraînés (basé sur les catégories d'exercices) et leur volume approximatif (très approximatif, concentrez-vous sur la présence/absence et l'équilibre):
            ${Object.values(workouts.days).flatMap(day => Object.entries(day.categories)).reduce((acc, [catName, exercises]) => {
                const totalVolumeCat = exercises.reduce((sum, ex) => sum + ex.series.reduce((sSum, s) => sSum + (s.reps * s.weight), 0), 0);
                if (totalVolumeCat > 0) acc.push(`${catName}: ${totalVolumeCat} kg`);
                return acc;
            }, []).join('\n')}

            Conseils:
            `;

            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            setGlobalNotes(text); // Mettre à jour les notes globales avec l'analyse IA
            showToast("Analyse IA globale terminée !", "success", 5000);
            await saveUserData({ globalNotes: text }, null); // Sauvegarder les notes
        } catch (error) {
            console.error("Erreur lors de l'analyse IA globale:", error);
            showToast("Échec de l'analyse IA globale. Réessayez.", "error");
        } finally {
            setAiAnalysisLoading(false);
            hideToast();
        }
    }, [historicalData, workouts, personalBests, showToast, saveUserData, setGlobalNotes, geminiModel]);


    const showProgressionGraphForExercise = useCallback((exerciseName, data) => {
        setProgressionGraphExerciseName(exerciseName);
        setProgressionGraphData(data);
        setShowProgressionGraph(true);
    }, []);

    // Formatteur pour les tooltips des graphiques
    const formatGraphTooltip = useCallback((value, name, props) => {
        if (name === "Poids Max (kg)") {
            return [`${value} kg`, name];
        } else if (name === "Reps Max") {
            return [`${value} reps`, name];
        } else if (name === "Volume Max (kg)") {
            return [`${value} kg`, name];
        }
        return [value, name];
    }, []);

    // Helper pour formater les dates
    const formatDate = useCallback((date) => {
        if (!date) return 'N/A';
        // Assurez-vous que c'est bien un objet Date
        const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
        return d.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }, []);

    const getSeriesDisplay = useCallback((series) => {
        return series.map(s => `${s.weight || 0}kg x ${s.reps || 0}`).join(' / ');
    }, []);

    // Affichage des vues
    const renderView = () => {
        switch (currentView) {
            case 'workout':
                return (
                    <MainWorkoutView
                        workouts={workouts}
                        selectedDayFilter={null} // Pas de filtre de jour ici
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
                        isSavingExercise={false} // Pas directement géré ici, à affiner si besoin
                        isDeletingExercise={false} // Pas directement géré ici
                        isAddingExercise={false} // Pas directement géré ici
                        searchTerm={''} // Pas de recherche ici, gérée dans HistoryView
                        setSearchTerm={() => { }}
                        days={workouts.dayOrder}
                        categories={Object.values(workouts.days).flatMap(day => Object.keys(day.categories))}
                        handleAddDay={handleAddDay}
                        handleEditDay={handleEditDay}
                        handleDeleteDay={handleDeleteDay}
                        handleAddSeries={handleAddSeries}
                    />
                );
            case 'timer':
                return (
                    <TimerView
                        timerSeconds={timerSeconds}
                        timerIsRunning={timerIsRunning}
                        timerIsFinished={timerIsFinished}
                        startTimer={startTimer}
                        pauseTimer={pauseTimer}
                        resetTimer={resetTimer}
                        setTimerSeconds={setTimerSeconds}
                        restTimeInput={timerSeconds.toString()} // Assurez-vous que c'est une chaîne
                        setRestTimeInput={setTimerSeconds} // Met à jour directement le nombre de secondes
                        formatTime={formatTime}
                        setTimerPreset={setTimerPreset}
                    />
                );
            case 'stats':
                return (
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
                );
            case 'history':
                return (
                    <HistoryView
                        historicalData={historicalData}
                        personalBests={personalBests}
                        handleReactivateExercise={handleReactivateExercise}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        showProgressionGraphForExercise={showProgressionGraphForExercise}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        isAdvancedMode={isAdvancedMode}
                    />
                );
            default:
                return null;
        }
    };


    const getDayButtonColors = useCallback((dayId) => {
        const day = workouts.days[dayId];
        if (!day) return 'bg-gray-700 text-gray-300'; // Default if day not found

        const allExercises = Object.values(day.categories).flat();
        const hasCompletedSeries = allExercises.some(exercise =>
            exercise.series.some(series => series.completed)
        );

        return hasCompletedSeries
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600';
    }, [workouts]);


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white text-lg">
                Chargement des données...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
            <div className="flex-grow pb-20 p-4 sm:p-6 md:p-8 max-w-2xl mx-auto w-full">
                {/* En-tête de l'application */}
                <header className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-blue-400">GymTracker</h1>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={addWorkoutToHistoryAndSave}
                            className="bg-green-600 text-white p-2 rounded-full shadow-lg hover:bg-green-700 transition-all active:scale-95"
                            aria-label="Sauvegarder la séance"
                        >
                            <CheckCircle className="h-6 w-6" />
                        </button>
                        <button
                            onClick={toggleCompactView}
                            className="bg-gray-700 text-gray-300 p-2 rounded-full shadow-lg hover:bg-gray-600 transition-all active:scale-95"
                            aria-label="Toggle Vue Compacte"
                        >
                            {isCompactView ? <Minimize2 className="h-6 w-6" /> : <Maximize2 className="h-6 w-6" />}
                        </button>
                        <button
                            onClick={toggleAdvancedMode}
                            className="bg-gray-700 text-gray-300 p-2 rounded-full shadow-lg hover:bg-gray-600 transition-all active:scale-95"
                            aria-label="Toggle Mode Avancé"
                        >
                            <Settings className="h-6 w-6" />
                        </button>
                    </div>
                </header>

                {/* Contenu principal basé sur la vue sélectionnée */}
                {renderView()}
            </div>

            {/* Navigation Bar */}
            <BottomNavigationBar
                currentView={currentView}
                setCurrentView={setCurrentView}
            />

            {/* Toast Notifications */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                    duration={toast.duration}
                    action={toast.action}
                />
            )}

            {/* Modal de progression graphique */}
            {showProgressionGraph && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xl border border-gray-700">
                        <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
                            <LineChartIcon className="h-6 w-6" />
                            Progression : {progressionGraphExerciseName}
                        </h2>
                        <div className="space-y-4">
                            <div className="bg-gray-700 rounded-lg p-4 h-64 sm:h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={progressionGraphData}
                                        margin={{
                                            top: 5,
                                            right: 10,
                                            left: 0,
                                            bottom: 5,
                                        }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#cbd5e0"
                                            tickFormatter={(timestamp) => formatDate(timestamp)}
                                            angle={-30}
                                            textAnchor="end"
                                            height={50}
                                        />
                                        <YAxis yAxisId="left" stroke="#8884d8" domain={['auto', 'auto']} label={{ value: 'Poids (kg)', angle: -90, position: 'insideLeft', fill: '#cbd5e0' }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={['auto', 'auto']} label={{ value: 'Reps/Volume', angle: 90, position: 'insideRight', fill: '#cbd5e0' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4a5568', borderRadius: '8px' }}
                                            labelStyle={{ color: '#cbd5e0' }}
                                            formatter={(value, name, props) => {
                                                // props.payload contient toutes les données de ce point
                                                if (name === "Poids Max (kg)") {
                                                    return [`${value} kg`, name];
                                                } else if (name === "Reps Max") {
                                                    return [`${value} reps`, name];
                                                } else if (name === "Volume Max (kg)") {
                                                    return [`${value} kg`, name];
                                                }
                                                return [value, name];
                                            }}
                                        />
                                        <Legend wrapperStyle={{ color: '#cbd5e0', paddingTop: '10px' }} />
                                        <Line yAxisId="left" type="monotone" dataKey="maxWeight" stroke="#8884d8" name="Poids Max (kg)" />
                                        <Line yAxisId="right" type="monotone" dataKey="maxReps" stroke="#82ca9d" name="Reps Max" />
                                        <Line yAxisId="right" type="monotone" dataKey="maxVolume" stroke="#ffc658" name="Volume Max (kg)" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

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
                </div>
            )}
        </div>
    );
};

export default ImprovedWorkoutApp;