import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, where, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as Tone from 'tone';

// Au lieu de démarrer Tone.js automatiquement
const startAudio = async () => {
  try {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
  } catch (error) {
    console.log('Audio context failed to start:', error);
  }
};

// Démarrez seulement après une interaction utilisateur
document.addEventListener('click', startAudio, { once: true });

// Initialisation de Firebase (les variables __app_id, __firebase_config, __initial_auth_token sont fournies par l'environnement Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// 🔍 Ajoute ceci ici pour debug Vercel :
console.log("VITE_FIREBASE_CONFIG:", import.meta.env.VITE_FIREBASE_CONFIG);

const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
const initialAuthToken = import.meta.env.VITE_INITIAL_AUTH_TOKEN ?? null;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Helper function to generate a date range (all dates between start and end, inclusive)
const generateDateRange = (startDate, endDate) => {
    const dates = [];
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0); // Normalize to start of day

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0); // Normalize to start of day

    while (currentDate <= end) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};

// Composant Toast pour les notifications
const Toast = ({ message, type, onClose }) => {
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const textColor = 'text-white';

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Masque le toast après 3 secondes
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl ${bgColor} ${textColor} text-lg font-semibold z-50 animate-fade-in-up`}>
            {message}
        </div>
    );
};

// Function to generate a UUID (Universally Unique Identifier)
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Structure initiale des données si aucune donnée n'est trouvée dans Firestore
const initialData = {
    days: {
        'Lundi + Jeudi': {
            categories: {
                PECS: [
                    { id: 'pecs-1', name: 'D.Couché léger', series: [{ weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'D.Couché lourd', series: [{ weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'D.Couché incliné léger', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'D.Couché incl lourd', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Ecartés Couchés', series: [{ weight: '6', reps: '' }, { weight: '6', reps: '6' }, { weight: '6', reps: '6' }], isDeleted: false, notes: '' },
                ],
                EPAULES: [
                    { id: generateUUID(), name: 'D.Epaules léger', series: [{ weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'D.Epaules lourd', series: [{ weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Ecartés Epaules', series: [{ weight: '6', reps: '15' }, { weight: '6', reps: '15' }, { weight: '6', reps: '15' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Avant Epaules', series: [{ weight: '6', reps: '15' }, { weight: '6', reps: '15' }, { weight: '6', reps: '15' }], isDeleted: false, notes: '' },
                ],
                TRICEPS: [
                    { id: generateUUID(), name: 'Haltere Front léger', series: [{ weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Haltere Front lourd', series: [{ weight: '6', reps: '8' }, { weight: '6', reps: '8' }, { weight: '6', reps: '8' }, { weight: '6', reps: '8' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Barre Front', series: [{ weight: '16', reps: '6' }, { weight: '16', reps: '6' }, { weight: '16', reps: '6' }, { weight: '16', reps: '6' }], isDeleted: false, notes: '' },
                ],
            },
            categoryOrder: ['PECS', 'EPAULES', 'TRICEPS'],
        },
        'Mardi + Vendredi': {
            categories: {
                DOS: [
                    { id: 'dos-1', name: 'R. Haltères Léger', series: [{ weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'R. Haltères Lourd', series: [{ weight: '12', reps: '8' }, { weight: '12', reps: '8' }, { weight: '12', reps: '8' }, { weight: '12', reps: '8' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Tractions', series: [{ weight: '', reps: '6' }, { weight: '', reps: '6' }, { weight: '6', reps: '6' }, { weight: '', reps: '6' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'R.Haltères Mono', series: [{ weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }], isDeleted: false, notes: '' },
                ],
                BICEPS: [
                    { id: generateUUID(), name: 'Curl Léger', series: [{ weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Curl Lourd', series: [{ weight: '10', reps: '10' }, { weight: '10', reps: '10' }, { weight: '10', reps: '10' }, { weight: '10', reps: '10' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Marteau Léger', series: [{ weight: '8', reps: '13' }, { weight: '8', reps: '13' }, { weight: '8', reps: '13' }, { weight: '8', reps: '13' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Marteau Lourd', series: [{ weight: '12', reps: '6' }, { weight: '12', reps: '6' }, { weight: '12', reps: '6' }, { weight: '12', reps: '6' }], isDeleted: false, notes: '' },
                ],
                'AR . EPAULES + ABS': [
                    { id: generateUUID(), name: 'Ar . Epaules', series: [{ weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Abdos', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                ],
            },
            categoryOrder: ['DOS', 'BICEPS', 'AR . EPAULES + ABS'],
        },
        'Mercredi + Samedi': {
            categories: {
                LEGS: [
                    { id: 'legs-1', name: 'S. de Terre Sumo', series: [{ weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'S. de Terre Normal', series: [{ weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }], isDeleted: false, notes: '' },
                ],
                FENTES: [
                    { id: generateUUID(), name: 'Fentes Ischios Léger uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Fentes Quads Léger uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Fentes Quads Lourd uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Fentes Quads Lourd uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                ],
                CURL: [
                    { id: generateUUID(), name: 'Curl Ischios uni', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Curl Quads uni', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                ],
                MOLLETS: [
                    { id: generateUUID(), name: 'Levées Léger uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: generateUUID(), name: 'Levées Lourd uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                ],
            },
            categoryOrder: ['LEGS', 'FENTES', 'CURL', 'MOLLETS'],
        },
    },
    dayOrder: ['Lundi + Jeudi', 'Mardi + Vendredi', 'Mercredi + Samedi'],
};

// Helper function to calculate 1RM using different formulas
const calculate1RM = (weight, reps) => {
    if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
        return {
            brzycki: 'N/A',
            epley: 'N/A',
            oconnor: 'N/A',
            average: 'N/A'
        };
    }

    let brzyckiVal = null; 
    if (reps <= 37) { // Brzycki formula is generally for reps < 10-12, but can extend. Using 37 as a practical upper limit.
        brzyckiVal = weight * (36 / (37 - reps));
    }

    const epleyVal = weight * (1 + (reps / 30));
    const oconnorVal = weight * (1 + 0.025 * reps);

    let sum = 0;
    let count = 0;
    if (brzyckiVal !== null) {
        sum += brzyckiVal;
        count++;
    }
    sum += epleyVal;
    count++;
    sum += oconnorVal;
    count++;

    const average = count > 0 ? (sum / count) : null;

    return {
        brzycki: brzyckiVal !== null ? brzyckiVal.toFixed(2) : 'N/A',
        epley: epleyVal.toFixed(2),
        oconnor: oconnorVal.toFixed(2),
        average: average !== null ? average.toFixed(2) : 'N/A'
    };
};

// Custom Hook: useTimer
const useTimer = (initialSeconds = 60) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const intervalRef = useRef(null);
    const synthRef = useRef(null); 

    useEffect(() => {
        synthRef.current = new Tone.Synth().toDestination();
        return () => {
            if (synthRef.current) {
                synthRef.current.dispose();
            }
        };
    }, []);

    const startTimer = () => {
        if (seconds > 0) {
            setIsRunning(true);
            setIsFinished(false);
            intervalRef.current = setInterval(() => {
                setSeconds(prevSeconds => {
                    if (prevSeconds <= 1) {
                        clearInterval(intervalRef.current);
                        setIsRunning(false);
                        setIsFinished(true);
                        if (synthRef.current) {
                            for (let i = 0; i < 3; i++) {
                                synthRef.current.triggerAttackRelease('G5', '8n', Tone.now() + (i * 0.5));
                            }
                        }
                        return 0;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        } else {
            resetTimer(initialSeconds);
            // Automatically start after reset if initialSeconds > 0
            if (initialSeconds > 0) {
                 setIsRunning(true);
                 setIsFinished(false);
                 intervalRef.current = setInterval(() => {
                    setSeconds(prevSeconds => {
                        if (prevSeconds <= 1) {
                            clearInterval(intervalRef.current);
                            setIsRunning(false);
                            setIsFinished(true);
                            if (synthRef.current) {
                                for (let i = 0; i < 3; i++) {
                                    synthRef.current.triggerAttackRelease('G5', '8n', Tone.now() + (i * 0.5));
                                }
                            }
                            return 0;
                        }
                        return prevSeconds - 1;
                    });
                }, 1000);
            }
        }
    };

    const pauseTimer = () => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
    };

    const resetTimer = (newInitialSeconds = initialSeconds) => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        setIsFinished(false);
        setSeconds(newInitialSeconds);
    };

    useEffect(() => {
        return () => clearInterval(intervalRef.current);
    }, []);

    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    return {
        seconds,
        isRunning,
        isFinished,
        startTimer,
        pauseTimer,
        resetTimer,
        formatTime,
        setSeconds,
    };
};


// Composant principal de l'application
const App = () => {
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [workouts, setWorkouts] = useState({ days: {}, dayOrder: [] });
    const [loading, setLoading] = useState(true);
    const [editingExercise, setEditingExercise] = useState(null); 
    const [newWeight, setNewWeight] = useState('');
    const [newSets, setNewSets] = useState('');
    const [newReps, setNewReps] = useState('');

    const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');

    const [selectedDayForAdd, setSelectedDayForAdd] = useState('');
    const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState('');
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState(null); 
    const [selectedDayFilter, setSelectedDayFilter] = useState(''); 
    const [showDatePicker, setShowDatePicker] = useState(false); 
    const [selectedDateForHistory, setSelectedDateForHistory] = useState(null); 
    const [selectedHistoryDayFilter, setSelectedHistoryDayFilter] = useState(null);
    const [graphTimeRange, setGraphTimeRange] = useState('90days'); 
    const [historicalDataForGraphs, setHistoricalDataForGraphs] = useState([]); 
    const [processedGraphData, setProcessedGraphData] = useState({}); 

    const [showExerciseGraphModal, setShowExerciseGraphModal] = useState(false); 
    const [exerciseForGraph, setExerciseForGraph] = useState(null); 
    const [individualExerciseGraphData, setIndividualExerciseGraphData] = useState([]); 

    const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [showDeletedExercisesInHistory, setShowDeletedExercisesInHistory] = useState(false);

    const [showAddDayModal, setShowAddDayModal] = useState(false);
    const [newDayNameInput, setNewDayNameInput] = useState('');
    const [showEditDayModal, setShowEditDayModal] = useState(false);
    const [editingDayName, setEditingDayName] = useState(null);
    const [editedDayNewNameInput, setEditedDayNewNameInput] = useState('');
    const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
    const [dayToDeleteName, setDayToDeleteName] = useState(null);

    const [showDayActionsDropdown, setShowDayActionsDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const [showSelectDayForEditModal, setShowSelectDayForEditModal] = useState(false);
    const [showSelectDayForDeleteModal, setShowSelectDayForDeleteModal] = useState(false);

    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
    const [selectedDayForCategoryAdd, setSelectedDayForCategoryAdd] = useState(''); 

    const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null); 

    const [toast, setToast] = useState(null); 

    const [showReorderDaysModal, setShowReorderDaysModal] = useState(false);
    const [reorderingDayOrder, setReorderingDayOrder] = useState([]); 

    const [personalBests, setPersonalBests] = useState({});
    const [progressionInsights, setProgressionInsights] = useState({});

    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const MAX_UNDO_STATES = 10; 

    const [isEditMode, setIsEditMode] = useState(false);

    const [showNotesModal, setShowNotesModal] = useState(false);
    const [exerciseForNotes, setExerciseForNotes] = useState(null); 
    const [currentNoteContent, setCurrentNoteContent] = useState('');

    const DEFAULT_REST_TIME = 90; 
    const {
        seconds: timerSeconds, 
        isRunning: timerIsRunning, 
        isFinished: timerIsFinished, 
        startTimer,
        pauseTimer,
        resetTimer,
        formatTime,
        setSeconds: setTimerSeconds, 
    } = useTimer(DEFAULT_REST_TIME);
    const [restTimeInput, setRestTimeInput] = useState(DEFAULT_REST_TIME); 

    const [graphStartDate, setGraphStartDate] = useState('');
    const [graphEndDate, setGraphEndDate] = useState('');

    // --- Gemini API Integration States (Suggestion related states removed) ---
    const [showProgressionAnalysisModal, setShowProgressionAnalysisModal] = useState(false);
    const [progressionAnalysisLoading, setProgressionAnalysisLoading] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [exerciseForAnalysis, setExerciseForAnalysis] = useState(null);
    // --- End Gemini API Integration States ---


    const toggleAdvancedMode = () => {
        setIsAdvancedMode(prevMode => !prevMode);
    };

    const dayButtonColors = [
        'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
        'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
        'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
        'from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
        'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
        'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
        'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
    ];

    const dayBorderAndTextColors = [
        'border-blue-500 text-blue-700',
        'border-green-500 text-green-700',
        'border-red-500 text-red-700',
        'border-yellow-500 text-yellow-700',
        'border-purple-500 text-purple-700',
        'border-pink-500 text-pink-700',
        'border-indigo-500 text-indigo-700',
    ];

    const normalizeDateToStartOfDay = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const calculateInsights = (historicalSessions) => {
        const pbs = {}; 
        const insights = {}; 

        const today = normalizeDateToStartOfDay(new Date());
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);
        ninetyDaysAgo.setHours(0, 0, 0, 0);

        const exerciseHistory = {};
        historicalSessions.forEach(session => {
            const sessionDate = session.timestamp;
            const workoutData = session.workoutData;

            if (workoutData && workoutData.days) {
                Object.values(workoutData.days).forEach(dayData => {
                    if (dayData && dayData.categories) {
                        Object.values(dayData.categories).forEach(categoryExercises => {
                            categoryExercises.forEach(exercise => {
                                if (!exercise.isDeleted && exercise.series && exercise.series.length > 0) {
                                    const maxWeight = Math.max(...exercise.series.map(s => parseFloat(s.weight)).filter(w => !isNaN(w)));
                                    if (!isNaN(maxWeight) && maxWeight > 0) {
                                        if (!exerciseHistory[exercise.id]) {
                                            exerciseHistory[exercise.id] = {
                                                name: exercise.name,
                                                sessions: []
                                            };
                                        }
                                        exerciseHistory[exercise.id].sessions.push({
                                            date: sessionDate,
                                            weight: maxWeight,
                                            reps: parseInt(exercise.series[0].reps) || 0 
                                        });
                                    }
                                }
                            });
                        });
                    }
                });
            }
        });

        for (const exerciseId in exerciseHistory) {
            const history = exerciseHistory[exerciseId].sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


            let maxWeightOverall = 0;
            let pbDate = null;
            let pbReps = 0;

            history.forEach(session => {
                if (session.weight > maxWeightOverall) {
                    maxWeightOverall = session.weight;
                    pbDate = session.date;
                    pbReps = session.reps;
                } else if (session.weight === maxWeightOverall && pbDate && new Date(session.date) > new Date(pbDate)) {
                    pbDate = session.date;
                    pbReps = session.reps;
                }
            });


            if (pbDate) {
                pbs[exerciseId] = {
                    name: exerciseHistory[exerciseId].name,
                    maxWeight: maxWeightOverall,
                    reps: pbReps,
                    date: pbDate 
                };
            }

            const recentSessions = history.filter(session => new Date(session.date) >= thirtyDaysAgo);
            const olderSessions = history.filter(session => new Date(session.date) >= ninetyDaysAgo && new Date(session.date) < thirtyDaysAgo);


            if (recentSessions.length > 0) {
                const avgRecentWeight = recentSessions.reduce((sum, s) => sum + s.weight, 0) / recentSessions.length;

                if (olderSessions.length > 0) {
                    const avgOlderWeight = olderSessions.reduce((sum, s) => sum + s.weight, 0) / olderSessions.length;

                    if (avgRecentWeight > avgOlderWeight * 1.05) { 
                        insights[exerciseId] = "Excellente progression récente !";
                    } else if (avgRecentWeight > avgOlderWeight * 1.01) { 
                        insights[exerciseId] = "Bonne progression.";
                    } else if (avgRecentWeight < avgOlderWeight * 0.95) { 
                        insights[exerciseId] = "Légère baisse de performance. À surveiller.";
                    } else {
                        insights[exerciseId] = "Progression stable.";
                    }
                } else {
                    insights[exerciseId] = "Début de suivi ou pas assez de données anciennes pour une comparaison.";
                }
            } else {
                insights[exerciseId] = "Pas de données récentes pour évaluer la progression.";
            }
        }
        return { insights, pbs };
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Erreur d'authentification:", error);
                    setToast({ message: `Erreur d'authentification: ${error.message}`, type: 'error' });
                }
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDayActionsDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);


    useEffect(() => {
        if (isAuthReady && userId) {
            setLoading(true);
            const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
            let q;

            if (selectedDateForHistory) {
                const endOfDay = new Date(selectedDateForHistory);
                endOfDay.setHours(23, 59, 59, 999);

                q = query(
                    sessionsRef,
                    where('timestamp', '<=', endOfDay),
                    orderBy('timestamp', 'desc'),
                    limit(1)
                );
            } else {
                q = query(sessionsRef, orderBy('timestamp', 'desc'), limit(1));
            }

            const unsubscribe = onSnapshot(q, async (snapshot) => {
                if (!snapshot.empty) {
                    const fetchedWorkoutData = snapshot.docs[0].data().workoutData;
                    const sanitizedDays = fetchedWorkoutData.days || {};
                    const sanitizedDayOrder = fetchedWorkoutData.dayOrder && Array.isArray(fetchedWorkoutData.dayOrder) && fetchedWorkoutData.dayOrder.length > 0
                        ? fetchedWorkoutData.dayOrder
                        : Object.keys(sanitizedDays).sort();

                    const finalSanitizedDays = {};
                    for (const dayKey in sanitizedDays) {
                        if (sanitizedDays.hasOwnProperty(dayKey)) {
                            const dayData = sanitizedDays[dayKey];
                            const newCategories = {};
                            if (dayData && dayData.categories) {
                                for (const categoryKey in dayData.categories) {
                                    if (dayData.categories.hasOwnProperty(categoryKey)) {
                                        const exercisesInCat = Array.isArray(dayData.categories[categoryKey])
                                            ? dayData.categories[categoryKey]
                                            : [];
                                        newCategories[categoryKey] = exercisesInCat.map(exercise => {
                                            const sanitizedSeries = Array.isArray(exercise.series)
                                                ? exercise.series.map(s => ({
                                                    weight: s.weight !== undefined ? String(s.weight) : '',
                                                    reps: s.reps !== undefined ? String(s.reps) : ''
                                                }))
                                                : [{ weight: '', reps: '' }];
                                            return {
                                                ...exercise,
                                                id: exercise.id || generateUUID(), 
                                                series: sanitizedSeries,
                                                isDeleted: typeof exercise.isDeleted === 'boolean' ? exercise.isDeleted : false,
                                                notes: typeof exercise.notes === 'string' ? exercise.notes : ''
                                            };
                                        });
                                    }
                                }
                            }
                            finalSanitizedDays[dayKey] = {
                                ...dayData,
                                categories: newCategories,
                                categoryOrder: Array.isArray(dayData.categoryOrder)
                                    ? dayData.categoryOrder
                                    : Object.keys(newCategories).sort()
                            };
                        }
                    }
                    setWorkouts({ days: finalSanitizedDays, dayOrder: sanitizedDayOrder });
                     if (!selectedDayFilter && sanitizedDayOrder.length > 0) {
                        setSelectedDayFilter(sanitizedDayOrder[0]);
                    }
                } else if (!selectedDateForHistory) {
                    const initialWorkouts = JSON.parse(JSON.stringify(initialData)); 
                    Object.values(initialWorkouts.days).forEach(day => {
                        Object.values(day.categories).forEach(categoryExercises => {
                            categoryExercises.forEach(ex => {
                                if (!ex.id.includes('-')) { 
                                   ex.id = generateUUID();
                                }
                            });
                        });
                    });
                    setWorkouts(initialWorkouts);
                     if (initialWorkouts.dayOrder.length > 0) {
                        setSelectedDayFilter(initialWorkouts.dayOrder[0]);
                    }
                }
                setLoading(false);
            }, (error) => {
                console.error("Erreur lors de la récupération des données:", error);
                setToast({ message: `Erreur Firestore: ${error.message}`, type: 'error' });
                setLoading(false);
            });
            return () => unsubscribe();
        } else if (!userId && isAuthReady) {
            setLoading(false);
            setToast({ message: "Erreur: Utilisateur non authentifié. Actualisez la page.", type: 'error' });
        }
    }, [isAuthReady, userId, selectedDateForHistory, appId]); 


    useEffect(() => {
        if (!isAuthReady || !userId) {
            setHistoricalDataForGraphs([]);
            setIndividualExerciseGraphData([]);
            return;
        }

        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        let queryStartDate = new Date();
        let queryEndDate = new Date();
        queryEndDate.setHours(23, 59, 59, 999);

        if (graphStartDate && graphEndDate) {
            queryStartDate = normalizeDateToStartOfDay(new Date(graphStartDate));
            queryEndDate = new Date(new Date(graphEndDate).setHours(23, 59, 59, 999));
        } else {
            queryStartDate = new Date(); // Default to today
            queryStartDate.setMonth(queryStartDate.getMonth() - 3); // Go back 3 months
            queryStartDate.setHours(0, 0, 0, 0);
        }


        const displayStartDate = new Date(queryStartDate);
        const displayEndDate = new Date(queryEndDate);
        const allDatesForDisplay = generateDateRange(displayStartDate, displayEndDate);

        const q = query(
            sessionsRef,
            where('timestamp', '>=', queryStartDate),
            where('timestamp', '<=', queryEndDate),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    timestamp: data.timestamp.toDate(), // Convert Firestore Timestamp to JS Date
                    workoutData: data.workoutData
                };
            });
            
            setHistoricalDataForGraphs(fetchedData); // Store all fetched data for insights

            if (showExerciseGraphModal && exerciseForGraph) {
                const latestDailyWeightsIndividual = {};
                fetchedData.forEach(session => {
                    const localDate = session.timestamp;
                    const dateKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    const sessionDays = session.workoutData?.days || {};
                    Object.keys(sessionDays).forEach(dayKey => { // Iterate over dayKey, not day
                        const dayData = sessionDays[dayKey];
                        if (dayData && dayData.categories) {
                            Object.keys(dayData.categories).forEach(categoryKey => { // Iterate over categoryKey
                                (dayData.categories[categoryKey] || []).forEach(exercise => { // Ensure categories[categoryKey] is an array
                                    if (exercise.id === exerciseForGraph.id) {
                                        const exerciseSeries = Array.isArray(exercise.series) ? exercise.series : [];
                                        const maxWeightForDay = Math.max(0, ...exerciseSeries.map(s => parseFloat(s.weight)).filter(w => !isNaN(w)));
                                        if (maxWeightForDay > 0) { // Only consider if there's a valid weight
                                            if (!latestDailyWeightsIndividual[dateKey] || session.timestamp > latestDailyWeightsIndividual[dateKey].timestamp) {
                                                latestDailyWeightsIndividual[dateKey] = {
                                                    timestamp: session.timestamp,
                                                    weight: maxWeightForDay,
                                                    hasNewData: true
                                                };
                                            }
                                        }
                                    }
                                });
                            });
                        }
                    });
                });

                const finalIndividualData = [];
                let lastKnownWeight = null;
                allDatesForDisplay.forEach(date => {
                    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const dataPoint = { date: dateKey, weight: null, hasNewData: false };
                    if (latestDailyWeightsIndividual[dateKey]) {
                        dataPoint.weight = latestDailyWeightsIndividual[dateKey].weight;
                        dataPoint.hasNewData = true;
                        lastKnownWeight = dataPoint.weight;
                    } else if (lastKnownWeight !== null) {
                        dataPoint.weight = lastKnownWeight;
                    }
                    finalIndividualData.push(dataPoint);
                });
                setIndividualExerciseGraphData(finalIndividualData);
                // setProcessedGraphData({}); // Not needed if individual graph is separate
            } else {
                // setHistoricalDataForGraphs(fetchedData); // Already set above
                setIndividualExerciseGraphData([]); // Clear if not showing specific graph
            }
        }, (error) => {
            console.error("Erreur lors de la récupération des données historiques:", error);
            setToast({ message: `Erreur Firestore (historique): ${error.message}`, type: 'error' });
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId, graphTimeRange, showDatePicker, showExerciseGraphModal, exerciseForGraph, graphStartDate, graphEndDate]);


    useEffect(() => {
        const newProcessedGraphData = {};
        if (showDatePicker && selectedDateForHistory && !showExerciseGraphModal && historicalDataForGraphs.length > 0) {
            // This logic is for the global graph view, which seems less used now.
            // The individual exercise graph logic is handled in the previous useEffect.
            // For now, this can be simplified or removed if not directly used for display.
        }
        setProcessedGraphData(newProcessedGraphData); // Potentially an empty object if not in the specific global graph view
    }, [historicalDataForGraphs, showDatePicker, selectedDateForHistory, showExerciseGraphModal]);


    useEffect(() => {
        if (historicalDataForGraphs.length > 0) {
            const { insights, pbs } = calculateInsights(historicalDataForGraphs);
            setProgressionInsights(insights);
            setPersonalBests(pbs);
        } else {
            setProgressionInsights({});
            setPersonalBests({});
        }
    }, [historicalDataForGraphs]);

    const saveWorkouts = async (updatedWorkoutsState, successMessage = "Données sauvegardées avec succès !", errorMessage = "Erreur lors de la sauvegarde des données.") => {
        if (userId && appId) { 
            const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
            try {
                await addDoc(sessionsRef, {
                    timestamp: serverTimestamp(),
                    workoutData: updatedWorkoutsState
                });
                setToast({ message: successMessage, type: 'success' });
            } catch (e) {
                console.error("Erreur lors de la sauvegarde des données:", e);
                setToast({ message: `${errorMessage}: ${e.message}`, type: 'error' });
            }
        } else {
            console.error("UserID ou AppID n'est pas disponible. Impossible de sauvegarder les données.");
            setToast({ message: "Erreur: ID utilisateur ou ID d'application non disponible. Impossible de sauvegarder.", type: 'error' });
        }
    };


    const applyChanges = (newWorkoutsState, successMessage, errorMessage) => {
        setUndoStack(prev => {
            const newStack = [...prev, workouts];
            if (newStack.length > MAX_UNDO_STATES) {
                return newStack.slice(newStack.length - MAX_UNDO_STATES);
            }
            return newStack;
        });
        setRedoStack([]);
        setWorkouts(newWorkoutsState);
        saveWorkouts(newWorkoutsState, successMessage, errorMessage);
    };

    const handleUndo = () => {
        if (undoStack.length > 0) {
            const previousState = undoStack[undoStack.length - 1];
            setUndoStack(prev => prev.slice(0, prev.length - 1));
            setRedoStack(prev => [...prev, workouts]);
            setWorkouts(previousState);
            setToast({ message: "Action annulée avec succès !", type: 'success' });
        } else {
            setToast({ message: "Rien à annuler.", type: 'error' });
        }
    };

    const handleRedo = () => {
        if (redoStack.length > 0) {
            const nextState = redoStack[redoStack.length - 1];
            setRedoStack(prev => prev.slice(0, prev.length - 1));
            setUndoStack(prev => [...prev, workouts]);
            setWorkouts(nextState);
            setToast({ message: "Action rétablie avec succès !", type: 'success' });
        } else {
            setToast({ message: "Rien à rétablir.", type: 'error' });
        }
    };

    const handleEditClick = (day, category, exerciseId, exercise) => {
        setEditingExercise({ day, category, exerciseId });
        if (exercise.series && exercise.series.length > 0) {
            setNewWeight(exercise.series[0].weight);
            setNewSets(exercise.series.length.toString());
            setNewReps(exercise.series[0].reps);
        } else {
            setNewWeight('');
            setNewSets('1'); // Default to 1 set if none exist
            setNewReps('');
        }
    };

    const handleSaveEdit = () => {
        if (!editingExercise) return;

        const { day, category, exerciseId } = editingExercise;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exerciseId);

        if (exerciseIndex !== -1) {
            const weightNum = parseFloat(newWeight);
            const setsNum = parseInt(newSets);
            const repsNum = parseInt(newReps);

            if (newWeight !== '' && isNaN(weightNum)) {
                setToast({ message: "Le poids doit être un nombre.", type: 'error' });
                return;
            }
            if (newSets !== '' && (isNaN(setsNum) || setsNum <=0)) { 
                setToast({ message: "Les séries doivent être un nombre entier positif.", type: 'error' });
                return;
            }
            if (newReps !== '' && (isNaN(repsNum) || repsNum < 0)) { 
                setToast({ message: "Les répétitions doivent être un nombre entier positif ou nul.", type: 'error' });
                return;
            }

            const newSeriesArray = [];
            for (let i = 0; i < (setsNum || 1) ; i++) { // Default to 1 set if setsNum is invalid
                newSeriesArray.push({ weight: newWeight, reps: newReps });
            }
            updatedWorkouts.days[day].categories[category][exerciseIndex] = {
                ...updatedWorkouts.days[day].categories[category][exerciseIndex],
                series: newSeriesArray,
            };

            applyChanges(updatedWorkouts, "Exercice modifié avec succès !");
            setEditingExercise(null);
        } else {
            setToast({ message: "Erreur: Exercice non trouvé pour la modification.", type: 'error' });
        }
    };

    const handleAddExerciseClick = (day, category) => {
        setSelectedDayForAdd(day);
        setSelectedCategoryForAdd(category);
        setNewExerciseName('');
        setNewWeight('');
        setNewSets('3'); // Default to 3 sets
        setNewReps('');
        setShowAddExerciseModal(true);
    };

    const handleAddNewExercise = (name = newExerciseName, weight = newWeight, sets = newSets, reps = newReps) => {
        if (!selectedDayForAdd || selectedDayForAdd.trim() === '' || !selectedCategoryForAdd || selectedCategoryForAdd.trim() === '') {
            setToast({ message: "Veuillez sélectionner un jour et une catégorie valides.", type: 'error' });
            return;
        }
        if (!name.trim()) {
            setToast({ message: "Le nom de l'exercice est obligatoire.", type: 'error' });
            return;
        }

        const weightNum = parseFloat(weight);
        const setsNum = parseInt(sets);
        const repsNum = parseInt(reps);

        if (weight !== '' && isNaN(weightNum)) {
            setToast({ message: "Le poids doit être un nombre.", type: 'error' });
            return;
        }
        if (sets !== '' && (isNaN(setsNum) || setsNum <=0)) {
            setToast({ message: "Les séries doivent être un nombre entier positif.", type: 'error' });
            return;
        }
        if (reps !== '' && (isNaN(repsNum) || repsNum < 0)) {
            setToast({ message: "Les répétitions doivent être un nombre entier positif ou nul.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        if (!updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd]) {
            updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd] = [];
        }

        const seriesToStore = [];
        for (let i = 0; i < (setsNum || 1); i++) { // Default to 1 set
            seriesToStore.push({ weight: String(weight), reps: String(reps) });
        }

        updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd].push({
            id: generateUUID(),
            name: name.trim(),
            series: seriesToStore,
            isDeleted: false,
            notes: '',
        });
        applyChanges(updatedWorkouts, "Exercice ajouté avec succès !");
        setShowAddExerciseModal(false);
    };


    const handleDeleteExercise = (day, category, exerciseId) => {
        setExerciseToDelete({ day, category, exerciseId });
        setShowDeleteConfirm(true);
    };

    const confirmDeleteExercise = () => {
        if (!exerciseToDelete) return;

        const { day, category, exerciseId } = exerciseToDelete;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));

        if (updatedWorkouts.days[day] && updatedWorkouts.days[day].categories && updatedWorkouts.days[day].categories[category]) {
            const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(
                (ex) => ex.id === exerciseId
            );

            if (exerciseIndex !== -1) {
                updatedWorkouts.days[day].categories[category][exerciseIndex].isDeleted = true;
                applyChanges(updatedWorkouts, "Exercice supprimé avec succès !");
            } else {
                setToast({ message: "Erreur: Exercice non trouvé pour la suppression.", type: 'error' });
            }
        } else {
            setToast({ message: "Erreur: Catégorie ou jour non trouvé pour la suppression.", type: 'error' });
        }

        setShowDeleteConfirm(false);
        setExerciseToDelete(null);
    };

    const handleReactivateExercise = (day, category, exerciseId) => {
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        if (updatedWorkouts.days[day] && updatedWorkouts.days[day].categories && updatedWorkouts.days[day].categories[category]) {
            const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(
                (ex) => ex.id === exerciseId
            );

            if (exerciseIndex !== -1) {
                updatedWorkouts.days[day].categories[category][exerciseIndex].isDeleted = false;
                applyChanges(updatedWorkouts, "Exercice réactivé avec succès !");
            } else {
                setToast({ message: "Erreur: Exercice non trouvé pour la réactivation.", type: 'error' });
            }
        } else {
            setToast({ message: "Erreur: Catégorie ou jour non trouvé pour la réactivation.", type: 'error' });
        }
    };

    const handleAddDay = () => {
        if (!newDayNameInput.trim()) {
            setToast({ message: "Le nom du jour ne peut pas être vide.", type: 'error' });
            return;
        }
        if (workouts.days[newDayNameInput.trim()]) {
            setToast({ message: "Ce jour existe déjà.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        updatedWorkouts.days[newDayNameInput.trim()] = {
            categories: {},
            categoryOrder: []
        };
        updatedWorkouts.dayOrder.push(newDayNameInput.trim());
        applyChanges(updatedWorkouts, `Jour "${newDayNameInput.trim()}" ajouté avec succès !`);
        setShowAddDayModal(false);
        setNewDayNameInput('');
    };

    const handleEditDay = (oldDayName) => {
        setEditingDayName(oldDayName);
        setEditedDayNewNameInput(oldDayName);
        setShowSelectDayForEditModal(false);
        setShowEditDayModal(true);
    };

    const confirmEditDay = () => {
        if (!editedDayNewNameInput.trim()) {
            setToast({ message: "Le nouveau nom du jour ne peut pas être vide.", type: 'error' });
            return;
        }
        if (editedDayNewNameInput.trim() === editingDayName) {
            setShowEditDayModal(false);
            setEditingDayName(null);
            return;
        }
        if (workouts.days[editedDayNewNameInput.trim()]) {
            setToast({ message: "Un jour avec ce nom existe déjà.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const oldDayData = updatedWorkouts.days[editingDayName];
        delete updatedWorkouts.days[editingDayName];
        updatedWorkouts.days[editedDayNewNameInput.trim()] = oldDayData;

        updatedWorkouts.dayOrder = updatedWorkouts.dayOrder.map(dayName =>
            dayName === editingDayName ? editedDayNewNameInput.trim() : dayName
        );

        if (selectedDayFilter === editingDayName) {
            setSelectedDayFilter(updatedWorkouts.dayOrder.length > 0 ? editedDayNewNameInput.trim() : null);
        }
        if (selectedHistoryDayFilter === editingDayName) {
            setSelectedHistoryDayFilter(updatedWorkouts.dayOrder.length > 0 ? editedDayNewNameInput.trim() : null);
        }


        applyChanges(updatedWorkouts, `Jour "${editingDayName}" renommé en "${editedDayNewNameInput.trim()}" avec succès !`);
        setShowEditDayModal(false);
        setEditingDayName(null);
        setEditedDayNewNameInput('');
    };

    const handleDeleteDay = (dayName) => {
        setDayToDeleteName(dayName);
        setShowSelectDayForDeleteModal(false);
        setShowDeleteDayConfirm(true);
    };

    const confirmDeleteDay = () => {
        if (!dayToDeleteName) return;

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        delete updatedWorkouts.days[dayToDeleteName];
        updatedWorkouts.dayOrder = updatedWorkouts.dayOrder.filter(day => day !== dayToDeleteName);

        if (selectedDayFilter === dayToDeleteName) {
            setSelectedDayFilter(updatedWorkouts.dayOrder.length > 0 ? updatedWorkouts.dayOrder[0] : null);
        }
        if (selectedHistoryDayFilter === dayToDeleteName) {
            setSelectedHistoryDayFilter(updatedWorkouts.dayOrder.length > 0 ? updatedWorkouts.dayOrder[0] : null);
        }

        applyChanges(updatedWorkouts, `Jour "${dayToDeleteName}" supprimé avec succès !`);
        setShowDeleteDayConfirm(false);
        setDayToDeleteName(null);
    };

    const handleAddCategory = () => {
        if (!selectedDayForCategoryAdd || selectedDayForCategoryAdd.trim() === '') {
            setToast({ message: "Veuillez sélectionner un jour valide pour ajouter un groupe musculaire.", type: 'error' });
            return;
        }
        if (!newCategoryNameInput.trim()) {
            setToast({ message: "Le nom du groupe musculaire est obligatoire.", type: 'error' });
            return;
        }
        const existingCategories = Object.keys(workouts.days[selectedDayForCategoryAdd]?.categories || {});
        if (existingCategories.some(cat => cat.toUpperCase() === newCategoryNameInput.trim().toUpperCase())) {
            setToast({ message: "Ce groupe musculaire existe déjà pour ce jour.", type: 'error' });
            return;
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        if (!updatedWorkouts.days[selectedDayForCategoryAdd]) {
            updatedWorkouts.days[selectedDayForCategoryAdd] = { categories: {}, categoryOrder: [] };
        }
        const newCategoryKey = newCategoryNameInput.trim().toUpperCase(); 
        updatedWorkouts.days[selectedDayForCategoryAdd].categories[newCategoryKey] = [];
        updatedWorkouts.days[selectedDayForCategoryAdd].categoryOrder.push(newCategoryKey);
        
        applyChanges(updatedWorkouts, `Groupe musculaire "${newCategoryNameInput.trim()}" ajouté avec succès !`);
        setShowAddCategoryModal(false);
        setNewCategoryNameInput('');
    };

    const openAddCategoryModalForDay = (day) => {
        if (!day) {
            setToast({ message: "Veuillez créer un jour d'entraînement avant d'ajouter des groupes musculaires.", type: 'error' });
            return;
        }
        setSelectedDayForCategoryAdd(day);
        setNewCategoryNameInput('');
        setShowAddCategoryModal(true);
    };


    const handleEditCategory = (day, oldCategoryName) => {
        setEditingCategory({ day, oldCategoryName });
        setNewCategoryName(oldCategoryName); 
        setShowEditCategoryModal(true);
    };

    const confirmEditCategory = () => {
        if (!editingCategory || !newCategoryName.trim()) {
            setToast({ message: "Le nouveau nom du groupe musculaire ne peut pas être vide.", type: 'error' });
            return;
        }
        const newCatUpper = newCategoryName.trim().toUpperCase();
        const oldCatUpper = editingCategory.oldCategoryName.toUpperCase();

        if (newCatUpper === oldCatUpper) {
            setShowEditCategoryModal(false);
            setEditingCategory(null);
            return;
        }
        if (workouts.days[editingCategory.day]?.categories[newCatUpper]) {
            setToast({ message: "Un groupe musculaire avec ce nom existe déjà pour ce jour.", type: 'error' });
            return;
        }

        const { day, oldCategoryName } = editingCategory;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const categories = updatedWorkouts.days[day].categories;
        const categoryOrder = updatedWorkouts.days[day].categoryOrder;

        categories[newCatUpper] = categories[oldCategoryName]; 
        delete categories[oldCategoryName];

        const oldIndex = categoryOrder.indexOf(oldCategoryName); 
        if (oldIndex !== -1) {
            categoryOrder[oldIndex] = newCatUpper;
        }

        applyChanges(updatedWorkouts, `Groupe musculaire "${oldCategoryName}" renommé en "${newCategoryName.trim()}" avec succès !`);
        setShowEditCategoryModal(false);
        setEditingCategory(null);
        setNewCategoryName('');
    };

    const handleDeleteCategory = (day, categoryName) => {
        setCategoryToDelete({ day, categoryName });
        setShowDeleteCategoryConfirm(true);
    };

    const confirmDeleteCategory = () => {
        if (!categoryToDelete) return;

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));

        if (updatedWorkouts.days[categoryToDelete.day] && updatedWorkouts.days[categoryToDelete.day].categories) {
            const exercisesInCat = updatedWorkouts.days[categoryToDelete.day].categories[categoryToDelete.categoryName];
            if (Array.isArray(exercisesInCat)) {
                exercisesInCat.forEach(ex => ex.isDeleted = true); // Mark all exercises in category as deleted
            }
            // Remove the category from the display order, but keep its data for history
            updatedWorkouts.days[categoryToDelete.day].categoryOrder = updatedWorkouts.days[categoryToDelete.day].categoryOrder.filter(cat => cat !== categoryToDelete.categoryName);
            
            applyChanges(updatedWorkouts, `Groupe musculaire "${categoryToDelete.categoryName}" et ses exercices marqués comme supprimés avec succès !`);
        } else {
            setToast({ message: "Erreur: Groupe musculaire ou jour non trouvé pour la suppression.", type: 'error' });
        }

        setShowDeleteCategoryConfirm(false);
        setCategoryToDelete(null);
    };

    const openExerciseGraphModal = (exercise) => {
        setExerciseForGraph(exercise);
        setShowExerciseGraphModal(true);
        setGraphStartDate('');
        setGraphEndDate('');
        // setGraphTimeRange('90days'); // Default range handled by useEffect for historicalData
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        if (dateString instanceof Date) {
            return dateString.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts;
            const date = new Date(year, month - 1, day);
            return date.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
        return dateString; 
    };

    const toggleHistoryView = () => {
        setShowDatePicker(prev => {
            const newShowDatePicker = !prev;
            if (newShowDatePicker) {
                const today = normalizeDateToStartOfDay(new Date());
                setSelectedDateForHistory(today);
                if (workouts.dayOrder.length > 0) {
                    setSelectedHistoryDayFilter(workouts.dayOrder[0]);
                } else {
                    setSelectedHistoryDayFilter(null);
                }
                setIsEditMode(false);
            } else {
                setSelectedDateForHistory(null);
                setSelectedHistoryDayFilter(null);
            }
            return newShowDatePicker;
        });
    };

    const handleDateChange = (e) => {
        const newSelectedDate = normalizeDateToStartOfDay(new Date(e.target.value));
        const today = normalizeDateToStartOfDay(new Date());

        if (newSelectedDate > today) {
            setToast({ message: "Impossible de sélectionner une date future pour l'historique.", type: 'error' });
            setSelectedDateForHistory(today);
        } else {
            setSelectedDateForHistory(newSelectedDate);
        }
    };

    const navigateHistory = (direction) => {
        if (!selectedDateForHistory) return;
        const newDate = normalizeDateToStartOfDay(new Date(selectedDateForHistory));
        newDate.setDate(newDate.getDate() + direction);

        const today = normalizeDateToStartOfDay(new Date());

        if (newDate > today) {
            setToast({ message: "Impossible de naviguer vers une date future.", type: 'error' });
            // setSelectedDateForHistory(today); // Option: revert to today
        } else {
            setSelectedDateForHistory(newDate);
        }
    };

    const getAllUniqueDays = () => {
        return [...(workouts.dayOrder || [])]; 
    };

    useEffect(() => {
        if ((workouts.dayOrder || []).length > 0) {
            if (!selectedDayFilter || !(workouts.dayOrder || []).includes(selectedDayFilter)) {
                setSelectedDayFilter((workouts.dayOrder || [])[0]);
            }
        } else {
            setSelectedDayFilter(null);
        }
    }, [workouts.dayOrder, selectedDayFilter]);

    useEffect(() => {
        const currentDayOrder = workouts.dayOrder || [];
        if (showDatePicker && currentDayOrder.length > 0) {
            if (!selectedHistoryDayFilter || !currentDayOrder.includes(selectedHistoryDayFilter)) {
                setSelectedHistoryDayFilter(currentDayOrder[0]);
            }
        } else if (showDatePicker && currentDayOrder.length === 0) {
            setSelectedHistoryDayFilter(null);
        }
    }, [selectedDateForHistory, workouts.dayOrder, showDatePicker, selectedHistoryDayFilter]); 


    const handleReorderDays = (dayName, direction) => {
        const currentOrder = [...reorderingDayOrder];
        const index = currentOrder.indexOf(dayName);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < currentOrder.length) {
            const [removed] = currentOrder.splice(index, 1);
            currentOrder.splice(newIndex, 0, removed);
            setReorderingDayOrder(currentOrder);
        }
    };

    const saveReorderedDays = () => {
        const updatedWorkouts = { ...workouts, dayOrder: reorderingDayOrder };
        applyChanges(updatedWorkouts, "Ordre des jours sauvegardé avec succès !");
        setShowReorderDaysModal(false);
    };

    const getSeriesDisplay = (exercise) => {
        const firstSeries = exercise.series && exercise.series.length > 0 ? exercise.series[0] : { weight: '', reps: '' };
        const setsCount = exercise.series ? exercise.series.length : 0;

        const weight = parseFloat(firstSeries.weight);
        const reps = parseInt(firstSeries.reps);
        const rmResult = calculate1RM(weight, reps);

        return (
            <span>
                Poids: <strong className="font-extrabold text-xl">{firstSeries.weight || '-'}</strong> kg | Séries: <strong className="font-extrabold text-xl">{setsCount || '-'}</strong> | Reps: <strong className="font-extrabold text-xl">{firstSeries.reps || '-'}</strong>
                {isAdvancedMode && (!isNaN(weight) && !isNaN(reps) && rmResult.average !== 'N/A') && (
                    <span className="text-sm text-blue-300 ml-1">(1RM: {rmResult.average} kg)</span>
                )}
            </span>
        );
    };

    const handleReorderCategories = (dayName, categoryName, direction) => {
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const categoryOrder = updatedWorkouts.days[dayName].categoryOrder;
        const index = categoryOrder.indexOf(categoryName);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < categoryOrder.length) {
            const [removed] = categoryOrder.splice(index, 1);
            categoryOrder.splice(newIndex, 0, removed);
            updatedWorkouts.days[dayName].categoryOrder = categoryOrder; 
            applyChanges(updatedWorkouts, "Ordre des groupes musculaires mis à jour !");
        }
    };

    const handleReorderExercises = (dayName, categoryName, exerciseId, direction) => {
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exercises = updatedWorkouts.days[dayName].categories[categoryName];
        const index = exercises.findIndex(ex => ex.id === exerciseId);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < exercises.length) {
            const [removed] = exercises.splice(index, 1);
            exercises.splice(newIndex, 0, removed);
            updatedWorkouts.days[dayName].categories[categoryName] = exercises;
            applyChanges(updatedWorkouts, "Ordre des exercices mis à jour !");
        }
    };

    const handleOpenNotesModal = (day, category, exerciseId, currentNotes) => {
        setExerciseForNotes({ day, category, exerciseId });
        setCurrentNoteContent(currentNotes || '');
        setShowNotesModal(true);
    };

    const handleSaveNote = () => {
        if (!exerciseForNotes) return;

        const { day, category, exerciseId } = exerciseForNotes;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exerciseId);

        if (exerciseIndex !== -1) {
            updatedWorkouts.days[day].categories[category][exerciseIndex].notes = currentNoteContent;
            applyChanges(updatedWorkouts, "Note sauvegardée avec succès !");
            setShowNotesModal(false);
            setExerciseForNotes(null);
            setCurrentNoteContent('');
        } else {
            setToast({ message: "Erreur: Exercice non trouvé pour la sauvegarde de la note.", type: 'error' });
        }
    };

    const handleDeleteNote = () => {
        if (!exerciseForNotes) return;

        const { day, category, exerciseId } = exerciseForNotes;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exerciseId);

        if (exerciseIndex !== -1) {
            updatedWorkouts.days[day].categories[category][exerciseIndex].notes = ''; 
            applyChanges(updatedWorkouts, "Note supprimée avec succès !");
            setShowNotesModal(false);
            setExerciseForNotes(null);
            setCurrentNoteContent('');
        } else {
            setToast({ message: "Erreur: Exercice non trouvé pour la suppression de la note.", type: 'error' });
        }
    };

    // --- Gemini API Functions (Suggestion related functions removed) ---
    const handleAnalyzeProgressionClick = async (exercise) => {
        setExerciseForAnalysis(exercise);
        setProgressionAnalysisContent('');
        setShowProgressionAnalysisModal(true);
        setProgressionAnalysisLoading(true);

        // Ensure graph data for this specific exercise is loaded/available
        // The openExerciseGraphModal function already triggers data loading for individualExerciseGraphData
        // We need to make sure it's populated before calling Gemini.
        // A simple way is to call openExerciseGraphModal logic or ensure data is fresh.
        // However, a more robust solution might involve explicitly fetching/checking data here.

        // Re-fetch or ensure data is present for the specific exercise graph
        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        let queryStartDate = new Date();
        queryStartDate.setMonth(queryStartDate.getMonth() - 6); // Analyze last 6 months for example
        queryStartDate.setHours(0,0,0,0);
        let queryEndDate = new Date();
        queryEndDate.setHours(23,59,59,999);

        const allDatesForDisplay = generateDateRange(queryStartDate, queryEndDate);

        const q = query(
            sessionsRef,
            where('timestamp', '>=', queryStartDate),
            where('timestamp', '<=', queryEndDate),
            orderBy('timestamp', 'asc')
        );
        
        try {
            const snapshot = await getDocs(q); // Use getDocs for a one-time fetch for analysis
            const fetchedData = snapshot.docs.map(doc => ({
                timestamp: doc.data().timestamp.toDate(),
                workoutData: doc.data().workoutData
            }));

            const latestDailyWeightsIndividual = {};
            fetchedData.forEach(session => {
                const localDate = session.timestamp;
                const dateKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                const sessionDays = session.workoutData?.days || {};
                Object.keys(sessionDays).forEach(dayKey => {
                    const dayData = sessionDays[dayKey];
                    if (dayData && dayData.categories) {
                        Object.keys(dayData.categories).forEach(categoryKey => {
                            (dayData.categories[categoryKey] || []).forEach(exItem => {
                                if (exItem.id === exercise.id) {
                                    const exerciseSeries = Array.isArray(exItem.series) ? exItem.series : [];
                                    const maxWeightForDay = Math.max(0, ...exerciseSeries.map(s => parseFloat(s.weight)).filter(w => !isNaN(w)));
                                    if (maxWeightForDay > 0) {
                                        if (!latestDailyWeightsIndividual[dateKey] || session.timestamp > latestDailyWeightsIndividual[dateKey].timestamp) {
                                            latestDailyWeightsIndividual[dateKey] = {
                                                timestamp: session.timestamp,
                                                weight: maxWeightForDay,
                                            };
                                        }
                                    }
                                }
                            });
                        });
                    }
                });
            });
            
            const analysisDataPoints = [];
            allDatesForDisplay.forEach(date => {
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                if (latestDailyWeightsIndividual[dateKey]) {
                    analysisDataPoints.push({ date: dateKey, weight: latestDailyWeightsIndividual[dateKey].weight });
                }
            });


            if (analysisDataPoints.length < 3) { // Need at least a few data points for meaningful analysis
                setProgressionAnalysisContent("Pas assez de données de progression pour cet exercice sur la période sélectionnée pour une analyse significative.");
                setProgressionAnalysisLoading(false);
                return;
            }

            const formattedDataString = analysisDataPoints.map(dp => `${dp.date}: ${dp.weight}kg`).join('; ');
            const prompt = `Analyse ma progression pour l'exercice '${exercise.name}'. Voici mes données de performance (date: poids soulevé en kg) sur les 6 derniers mois : ${formattedDataString}. Points à considérer : tendance générale, plateaux éventuels, régularité. Fournis une brève analyse (2-4 phrases) et 2-3 conseils actionnables et concis pour améliorer ma force ou ma technique sur cet exercice. Sois encourageant et direct.`;
            
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const geminiApiKey = ""; 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erreur de l'API Gemini: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setProgressionAnalysisContent(text);
            } else {
                setProgressionAnalysisContent("Désolé, je n'ai pas pu obtenir d'analyse pour le moment.");
                setToast({ message: "Format de réponse de l'API pour l'analyse inattendu.", type: 'error' });
            }

        } catch (error) {
            console.error("Erreur lors de l'analyse de progression:", error);
            setProgressionAnalysisContent("Une erreur est survenue lors de l'analyse. Veuillez réessayer.");
            setToast({ message: `Erreur d'analyse: ${error.message}`, type: 'error' });
        } finally {
            setProgressionAnalysisLoading(false);
        }
    };

    // --- End Gemini API Functions ---


    if (loading || !isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-xl">Chargement des données...</p>
            </div>
        );
    }

    const orderedDays = workouts.dayOrder || []; 

    const daysToDisplay = showDatePicker
    ? (selectedHistoryDayFilter && Object.keys(workouts.days).includes(selectedHistoryDayFilter) ? [selectedHistoryDayFilter] : Object.keys(workouts.days)) // In history mode, show selected day or all days if no specific day is selected
    : (selectedDayFilter && orderedDays.includes(selectedDayFilter) ? [selectedDayFilter] : []);



    return (
        <div className={`min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white font-inter p-4 sm:p-6 lg:p-8`}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <h1 className={`text-2xl sm:text-4xl font-extrabold text-blue-400 tracking-tight text-center sm:text-left flex items-center`}>
                        Mon Suivi Muscu
                    </h1>
                    <label htmlFor="advanced-mode-toggle" className="flex items-center cursor-pointer relative">
                        <input
                            type="checkbox"
                            id="advanced-mode-toggle"
                            className="sr-only"
                            checked={isAdvancedMode}
                            onChange={toggleAdvancedMode}
                        />
                        <div className="block bg-gray-600 w-14 h-8 rounded-full transition-all duration-300"></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all duration-300 ${isAdvancedMode ? 'translate-x-6 bg-blue-500' : ''}`}></div>
                        <span className={`ml-3 text-sm text-gray-300`}>Mode Avancé</span>
                    </label>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap justify-center sm:justify-end gap-2">
                    <button
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        className="px-3 py-2 sm:px-4 sm:py-2 rounded-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        className="px-3 py-2 sm:px-4 sm:py-2 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                        Rétablir
                    </button>
                    <button
                        onClick={() => setIsEditMode(prev => !prev)}
                        disabled={showDatePicker}
                        className={`px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold shadow-lg transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 text-sm sm:text-base
                            ${isEditMode ? 'bg-gradient-to-r from-red-600 to-pink-700 hover:from-red-700 hover:to-pink-800' : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'}
                            text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isEditMode ? 'Quitter édition' : 'Mode Édition'}
                    </button>
                    <button
                        onClick={toggleHistoryView}
                        className="px-4 py-2 sm:px-6 sm:py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-bold shadow-lg hover:from-purple-700 hover:to-indigo-800 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 text-sm sm:text-base"
                    >
                        {showDatePicker ? 'Retour aux exercices' : 'Voir l\'historique'}
                    </button>
                </div>
            </header>

            {isEditMode && !showDatePicker && (
                <div className="flex flex-col sm:flex-row gap-6 mb-6">
                    <div className="relative inline-block text-left" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDayActionsDropdown(!showDayActionsDropdown)}
                            className="inline-flex justify-center w-full rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                            id="menu-button"
                            aria-expanded="true"
                            aria-haspopup="true"
                        >
                            Actions sur les jours
                            <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        {showDayActionsDropdown && (
                            <div
                                className="origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                                role="menu"
                                aria-orientation="vertical"
                                aria-labelledby="menu-button"
                                tabIndex="-1"
                            >
                                <div className="py-1" role="none">
                                    <button onClick={() => { setShowAddDayModal(true); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1" > Ajouter un jour </button>
                                    <button onClick={() => { setShowSelectDayForEditModal(true); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1"> Renommer un jour</button>
                                    <button onClick={() => { setShowSelectDayForDeleteModal(true); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1">Supprimer un jour</button>
                                    <button onClick={() => { setShowReorderDaysModal(true); setReorderingDayOrder([...(workouts.dayOrder || [])]); setShowDayActionsDropdown(false); }} className="text-gray-200 block px-4 py-2 text-sm hover:bg-gray-600 w-full text-left" role="menuitem" tabIndex="-1">Réorganiser les jours</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!showDatePicker && (
                <div className="flex flex-wrap gap-3 mb-8 justify-start">
                    {orderedDays.map((day, index) => (
                        <button
                            key={day}
                            onClick={() => setSelectedDayFilter(day)}
                            className={`px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold shadow-md transition transform hover:scale-105 text-sm sm:text-base
                            ${selectedDayFilter === day
                                    ? `bg-gradient-to-r ${dayButtonColors[index % dayButtonColors.length]} text-white`
                                    : `bg-gray-700 border-2 ${dayBorderAndTextColors[index % dayBorderAndTextColors.length]}`
                                }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
            )}

            {showDatePicker && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                    <div className="flex items-center space-x-2">
                        <button onClick={() => navigateHistory(-1)} className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition transform hover:scale-105 text-sm sm:text-base"> {'< Précédent'} </button>
                        <input type="date" value={selectedDateForHistory ? selectedDateForHistory.toISOString().split('T')[0] : ''} onChange={handleDateChange} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} />
                        <button onClick={() => navigateHistory(1)} className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition transform hover:scale-105 text-sm sm:text-base"> {'Suivant >'} </button>
                    </div>
                    <select value={selectedHistoryDayFilter || ''} onChange={(e) => setSelectedHistoryDayFilter(e.target.value || null)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} >
                        {/* Removed "Tous les jours" option */}
                        {getAllUniqueDays().map(day => ( <option key={day} value={day}>{day}</option> ))}
                    </select>
                    <label className={`flex items-center space-x-2 text-gray-300 text-sm sm:text-base`}>
                        <input type="checkbox" checked={showDeletedExercisesInHistory} onChange={(e) => setShowDeletedExercisesInHistory(e.target.checked)} className="form-checkbox h-4 w-4 sm:h-5 sm:w-5 text-blue-600 rounded" />
                        <span>Afficher exos supprimés</span>
                    </label>
                </div>
            )}

            {!showDatePicker && (
                <div className="flex flex-col lg:flex-row gap-8 mb-8 max-w-6xl mx-auto">
                    <div className={`bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-700 w-full`}>
                        <h2 className={`text-2xl sm:text-3xl font-bold text-red-400 mb-4 text-center`}>Minuteur de repos</h2>
                        <div className="flex items-center justify-center space-x-4 mb-4">
                            <input type="number" value={restTimeInput}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value >= 0) {setRestTimeInput(value); setTimerSeconds(value);}
                                    else if (e.target.value === '') {setRestTimeInput('');}
                                }}
                                onBlur={() => { if (restTimeInput === '') {setRestTimeInput(DEFAULT_REST_TIME); setTimerSeconds(DEFAULT_REST_TIME);}}}
                                className={`w-20 sm:w-24 p-2 rounded-md bg-gray-700 text-white border border-gray-600 text-center text-base sm:text-lg focus:ring-2 focus:ring-blue-500`}
                                min="0" max="3600" aria-label="Temps de repos en secondes" />
                            <span className={`text-lg sm:text-xl text-gray-300`}>secondes</span>
                        </div>
                        <p className={`text-5xl sm:text-6xl font-extrabold text-blue-400 mb-6 text-center transition-colors duration-500`}> {formatTime(timerSeconds)} </p>
                        <div className="flex justify-center space-x-4">
                            <button onClick={timerIsRunning ? pauseTimer : () => startTimer()}
                                className={`px-6 py-3 sm:px-8 sm:py-4 rounded-full font-bold shadow-lg transition transform hover:scale-105 text-lg sm:text-xl ${timerIsRunning ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} text-white`} >
                                {timerIsRunning ? 'Pause' : 'Démarrer'}
                            </button>
                            <button onClick={() => resetTimer(restTimeInput || DEFAULT_REST_TIME)} className="px-6 py-3 sm:px-8 sm:py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg transition transform hover:scale-105 text-lg sm:text-xl" >
                                Réinitialiser
                            </button>
                        </div>
                        {timerIsFinished && ( <p className="text-yellow-400 text-xl sm:text-2xl font-bold mt-4 animate-bounce text-center"> Temps de repos terminé ! </p> )}
                    </div>
                </div>
            )}


            <div className="grid grid-cols-1 gap-8 max-w-6xl mx-auto">
                {daysToDisplay.map((day) => {
                    const currentDayData = workouts.days?.[day];
                    if (!currentDayData) {
                        return <div key={day} className="text-center text-gray-500">Journée "{day}" non trouvée ou vide.</div>;
                    }

                    // Determine which set of categories to iterate over
                    const categoriesToIterate = showDatePicker
                        ? Object.keys(currentDayData.categories || {}) // In history mode, iterate over all existing categories
                        : (currentDayData.categoryOrder || []); // Only ordered categories in main view

                    return (
                        <div key={day} className={`bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 border border-gray-700`}>
                            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                                <h2 className={`text-2xl sm:text-3xl font-bold text-blue-400`}>{day}</h2>
                                {isEditMode && !showDatePicker && (
                                    <button onClick={() => openAddCategoryModalForDay(day)} className="px-3 py-1 sm:px-4 sm:py-2 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs sm:text-sm" title="Ajouter un groupe musculaire" >
                                        Ajouter groupe musculaire
                                    </button>
                                )}
                            </div>

                            {categoriesToIterate.map((category) => {
                                const exercises = currentDayData.categories?.[category] || [];

                                // Filter exercises for display within the category
                                let exercisesToRender;
                                if (!showDatePicker) {
                                    exercisesToRender = exercises.filter(ex => !ex.isDeleted);
                                } else {
                                    exercisesToRender = showDeletedExercisesInHistory ? exercises : exercises.filter(ex => !ex.isDeleted);
                                }

                                // If in history mode, and after filtering, there are no exercises to render,
                                // then don't display this category. This covers cases where a category
                                // might exist in `currentDayData.categories` but has no exercises at all,
                                // or only non-deleted ones when `showDeletedExercisesInHistory` is false.
                                if (showDatePicker && exercisesToRender.length === 0) {
                                    return null;
                                }

                                // If in main mode, and not in edit mode, and no non-deleted exercises, hide category
                                if (!showDatePicker && !isEditMode && exercises.every(ex => ex.isDeleted)) {
                                    return null;
                                }

                                // For reordering buttons, we need the actual index in the categoryOrder
                                const categoryIndexInOrder = currentDayData.categoryOrder.indexOf(category);

                                return (
                                    <div key={category} className={`mb-8 bg-gray-700 rounded-lg p-3 sm:p-5 shadow-inner border border-gray-700`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className={`text-xl sm:text-2xl font-semibold text-green-300`}>{category}</h3>
                                            {isEditMode && !showDatePicker && (
                                                <div className="flex space-x-1 sm:space-x-2 flex-wrap gap-1"> 
                                                    <button onClick={() => handleAddExerciseClick(day, category)} className="px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs" title="Ajouter un exercice">Ajouter exo</button>
                                                    {/* Removed Suggest Exercise Button */}
                                                    <button onClick={() => handleEditCategory(day, category)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Renommer groupe musculaire"> <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-7.793 7.793A1 1 0 017.07 14H5a1 1 0 01-1-1v-2.07l7.793-7.793zM11.379 5.793L13.586 8l-1.5 1.5-2.207-2.207 1.5-1.5z" /></svg></button>
                                                    <button onClick={() => handleDeleteCategory(day, category)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer groupe musculaire"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={() => handleReorderCategories(day, category, -1)} disabled={categoryIndexInOrder === 0 || categoryIndexInOrder === -1} className="p-1 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer le groupe musculaire vers le haut"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={() => handleReorderCategories(day, category, 1)} disabled={categoryIndexInOrder === currentDayData.categoryOrder.length - 1 || categoryIndexInOrder === -1} className="p-1 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer le groupe musculaire vers le bas"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                                </div>
                                            )}
                                        </div>
                                        <ul className="space-y-4">
                                            {exercisesToRender.map((exercise, exerciseIndex) => (
                                                <li key={exercise.id} className={`bg-gray-800 p-3 sm:p-4 rounded-md shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-200 ${exercise.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                                    <div className="flex-grow mb-2 sm:mb-0">
                                                        <p className={`text-base sm:text-lg font-medium text-white`}>{exercise.name}</p>
                                                        <p className={`text-sm sm:text-base text-gray-300`}>{getSeriesDisplay(exercise)}</p>
                                                        {isAdvancedMode && personalBests[exercise.id] && ( <p className="text-xs sm:text-sm text-yellow-300 mt-1"> Meilleure Perf: {personalBests[exercise.id].maxWeight}kg ({personalBests[exercise.id].reps} reps) le {formatDate(personalBests[exercise.id].date)}</p>)}
                                                        {isAdvancedMode && progressionInsights[exercise.id] && ( <p className="text-xs sm:text-sm text-cyan-300 mt-1"> Insight: {progressionInsights[exercise.id]} </p>)}
                                                        {exercise.notes && ( <p className={`text-xs sm:text-sm text-gray-300 mt-2 italic`}> Notes: "{exercise.notes}"</p>)}
                                                    </div>
                                                    <div className="flex space-x-1 sm:space-x-2 flex-wrap gap-1 mt-2 sm:mt-0"> 
                                                        {/* Edit button is now always visible when not in history mode */}
                                                        {!showDatePicker && (
                                                            <button onClick={() => handleEditClick(day, category, exercise.id, exercise)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110 shadow-lg" title="Editer l'exercice"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-7.793 7.793A1 1 0 017.07 14H5a1 1 0 01-1-1v-2.07l7.793-7.793zM11.379 5.793L13.586 8l-1.5 1.5-2.207-2.207 1.5-1.5z" /></svg></button>
                                                        )}
                                                        {isEditMode && !showDatePicker && (
                                                            <>
                                                                <button onClick={() => handleDeleteExercise(day, category, exercise.id)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110 shadow-lg" title="Supprimer l'exercice"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, -1)} disabled={exerciseIndex === 0} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer l'exercice vers le haut"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button>
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, 1)} disabled={exerciseIndex === exercisesToRender.length - 1} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer l'exercice vers le bas"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                                                            </>
                                                        )}
                                                        {showDatePicker && exercise.isDeleted && ( <button onClick={() => handleReactivateExercise(day, category, exercise.id)} className="px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs" title="Réactiver l'exercice">Réactiver</button>)}
                                                        {isAdvancedMode && !exercise.isDeleted && (
                                                             <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec IA"> ✨ Analyser </button>
                                                        )}
                                                        <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg></button>
                                                        <button onClick={() => handleOpenNotesModal(day, category, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 3.414L16.586 7A2 2 0 0117 8.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h9V8.414L12.586 5A2 2 0 0012 4.586V4H6zm-1 6a1 1 0 011-1h5a1 1 0 110 2H6a1 1 0 01-1-1zM6 13a1 1 0 011-1h5a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg></button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>


            {/* Modals */}
            {editingExercise && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Modifier l'exercice</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="editWeight" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Poids (kg):</label> <input type="number" id="editWeight" step="0.1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} /> </div> <div> <label htmlFor="editSets" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Séries:</label> <input type="number" id="editSets" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newSets} onChange={(e) => setNewSets(e.target.value)} /> </div> <div> <label htmlFor="editReps" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Reps:</label> <input type="number" id="editReps" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newReps} onChange={(e) => setNewReps(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setEditingExercise(null)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler </button> <button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder </button> </div> </div> </div>)}
            {showAddExerciseModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter un nouvel exercice</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newExerciseName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom de l'exercice:</label> <input type="text" id="newExerciseName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} /> </div> <div> <label htmlFor="newExerciseWeight" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Poids (kg):</label> <input type="number" id="newExerciseWeight" step="0.1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} /> </div> <div> <label htmlFor="newExerciseSets" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Séries:</label> <input type="number" id="newExerciseSets" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newSets} onChange={(e) => setNewSets(e.target.value)} /> </div> <div> <label htmlFor="newExerciseReps" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Reps:</label> <input type="number" id="newExerciseReps" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newReps} onChange={(e) => setNewReps(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowAddExerciseModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={() => handleAddNewExercise()} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button> </div> </div> </div>)}
            {showDeleteConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression</h2> <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer l'exercice "{workouts.days[exerciseToDelete?.day]?.categories[exerciseToDelete?.category]?.find(ex => ex.id === exerciseToDelete?.exerciseId)?.name}" ? Il sera marqué comme supprimé. </p> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowDeleteConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler </button> <button onClick={confirmDeleteExercise} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer </button> </div> </div> </div>)}
            {showAddDayModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter un nouveau jour</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newDayName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom du jour:</label> <input type="text" id="newDayName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newDayNameInput} onChange={(e) => setNewDayNameInput(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowAddDayModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={handleAddDay} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button> </div> </div> </div>)}
            {showSelectDayForEditModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Sélectionner le jour à renommer</h2> <div className="space-y-3 sm:space-y-4"> {(orderedDays || []).map((day) => ( <button key={day} onClick={() => handleEditDay(day)} className={`w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base`} > {day} </button> ))} </div> <div className="flex justify-end mt-6 sm:mt-8"> <button onClick={() => setShowSelectDayForEditModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> </div> </div> </div>)}
            {showEditDayModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Renommer le jour "{editingDayName}"</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="editedDayNewName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nouveau nom du jour:</label> <input type="text" id="editedDayNewName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={editedDayNewNameInput} onChange={(e) => setEditedDayNewNameInput(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowEditDayModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmEditDay} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Renommer</button> </div> </div> </div>)}
            {showSelectDayForDeleteModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Sélectionner le jour à supprimer</h2> <div className="space-y-3 sm:space-y-4"> {(orderedDays || []).map((day) => ( <button key={day} onClick={() => handleDeleteDay(day)} className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base" > {day} </button> ))} </div> <div className="flex justify-end mt-6 sm:mt-8"> <button onClick={() => setShowSelectDayForDeleteModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> </div> </div> </div>)}
            {showDeleteDayConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression du jour</h2> <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer le jour "{dayToDeleteName}" et toutes ses catégories et exercices ? Cette action est irréversible. </p> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowDeleteDayConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmDeleteDay} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer</button> </div> </div> </div>)}
            {showAddCategoryModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter groupe musculaire à "{selectedDayForCategoryAdd}"</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newCategoryNameInput" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom du groupe musculaire:</label> <input type="text" id="newCategoryNameInput" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newCategoryNameInput} onChange={(e) => setNewCategoryNameInput(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowAddCategoryModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={handleAddCategory} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button> </div> </div> </div>)}
            {showEditCategoryModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Renommer le groupe musculaire "{editingCategory?.oldCategoryName}"</h2> <div className="space-y-3 sm:space-y-4"> <div> <label htmlFor="newCategoryName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nouveau nom:</label> <input type="text" id="newCategoryName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /> </div> </div> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowEditCategoryModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmEditCategory} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Renommer</button> </div> </div> </div>)}
            {showDeleteCategoryConfirm && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression</h2> <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer "{categoryToDelete?.categoryName}" du jour "{categoryToDelete?.day}" et tous ses exercices ? Irréversible. </p> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowDeleteCategoryConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={confirmDeleteCategory} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer</button> </div> </div> </div>)}
            {showExerciseGraphModal && exerciseForGraph && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-lg sm:max-w-4xl border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Progression: {exerciseForGraph.name}</h2> <div className={`bg-gray-700 p-4 rounded-lg mb-6`}> <h3 className={`text-lg sm:text-xl font-semibold mb-4 text-center text-white`}>Plage de dates</h3> <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4"> <div> <label htmlFor="graphStartDate" className={`block text-gray-300 text-xs sm:text-sm font-bold mb-1 sm:mb-2`}>Début:</label> <input type="date" id="graphStartDate" value={graphStartDate} onChange={(e) => setGraphStartDate(e.target.value)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 w-full text-sm sm:text-base`} /> </div> <div> <label htmlFor="graphEndDate" className={`block text-gray-300 text-xs sm:text-sm font-bold mb-1 sm:mb-2`}>Fin:</label> <input type="date" id="graphEndDate" value={graphEndDate} onChange={(e) => setGraphEndDate(e.target.value)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 w-full text-sm sm:text-base`} /> </div> </div> </div> <ResponsiveContainer width="100%" height={250} sm:height={300}> <LineChart data={individualExerciseGraphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" /> <XAxis dataKey="date" stroke="#cbd5e0" tickFormatter={formatDate} style={{fontSize: '10px'}} sm:style={{fontSize: '12px'}} /> <YAxis stroke="#cbd5e0" domain={['auto', 'auto']} style={{fontSize: '10px'}} sm:style={{fontSize: '12px'}} /> <Tooltip contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#a0aec0' }} formatter={(value) => value !== null ? `${value} kg` : 'N/A'} /> <Legend wrapperStyle={{ color: '#e2e8f0', fontSize: '12px' }} /> <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={2} dot={({ cx, cy, stroke, payload }) => { if (payload.hasNewData) { return ( <circle key={`${payload.date}-${payload.weight}`} cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={2} fill="#8884d8" /> );} return null; }} activeDot={{ r: 6 }} name="Poids" connectNulls={true} /> </LineChart> </ResponsiveContainer> <div className="flex justify-end mt-6 sm:mt-8"> <button onClick={() => setShowExerciseGraphModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Fermer</button> </div> </div> </div>)}
            {showReorderDaysModal && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Réorganiser les jours</h2> <ul className="space-y-3"> {reorderingDayOrder.map((dayName, index) => ( <li key={dayName} className={`flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm`}> <span className={`text-base sm:text-lg text-white`}>{dayName}</span> <div className="flex space-x-2"> <button onClick={() => handleReorderDays(dayName, -1)} disabled={index === 0} className="p-1 sm:p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le haut"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg></button> <button onClick={() => handleReorderDays(dayName, 1)} disabled={index === reorderingDayOrder.length - 1} className="p-1 sm:p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le bas"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button> </div> </li> ))} </ul> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => setShowReorderDaysModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={saveReorderedDays} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder</button> </div> </div> </div>)}
            {showNotesModal && exerciseForNotes && ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"> <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800`}> <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Notes pour {workouts.days[exerciseForNotes.day]?.categories[exerciseForNotes.category]?.find(ex => ex.id === exerciseForNotes.exerciseId)?.name}</h2> <textarea className={`w-full h-24 sm:h-32 p-2 sm:p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 resize-none text-sm sm:text-base`} placeholder="Écrivez vos notes ici..." value={currentNoteContent} onChange={(e) => setCurrentNoteContent(e.target.value)} ></textarea> <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8"> <button onClick={() => {setShowNotesModal(false); setExerciseForNotes(null); setCurrentNoteContent('');}} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button> <button onClick={handleDeleteNote} disabled={!currentNoteContent} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"> Supprimer Note</button> <button onClick={handleSaveNote} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder</button> </div> </div> </div>)}
            
            {/* Suggestion Modal (Gemini) - Removed */}
            {/* Progression Analysis Modal (Gemini) */}
            {showProgressionAnalysisModal && exerciseForAnalysis && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-lg border border-gray-700 bg-gray-800`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 text-white text-center`}>✨ Analyse de Progression pour {exerciseForAnalysis.name}</h2>
                        {progressionAnalysisLoading && (
                            <div className="flex flex-col items-center justify-center h-40">
                                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
                                <p className="text-sky-300 mt-3 text-sm sm:text-base">Analyse en cours...</p>
                            </div>
                        )}
                        {!progressionAnalysisLoading && progressionAnalysisContent && (
                            <div className="mt-4 p-3 sm:p-4 bg-gray-700 rounded-lg max-h-80 sm:max-h-96 overflow-y-auto">
                                <p className="text-white whitespace-pre-wrap text-sm sm:text-base">{progressionAnalysisContent}</p>
                            </div>
                        )}
                         {!progressionAnalysisLoading && !progressionAnalysisContent && (
                            <p className="text-gray-400 text-center text-sm sm:text-base">Aucune analyse disponible ou erreur lors de la récupération.</p>
                        )}
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6">
                            <button
                                onClick={() => setShowProgressionAnalysisModal(false)}
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default App;
