// App.jsx
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
import TimerModal from './components/TimerModal.jsx';
import ExerciseSelector from './components/ExerciseSelector.jsx';

// Configuration Firebase
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialisation de l'IA générative
const genAI = new GenerativeAIModule.GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


const ImprovedWorkoutApp = () => {
    const [currentView, setCurrentView] = useState('workout'); // 'workout', 'timer', 'history', 'stats'
    const [workouts, setWorkouts] = useState({
        days: {},
        dayOrder: [] // Pour maintenir l'ordre des jours
    });
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [globalNotes, setGlobalNotes] = useState('');
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false); // État pour la modale du minuteur
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // État pour la modale des paramètres

    // États pour les paramètres
    const [settings, setSettings] = useState({
        defaultRestTime: 90, // Temps de repos par défaut en secondes
        autoStartTimer: false, // Démarrer automatiquement le minuteur après chaque série
        showEstimated1RM: true, // Afficher le 1RM estimé
        weightIncrement: 2.5, // Incrément de poids par défaut
        theme: 'dark', // Thème (dark/light)
        notifications: true, // Notifications activées
        autoSave: true, // Sauvegarde automatique
        showVolume: true, // Afficher le volume par exercice
        compactMode: false, // Mode compact pour l'affichage
        defaultSets: 3, // Nombre de séries par défaut pour nouveaux exercices
        defaultReps: 10 // Nombre de répétitions par défaut pour nouvelles séries
    });

    // États pour le minuteur global
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const timerIntervalRef = useRef(null);

    // AI States
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [isLoadingAI, setIsLoadingAI] = useState(false);

    // Fonction pour afficher les toasts
    const showToast = useCallback((message, type = 'info', duration = 3000, action = null) => {
        setToast({ message, type, duration, action });
    }, []);

    // Fonction pour le minuteur
    const startTimer = useCallback(() => {
        setTimerIsRunning(true);
        setTimerIsFinished(false);
    }, []);

    const pauseTimer = useCallback(() => {
        setTimerIsRunning(false);
    }, []);

    const resetTimer = useCallback(() => {
        setTimerSeconds(0);
        setTimerIsRunning(false);
        setTimerIsFinished(false);
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    }, []);

    const formatTime = useCallback((totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    // Effet pour le minuteur
    useEffect(() => {
        if (timerIsRunning && timerSeconds > 0) {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
            timerIntervalRef.current = setInterval(() => {
                setTimerSeconds((prevSeconds) => {
                    if (prevSeconds <= 1) {
                        clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                        setTimerIsRunning(false);
                        setTimerIsFinished(true);
                        showToast("Le minuteur est terminé !", 'success');
                        return 0;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        } else if (timerIsRunning && timerSeconds === 0) {
            // If timer started at 0, immediately finish
            setTimerIsRunning(false);
            setTimerIsFinished(true);
            showToast("Le minuteur est terminé !", 'success');
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        } else if (!timerIsRunning && timerSeconds === 0 && timerIsFinished) {
            // Do nothing if timer is finished and at 0
        } else if (!timerIsRunning && timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [timerIsRunning, timerSeconds, showToast]);


    // Firebase Auth et Firestore
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Erreur de connexion anonyme:", error);
                    showToast("Erreur de connexion. Veuillez réessayer.", "error");
                }
            }
            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribeAuth();
    }, [showToast]);

    useEffect(() => {
        if (user) {
            const docRef = doc(db, "users", user.uid);
            const unsubscribeFirestore = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setWorkouts(data.workouts || { days: {}, dayOrder: [] });
                    setHistoricalData(data.historicalData || []);
                    setPersonalBests(data.personalBests || {});
                    setGlobalNotes(data.globalNotes || '');
                    setSettings(data.settings || {
                        defaultRestTime: 90,
                        autoStartTimer: false,
                        showEstimated1RM: true,
                        weightIncrement: 2.5,
                        theme: 'dark',
                        notifications: true,
                        autoSave: true,
                        showVolume: true,
                        compactMode: false,
                        defaultSets: 3,
                        defaultReps: 10
                    });
                } else {
                    console.log("Document utilisateur non trouvé, initialisation...");
                    // Initialiser avec des structures vides si le document n'existe pas
                    setDoc(docRef, {
                        workouts: { days: {}, dayOrder: [] },
                        historicalData: [],
                        personalBests: {},
                        globalNotes: '',
                        settings: {
                            defaultRestTime: 90,
                            autoStartTimer: false,
                            showEstimated1RM: true,
                            weightIncrement: 2.5,
                            theme: 'dark',
                            notifications: true,
                            autoSave: true,
                            showVolume: true,
                            compactMode: false,
                            defaultSets: 3,
                            defaultReps: 10
                        }
                    }).catch(e => console.error("Erreur d'initialisation du document:", e));
                }
            }, (error) => {
                console.error("Erreur de récupération des données Firestore:", error);
                showToast("Erreur de chargement des données. Veuillez vérifier votre connexion.", "error");
            });

            return () => unsubscribeFirestore();
        }
    }, [user, showToast]);

    // Sauvegarde des données
    const saveData = useCallback(async (dataToSave) => {
        if (!user) {
            showToast("Utilisateur non connecté, impossible de sauvegarder.", "error");
            return;
        }
        const docRef = doc(db, "users", user.uid);
        try {
            await setDoc(docRef, dataToSave, { merge: true });
            // console.log("Données sauvegardées avec succès !");
        } catch (e) {
            console.error("Erreur de sauvegarde des données:", e);
            showToast("Erreur de sauvegarde. Veuillez réessayer.", "error");
        }
    }, [user, showToast]);

    // Effet pour sauvegarder les workouts, historicalData, personalBests, globalNotes et settings
    useEffect(() => {
        if (user && workouts.days) { // S'assurer que workouts est initialisé
            saveData({ workouts, historicalData, personalBests, globalNotes, settings });
        }
    }, [workouts, historicalData, personalBests, globalNotes, settings, user, saveData]);

    // Fonctions utilitaires
    const formatDate = useCallback((dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        // Si dateString est un objet Timestamp de Firebase
        if (dateString && typeof dateString.toDate === 'function') {
            return dateString.toDate().toLocaleDateString('fr-FR', options);
        }
        // Si dateString est une date ISO string ou un objet Date
        try {
            const date = new Date(dateString);
            if (!isNaN(date)) {
                return date.toLocaleDateString('fr-FR', options);
            }
        } catch (e) {
            console.error("Invalid date string:", dateString, e);
        }
        return "Date invalide";
    }, []);

    const getSeriesDisplay = useCallback((series) => {
        if (!series) return '';
        return series.map(s => `${s.reps}x${s.weight}kg`).join(' | ');
    }, []);

    const calculateTotalVolume = useCallback((sessions) => {
        return sessions.reduce((totalVol, session) => {
            const sessionVolume = session.exercises.reduce((seshVol, exercise) => {
                const exerciseVolume = exercise.sets.reduce((exVol, set) => exVol + (set.reps * set.weight), 0);
                return seshVol + exerciseVolume;
            }, 0);
            return totalVol + sessionVolume;
        }, 0);
    }, []);

    const getWorkoutStats = useCallback(() => {
        const stats = {
            totalWorkouts: historicalData.length,
            totalExercises: new Set(historicalData.flatMap(session => session.exercises.map(ex => ex.name))).size,
            totalVolume: calculateTotalVolume(historicalData),
            averageVolumePerWorkout: historicalData.length > 0 ? calculateTotalVolume(historicalData) / historicalData.length : 0,
            averageDuration: 0, // This needs actual duration data
        };

        // Calculate average duration if available
        const totalDuration = historicalData.reduce((sum, session) => {
            if (session.duration) {
                // Assuming duration is in minutes or seconds, normalize to minutes for average
                return sum + session.duration;
            }
            return sum;
        }, 0);

        if (historicalData.length > 0 && totalDuration > 0) {
            stats.averageDuration = totalDuration / historicalData.length;
        }

        return stats;
    }, [historicalData, calculateTotalVolume]);


    const getExerciseVolumeData = useCallback(() => {
        const exerciseVolumeMap = {};
        historicalData.forEach(session => {
            session.exercises.forEach(exercise => {
                if (!exercise.deleted) {
                    const volume = exercise.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
                    exerciseVolumeMap[exercise.name] = (exerciseVolumeMap[exercise.name] || 0) + volume;
                }
            });
        });
        return Object.entries(exerciseVolumeMap)
            .sort(([, a], [, b]) => b - a)
            .map(([name, volume]) => ({ name, volume }));
    }, [historicalData]);

    const getDailyVolumeData = useCallback(() => {
        const dailyVolumeMap = {};
        historicalData.forEach(session => {
            const date = formatDate(session.date); // Use formatDate for consistent keys
            const sessionVolume = session.exercises.reduce((seshVol, exercise) => {
                const exerciseVolume = exercise.sets.reduce((exVol, set) => exVol + (set.reps * set.weight), 0);
                return seshVol + exerciseVolume;
            }, 0);
            dailyVolumeMap[date] = (dailyVolumeMap[date] || 0) + sessionVolume;
        });

        // Sort by date to ensure proper graph display
        return Object.entries(dailyVolumeMap)
            .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
            .map(([date, volume]) => ({ date, volume }));
    }, [historicalData, formatDate]);

    const getExerciseFrequencyData = useCallback(() => {
        const exerciseFrequencyMap = {};
        historicalData.forEach(session => {
            session.exercises.forEach(exercise => {
                if (!exercise.deleted) {
                    exerciseFrequencyMap[exercise.name] = (exerciseFrequencyMap[exercise.name] || 0) + 1;
                }
            });
        });
        return Object.entries(exerciseFrequencyMap)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));
    }, [historicalData]);

    const analyzeProgressionWithAI = useCallback(async (exerciseName, history) => {
        setIsLoadingAI(true);
        setProgressionAnalysisContent(''); // Clear previous analysis
        try {
            const formattedHistory = history.map(session => ({
                date: formatDate(session.date),
                sets: session.sets.map(set => `${set.reps} reps x ${set.weight} kg`).join(', ')
            }));

            const prompt = `Analyse la progression pour l'exercice "${exerciseName}" basé sur l'historique suivant et donne des conseils personnalisés. Identifie les tendances (augmentation de poids, de reps, de volume), les plateaux, et suggère des ajustements. Propose des conseils clairs et concis pour les prochaines séances.

            Historique:
            ${JSON.stringify(formattedHistory, null, 2)}

            Format de la réponse (analyse + conseils):
            - Points clés de la progression (ex: "Progression constante en force", "Plateau identifié")
            - Analyse détaillée (augmentation/diminution des reps/poids, volume)
            - Conseils personnalisés (ex: "Augmenter le poids de 2.5kg", "Tenter une série supplémentaire", "Changer de variation d'exercice", "Prendre un deload")`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            setProgressionAnalysisContent(text);
        } catch (error) {
            console.error("Erreur lors de l'analyse de progression par l'IA:", error);
            setProgressionAnalysisContent("Désolé, une erreur est survenue lors de l'analyse de votre progression. Veuillez réessayer.");
            showToast("Erreur de l'IA pour l'analyse de progression.", "error");
        } finally {
            setIsLoadingAI(false);
        }
    }, [model, formatDate, showToast]);

    const analyzeGlobalStatsWithAI = useCallback(async () => {
        setIsLoadingAI(true);
        setAiSuggestions([]); // Clear previous suggestions
        try {
            const workoutStats = getWorkoutStats();
            const exerciseVolumeData = getExerciseVolumeData();
            const exerciseFrequencyData = getExerciseFrequencyData();

            const prompt = `En tant qu'entraîneur IA, analyse les statistiques globales d'entraînement suivantes et propose des suggestions personnalisées pour améliorer la performance, la récupération et la planification des entraînements.

            Statistiques globales:
            - Nombre total de séances: ${workoutStats.totalWorkouts}
            - Nombre total d'exercices différents: ${workoutStats.totalExercises}
            - Volume total d'entraînement: ${workoutStats.totalVolume.toFixed(2)} kg
            - Volume moyen par séance: ${workoutStats.averageVolumePerWorkout.toFixed(2)} kg
            - Durée moyenne par séance: ${workoutStats.averageDuration > 0 ? `${workoutStats.averageDuration.toFixed(1)} minutes` : 'Non disponible'}

            Volume par exercice (Top 5):
            ${exerciseVolumeData.slice(0, 5).map(data => `- ${data.name}: ${data.volume.toFixed(2)} kg`).join('\n')}

            Fréquence par exercice (Top 5):
            ${exerciseFrequencyData.slice(0, 5).map(data => `- ${data.name}: ${data.count} séances`).join('\n')}

            Records personnels (si disponibles):
            ${Object.keys(personalBests).length > 0 ?
                    Object.entries(personalBests).map(([exerciseName, pb]) =>
                        `- ${exerciseName}: ${pb.maxWeight} kg x ${pb.maxReps} reps (max poids) / ${pb.maxRepsForWeight} reps à ${pb.weightForMaxReps} kg (max reps) le ${formatDate(pb.date)}`
                    ).join('\n')
                    : 'Aucun record personnel enregistré.'
                }

            Notes globales de l'utilisateur:
            ${globalNotes || 'Aucune note fournie.'}

            Fournis des suggestions concises et actionnables, sous forme de courtes phrases ou de paragraphes, pour les domaines suivants:
            1.  **Amélioration de la performance:** Comment l'utilisateur peut-il devenir plus fort/plus endurant?
            2.  **Variété/Équilibre:** Y a-t-il des déséquilibres ou des manques dans les exercices ou les groupes musculaires travaillés?
            3.  **Récupération:** Des conseils pour optimiser la récupération.
            4.  **Planification:** Des idées pour structurer les entraînements futurs.
            5.  **Motivation/Mental:** Comment maintenir l'engagement.

            Réponds en listant les suggestions directement, sans introduction ni conclusion générale, chaque suggestion étant un paragraphe distinct.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            // Split the text into an array of suggestions, assuming each paragraph is a suggestion
            const suggestionsArray = text.split('\n\n').filter(s => s.trim() !== '');
            setAiSuggestions(suggestionsArray);
        } catch (error) {
            console.error("Erreur lors de l'analyse globale par l'IA:", error);
            setAiSuggestions(["Désolé, une erreur est survenue lors de l'analyse de vos statistiques globales. Veuillez réessayer."]);
            showToast("Erreur de l'IA pour l'analyse globale.", "error");
        } finally {
            setIsLoadingAI(false);
        }
    }, [model, getWorkoutStats, getExerciseVolumeData, getExerciseFrequencyData, personalBests, globalNotes, formatDate, showToast]);


    const handleReactivateExercise = useCallback(async (exerciseName) => {
        try {
            const updatedHistoricalData = historicalData.map(session => ({
                ...session,
                exercises: session.exercises.map(exercise =>
                    exercise.name === exerciseName ? { ...exercise, deleted: false } : exercise
                )
            }));

            // Mettre à jour les `workouts` pour réactiver si l'exercice était dans un programme actif
            const updatedWorkouts = { ...workouts };
            let workoutChanged = false;
            for (const dayKey of updatedWorkouts.dayOrder) {
                const day = updatedWorkouts.days[dayKey];
                if (day && day.exercises) {
                    const exerciseIndex = day.exercises.findIndex(ex => ex.name === exerciseName);
                    if (exerciseIndex !== -1 && day.exercises[exerciseIndex].deleted) {
                        day.exercises[exerciseIndex].deleted = false;
                        workoutChanged = true;
                    }
                }
            }

            setHistoricalData(updatedHistoricalData);
            if (workoutChanged) {
                setWorkouts(updatedWorkouts);
            }
            showToast(`L'exercice '${exerciseName}' a été réactivé.`, 'success');
        } catch (error) {
            console.error("Erreur lors de la réactivation de l'exercice:", error);
            showToast("Erreur lors de la réactivation de l'exercice.", "error");
        }
    }, [historicalData, workouts, showToast]);


    const deleteHistoricalSession = useCallback(async (sessionId) => {
        try {
            const updatedHistoricalData = historicalData.filter(session => session.id !== sessionId);
            setHistoricalData(updatedHistoricalData);

            // Optionnel: Mettre à jour les personalBests si la session supprimée contenait un PB
            // Cela nécessiterait de recalculer tous les PBs, ou de marquer la session comme supprimée plutôt que de la retirer.
            // Pour l'instant, on se contente de la suppression de l'historique.
            showToast("Séance supprimée de l'historique.", "success", 3000, {
                label: "Annuler",
                onClick: () => {
                    // Pour une annulation, il faudrait stocker la session supprimée temporairement
                    // et la rajouter ici. Pour l'exemple, on laisse simple.
                    showToast("L'annulation n'est pas encore implémentée pour la suppression de séance.", "info");
                }
            });
        } catch (error) {
            console.error("Erreur lors de la suppression de la session historique:", error);
            showToast("Erreur lors de la suppression de la session historique.", "error");
        }
    }, [historicalData, showToast]);


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="text-lg font-medium">Chargement de votre profil...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="flex items-center justify-between p-4 bg-gray-800 shadow-md">
                <h1 className="text-2xl font-bold text-blue-400">Carnet Muscu</h1>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsTimerModalOpen(true)}
                        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors"
                        aria-label="Ouvrir le minuteur"
                    >
                        <Clock className="h-6 w-6 text-white" />
                    </button>
                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                        aria-label="Ouvrir les paramètres"
                    >
                        <Settings className="h-6 w-6 text-white" />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 pb-20"> {/* Ajout de pb-20 pour éviter que le contenu soit caché par la nav bar */}
                {currentView === 'workout' && (
                    <MainWorkoutView
                        workouts={workouts}
                        setWorkouts={setWorkouts}
                        historicalData={historicalData}
                        setHistoricalData={setHistoricalData}
                        personalBests={personalBests}
                        setPersonalBests={setPersonalBests}
                        formatDate={formatDate}
                        getSeriesDisplay={getSeriesDisplay}
                        analyzeProgressionWithAI={analyzeProgressionWithAI}
                        progressionAnalysisContent={progressionAnalysisContent}
                        setProgressionAnalysisContent={setProgressionAnalysisContent}
                        isLoadingAI={isLoadingAI}
                        showToast={showToast}
                        startTimer={startTimer}
                        setTimerSeconds={setTimerSeconds}
                        setCurrentView={setCurrentView} // Permet à MainWorkoutView de changer de vue (ex: vers le minuteur)
                        settings={settings}
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
                        showToast={showToast}
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
                        deleteHistoricalSession={deleteHistoricalSession}
                        isLoadingAI={isLoadingAI}
                        showToast={showToast}
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
                        onGenerateAISuggestions={analyzeGlobalStatsWithAI}
                        aiSuggestions={aiSuggestions}
                        isLoadingAI={isLoadingAI}
                        progressionAnalysisContent={progressionAnalysisContent} // Pas directement utilisé ici, mais peut l'être si la vue Stats inclut l'analyse d'un exo.
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

            {/* Settings Modal */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl relative">
                        <button
                            onClick={() => setIsSettingsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                            aria-label="Fermer les paramètres"
                        >
                            <X className="h-6 w-6" />
                        </button>

                        <h2 className="text-3xl font-bold text-white text-center mb-6 flex items-center justify-center gap-3">
                            <Settings className="h-8 w-8 text-gray-400" /> Paramètres
                        </h2>

                        <div className="space-y-6">
                            {/* Section Minuteur */}
                            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-blue-400" /> Minuteur
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Temps de repos par défaut (secondes)
                                        </label>
                                        <input
                                            type="number"
                                            value={settings.defaultRestTime}
                                            onChange={(e) => setSettings(prev => ({ ...prev, defaultRestTime: Number(e.target.value) }))}
                                            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="0"
                                            max="600"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="autoStartTimer"
                                            checked={settings.autoStartTimer}
                                            onChange={(e) => setSettings(prev => ({ ...prev, autoStartTimer: e.target.checked }))}
                                            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                        />
                                        <label htmlFor="autoStartTimer" className="text-gray-300">
                                            Démarrer automatiquement le minuteur après chaque série
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Section Affichage */}
                            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Eye className="h-5 w-5 text-green-400" /> Affichage
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="showEstimated1RM"
                                            checked={settings.showEstimated1RM}
                                            onChange={(e) => setSettings(prev => ({ ...prev, showEstimated1RM: e.target.checked }))}
                                            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                        />
                                        <label htmlFor="showEstimated1RM" className="text-gray-300">
                                            Afficher le 1RM estimé pour chaque série
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="showVolume"
                                            checked={settings.showVolume}
                                            onChange={(e) => setSettings(prev => ({ ...prev, showVolume: e.target.checked }))}
                                            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                        />
                                        <label htmlFor="showVolume" className="text-gray-300">
                                            Afficher le volume par exercice
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="compactMode"
                                            checked={settings.compactMode}
                                            onChange={(e) => setSettings(prev => ({ ...prev, compactMode: e.target.checked }))}
                                            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                        />
                                        <label htmlFor="compactMode" className="text-gray-300">
                                            Mode compact (affichage condensé)
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Section Entraînement */}
                            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Dumbbell className="h-5 w-5 text-purple-400" /> Entraînement
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Incrément de poids par défaut (kg)
                                        </label>
                                        <select
                                            value={settings.weightIncrement}
                                            onChange={(e) => setSettings(prev => ({ ...prev, weightIncrement: Number(e.target.value) }))}
                                            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={0.5}>0.5 kg</option>
                                            <option value={1}>1 kg</option>
                                            <option value={1.25}>1.25 kg</option>
                                            <option value={2.5}>2.5 kg</option>
                                            <option value={5}>5 kg</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Séries par défaut
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.defaultSets}
                                                onChange={(e) => setSettings(prev => ({ ...prev, defaultSets: Number(e.target.value) }))}
                                                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="1"
                                                max="10"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Répétitions par défaut
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.defaultReps}
                                                onChange={(e) => setSettings(prev => ({ ...prev, defaultReps: Number(e.target.value) }))}
                                                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="1"
                                                max="50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section Système */}
                            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-orange-400" /> Système
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="notifications"
                                            checked={settings.notifications}
                                            onChange={(e) => setSettings(prev => ({ ...prev, notifications: e.target.checked }))}
                                            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                        />
                                        <label htmlFor="notifications" className="text-gray-300">
                                            Activer les notifications
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="autoSave"
                                            checked={settings.autoSave}
                                            onChange={(e) => setSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
                                            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                        />
                                        <label htmlFor="autoSave" className="text-gray-300">
                                            Sauvegarde automatique
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Thème
                                        </label>
                                        <select
                                            value={settings.theme}
                                            onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
                                            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="dark">Sombre</option>
                                            <option value="light">Clair</option>
                                            <option value="auto">Automatique</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Boutons d'action */}
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => {
                                    setSettings({
                                        defaultRestTime: 90,
                                        autoStartTimer: false,
                                        showEstimated1RM: true,
                                        weightIncrement: 2.5,
                                        theme: 'dark',
                                        notifications: true,
                                        autoSave: true,
                                        showVolume: true,
                                        compactMode: false,
                                        defaultSets: 3,
                                        defaultReps: 10
                                    });
                                    showToast("Paramètres réinitialisés", "info");
                                }}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                            >
                                Réinitialiser
                            </button>
                            <button
                                onClick={() => {
                                    setIsSettingsModalOpen(false);
                                    showToast("Paramètres sauvegardés", "success");
                                }}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImprovedWorkoutApp;