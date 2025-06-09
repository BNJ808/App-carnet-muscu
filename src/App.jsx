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
import Toast from './Toast.jsx'; // Corrected path
import MainWorkoutView from './MainWorkoutView.jsx'; // Corrected path
import HistoryView from './HistoryView.jsx'; // Corrected path
import TimerView from './TimerView.jsx'; // Corrected path
import StatsView from './StatsView.jsx'; // Corrected path
import BottomNavigationBar from './BottomNavigationBar.jsx'; // Corrected path
import TimerModal from './TimerModal.jsx'; // Corrected path // Ensure TimerModal is imported

const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ImprovedWorkoutApp = () => {
    const [workouts, setWorkouts] = useState({ days: {}, dayOrder: [] });
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [currentView, setCurrentView] = useState('workout'); // 'workout', 'timer', 'stats', 'history'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDayFilter, setSelectedDayFilter] = useState('all');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);
    const [globalNotes, setGlobalNotes] = useState('');
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [isLoadingAI, setIsLoadingAI] = useState(false); // For AI suggestions loading
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState(''); // Content for progression analysis modal
    const [showProgressionGraph, setShowProgressionGraph] = useState(false); // State for showing the graph
    const [progressionGraphData, setProgressionGraphData] = useState([]); // Data for the progression graph
    const [progressionGraphExerciseName, setProgressionGraphExerciseName] = useState(''); // Name of the exercise for the graph
    const [isAdvancedMode, setIsAdvancedMode] = useState(false); // Advanced mode toggle
    const [darkMode, setDarkMode] = useState(true); // Dark mode toggle
    const [toast, setToast] = useState(null); // { message, type, action, duration }

    // Timer states
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const timerIntervalRef = useRef(null);
    const [restTimeInput, setRestTimeInput] = useState('90'); // Default rest time for quick timer
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false); // State to control TimerModal visibility

    // Undo/Redo states
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUpdatingHistoryRef = useRef(false);

    // User ID state
    const [userId, setUserId] = useState(null);
    const [dbInitialized, setDbInitialized] = useState(false);

    useEffect(() => {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined') {
                try {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } catch (error) {
                    console.error("Firebase custom token sign-in failed:", error);
                    await signInAnonymously(auth);
                }
            } else {
                await signInAnonymously(auth);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                setDbInitialized(true);
            } else {
                setUserId(null);
                setDbInitialized(true); // Still set to true even if anonymous, so listeners can proceed
            }
        });

        initAuth();

        return () => unsubscribe();
    }, []);

    // Firestore listeners
    useEffect(() => {
        if (!dbInitialized || !userId) return;

        const workoutsDocRef = doc(db, `artifacts/${appId}/users/${userId}/workouts`, 'current');
        const historicalDataColRef = collection(db, `artifacts/${appId}/users/${userId}/history`);
        const personalBestsDocRef = doc(db, `artifacts/${appId}/users/${userId}/stats`, 'personalBests');
        const globalNotesDocRef = doc(db, `artifacts/${appId}/users/${userId}/notes`, 'global');

        // Workouts listener
        const unsubscribeWorkouts = onSnapshot(workoutsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (!isUpdatingHistoryRef.current) {
                    setWorkouts(data);
                    if (historyIndex === -1 || JSON.stringify(data) !== JSON.stringify(history[historyIndex])) {
                        const newHistory = history.slice(0, historyIndex + 1);
                        setHistory([...newHistory, data]);
                        setHistoryIndex(newHistory.length);
                    }
                }
            } else {
                if (!isUpdatingHistoryRef.current) {
                    setWorkouts({ days: {}, dayOrder: [] });
                    const newHistory = history.slice(0, historyIndex + 1);
                    setHistory([...newHistory, { days: {}, dayOrder: [] }]);
                    setHistoryIndex(newHistory.length);
                }
            }
        }, (error) => {
            console.error("Error fetching workouts:", error);
            showToast("Erreur de chargement des entraînements.", "error");
        });

        // Historical Data listener (last 50 sessions for performance)
        const q = query(historicalDataColRef, limit(50));
        const unsubscribeHistoricalData = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistoricalData(data);
        }, (error) => {
            console.error("Error fetching historical data:", error);
            showToast("Erreur de chargement de l'historique.", "error");
        });

        // Personal Bests listener
        const unsubscribePersonalBests = onSnapshot(personalBestsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setPersonalBests(docSnap.data());
            } else {
                setPersonalBests({});
            }
        }, (error) => {
            console.error("Error fetching personal bests:", error);
            showToast("Erreur de chargement des records personnels.", "error");
        });

        // Global Notes listener
        const unsubscribeGlobalNotes = onSnapshot(globalNotesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setGlobalNotes(docSnap.data().notes || '');
            } else {
                setGlobalNotes('');
            }
        }, (error) => {
            console.error("Error fetching global notes:", error);
            showToast("Erreur de chargement des notes globales.", "error");
        });

        return () => {
            unsubscribeWorkouts();
            unsubscribeHistoricalData();
            unsubscribePersonalBests();
            unsubscribeGlobalNotes();
        };
    }, [dbInitialized, userId, history, historyIndex]);

    // Save workouts to Firestore
    useEffect(() => {
        if (!dbInitialized || !userId) return;
        const saveWorkouts = async () => {
            if (historyIndex > -1 && JSON.stringify(workouts) !== JSON.stringify(history[historyIndex])) {
                isUpdatingHistoryRef.current = true;
                try {
                    await setDoc(doc(db, `artifacts/${appId}/users/${userId}/workouts`, 'current'), workouts);
                } catch (e) {
                    console.error("Error saving workouts to Firestore: ", e);
                    showToast("Erreur lors de la sauvegarde des entraînements.", "error");
                } finally {
                    isUpdatingHistoryRef.current = false;
                }
            }
        };
        saveWorkouts();
    }, [workouts, history, historyIndex, dbInitialized, userId]);

    // Toast functions
    const showToast = useCallback((message, type = 'info', action = null, duration = 3000) => {
        setToast({ message, type, action, duration });
    }, []);

    const closeToast = useCallback(() => {
        setToast(null);
    }, []);

    // Utility to format time for timers
    const formatTime = useCallback((totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    // Timer logic
    const startTimer = useCallback(() => {
        if (!timerIsRunning) {
            setTimerIsRunning(true);
            setTimerIsFinished(false);
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds((prevSeconds) => {
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
        setTimerIsFinished(false);
        setTimerSeconds(0);
    }, []);

    // Helper for sorting based on the stored method
    const sortExercises = useCallback((exercises) => {
        // Retrieve the stored sorting preference
        const savedSortMethod = localStorage.getItem('exerciseSortMethod') || 'default';

        switch (savedSortMethod) {
            case 'completed-first':
                // Sort by completion status (completed true first), then by name
                return [...exercises].sort((a, b) => {
                    const aCompleted = a.series.every(s => s.completed);
                    const bCompleted = b.series.every(s => s.completed);
                    if (aCompleted && !bCompleted) return -1;
                    if (!aCompleted && bCompleted) return 1;
                    return a.name.localeCompare(b.name);
                });
            case 'alphabetical':
                // Sort by name alphabetically
                return [...exercises].sort((a, b) => a.name.localeCompare(b.name));
            case 'default':
            default:
                // Default order (as they appear in the day's exercises)
                return [...exercises];
        }
    }, []);

    // Workout management functions
    const addDay = useCallback(() => {
        const newDayName = `Jour ${workouts.dayOrder.length + 1}`;
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [newDayName]: []
            },
            dayOrder: [...prev.dayOrder, newDayName]
        }));
        showToast("Jour d'entraînement ajouté !", "success");
    }, [workouts]);

    const renameDay = useCallback((oldName, newName) => {
        if (oldName === newName || !newName.trim()) return;
        setWorkouts(prev => {
            const newDays = { ...prev.days };
            const exercises = newDays[oldName];
            delete newDays[oldName];
            newDays[newName] = exercises;
            const newDayOrder = prev.dayOrder.map(day => day === oldName ? newName : day);
            return { days: newDays, dayOrder: newDayOrder };
        });
        showToast(`Jour renommé en "${newName}".`, "info");
    }, []);

    const deleteDay = useCallback((dayName) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le jour "${dayName}" et tous ses exercices ?`)) return;
        setWorkouts(prev => {
            const newDays = { ...prev.days };
            delete newDays[dayName];
            const newDayOrder = prev.dayOrder.filter(name => name !== dayName);
            return { days: newDays, dayOrder: newDayOrder };
        });
        showToast(`Jour "${dayName}" supprimé.`, "warning");
    }, []);

    const addExercise = useCallback((dayName, exerciseName = '') => {
        if (!exerciseName.trim()) {
            exerciseName = `Nouvel Exercice ${workouts.days[dayName].length + 1}`;
        }
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: [...prev.days[dayName], {
                    id: Date.now(),
                    name: exerciseName,
                    category: 'Autre', // Default category
                    series: [{ weight: '', reps: '', completed: false }],
                    notes: '',
                    progressionHistory: [], // To store history for this exercise
                }]
            }
        }));
        showToast("Exercice ajouté !", "success");
    }, [workouts]);

    const deleteExercise = useCallback((dayName, exerciseId) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet exercice ?")) return;
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].filter(ex => ex.id !== exerciseId)
            }
        }));
        showToast("Exercice supprimé.", "warning");
    }, []);

    const updateExerciseNotes = useCallback((dayName, exerciseId, notes) => {
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].map(ex =>
                    ex.id === exerciseId ? { ...ex, notes } : ex
                )
            }
        }));
    }, []);

    const addSerie = useCallback((dayName, exerciseId) => {
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].map(ex =>
                    ex.id === exerciseId ? { ...ex, series: [...ex.series, { weight: '', reps: '', completed: false }] } : ex
                )
            }
        }));
    }, []);

    const removeSerie = useCallback((dayName, exerciseId, serieIndex) => {
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].map(ex =>
                    ex.id === exerciseId ? { ...ex, series: ex.series.filter((_, idx) => idx !== serieIndex) } : ex
                )
            }
        }));
    }, []);

    const updateSerie = useCallback((dayName, exerciseId, serieIndex, field, value) => {
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].map(ex =>
                    ex.id === exerciseId ? {
                        ...ex,
                        series: ex.series.map((serie, idx) =>
                            idx === serieIndex ? { ...serie, [field]: value } : serie
                        )
                    } : ex
                )
            }
        }));
    }, []);

    const toggleSerieCompleted = useCallback((dayName, exerciseId, serieIndex) => {
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].map(ex =>
                    ex.id === exerciseId ? {
                        ...ex,
                        series: ex.series.map((serie, idx) =>
                            idx === serieIndex ? { ...serie, completed: !serie.completed } : serie
                        )
                    } : ex
                )
            }
        }));
    }, []);

    const handleEditExerciseName = useCallback((dayName, exerciseId, newName) => {
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].map(ex =>
                    ex.id === exerciseId ? { ...ex, name: newName } : ex
                )
            }
        }));
        showToast(`Nom de l'exercice mis à jour.`, "info");
    }, []);

    const handleEditExerciseCategory = useCallback((dayName, exerciseId, newCategory) => {
        setWorkouts(prev => ({
            ...prev,
            days: {
                ...prev.days,
                [dayName]: prev.days[dayName].map(ex =>
                    ex.id === exerciseId ? { ...ex, category: newCategory } : ex
                )
            }
        }));
        showToast(`Catégorie de l'exercice mise à jour.`, "info");
    }, []);


    const markDayAsCompleted = useCallback(async (dayName) => {
        if (!userId) {
            showToast("Veuillez vous connecter pour enregistrer vos entraînements.", "error");
            return;
        }

        const dayExercises = workouts.days[dayName];
        if (!dayExercises || dayExercises.length === 0) {
            showToast("Ce jour d'entraînement est vide. Ajoutez des exercices avant de le terminer.", "warning");
            return;
        }

        if (!window.confirm(`Terminer le jour "${dayName}" ? Cela enregistrera toutes les séries complétées dans l'historique.`)) {
            return;
        }

        const batch = writeBatch(db);
        const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/history`);
        const personalBestsDocRef = doc(db, `artifacts/${appId}/users/${userId}/stats`, 'personalBests');

        const newPersonalBests = { ...personalBests };
        const sessionDate = Timestamp.now();

        const completedExercises = dayExercises.filter(ex => ex.series.some(s => s.completed));

        if (completedExercises.length === 0) {
            showToast("Aucune série complétée dans ce jour. Rien à enregistrer dans l'historique.", "info");
            return;
        }

        for (const exercise of completedExercises) {
            const completedSeries = exercise.series.filter(s => s.completed && s.weight && s.reps);

            if (completedSeries.length === 0) continue;

            const sessionEntry = {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                category: exercise.category,
                notes: exercise.notes,
                series: completedSeries.map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
                date: sessionDate,
                dayName: dayName,
            };

            const newDocRef = doc(historyCollectionRef);
            batch.set(newDocRef, sessionEntry);

            // Update Personal Bests
            for (const serie of completedSeries) {
                const weight = parseFloat(serie.weight);
                const reps = parseInt(serie.reps);
                if (weight > 0 && reps > 0) {
                    const currentPB = newPersonalBests[exercise.name] || { maxWeight: 0, maxReps: 0, maxVolume: 0, oneRepMax: 0 };

                    // Max Weight (for any reps)
                    if (weight > currentPB.maxWeight) {
                        currentPB.maxWeight = weight;
                    }
                    // Max Reps (for any weight)
                    if (reps > currentPB.maxReps) {
                        currentPB.maxReps = reps;
                    }

                    // Max Volume (weight * reps * sets for a single exercise in a session)
                    const serieVolume = weight * reps;
                    if (serieVolume > currentPB.maxVolume) {
                        currentPB.maxVolume = serieVolume;
                    }

                    // Estimated One-Rep Max (Epley formula: weight * (1 + reps / 30))
                    const estimatedOneRepMax = weight * (1 + reps / 30);
                    if (estimatedOneRepMax > currentPB.oneRepMax) {
                        currentPB.oneRepMax = estimatedOneRepMax;
                    }
                    newPersonalBests[exercise.name] = currentPB;
                }
            }
        }

        batch.set(personalBestsDocRef, newPersonalBests, { merge: true });

        try {
            await batch.commit();
            showToast(`Jour "${dayName}" terminé et enregistré !`, "success");
            // Optionally, clear completed series or move them
            setWorkouts(prev => {
                const updatedDays = { ...prev.days };
                updatedDays[dayName] = updatedDays[dayName].map(ex => ({
                    ...ex,
                    series: ex.series.map(s => ({ ...s, completed: false, weight: '', reps: '' })) // Reset completed status and values
                }));
                return { ...prev, days: updatedDays };
            });
        } catch (e) {
            console.error("Error writing batch to Firestore: ", e);
            showToast("Erreur lors de l'enregistrement de la session.", "error");
        }
    }, [workouts, personalBests, userId, db, showToast]);


    const reactivateExercise = useCallback(async (sessionId) => {
        if (!userId) {
            showToast("Veuillez vous connecter pour réactiver des exercices.", "error");
            return;
        }

        if (!window.confirm("Voulez-vous vraiment réactiver cet exercice comme un nouveau jour d'entraînement ?")) {
            return;
        }

        try {
            const sessionToReactivate = historicalData.find(session => session.id === sessionId);

            if (!sessionToReactivate) {
                showToast("Session introuvable dans l'historique.", "error");
                return;
            }

            // Create a new day for the reactivated exercises
            const newDayName = `Réactivé: ${formatDate(sessionToReactivate.date.toDate())}`;
            const newExercises = [{
                id: Date.now(), // Unique ID for the new exercise entry
                name: sessionToReactivate.exerciseName,
                category: sessionToReactivate.category,
                series: sessionToReactivate.series.map(s => ({
                    weight: s.weight.toString(),
                    reps: s.reps.toString(),
                    completed: false // Start as uncompleted
                })),
                notes: sessionToReactivate.notes || '',
                progressionHistory: [], // This will be populated from historical data for the new exercise
            }];

            setWorkouts(prev => ({
                ...prev,
                days: {
                    ...prev.days,
                    [newDayName]: newExercises
                },
                dayOrder: [...prev.dayOrder, newDayName]
            }));

            showToast(`Exercice '${sessionToReactivate.exerciseName}' réactivé dans un nouveau jour !`, "success");

        } catch (error) {
            console.error("Error reactivating exercise:", error);
            showToast("Erreur lors de la réactivation de l'exercice.", "error");
        }
    }, [historicalData, workouts, userId, showToast, formatDate]);

    // AI Integration
    const GOOGLE_GEMINI_API_KEY = typeof __google_gemini_api_key !== 'undefined' ? __google_gemini_api_key : '';
    const generativeAI = useMemo(() => {
        if (GOOGLE_GEMINI_API_KEY) {
            try {
                return new GenerativeAIModule.GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
            } catch (error) {
                console.error("Failed to initialize Generative AI:", error);
                showToast("Erreur d'initialisation de l'IA. Vérifiez votre clé API.", "error");
                return null;
            }
        }
        return null;
    }, [GOOGLE_GEMINI_API_KEY, showToast]);

    const model = useMemo(() => {
        return generativeAI ? generativeAI.getGenerativeModel({ model: "gemini-pro" }) : null;
    }, [generativeAI]);

    const analyzeProgressionWithAI = useCallback(async (exerciseData) => {
        if (!model) {
            showToast("Service IA non disponible. Vérifiez la configuration.", "error");
            return;
        }

        setAiAnalysisLoading(true);
        try {
            const prompt = `Analyse la progression de l'exercice "${exerciseData.name}" basé sur les données historiques suivantes. Pour chaque série, indique le poids et les répétitions. Les données sont des objets {date: Timestamp, series: [{weight: number, reps: number}]}.
            ${JSON.stringify(exerciseData.progressionHistory)}
            Fournis une analyse concise de la performance, des tendances, des points forts, des points faibles, et des suggestions pour l'améliorer. Utilise un ton motivant et encourageant, comme un coach sportif. Ne fais pas de préambule ni de conclusion, juste l'analyse. Commence directement par "Super travail sur l'exercice...".`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setProgressionAnalysisContent(text);
        } catch (error) {
            console.error("Erreur lors de l'analyse de la progression par l'IA:", error);
            setProgressionAnalysisContent("Désolé, une erreur est survenue lors de l'analyse de la progression par l'IA.");
            showToast("Erreur IA lors de l'analyse de progression.", "error");
        } finally {
            setAiAnalysisLoading(false);
        }
    }, [model, showToast]);

    const analyzeGlobalStatsWithAI = useCallback(async () => {
        if (!model) {
            showToast("Service IA non disponible. Vérifiez la configuration.", "error");
            return;
        }

        setIsLoadingAI(true);
        try {
            const prompt = `En tant que coach sportif, analyse les statistiques globales suivantes de l'utilisateur et propose des suggestions personnalisées pour améliorer son entraînement.
            Données d'entraînement actuelles: ${JSON.stringify(workouts)}
            Données historiques (5 dernières sessions): ${JSON.stringify(historicalData.slice(0, 5))}
            Records personnels: ${JSON.stringify(personalBests)}
            Notes globales: ${globalNotes}
            
            Fais une analyse des points forts et des points à améliorer. Propose 3-5 suggestions concrètes et motivantes pour les entraînements futurs (ex: "Essaie d'ajouter X", "Considère Y", "Concentrez-vous sur Z"). Ne fais pas de préambule ni de conclusion, juste l'analyse et les suggestions. Chaque suggestion doit être une phrase ou deux.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            // Parse suggestions from the text, assuming they are clearly listed
            const suggestionsArray = text.split('\n').filter(line => line.trim().length > 0 && (line.includes('suggestion') || line.includes('Propose') || line.includes('essaie') || line.includes('considère') || line.includes('concentrez-vous')));
            setAiSuggestions(suggestionsArray);
            showToast("Analyse IA générée !", "success");
        } catch (error) {
            console.error("Erreur lors de l'analyse globale par l'IA:", error);
            setAiSuggestions(["Désolé, une erreur est survenue lors de l'analyse globale par l'IA."]);
            showToast("Erreur IA lors de l'analyse globale.", "error");
        } finally {
            setIsLoadingAI(false);
        }
    }, [model, workouts, historicalData, personalBests, globalNotes, showToast]);

    const showProgressionGraphForExercise = useCallback((exerciseName, exerciseId) => {
        const exerciseHistory = historicalData
            .filter(session => session.exerciseName === exerciseName)
            .sort((a, b) => a.date.toDate() - b.date.toDate()) // Ensure chronological order
            .map(session => ({
                date: formatDate(session.date.toDate()),
                // For a simple line chart, we can plot max weight or estimated 1RM per session
                // Or average volume per session (weight * reps for each series)
                value: session.series.reduce((sum, s) => sum + (s.weight * s.reps), 0) // Total volume for the exercise in that session
            }));

        setProgressionGraphData(exerciseHistory);
        setProgressionGraphExerciseName(exerciseName);
        setShowProgressionGraph(true);
    }, [historicalData, formatDate]);

    // Global stats calculation for StatsView
    const getWorkoutStats = useCallback(() => {
        let totalVolume = 0; // Total weight * reps across all completed series
        let completedWorkouts = 0; // Number of days marked as completed
        let totalExercises = 0; // Total unique exercises ever done
        const exerciseCategories = new Set();
        const topExercises = {}; // { exerciseName: totalVolume }
        const daysTrained = new Set(); // To count unique days trained

        // From historical data
        historicalData.forEach(session => {
            session.series.forEach(serie => {
                totalVolume += (serie.weight || 0) * (serie.reps || 0);
            });
            if (session.dayName) { // Assuming dayName is recorded upon completion
                completedWorkouts++;
                daysTrained.add(formatDate(session.date.toDate())); // Use formatted date for unique days
            }
            if (session.exerciseName) {
                totalExercises++; // This counts each instance of an exercise
                exerciseCategories.add(session.category);
                topExercises[session.exerciseName] = (topExercises[session.exerciseName] || 0) + session.series.reduce((sum, s) => sum + (s.weight * s.reps), 0);
            }
        });

        // From current workouts (for exercises not yet in history)
        Object.values(workouts.days).forEach(dayExercises => {
            dayExercises.forEach(exercise => {
                exerciseCategories.add(exercise.category);
                // We don't add current workout volume to totalVolume here, as it's only for completed sessions.
                // We could add exercise.name to a set of unique exercises if we wanted *all* defined exercises.
            });
        });

        const sortedTopExercises = Object.entries(topExercises)
            .sort(([, volumeA], [, volumeB]) => volumeB - volumeA)
            .slice(0, 5); // Top 5 exercises by volume

        return {
            totalVolume: Math.round(totalVolume),
            completedWorkouts: completedWorkouts, // This is count of historical *sessions*, not unique completed days
            totalUniqueExercises: new Set(historicalData.map(d => d.exerciseName)).size, // Count unique exercise names in history
            numberOfDaysTrained: daysTrained.size,
            totalCategories: exerciseCategories.size,
            topExercises: sortedTopExercises,
        };
    }, [historicalData, workouts, formatDate]);


    // Undo/Redo functionality
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            isUpdatingHistoryRef.current = true;
            setHistoryIndex(prev => prev - 1);
            setWorkouts(history[historyIndex - 1]);
            showToast("Action annulée.", "info", { label: "Rétablir", onClick: redo });
            isUpdatingHistoryRef.current = false;
        } else {
            showToast("Rien à annuler.", "info");
        }
    }, [history, historyIndex, redo, showToast]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUpdatingHistoryRef.current = true;
            setHistoryIndex(prev => prev + 1);
            setWorkouts(history[historyIndex + 1]);
            showToast("Action rétablie.", "info");
            isUpdatingHistoryRef.current = false;
        } else {
            showToast("Rien à rétablir.", "info");
        }
    }, [history, historyIndex, showToast]);

    // Global Notes Save
    const saveGlobalNotes = useCallback(async (notes) => {
        if (!userId) {
            showToast("Veuillez vous connecter pour sauvegarder les notes.", "error");
            return;
        }
        try {
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/notes`, 'global'), { notes, timestamp: serverTimestamp() }, { merge: true });
            showToast("Notes globales sauvegardées !", "success");
        } catch (e) {
            console.error("Error saving global notes:", e);
            showToast("Erreur lors de la sauvegarde des notes globales.", "error");
        }
    }, [db, userId, showToast]);

    return (
        <div className={`min-h-screen bg-gray-900 text-gray-100 ${darkMode ? 'dark' : ''}`}>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    action={toast.action}
                    duration={toast.duration}
                    onClose={closeToast}
                />
            )}

            <div className="container mx-auto p-4 pb-20 max-w-xl">
                <h1 className="text-4xl font-extrabold text-white text-center mb-8 tracking-tight">
                    🔥 PowerLog
                </h1>

                {/* Top Bar for Global Actions */}
                <div className="flex justify-between items-center bg-gray-800/50 rounded-lg p-3 mb-6 shadow-xl border border-gray-700/50">
                    <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Annuler"
                    >
                        <Undo2 className="h-5 w-5 text-gray-300" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Rétablir"
                    >
                        <Redo2 className="h-5 w-5 text-gray-300" />
                    </button>
                    <button
                        onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                        className={`p-2 rounded-full transition-all ${isAdvancedMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                        aria-label="Mode avancé"
                    >
                        <Sparkles className={`h-5 w-5 ${isAdvancedMode ? 'text-white' : 'text-gray-300'}`} />
                    </button>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-all"
                        aria-label="Toggle Dark Mode"
                    >
                        {darkMode ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-blue-400" />}
                    </button>
                    <button
                        onClick={addDay}
                        className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition-all"
                        aria-label="Ajouter un jour"
                    >
                        <Plus className="h-5 w-5 text-white" />
                    </button>
                </div>

                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        addDay={addDay}
                        renameDay={renameDay}
                        deleteDay={deleteDay}
                        addExercise={addExercise}
                        deleteExercise={deleteExercise}
                        updateExerciseNotes={updateExerciseNotes}
                        addSerie={addSerie}
                        removeSerie={removeSerie}
                        updateSerie={updateSerie}
                        toggleSerieCompleted={toggleSerieCompleted}
                        handleEditExerciseName={handleEditExerciseName}
                        handleEditExerciseCategory={handleEditExerciseCategory}
                        markDayAsCompleted={markDayAsCompleted}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        selectedDayFilter={selectedDayFilter}
                        setSelectedDayFilter={setSelectedDayFilter}
                        selectedCategoryFilter={selectedCategoryFilter}
                        setSelectedCategoryFilter={setSelectedCategoryFilter}
                        showOnlyCompleted={showOnlyCompleted}
                        setShowOnlyCompleted={setShowOnlyCompleted}
                        sortExercises={sortExercises}
                        isAdvancedMode={isAdvancedMode}
                        showToast={showToast}
                        formatDate={formatDate} // Pass formatDate
                        showProgressionGraphForExercise={showProgressionGraphForExercise}
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
                        setTimerPreset={(preset) => {
                            setTimerSeconds(preset);
                            setRestTimeInput(String(preset)); // Update restTimeInput to reflect preset for consistency
                        }}
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
                        saveGlobalNotes={saveGlobalNotes}
                        analyzeGlobalStatsWithAI={analyzeGlobalStatsWithAI}
                        aiAnalysisLoading={aiAnalysisLoading}
                        aiSuggestions={aiSuggestions}
                        isLoadingAI={isLoadingAI}
                        getWorkoutStats={getWorkoutStats}
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
                        isAdvancedMode={isAdvancedMode}
                    />
                )}

                <BottomNavigationBar
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                />

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

                {/* Progression Analysis Modal */}
                {progressionAnalysisContent && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
                        <div className="bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full border border-gray-700 transform scale-95 animate-scale-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-white">Analyse de Progression</h3>
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
                )}
            </div>
        </div>
    );
};

export default ImprovedWorkoutApp;