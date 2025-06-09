import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, limit, addDoc, serverTimestamp, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
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
// Remplacez par vos propres informations de configuration Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Historique des états pour Undo/Redo ---
const MAX_HISTORY_SIZE = 20; // Nombre maximum d'états à conserver

const useHistory = (initialState) => {
    const [history, setHistory] = useState([initialState]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const setState = useCallback((newState, { shallow = false } = {}) => {
        setHistory(prevHistory => {
            const newHistory = prevHistory.slice(0, currentIndex + 1);
            if (shallow) {
                // Si shallow est vrai, ne pas ajouter si l'état est identique (référence)
                if (newHistory[newHistory.length - 1] === newState) {
                    return prevHistory;
                }
            } else {
                // Pour une comparaison profonde, comparer avec JSON.stringify ou une lib comme lodash.isEqual
                // Pour l'instant, on va juste vérifier si l'objet est 'profondément' le même
                if (JSON.stringify(newHistory[newHistory.length - 1]) === JSON.stringify(newState)) {
                    return prevHistory;
                }
            }

            const updatedHistory = [...newHistory, newState];
            if (updatedHistory.length > MAX_HISTORY_SIZE) {
                updatedHistory.shift(); // Supprime l'état le plus ancien
            }
            setCurrentIndex(updatedHistory.length - 1);
            return updatedHistory;
        });
    }, [currentIndex]);

    const undo = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const redo = useCallback(() => {
        if (currentIndex < history.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, history.length]);

    const canUndo = currentIndex > 0;
    const canRedo = currentIndex < history.length - 1;

    const currentState = history[currentIndex];

    return [currentState, setState, undo, redo, canUndo, canRedo];
};


const ImprovedWorkoutApp = () => {
    // --- États globaux ---
    const [workouts, setWorkouts, undo, redo, canUndo, canRedo] = useHistory({ days: {}, dayOrder: [] });
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [currentView, setCurrentView] = useState('workout'); // 'workout', 'timer', 'stats', 'history'
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [toast, setToast] = useState(null); // { message, type, action }
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);

    // AI States
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false); // Global workout analysis
    const [aiWorkoutAnalysisContent, setAiWorkoutAnalysisContent] = useState('');
    const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false); // Exercise suggestions for current day
    const [aiExerciseSuggestions, setAiExerciseSuggestions] = useState([]);
    const [isLoadingAIProgression, setIsLoadingAIProgression] = useState(false); // For history view progression analysis
    const [aiProgressionAnalysisContent, setAiProgressionAnalysisContent] = useState(''); // For history view progression analysis

    // Timer States
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
    const timerIntervalRef = useRef(null);
    const notificationSoundRef = useRef(new Audio('/assets/notification.mp3')); // Chemin vers votre son de notification

    // --- Firebase Auth & Data Loading ---
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthenticated(true);
            } else {
                signInAnonymously(auth).then((userCredential) => {
                    setUserId(userCredential.user.uid);
                    setIsAuthenticated(true);
                }).catch((error) => {
                    console.error("Erreur d'authentification anonyme:", error);
                    showToast("Impossible de se connecter. Veuillez réessayer.", "error");
                });
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !userId) {
            setLoading(false);
            return;
        }

        const userDocRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.workouts) {
                    setWorkouts(data.workouts, { shallow: false });
                }
                if (data.historicalData) {
                    setHistoricalData(data.historicalData);
                }
            } else {
                // Initialisation des données si le document n'existe pas
                setDoc(userDocRef, { workouts: { days: {}, dayOrder: [] }, historicalData: [] }, { merge: true })
                    .then(() => console.log("Données utilisateur initialisées."))
                    .catch(e => console.error("Erreur d'initialisation des données:", e));
            }
            setLoading(false);
        }, (error) => {
            console.error("Erreur de récupération des données Firestore:", error);
            showToast("Erreur de chargement des données. Veuillez réessayer.", "error");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthenticated, userId, setWorkouts]);

    // Save data to Firestore whenever workouts or historicalData changes
    const saveToFirestore = useCallback(async (dataToSave, collectionName) => {
        if (userId) {
            const userDocRef = doc(db, 'users', userId);
            try {
                await setDoc(userDocRef, { [collectionName]: dataToSave }, { merge: true });
                console.log(`${collectionName} saved successfully.`);
            } catch (e) {
                console.error(`Error saving ${collectionName}:`, e);
                showToast(`Erreur de sauvegarde des ${collectionName}.`, "error");
            }
        }
    }, [userId, showToast]);

    useEffect(() => {
        // Debounce saving workouts to avoid excessive writes
        const handler = setTimeout(() => {
            saveToFirestore(workouts, 'workouts');
        }, 500); // 500ms debounce
        return () => clearTimeout(handler);
    }, [workouts, saveToFirestore]);

    useEffect(() => {
        // Debounce saving historicalData
        const handler = setTimeout(() => {
            saveToFirestore(historicalData, 'historicalData');
        }, 500); // 500ms debounce
        return () => clearTimeout(handler);
    }, [historicalData, saveToFirestore]);


    // --- Utils Functions ---
    const generateUniqueId = useCallback(() => Date.now().toString(36) + Math.random().toString(36).substring(2), []);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('fr-FR', options);
    }, []);

    const formatTime = useCallback((totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, []);

    const getSeriesDisplay = useCallback((serie) => {
        let display = '';
        if (serie.weight) display += `${serie.weight} kg`;
        if (serie.reps) display += ` x ${serie.reps} reps`;
        if (serie.rpe) display += ` @ RPE ${serie.rpe}`;
        return display.trim();
    }, []);

    const showToast = useCallback((message, type = 'info', action = null, duration = 3000) => {
        setToast({ message, type, action, duration });
    }, []);

    // --- Logic for Workouts (CRUD Operations) ---
    const addDay = useCallback((name) => {
        setWorkouts(prevWorkouts => {
            const newDayId = generateUniqueId();
            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [newDayId]: { id: newDayId, name, exercises: [], notes: '' }
                },
                dayOrder: [...prevWorkouts.dayOrder, newDayId]
            };
        });
    }, [setWorkouts, generateUniqueId]);

    const renameDay = useCallback((dayId, newName) => {
        setWorkouts(prevWorkouts => ({
            ...prevWorkouts,
            days: {
                ...prevWorkouts.days,
                [dayId]: { ...prevWorkouts.days[dayId], name: newName }
            }
        }));
    }, [setWorkouts]);

    const deleteDay = useCallback((dayId) => {
        setWorkouts(prevWorkouts => {
            const newDays = { ...prevWorkouts.days };
            delete newDays[dayId];
            const newDayOrder = prevWorkouts.dayOrder.filter(id => id !== dayId);
            return {
                ...prevWorkouts,
                days: newDays,
                dayOrder: newDayOrder
            };
        });
    }, [setWorkouts]);

    const duplicateDay = useCallback((dayId) => {
        setWorkouts(prevWorkouts => {
            const originalDay = prevWorkouts.days[dayId];
            if (!originalDay) return prevWorkouts;

            const newDayId = generateUniqueId();
            const duplicatedDay = {
                ...originalDay,
                id: newDayId,
                name: `${originalDay.name} (Copie)`,
                exercises: originalDay.exercises.map(ex => ({
                    ...ex,
                    id: generateUniqueId(), // New ID for duplicated exercises
                    series: ex.series.map(s => ({ ...s, completed: false })) // Reset completed status
                }))
            };

            const newDayOrder = [...prevWorkouts.dayOrder, newDayId]; // Add at the end
            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [newDayId]: duplicatedDay
                },
                dayOrder: newDayOrder
            };
        });
    }, [setWorkouts, generateUniqueId]);

    const moveDay = useCallback((dayId, direction) => {
        setWorkouts(prevWorkouts => {
            const newDayOrder = [...prevWorkouts.dayOrder];
            const index = newDayOrder.indexOf(dayId);
            if (index === -1) return prevWorkouts;

            const newIndex = index + (direction === 'up' ? -1 : 1);
            if (newIndex < 0 || newIndex >= newDayOrder.length) return prevWorkouts;

            const [movedDay] = newDayOrder.splice(index, 1);
            newDayOrder.splice(newIndex, 0, movedDay);

            return { ...prevWorkouts, dayOrder: newDayOrder };
        });
    }, [setWorkouts]);

    const addExercise = useCallback((dayId, name, category = '') => {
        setWorkouts(prevWorkouts => {
            const newExerciseId = generateUniqueId();
            const newExercise = {
                id: newExerciseId,
                name,
                category,
                series: [{ set: 1, weight: 0, reps: 0, rpe: 0, completed: false }],
                notes: '',
                hidden: false
            };
            const updatedDay = {
                ...prevWorkouts.days[dayId],
                exercises: [...prevWorkouts.days[dayId].exercises, newExercise]
            };
            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [dayId]: updatedDay
                }
            };
        });
    }, [setWorkouts, generateUniqueId]);

    const onDeleteExercise = useCallback((dayId, exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDay = {
                ...prevWorkouts.days[dayId],
                exercises: prevWorkouts.days[dayId].exercises.filter(ex => ex.id !== exerciseId)
            };
            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [dayId]: updatedDay
                }
            };
        });
    }, [setWorkouts]);

    const toggleExerciseVisibility = useCallback((dayId, exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedExercises = prevWorkouts.days[dayId].exercises.map(ex =>
                ex.id === exerciseId ? { ...ex, hidden: !ex.hidden } : ex
            );
            const updatedDay = {
                ...prevWorkouts.days[dayId],
                exercises: updatedExercises
            };
            return {
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [dayId]: updatedDay
                }
            };
        });
    }, [setWorkouts]);

    const onAddSerie = useCallback((dayId, exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedExercises = prevWorkouts.days[dayId].exercises.map(exercise => {
                if (exercise.id === exerciseId) {
                    const newSetNumber = exercise.series.length + 1;
                    return {
                        ...exercise,
                        series: [...exercise.series, { set: newSetNumber, weight: 0, reps: 0, rpe: 0, completed: false }]
                    };
                }
                return exercise;
            });
            const updatedDay = { ...prevWorkouts.days[dayId], exercises: updatedExercises };
            return { ...prevWorkouts, days: { ...prevWorkouts.days, [dayId]: updatedDay } };
        });
    }, [setWorkouts]);

    const onRemoveSerie = useCallback((dayId, exerciseId, serieIndex) => {
        setWorkouts(prevWorkouts => {
            const updatedExercises = prevWorkouts.days[dayId].exercises.map(exercise => {
                if (exercise.id === exerciseId) {
                    const newSeries = exercise.series.filter((_, index) => index !== serieIndex)
                        .map((s, idx) => ({ ...s, set: idx + 1 })); // Re-number sets
                    return { ...exercise, series: newSeries };
                }
                return exercise;
            });
            const updatedDay = { ...prevWorkouts.days[dayId], exercises: updatedExercises };
            return { ...prevWorkouts, days: { ...prevWorkouts.days, [dayId]: updatedDay } };
        });
    }, [setWorkouts]);

    const onUpdateSerie = useCallback((dayId, exerciseId, serieIndex, field, value) => {
        setWorkouts(prevWorkouts => {
            const updatedExercises = prevWorkouts.days[dayId].exercises.map(exercise => {
                if (exercise.id === exerciseId) {
                    const newSeries = exercise.series.map((serie, index) => {
                        if (index === serieIndex) {
                            return { ...serie, [field]: value };
                        }
                        return serie;
                    });
                    return { ...exercise, series: newSeries };
                }
                return exercise;
            });
            const updatedDay = { ...prevWorkouts.days[dayId], exercises: updatedExercises };
            return { ...prevWorkouts, days: { ...prevWorkouts.days, [dayId]: updatedDay } };
        });
    }, [setWorkouts]);

    const onToggleSerieCompleted = useCallback((dayId, exerciseId, serieIndex) => {
        setWorkouts(prevWorkouts => {
            const updatedExercises = prevWorkouts.days[dayId].exercises.map(exercise => {
                if (exercise.id === exerciseId) {
                    const newSeries = exercise.series.map((serie, index) => {
                        if (index === serieIndex) {
                            return { ...serie, completed: !serie.completed };
                        }
                        return serie;
                    });
                    return { ...exercise, series: newSeries };
                }
                return exercise;
            });
            const updatedDay = { ...prevWorkouts.days[dayId], exercises: updatedExercises };
            return { ...prevWorkouts, days: { ...prevWorkouts.days, [dayId]: updatedDay } };
        });
    }, [setWorkouts]);

    const onUpdateExerciseNotes = useCallback((dayId, exerciseId, notes) => {
        setWorkouts(prevWorkouts => {
            const updatedExercises = prevWorkouts.days[dayId].exercises.map(exercise => {
                if (exercise.id === exerciseId) {
                    return { ...exercise, notes };
                }
                return exercise;
            });
            const updatedDay = { ...prevWorkouts.days[dayId], exercises: updatedExercises };
            return { ...prevWorkouts, days: { ...prevWorkouts.days, [dayId]: updatedDay } };
        });
    }, [setWorkouts]);

    // Save current workout to historical data
    const saveCurrentWorkoutToHistory = useCallback(() => {
        const currentDate = new Date().toISOString();
        const workoutToSave = {
            id: generateUniqueId(),
            date: currentDate,
            name: workouts.days[workouts.dayOrder[0]]?.name || 'Séance du jour', // Use the first day's name as session name
            exercises: []
        };

        workouts.dayOrder.forEach(dayId => {
            workouts.days[dayId].exercises.forEach(exercise => {
                // Ensure exercises are not duplicated if from different days but same name
                const existingExerciseInSession = workoutToSave.exercises.find(ex => ex.name === exercise.name);

                if (existingExerciseInSession) {
                    // If exercise already exists, add series to it
                    existingExerciseInSession.series.push(...exercise.series.map(s => ({ ...s, completed: true })));
                } else {
                    workoutToSave.exercises.push({
                        id: generateUniqueId(), // Unique ID for historical exercise
                        name: exercise.name,
                        category: exercise.category,
                        series: exercise.series.map(s => ({ ...s, completed: true })), // Mark all as completed for history
                        notes: exercise.notes,
                        deleted: exercise.deleted || false // Carry over deleted status if exists
                    });
                }
            });
        });

        setHistoricalData(prevData => {
            // Check if a session for today already exists
            const today = new Date().toDateString();
            const sessionAlreadyExists = prevData.some(session => new Date(session.date).toDateString() === today);

            if (sessionAlreadyExists) {
                // Find existing session and update it
                return prevData.map(session => {
                    if (new Date(session.date).toDateString() === today) {
                        return workoutToSave; // Replace with the new session
                    }
                    return session;
                });
            } else {
                return [...prevData, workoutToSave];
            }
        });
        showToast("Séance sauvegardée dans l'historique !", "success");
    }, [workouts, setHistoricalData, generateUniqueId, showToast]);

    // Calculate personal bests whenever historical data changes
    useEffect(() => {
        const newPersonalBests = {};
        historicalData.forEach(session => {
            session.exercises.forEach(exercise => {
                exercise.series.forEach(serie => {
                    if (serie.weight && serie.reps) {
                        const current1RM = serie.weight * (1 + (serie.reps / 30)); // Epley formula
                        if (!newPersonalBests[exercise.name] || current1RM > (newPersonalBests[exercise.name].weight * (1 + (newPersonalBests[exercise.name].reps / 30)))) {
                            newPersonalBests[exercise.name] = { weight: serie.weight, reps: serie.reps, date: session.date };
                        }
                    }
                });
            });
        });
        setPersonalBests(newPersonalBests);
    }, [historicalData]);

    const deleteHistoricalSession = useCallback((sessionId) => {
        setHistoricalData(prevData => prevData.filter(session => session.id !== sessionId));
        showToast("Séance historique supprimée !", "success");
    }, [setHistoricalData, showToast]);

    const handleReactivateExercise = useCallback((exerciseName) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            let exerciseFound = false;

            for (const dayId in updatedDays) {
                updatedDays[dayId] = {
                    ...updatedDays[dayId],
                    exercises: updatedDays[dayId].exercises.map(ex => {
                        if (ex.name === exerciseName && ex.deleted) {
                            exerciseFound = true;
                            return { ...ex, deleted: false, hidden: false }; // Also unhide
                        }
                        return ex;
                    })
                };
            }
            if (exerciseFound) {
                showToast(`L'exercice "${exerciseName}" a été réactivé dans tous les jours d'entraînement.`, "success");
            } else {
                showToast(`L'exercice "${exerciseName}" n'a pas été trouvé ou n'était pas marqué comme supprimé.`, "warning");
            }

            return { ...prevWorkouts, days: updatedDays };
        });
    }, [setWorkouts, showToast]);


    // --- AI Integration ---
    const generateAIResponse = useCallback(async (prompt) => {
        if (!process.env.REACT_APP_GEMINI_API_KEY) {
            showToast("Clé API Gemini manquante. Veuillez la configurer dans .env.", "error");
            return "Clé API Gemini non configurée.";
        }

        try {
            const { GoogleGenerativeAI } = GenerativeAIModule;
            const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API Gemini:", error);
            showToast(`Erreur AI: ${error.message}`, "error");
            return "Erreur lors de la génération de la réponse IA.";
        }
    }, [showToast]);

    const analyzeWorkoutWithAI = useCallback(async (currentWorkoutDay) => {
        setAiAnalysisLoading(true);
        setAiWorkoutAnalysisContent('');
        if (!currentWorkoutDay || !currentWorkoutDay.exercises.length) {
            setAiAnalysisLoading(false);
            showToast("Pas d'exercices à analyser dans cette séance.", "info");
            return;
        }

        let prompt = `Analyse le programme d'entraînement suivant pour la séance "${currentWorkoutDay.name}" en français. Fournis des conseils sur la structure, la progression, l'équilibre musculaire, et les améliorations possibles. Si le volume est faible, suggère d'augmenter le nombre de séries ou d'exercices. Ne donne pas de répétition spécifique. Garde la réponse concise et directement applicable.
        
        Programme:
        `;
        currentWorkoutDay.exercises.forEach(exercise => {
            prompt += `- ${exercise.name} (${exercise.category || 'Aucune catégorie'}):\n`;
            exercise.series.forEach(serie => {
                prompt += `  - Série ${serie.set}: ${serie.weight || '?'}kg x ${serie.reps || '?'} reps @ RPE ${serie.rpe || '?'}\n`;
            });
            if (exercise.notes) prompt += `  Notes: ${exercise.notes}\n`;
        });

        const analysis = await generateAIResponse(prompt);
        setAiWorkoutAnalysisContent(analysis);
        setAiAnalysisLoading(false);
        showToast("Analyse IA terminée !", "success");
    }, [generateAIResponse, showToast]);

    const clearAiWorkoutAnalysis = useCallback(() => {
        setAiWorkoutAnalysisContent('');
    }, []);

    const generateExerciseSuggestionsAI = useCallback(async (currentWorkoutDay) => {
        setAiSuggestionsLoading(true);
        setAiExerciseSuggestions([]);
        if (!currentWorkoutDay) {
            setAiSuggestionsLoading(false);
            showToast("Veuillez sélectionner un jour d'entraînement pour générer des suggestions.", "info");
            return;
        }

        let prompt = `Suggère 3-5 exercices complémentaires pour un programme d'entraînement en français. Le programme actuel se concentre sur les muscles suivants et contient les exercices suivants :
        
        Exercices actuels pour "${currentWorkoutDay.name}":
        `;
        if (currentWorkoutDay.exercises.length === 0) {
            prompt += "Aucun exercice pour l'instant. Proposez des exercices de base variés pour un entraînement complet du corps.\n";
        } else {
            currentWorkoutDay.exercises.forEach(exercise => {
                prompt += `- ${exercise.name} (Catégorie: ${exercise.category || 'Non spécifiée'})\n`;
            });
        }
        prompt += "\nBasé sur cela, propose 3 à 5 nouveaux exercices pour équilibrer ou compléter le programme, en incluant leur catégorie (ex: 'Pompes (Pectoraux)'). Réponds sous forme de liste numérotée simple d'exercices.\n";


        const suggestionsText = await generateAIResponse(prompt);
        // Parse the suggestions (expecting a numbered list)
        const parsedSuggestions = suggestionsText.split('\n').filter(line => line.match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').trim());
        setAiExerciseSuggestions(parsedSuggestions);
        setAiSuggestionsLoading(false);
        showToast("Suggestions d'exercices IA générées !", "success");
    }, [generateAIResponse, showToast]);

    const clearAiExerciseSuggestions = useCallback(() => {
        setAiExerciseSuggestions([]);
    }, []);

    const analyzeProgressionWithAI = useCallback(async (exerciseName, historicalData) => {
        setIsLoadingAIProgression(true);
        setAiProgressionAnalysisContent('');

        const relevantData = historicalData.filter(session =>
            session.exercises.some(ex => ex.name === exerciseName)
        );

        if (relevantData.length === 0) {
            setAiProgressionAnalysisContent("Pas de données suffisantes pour analyser la progression de cet exercice.");
            setIsLoadingAIProgression(false);
            return;
        }

        let prompt = `Analyse la progression de l'exercice "${exerciseName}" en français, basée sur les données historiques suivantes. Donne des conseils sur la surcharge progressive, la périodisation, et les ajustements si la progression stagne. Ne donne pas de répétition spécifique. Garde la réponse concise et directement applicable.\n\nHistorique pour ${exerciseName}:\n`;
        relevantData.forEach(session => {
            session.exercises.forEach(ex => {
                if (ex.name === exerciseName) {
                    prompt += `Date: ${formatDate(session.date)}, Séries: [`;
                    ex.series.forEach(s => prompt += `${s.weight || '?'}kgx${s.reps || '?'}reps `);
                    prompt += `]\n`;
                }
            });
        });

        const analysis = await generateAIResponse(prompt);
        setAiProgressionAnalysisContent(analysis);
        setIsLoadingAIProgression(false);
        showToast("Analyse de progression IA terminée !", "success");
    }, [generateAIResponse, showToast, formatDate]);


    // --- Timer Logic ---
    const startTimer = useCallback(() => {
        if (!timerIsRunning && timerSeconds > 0) {
            setTimerIsRunning(true);
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds(prevSeconds => {
                    if (prevSeconds <= 1) {
                        clearInterval(timerIntervalRef.current);
                        setTimerIsRunning(false);
                        setTimerIsFinished(true);
                        notificationSoundRef.current.play(); // Play sound
                        return 0;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        } else if (timerSeconds === 0) {
            showToast("Veuillez définir une durée pour le minuteur.", "warning");
        }
    }, [timerIsRunning, timerSeconds, showToast]);

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

    // --- Data Export/Import ---
    const exportData = useCallback(() => {
        const dataToExport = {
            workouts,
            historicalData,
        };
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'workout_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Données exportées avec succès !", "success");
    }, [workouts, historicalData, showToast]);

    const importData = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (importedData.workouts && importedData.historicalData) {
                            setWorkouts(importedData.workouts);
                            setHistoricalData(importedData.historicalData);
                            showToast("Données importées avec succès !", "success");
                        } else {
                            throw new Error("Format de fichier incorrect.");
                        }
                    } catch (error) {
                        console.error("Erreur d'importation des données:", error);
                        showToast(`Erreur d'importation: ${error.message}`, "error");
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }, [setWorkouts, setHistoricalData, showToast]);

    // --- Main Render ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white text-xl">
                <RotateCcw className="animate-spin mr-3" /> Chargement...
            </div>
        );
    }

    return (
        <div className="bg-gray-900 min-h-screen flex flex-col">
            {/* Contenu principal en fonction de la vue */}
            <main className="flex-grow pb-16"> {/* Padding bottom for the nav bar */}
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        setWorkouts={setWorkouts}
                        onToggleSerieCompleted={onToggleSerieCompleted}
                        onUpdateSerie={onUpdateSerie}
                        onAddSerie={onAddSerie}
                        onRemoveSerie={onRemoveSerie}
                        onUpdateExerciseNotes={onUpdateExerciseNotes}
                        addDay={addDay}
                        renameDay={renameDay}
                        deleteDay={deleteDay}
                        duplicateDay={duplicateDay}
                        moveDay={moveDay}
                        addExercise={addExercise}
                        onDeleteExercise={onDeleteExercise}
                        toggleExerciseVisibility={toggleExerciseVisibility}
                        formatDate={formatDate}
                        showToast={showToast}
                        isAdvancedMode={isAdvancedMode}
                        toggleAdvancedMode={() => setIsAdvancedMode(prev => !prev)}
                        exportData={exportData}
                        importData={importData}
                        undo={undo}
                        redo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        analyzeWorkoutWithAI={analyzeWorkoutWithAI}
                        aiAnalysisLoading={aiAnalysisLoading}
                        aiWorkoutAnalysisContent={aiWorkoutAnalysisContent}
                        clearAiWorkoutAnalysis={clearAiWorkoutAnalysis}
                        generateExerciseSuggestionsAI={generateExerciseSuggestionsAI}
                        aiSuggestionsLoading={aiSuggestionsLoading}
                        aiExerciseSuggestions={aiExerciseSuggestions}
                        clearAiExerciseSuggestions={clearAiExerciseSuggestions}
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
                        formatTime={formatTime}
                        setTimerPreset={(seconds) => setTimerSeconds(seconds)} // Simpler way to set preset
                    />
                )}
                {currentView === 'stats' && (
                    <StatsView
                        workouts={workouts}
                        historicalData={historicalData}
                        personalBests={personalBests}
                        formatDate={formatDate}
                        getWorkoutStats={() => { /* Implement if needed */ }}
                        analyzeGlobalStatsWithAI={() => { /* Implement if needed */ }}
                        aiAnalysisLoading={aiAnalysisLoading} // Re-using global AI loading
                        aiWorkoutAnalysisContent={aiWorkoutAnalysisContent} // Re-using global AI content
                        showToast={showToast}
                    />
                )}
                {currentView === 'history' && (
                    <HistoryView
                        historicalData={historicalData}
                        personalBests={personalBests}
                        handleReactivateExercise={handleReactivateExercise}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        progressionAnalysisContent={aiProgressionAnalysisContent}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        isAdvancedMode={isAdvancedMode}
                        deleteHistoricalSession={deleteHistoricalSession}
                        isLoadingAI={isLoadingAIProgression}
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

            {/* Timer Modal (if needed for specific use cases like per-serie timer) */}
            {/* Si vous avez une modale de minuteur séparée qui est contrôlée globalement */}
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
        </div>
    );
};

export default ImprovedWorkoutApp;