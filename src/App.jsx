// App.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, limit, addDoc, serverTimestamp, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import {
    Undo2, Redo2, Settings, XCircle, CheckCircle, ChevronDown, ChevronUp, Pencil, Sparkles, ArrowUp, ArrowDown,
    Plus, Trash2, Play, Pause, RotateCcw, Search, Filter, Dumbbell, Clock, History, NotebookText,
    LineChart as LineChartIcon, Target, TrendingUp, Award, Calendar, BarChart3,
    Zap, Download, Upload, Share, Eye, EyeOff, Maximize2, Minimize2, Activity, X
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
        showEstimated1RM: true, // Afficher le 1RM estimé
        notifications: true, // Notifications activées
        autoSave: true, // Sauvegarde automatique
        showVolume: true, // Afficher le volume par exercice
        defaultSets: 3, // Nombre de séries par défaut pour nouveaux exercices
        defaultReps: 10 // Nombre de répétitions par défaut pour nouvelles séries
    });

    // États pour le minuteur global
    const [timerSeconds, setTimerSeconds] = useState(90); // Défaut à 1:30
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [selectedTimerPreset, setSelectedTimerPreset] = useState(90); // Preset sélectionné
    const timerIntervalRef = useRef(null);

    // AI States
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [selectedExerciseForProgression, setSelectedExerciseForProgression] = useState(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState([]);

    // Fonction pour afficher les toasts
    const showToast = useCallback((message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Authentification
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                try {
                    const result = await signInAnonymously(auth);
                    console.log("Utilisateur connecté anonymement:", result.user.uid);
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
                        showEstimated1RM: true,
                        notifications: true,
                        autoSave: true,
                        showVolume: true,
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
                            showEstimated1RM: true,
                            notifications: true,
                            autoSave: true,
                            showVolume: true,
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

    // Sauvegarder automatiquement
    useEffect(() => {
        if (user && settings.autoSave) {
            const timeoutId = setTimeout(() => {
                saveData({
                    workouts,
                    historicalData,
                    personalBests,
                    globalNotes,
                    settings
                });
            }, 2000); // Délai de 2 secondes après la dernière modification

            return () => clearTimeout(timeoutId);
        }
    }, [workouts, historicalData, personalBests, globalNotes, settings, saveData, user]);

    // Fonctions utilitaires
    const formatDate = useCallback((date) => {
        const dateObj = date instanceof Date ? date : 
                       (date && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
        return dateObj.toLocaleDateString('fr-FR');
    }, []);

    const getSeriesDisplay = useCallback((series) => {
        if (!series || series.length === 0) return "Aucune série";
        return series.map(set => `${set.reps} × ${set.weight}kg`).join(', ');
    }, []);

    // Minuteur
    const startTimer = useCallback((seconds) => {
        // Si pas de paramètre fourni, utiliser timerSeconds actuel
        const timerDuration = typeof seconds === 'number' ? seconds : timerSeconds;
        
        if (timerDuration <= 0) return; // Ne pas démarrer si pas de temps défini
        
        // Mettre à jour le preset sélectionné si un nouveau temps est fourni
        if (typeof seconds === 'number') {
            setSelectedTimerPreset(seconds);
        }
        
        setTimerSeconds(timerDuration);
        setTimerIsRunning(true);
        setTimerIsFinished(false);
        
        // Nettoyer l'ancien timer s'il existe
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        
        timerIntervalRef.current = setInterval(() => {
            setTimerSeconds(prev => {
                if (prev <= 1) {
                    setTimerIsRunning(false);
                    setTimerIsFinished(true);
                    if (settings.notifications && 'Notification' in window) {
                        new Notification("Temps de repos terminé !", {
                            body: "Il est temps de reprendre l'entraînement !",
                            icon: "/favicon.ico"
                        });
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [timerSeconds, settings.notifications]);

    const stopTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        setTimerIsRunning(false);
    }, []);

    const resetTimer = useCallback(() => {
        stopTimer();
        setTimerSeconds(selectedTimerPreset); // Retourner au preset sélectionné
        setTimerIsFinished(false);
    }, [stopTimer, selectedTimerPreset]);

    // Fonctions de calcul pour les statistiques
    const getWorkoutStats = useCallback(() => {
        const totalWorkouts = historicalData.length;
        const totalExercises = new Set(historicalData.flatMap(session => 
            session.exercises.filter(ex => !ex.deleted).map(ex => ex.name)
        )).size;
        
        const totalVolume = historicalData.reduce((sum, session) => 
            sum + session.exercises.filter(ex => !ex.deleted).reduce((sessionSum, ex) => 
                sessionSum + ex.sets.reduce((setSum, set) => setSum + (set.reps * set.weight), 0), 0
            ), 0
        );
        
        const averageVolumePerWorkout = totalWorkouts > 0 ? totalVolume / totalWorkouts : 0;
        
        // Calcul de la durée moyenne
        const sessionsWithDuration = historicalData.filter(session => session.duration && session.duration > 0);
        const averageDuration = sessionsWithDuration.length > 0 ? 
            sessionsWithDuration.reduce((sum, session) => sum + session.duration, 0) / sessionsWithDuration.length : 0;

        return {
            totalWorkouts,
            totalExercises,
            totalVolume,
            averageVolumePerWorkout,
            averageDuration
        };
    }, [historicalData]);

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
            const dateKey = formatDate(session.date);
            const dailyVolume = session.exercises.filter(ex => !ex.deleted).reduce((sum, ex) => 
                sum + ex.sets.reduce((setSum, set) => setSum + (set.reps * set.weight), 0), 0
            );
            dailyVolumeMap[dateKey] = (dailyVolumeMap[dateKey] || 0) + dailyVolume;
        });
        return Object.entries(dailyVolumeMap)
            .sort(([a], [b]) => new Date(a) - new Date(b))
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

            Limite tes suggestions à 5-7 conseils au total, chacun étant une phrase ou un court paragraphe actionnable.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Convertir le texte en suggestions (diviser par ligne ou par section)
            const suggestions = text.split('\n')
                .filter(line => line.trim().length > 10)
                .slice(0, 7);

            setAiSuggestions(suggestions);
        } catch (error) {
            console.error("Erreur lors de l'analyse globale par l'IA:", error);
            setAiSuggestions(["Désolé, une erreur est survenue lors de l'analyse de vos statistiques. Veuillez réessayer."]);
            showToast("Erreur de l'IA pour l'analyse globale.", "error");
        } finally {
            setIsLoadingAI(false);
        }
    }, [getWorkoutStats, getExerciseVolumeData, getExerciseFrequencyData, personalBests, formatDate, globalNotes, model, showToast]);

    const deleteHistoricalSession = useCallback((sessionIndex) => {
        setHistoricalData(prevData => {
            const updatedData = [...prevData];
            updatedData.splice(sessionIndex, 1);
            return updatedData;
        });
        showToast("Séance supprimée de l'historique.", "info");
    }, [showToast]);

    const handleReactivateExercise = useCallback((sessionIndex, exerciseIndex) => {
        setHistoricalData(prevData => {
            const updatedData = [...prevData];
            if (updatedData[sessionIndex] && updatedData[sessionIndex].exercises[exerciseIndex]) {
                updatedData[sessionIndex].exercises[exerciseIndex].deleted = false;
            }
            return updatedData;
        });
        showToast("Exercice réactivé.", "success");
    }, [showToast]);

    // Gestion des paramètres avec correction pour les valeurs vides
    const handleSettingsChange = useCallback((field, value) => {
        setSettings(prev => {
            // Pour les champs numériques, gérer les valeurs vides
            if ((field === 'defaultSets' || field === 'defaultReps') && value === '') {
                return { ...prev, [field]: '' };
            }
            
            // Pour les champs numériques avec valeur, s'assurer qu'elle est valide
            if (field === 'defaultSets' || field === 'defaultReps') {
                const numValue = Number(value);
                if (isNaN(numValue) || numValue < 1) {
                    return prev; // Ne pas mettre à jour si la valeur n'est pas valide
                }
                return { ...prev, [field]: numValue };
            }
            
            // Pour les autres champs (checkbox, etc.)
            return { ...prev, [field]: value };
        });
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Chargement...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Barre de navigation supérieure */}
            <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Dumbbell className="h-6 w-6 text-blue-400" />
                    Mon Carnet
                </h1>
                <div className="flex items-center gap-2">
                    {/* Bouton Timer */}
                    <button
                        onClick={() => setIsTimerModalOpen(true)}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                        aria-label="Ouvrir le minuteur"
                    >
                        <Clock className="h-5 w-5" />
                    </button>
                    {/* Bouton Paramètres */}
                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                        aria-label="Ouvrir les paramètres"
                    >
                        <Settings className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* Contenu principal */}
            <div className="pb-20">
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
                        setCurrentView={setCurrentView}
                        settings={settings}
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

                {currentView === 'timer' && (
                    <TimerView
                        timerSeconds={timerSeconds}
                        timerIsRunning={timerIsRunning}
                        timerIsFinished={timerIsFinished}
                        startTimer={startTimer}
                        stopTimer={stopTimer}
                        resetTimer={resetTimer}
                        setTimerSeconds={setTimerSeconds}
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
                        aiAnalysisLoading={isLoadingAI}
                        onGenerateAISuggestions={analyzeGlobalStatsWithAI}
                        aiSuggestions={aiSuggestions}
                        isLoadingAI={isLoadingAI}
                        progressionAnalysisContent={progressionAnalysisContent}
                        getWorkoutStats={getWorkoutStats}
                        getExerciseVolumeData={getExerciseVolumeData}
                        getDailyVolumeData={getDailyVolumeData}
                        getExerciseFrequencyData={getExerciseFrequencyData}
                        showToast={showToast}
                    />
                )}
            </div>

            {/* Navigation inférieure */}
            <BottomNavigationBar 
                currentView={currentView} 
                setCurrentView={setCurrentView}
                timerSeconds={timerSeconds}
                timerIsRunning={timerIsRunning}
                setIsTimerModalOpen={setIsTimerModalOpen}
                setIsSettingsModalOpen={setIsSettingsModalOpen}
            />

            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Modale du minuteur */}
            {isTimerModalOpen && (
                <TimerModal
                    isOpen={isTimerModalOpen}
                    onClose={() => setIsTimerModalOpen(false)}
                    timerSeconds={timerSeconds}
                    timerIsRunning={timerIsRunning}
                    timerIsFinished={timerIsFinished}
                    startTimer={startTimer}
                    pauseTimer={stopTimer}
                    resetTimer={resetTimer}
                    setTimerSeconds={(seconds) => {
                        setTimerSeconds(seconds);
                        setSelectedTimerPreset(seconds);
                    }}
                    formatTime={(seconds) => {
                        // Vérifier que seconds est un nombre valide
                        const validSeconds = typeof seconds === 'number' && !isNaN(seconds) ? seconds : 0;
                        const mins = Math.floor(validSeconds / 60);
                        const secs = validSeconds % 60;
                        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                    }}
                />
            )}

            {/* Modale des paramètres */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                                <Settings className="h-8 w-8 text-gray-400" /> 
                                Paramètres
                            </h2>

                            <div className="space-y-6">
                                {/* Section Affichage */}
                                <div className="rounded-lg p-4 border bg-gray-700/30 border-gray-600/50">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                                        <Eye className="h-5 w-5 text-green-400" /> 
                                        Affichage
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="showEstimated1RM"
                                                checked={settings.showEstimated1RM}
                                                onChange={(e) => handleSettingsChange('showEstimated1RM', e.target.checked)}
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
                                                onChange={(e) => handleSettingsChange('showVolume', e.target.checked)}
                                                className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                            />
                                            <label htmlFor="showVolume" className="text-gray-300">
                                                Afficher le volume par exercice
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Section Entraînement */}
                                <div className="rounded-lg p-4 border bg-gray-700/30 border-gray-600/50">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                                        <Dumbbell className="h-5 w-5 text-purple-400" /> 
                                        Entraînement
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-gray-300">
                                                    Séries par défaut
                                                </label>
                                                <input
                                                    type="number"
                                                    value={settings.defaultSets}
                                                    onChange={(e) => handleSettingsChange('defaultSets', e.target.value)}
                                                    className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white border border-gray-600"
                                                    min="1"
                                                    max="10"
                                                    placeholder="Nombre de séries"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-gray-300">
                                                    Répétitions par défaut
                                                </label>
                                                <input
                                                    type="number"
                                                    value={settings.defaultReps}
                                                    onChange={(e) => handleSettingsChange('defaultReps', e.target.value)}
                                                    className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white border border-gray-600"
                                                    min="1"
                                                    max="50"
                                                    placeholder="Nombre de répétitions"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section Système */}
                                <div className="rounded-lg p-4 border bg-gray-700/30 border-gray-600/50">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                                        <Settings className="h-5 w-5 text-orange-400" /> 
                                        Système
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id="notifications"
                                                checked={settings.notifications}
                                                onChange={(e) => handleSettingsChange('notifications', e.target.checked)}
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
                                                onChange={(e) => handleSettingsChange('autoSave', e.target.checked)}
                                                className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                                            />
                                            <label htmlFor="autoSave" className="text-gray-300">
                                                Sauvegarde automatique
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Boutons d'action */}
                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => {
                                        setSettings({
                                            showEstimated1RM: true,
                                            notifications: true,
                                            autoSave: true,
                                            showVolume: true,
                                            defaultSets: 3,
                                            defaultReps: 10
                                        });
                                        showToast("Paramètres réinitialisés", "info");
                                    }}
                                    className="flex-1 font-medium py-3 px-4 rounded-lg transition-colors bg-gray-600 hover:bg-gray-700 text-white"
                                >
                                    Réinitialiser
                                </button>
                                <button
                                    onClick={() => {
                                        // S'assurer que les valeurs numériques sont valides avant de fermer
                                        const finalSettings = {
                                            ...settings,
                                            defaultSets: settings.defaultSets === '' ? 3 : Number(settings.defaultSets),
                                            defaultReps: settings.defaultReps === '' ? 10 : Number(settings.defaultReps)
                                        };
                                        setSettings(finalSettings);
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
                </div>
            )}
        </div>
    );
};

export default ImprovedWorkoutApp;