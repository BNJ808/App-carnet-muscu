import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, where, serverTimestamp, getDocs, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    Undo2, Redo2, Settings, XCircle, CheckCircle
} from 'lucide-react';
// Import pour l'API Gemini
import { GoogleGenerativeAI } from '@google/generative-ai';


// Import des composants refactorisés - Correction des chemins d'importation
import Toast from './Toast.jsx';
import MainWorkoutView from './MainWorkoutView.jsx';
import HistoryView from './HistoryView.jsx';
import TimerView from './TimerView.jsx'; // Nouveau
import BottomNavigationBar from './BottomNavigationBar.jsx'; // Nouveau

// This ensures Tone is defined, either by the environment or as a stub.
// This is a workaround to prevent ReferenceError if Tone.js is not loaded by the environment.
// It will allow the app to run, but audio functionality will be disabled if Tone is truly missing.
if (typeof window.Tone === 'undefined') {
    console.warn("Tone.js library not found globally. Audio functionality will be disabled.");
    window.Tone = {
        // Basic stub for Tone.Synth and context to prevent ReferenceErrors
        Synth: function() {
            console.warn("Tone.js Synth stub used.");
            return {
                toDestination: () => ({}),
                triggerAttackRelease: () => { /* no-op */ },
                dispose: () => { /* no-op: added dispose method */ }
            };
        },
        context: {
            state: 'suspended',
            resume: () => Promise.resolve() // Stub resume to prevent errors if startAudio is called
        },
        start: () => {
            console.warn("Tone.js start stub used.");
            return Promise.resolve();
        },
        now: () => 0 // Add a stub for Tone.now()
    };
}

// Styles CSS intégrés directement pour l'aperçu
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

    /* Animation pour l'exercice sauvegardé */
    .saved-animation {
        animation: saved-flash 0.7s ease-out;
    }

    @keyframes saved-flash {
        0% { background-color: #1f2937; } /* Couleur de fond normale */
        25% { background-color: #3b82f6; } /* Flash bleu temporaire */
        100% { background-color: #1f2937; } /* Retour à la normale */
    }

    /* Style pour les boutons en cours de sauvegarde/suppression */
    .button-saving, .button-deleting {
        opacity: 0.7;
        cursor: wait;
        pointer-events: none; /* Empêche les clics supplémentaires */
    }
`;

// Initialisation de Firebase (les variables __app_id, __firebase_config, __initial_auth_token sont fournies par l'environnement Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Utilisation des variables globales fournies par l'environnement Canvas
// Note: Les avertissements "import.meta" sont liés à la configuration de compilation de l'environnement Vercel
// et n'empêchent pas le fonctionnement si les variables sont correctement définies sur Vercel.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Vérification pour le débogage (peut être retirée après que tout fonctionne)
if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    console.error("ERREUR DE CONFIGURATION: Firebase 'projectId' ou 'apiKey' manquant. Vérifiez vos variables d'environnement VITE_FIREBASE_PROJECT_ID et VITE_FIREBASE_API_KEY sur Vercel et dans votre fichier .env local.");
}

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

// Function to generate a UUID (Universally Unique Identifier)
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Base structure for initial data
const baseInitialData = {
    days: {
        'Lundi + Jeudi': {
            categories: {
                PECS: [
                    { id: 'pecs-1', name: 'D.Couché léger', series: [{ weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }], isDeleted: false, notes: '' },
                    { id: 'pecs-2', name: 'D.Couché lourd', series: [{ weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }], isDeleted: false, notes: '' },
                    { id: 'pecs-3', name: 'D.Couché incliné léger', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                    { id: 'pecs-4', name: 'D.Couché incl lourd', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '10' }, { weight: '10', reps: '10' }], isDeleted: false, notes: '' },
                    { id: 'pecs-5', name: 'Ecartés Couchés', series: [{ weight: '6', reps: '' }, { weight: '6', reps: '6' }, { weight: '6', reps: '6' }], isDeleted: false, notes: '' },
                ],
                EPAULES: [
                    { id: 'epaules-1', name: 'D.Epaules léger', series: [{ weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }], isDeleted: false, notes: '' },
                    { id: 'epaules-2', name: 'D.Epaules lourd', series: [{ weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }, { weight: '14', reps: '8' }], isDeleted: false, notes: '' },
                    { id: 'epaules-3', name: 'Ecartés Epaules', series: [{ weight: '6', reps: '15' }, { weight: '6', reps: '15' }, { weight: '6', reps: '15' }], isDeleted: false, notes: '' },
                    { id: 'epaules-4', name: 'Avant Epaules', series: [{ weight: '6', reps: '15' }, { weight: '6', reps: '15' }, { weight: '6', reps: '15' }], isDeleted: false, notes: '' },
                ],
                TRICEPS: [
                    { id: 'triceps-1', name: 'Haltere Front léger', series: [{ weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }], isDeleted: false, notes: '' },
                    { id: 'triceps-2', name: 'Haltere Front lourd', series: [{ weight: '6', reps: '8' }, { weight: '6', reps: '8' }, { weight: '6', reps: '8' }, { weight: '6', reps: '8' }], isDeleted: false, notes: '' },
                    { id: 'triceps-3', name: 'Barre Front', series: [{ weight: '16', reps: '6' }, { weight: '16', reps: '6' }, { weight: '16', reps: '6' }, { weight: '16', reps: '6' }], isDeleted: false, notes: '' },
                ],
            },
            categoryOrder: ['PECS', 'EPAULES', 'TRICEPS'],
        },
        'Mardi + Vendredi': {
            categories: {
                DOS: [
                    { id: 'dos-1', name: 'R. Haltères Léger', series: [{ weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }], isDeleted: false, notes: '' },
                    { id: 'dos-2', name: 'R. Haltères Lourd', series: [{ weight: '12', reps: '8' }, { weight: '12', reps: '8' }, { weight: '12', reps: '8' }, { weight: '12', reps: '8' }], isDeleted: false, notes: '' },
                    { id: 'dos-3', name: 'Tractions', series: [{ weight: '', reps: '6' }, { weight: '', reps: '6' }, { weight: '', reps: '6' }, { weight: '', reps: '6' }], isDeleted: false, notes: '' },
                    { id: 'dos-4', name: 'R.Haltères Mono', series: [{ weight: '10', reps: '12' }, { weight: '10', reps: '12' }, { weight: '10', reps: '12' }], isDeleted: false, notes: '' },
                ],
                BICEPS: [
                    { id: 'biceps-1', name: 'Curl Léger', series: [{ weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }, { weight: '8', reps: '15' }], isDeleted: false, notes: '' },
                    { id: 'biceps-2', name: 'Curl Lourd', series: [{ weight: '10', reps: '10' }, { weight: '10', reps: '10' }, { weight: '10', reps: '10' }, { weight: '10', reps: '10' }], isDeleted: false, notes: '' },
                    { id: 'biceps-3', name: 'Marteau Léger', series: [{ weight: '8', reps: '13' }, { weight: '8', reps: '13' }, { weight: '8', reps: '13' }, { weight: '8', reps: '13' }], isDeleted: false, notes: '' },
                    { id: 'biceps-4', name: 'Marteau Lourd', series: [{ weight: '12', reps: '6' }, { weight: '12', reps: '6' }, { weight: '12', reps: '6' }, { weight: '12', reps: '6' }], isDeleted: false, notes: '' },
                ],
                'AR . EPAULES + ABS': [
                    { id: 'arepaules-1', name: 'Ar . Epaules', series: [{ weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }, { weight: '4', reps: '12' }], isDeleted: false, notes: '' },
                    { id: 'arepaules-2', name: 'Abdos', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                ],
            },
            categoryOrder: ['DOS', 'BICEPS', 'AR . EPAULES + ABS'],
        },
        'Mercredi + Samedi': {
            categories: {
                LEGS: [
                    { id: 'legs-1', name: 'S. de Terre Sumo', series: [{ weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }], isDeleted: false, notes: '' },
                    { id: 'legs-2', name: 'S. de Terre Normal', series: [{ weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }, { weight: '16', reps: '15' }], isDeleted: false, notes: '' },
                ],
                FENTES: [
                    { id: 'fentes-1', name: 'Fentes Ischios Léger uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: 'fentes-2', name: 'Fentes Quads Léger uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: 'fentes-3', name: 'Fentes Quads Lourd uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: 'fentes-4', name: 'Fentes Quads Lourd uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                ],
                CURL: [
                    { id: 'curl-1', name: 'Curl Ischios uni', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                    { id: 'curl-2', name: 'Curl Quads uni', series: [{ weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
                ],
                MOLLETS: [
                    { id: 'mollets-1', name: 'Levées Léger uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }], isDeleted: false, notes: '' },
                    { id: 'mollets-2', name: 'Levées Lourd uni', series: [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '10', reps: '' }], isDeleted: false, notes: '' },
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
    const [isFinishedState, setIsFinishedState] = useState(false); // Renamed to avoid conflict with local variable

    const intervalRef = useRef(null);
    const synthRef = useRef(null); 

    useEffect(() => {
        // Cleanup function for the synth
        return () => {
            if (synthRef.current) {
                // Ensure dispose method exists before calling it
                if (typeof synthRef.current.dispose === 'function') {
                    synthRef.current.dispose();
                } else {
                    console.warn("synthRef.current.dispose is not a function. Tone.js stub might be incomplete.");
                }
                synthRef.current = null; // Clear the ref
            }
        };
    }, []);

    const startTimer = async (timeToSet = seconds) => { // Make this function async, accept optional timeToSet
        const finalTime = timeToSet > 0 ? timeToSet : initialSeconds; // Use provided time or initialSeconds if current is 0
        setSeconds(finalTime); // Set seconds to the desired value before starting

        if (finalTime > 0) {
            // Ensure audio context is started and synth is initialized
            if (window.Tone) {
                if (window.Tone.context.state !== 'running') {
                    try {
                        await window.Tone.start();
                        console.log("Audio context started by timer.");
                    } catch (error) {
                        console.error("Failed to start audio context for timer:", error);
                        // Optionally set a toast here if this is the only way audio starts
                    }
                }
                // Initialize synth only if it hasn't been already
                if (!synthRef.current) {
                    synthRef.current = new window.Tone.Synth().toDestination();
                    console.log("Tone.Synth initialized by timer start.");
                }
            } else {
                console.warn("Tone.js not available for timer sounds.");
            }

            setIsRunning(true);
            setIsFinishedState(false); // Reset isFinishedState when starting
            clearInterval(intervalRef.current); // Clear any existing interval before setting a new one
            intervalRef.current = setInterval(() => {
                setSeconds(prevSeconds => {
                    if (prevSeconds <= 1) {
                        clearInterval(intervalRef.current);
                        setIsRunning(false);
                        setIsFinishedState(true); // Set to true when timer finishes
                        if (window.Tone && synthRef.current && typeof synthRef.current.triggerAttackRelease === 'function') {
                            for (let i = 0; i < 3; i++) {
                                synthRef.current.triggerAttackRelease('G5', '8n', window.Tone.now() + (i * 0.5)); // Use window.Tone
                            }
                        } else {
                            console.warn("Synth not ready or triggerAttackRelease not a function. Cannot play sound.");
                        }
                        return 0;
                    }
                    return prevSeconds - 1;
                });
            }, 1000);
        } else {
            // If finalTime is 0 or less, just reset without starting
            resetTimer(initialSeconds); // Reset to default
        }
    };

    const pauseTimer = () => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
    };

    const resetTimer = (newInitialSeconds = initialSeconds) => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        setIsFinishedState(false); // Reset isFinishedState when resetting
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
        isFinished: isFinishedState, // Corrected to return the state variable
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
    const [editingExerciseName, setEditingExerciseName] = useState(''); 
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
    const [showDatePicker, setShowDatePicker] = useState(false); // This state is now controlled by currentView
    const [selectedDateForHistory, setSelectedDateForHistory] = useState(null); 
    const [selectedHistoryDayFilter, setSelectedHistoryDayFilter] = useState(null);
    const [graphTimeRange, setGraphTimeRange] = useState('90days'); 
    const [historicalDataForGraphs, setHistoricalDataForGraphs] = useState([]); 
    const [processedGraphData, setProcessedGraphData] = {}; // Initialisation avec un objet vide

    const [showExerciseGraphModal, setShowExerciseGraphModal] = useState(false); 
    const [exerciseForGraph, setExerciseForGraph] = useState(null); 
    const [individualExerciseGraphData, setIndividualExerciseGraphData] = useState([]); 

    const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState(''); // Correction: useState avec valeur initiale

    const [showDeletedExercisesInHistory, setShowDeletedExercisesInHistory] = useState(false); // État pour afficher les exercices supprimés

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
    const [currentView, setCurrentView] = useState('workout'); // 'workout', 'timer', 'history'

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

    const [showProgressionAnalysisModal, setShowProgressionAnalysisModal] = useState(false);
    const [progressionAnalysisLoading, setProgressionAnalysisLoading] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [exerciseForAnalysis, setExerciseForAnalysis] = useState(null);

    const [isSavingExercise, setIsSavingExercise] = useState(false);
    const [isDeletingExercise, setIsDeletingExercise] = useState(false);
    const [isAddingExercise, setIsAddingExercise] = useState(false);


    const toggleAdvancedMode = () => {
        setIsAdvancedMode(prevMode => !prevMode);
    };

    const dayButtonColors = [
        'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
        'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
        'from-red-500 to-red-600 hover:from-red-700 hover:to-red-700',
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
        if (!Array.isArray(historicalSessions)) {
            console.warn("calculateInsights: historicalSessions is not an array.", historicalSessions);
            return { insights: {}, pbs: {} };
        }

        historicalSessions.forEach(session => {
            const sessionDate = session.timestamp;
            const workoutData = session.workoutData;

            // Ensure workoutData and workoutData.days are valid objects before calling Object.values
            if (workoutData && typeof workoutData === 'object' && workoutData.days && typeof workoutData.days === 'object') {
                Object.values(workoutData.days).forEach(dayData => {
                    // Ensure dayData and dayData.categories are valid objects before calling Object.values
                    if (dayData && typeof dayData === 'object' && dayData.categories && typeof dayData.categories === 'object') {
                        Object.values(dayData.categories).forEach(categoryExercises => {
                            // Ensure categoryExercises is an array before iterating
                            if (Array.isArray(categoryExercises)) {
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
                            } else {
                                console.warn("calculateInsights: categoryExercises is not an array:", categoryExercises);
                            }
                        });
                    } else {
                        console.warn("calculateInsights: dayData or dayData.categories is invalid:", dayData);
                    }
                });
            } else {
                console.warn("calculateInsights: workoutData or workoutData.days is invalid:", workoutData);
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
                    // Utilisez __initial_auth_token si défini, sinon signInAnonymously
                    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
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

    // Reset isEditMode when view changes from workout
    useEffect(() => {
        if (currentView !== 'workout') {
            setIsEditMode(false);
        }
        // Also reset history filters when switching away from history view
        if (currentView !== 'history') {
            setSelectedDateForHistory(null);
            setSelectedHistoryDayFilter(null);
            setShowDeletedExercisesInHistory(false);
        } else {
            // When switching to history, set default date to today
            setSelectedDateForHistory(normalizeDateToStartOfDay(new Date()));
            if (workouts.dayOrder.length > 0) {
                setSelectedHistoryDayFilter(workouts.dayOrder[0]);
            }
        }
    }, [currentView]);


    useEffect(() => {
        const fetchAndSetWorkouts = async () => {
            if (isAuthReady && userId) {
                setLoading(true);
                const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);

                // Now set up the real-time listener
                let q;
                if (currentView === 'history' && selectedDateForHistory) {
                    // Query for the latest workout data up to a specific date
                    // Requires a composite index on `timestamp` (descending)
                    q = query(
                        sessionsRef,
                        where('timestamp', '<=', Timestamp.fromDate(normalizeDateToStartOfDay(selectedDateForHistory))),
                        orderBy('timestamp', 'desc'),
                        limit(1)
                    );
                } else {
                    // Query for the absolute latest workout data
                    // Requires an index on `timestamp` (descending)
                    q = query(sessionsRef, orderBy('timestamp', 'desc'), limit(1));
                }

                const unsubscribe = onSnapshot(q, async (snapshot) => {
                    if (!snapshot.empty) {
                        const fetchedWorkoutData = snapshot.docs[0]?.data()?.workoutData; // Utilisation de l'opérateur de chaînage optionnel
                        console.log("onSnapshot: fetchedWorkoutData retrieved:", fetchedWorkoutData); // LOG POUR DÉBOGAGE

                        // Ensure fetchedWorkoutData is a valid object before proceeding
                        if (!fetchedWorkoutData || typeof fetchedWorkoutData !== 'object') {
                            console.warn("Fetched workout data is invalid or missing. Falling back to empty state.", fetchedWorkoutData);
                            setWorkouts({ days: {}, dayOrder: [] });
                            setLoading(false);
                            return;
                        }

                        const sanitizedDays = fetchedWorkoutData.days && typeof fetchedWorkoutData.days === 'object'
                            ? fetchedWorkoutData.days
                            : {};

                        const sanitizedDayOrder = Array.isArray(fetchedWorkoutData.dayOrder)
                            ? fetchedWorkoutData.dayOrder
                            : Object.keys(sanitizedDays).sort(); // Ensure Object.keys is called on an object

                        const finalSanitizedDays = {};
                        for (const dayKey in sanitizedDays) {
                            if (Object.prototype.hasOwnProperty.call(sanitizedDays, dayKey)) { // More robust hasOwnProperty check
                                const dayData = sanitizedDays[dayKey];
                                const newCategories = {};
                                const currentCategoryOrder = Array.isArray(dayData.categoryOrder)
                                    ? dayData.categoryOrder
                                    : []; // Ensure categoryOrder is an array, even if empty

                                if (dayData && typeof dayData === 'object' && dayData.categories && typeof dayData.categories === 'object') {
                                    for (const categoryKey in dayData.categories) {
                                        if (Object.prototype.hasOwnProperty.call(dayData.categories, categoryKey)) { // More robust hasOwnProperty check
                                            const exercisesInCat = Array.isArray(dayData.categories[categoryKey])
                                                ? dayData.categories[categoryKey]
                                                : [];
                                            newCategories[categoryKey] = exercisesInCat.map(exercise => {
                                                const sanitizedSeries = Array.isArray(exercise.series)
                                                    ? exercise.series.map(s => ({
                                                        weight: s.weight !== undefined ? String(s.weight) : '',
                                                        reps: s.reps !== undefined ? String(s.reps) : ''
                                                    }))
                                                    : [{ weight: '', reps: '' }]; // Always ensure series is an array of objects
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
                                    ...dayData, // Keep other properties if any
                                    categories: newCategories,
                                    categoryOrder: currentCategoryOrder.length > 0 ? currentCategoryOrder : Object.keys(newCategories).sort()
                                };
                            }
                        }
                        setWorkouts({ days: finalSanitizedDays, dayOrder: sanitizedDayOrder });
                        if (!selectedDayFilter && sanitizedDayOrder.length > 0) {
                            setSelectedDayFilter(sanitizedDayOrder[0]);
                        }
                    } else {
                        // If no data found, initialize with base structure
                        console.log("No workout data found in Firestore. Initializing with base structure.");
                        setWorkouts(baseInitialData); // Use baseInitialData as default
                        setSelectedDayFilter(baseInitialData.dayOrder[0]); // Select first day
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
        };

        fetchAndSetWorkouts();
    }, [isAuthReady, userId, currentView, selectedDateForHistory, appId]); 


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

        // Query for historical data within a date range for graphs
        // Requires a composite index on `timestamp` (ascending)
        const q = query(
            sessionsRef,
            where('timestamp', '>=', Timestamp.fromDate(queryStartDate)),
            where('timestamp', '<=', Timestamp.fromDate(queryEndDate)),
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
            
            // Use only fetchedData, no historicalSessionsData
            const combinedData = fetchedData;

            setHistoricalDataForGraphs(combinedData); // Store all fetched data for insights

            if (showExerciseGraphModal && exerciseForGraph) {
                const latestDailyWeightsIndividual = {};
                combinedData.forEach(session => {
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
            } else {
                setIndividualExerciseGraphData([]); // Clear if not showing specific graph
            }
        }, (error) => {
            console.error("Erreur lors de la récupération des données historiques:", error);
            setToast({ message: `Erreur Firestore (historique): ${error.message}`, type: 'error' });
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId, graphTimeRange, showExerciseGraphModal, exerciseForGraph, graphStartDate, graphEndDate]);


    useEffect(() => {
        const newProcessedGraphData = {};
        if (currentView === 'history' && selectedDateForHistory && !showExerciseGraphModal && historicalDataForGraphs.length > 0) {
            // This logic is for the global graph view, which seems less used now.
            // The individual exercise graph logic is handled in the previous useEffect.
            // For now, this can be simplified or removed if not directly used for display.
        }
        setProcessedGraphData(newProcessedGraphData); // Potentially an empty object if not in the specific global graph view
    }, [historicalDataForGraphs, currentView, selectedDateForHistory, showExerciseGraphModal]);


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

    // Effect to update the timer's internal seconds when restTimeInput changes
    useEffect(() => {
        // Only update if the timer is not running or if it's finished
        if (!timerIsRunning && !timerIsFinished) {
            // Ensure restTimeInput is a valid number before setting, default to DEFAULT_REST_TIME
            const newTimerSeconds = parseInt(restTimeInput, 10);
            setTimerSeconds(isNaN(newTimerSeconds) ? DEFAULT_REST_TIME : newTimerSeconds);
        }
    }, [restTimeInput, timerIsRunning, timerIsFinished, setTimerSeconds]);


    const saveWorkouts = async (updatedWorkoutsState, successMessage = "Données sauvegardées avec succès !", errorMessage = "Erreur lors de la sauvegarde des données.") => {
        if (userId && appId) { 
            const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
            try {
                // Deep clone and sanitize the data before saving
                const sanitizedWorkoutsState = JSON.parse(JSON.stringify(updatedWorkoutsState));

                // Ensure top-level structure
                if (!sanitizedWorkoutsState.days || typeof sanitizedWorkoutsState.days !== 'object') {
                    sanitizedWorkoutsState.days = {};
                }
                if (!Array.isArray(sanitizedWorkoutsState.dayOrder)) {
                    sanitizedWorkoutsState.dayOrder = Object.keys(sanitizedWorkoutsState.days).sort();
                }

                for (const dayKey in sanitizedWorkoutsState.days) {
                    if (Object.prototype.hasOwnProperty.call(sanitizedWorkoutsState.days, dayKey)) {
                        const dayData = sanitizedWorkoutsState.days[dayKey];

                        // Ensure dayData is an object
                        if (!dayData || typeof dayData !== 'object') {
                            sanitizedWorkoutsState.days[dayKey] = { categories: {}, categoryOrder: [] };
                            continue;
                        }

                        // Ensure categories is an object
                        if (!dayData.categories || typeof dayData.categories !== 'object') {
                            dayData.categories = {};
                        }
                        // Ensure categoryOrder is an array
                        if (!Array.isArray(dayData.categoryOrder)) {
                            dayData.categoryOrder = Object.keys(dayData.categories).sort();
                        }

                        for (const categoryKey in dayData.categories) {
                            if (Object.prototype.hasOwnProperty.call(dayData.categories, categoryKey)) {
                                let categoryExercises = dayData.categories[categoryKey];

                                // Ensure categoryExercises is an array
                                if (!Array.isArray(categoryExercises)) {
                                    categoryExercises = [];
                                }

                                dayData.categories[categoryKey] = categoryExercises.map(exercise => {
                                    // Ensure exercise is an object
                                    if (!exercise || typeof exercise !== 'object') {
                                        return { id: generateUUID(), name: '', series: [{ weight: '', reps: '' }], isDeleted: false, notes: '' };
                                    }

                                    // Ensure series is an array
                                    let sanitizedSeries = Array.isArray(exercise.series)
                                        ? exercise.series
                                        : [{ weight: '', reps: '' }];

                                    sanitizedSeries = sanitizedSeries.map(s => ({
                                        weight: s && s.weight !== undefined ? String(s.weight) : '',
                                        reps: s && s.reps !== undefined ? String(s.reps) : ''
                                    }));

                                    return {
                                        id: exercise.id || generateUUID(),
                                        name: typeof exercise.name === 'string' ? exercise.name : '',
                                        series: sanitizedSeries,
                                        isDeleted: typeof exercise.isDeleted === 'boolean' ? exercise.isDeleted : false,
                                        notes: typeof exercise.notes === 'string' ? exercise.notes : ''
                                    };
                                });
                            }
                        }
                    }
                }

                await addDoc(sessionsRef, {
                    timestamp: serverTimestamp(),
                    workoutData: sanitizedWorkoutsState
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
            setToast({ message: "Rien à rétablir.", type: 'error' });
        } else {
            setToast({ message: "Rien à rétablir.", type: 'error' });
        }
    };

    const handleEditClick = (day, category, exerciseId, exercise) => {
        setEditingExercise({ day, category, exerciseId });
        setEditingExerciseName(exercise.name); // Set the current exercise name for editing
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

        setIsSavingExercise(true); // Début de l'opération de sauvegarde

        const { day, category, exerciseId } = editingExercise;
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exerciseId);

        if (exerciseIndex !== -1) {
            const weightNum = parseFloat(newWeight);
            const setsNum = parseInt(newSets);
            const repsNum = parseInt(newReps);

            if (!editingExerciseName.trim()) { // Validate new exercise name
                setToast({ message: "Le nom de l'exercice ne peut pas être vide.", type: 'error' });
                setIsSavingExercise(false);
                return;
            }
            if (newWeight !== '' && isNaN(weightNum)) {
                setToast({ message: "Le poids doit être un nombre.", type: 'error' });
                setIsSavingExercise(false);
                return;
            }
            if (newSets !== '' && (isNaN(setsNum) || setsNum <=0)) { 
                setToast({ message: "Les séries doivent être un nombre entier positif.", type: 'error' });
                setIsSavingExercise(false);
                return;
            }
            if (newReps !== '' && (isNaN(repsNum) || repsNum < 0)) { 
                setToast({ message: "Les répétitions doivent être un nombre entier positif ou nul.", type: 'error' });
                setIsSavingExercise(false);
                return;
            }

            const newSeriesArray = [];
            for (let i = 0; i < (setsNum || 1) ; i++) { // Default to 1 set if setsNum is invalid
                newSeriesArray.push({ weight: newWeight, reps: newReps });
            }
            updatedWorkouts.days[day].categories[category][exerciseIndex] = {
                ...updatedWorkouts.days[day].categories[category][exerciseIndex],
                name: editingExerciseName.trim(), // Update the exercise name
                series: newSeriesArray,
            };

            // Appliquer la classe d'animation temporaire
            const exerciseElement = document.getElementById(`exercise-item-${exerciseId}`);
            if (exerciseElement) {
                exerciseElement.classList.add('saved-animation');
                setTimeout(() => {
                    exerciseElement.classList.remove('saved-animation');
                }, 700); // Correspond à la durée de l'animation CSS
            }

            applyChanges(updatedWorkouts, "Exercice modifié avec succès !");
            setEditingExercise(null);
            setEditingExerciseName(''); // Clear the editing name
            setIsSavingExercise(false); // Fin de l'opération de sauvegarde
        } else {
            setToast({ message: "Erreur: Exercice non trouvé pour la modification.", type: 'error' });
            setIsSavingExercise(false);
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
        setIsAddingExercise(true); // Début de l'opération d'ajout

        if (!selectedDayForAdd || selectedDayForAdd.trim() === '' || !selectedCategoryForAdd || selectedCategoryForAdd.trim() === '') {
            setToast({ message: "Veuillez sélectionner un jour et une catégorie valides.", type: 'error' });
            setIsAddingExercise(false);
            return;
        }
        if (!name.trim()) {
            setToast({ message: "Le nom de l'exercice est obligatoire.", type: 'error' });
            setIsAddingExercise(false);
            return;
        }

        const weightNum = parseFloat(weight);
        const setsNum = parseInt(sets);
        const repsNum = parseInt(reps);

        if (weight !== '' && isNaN(weightNum)) {
            setToast({ message: "Le poids doit être un nombre.", type: 'error' });
            setIsAddingExercise(false);
            return;
        }
        if (sets !== '' && (isNaN(setsNum) || setsNum <=0)) {
            setToast({ message: "Les séries doivent être un nombre entier positif.", type: 'error' });
            setIsAddingExercise(false);
            return;
        }
        if (reps !== '' && (isNaN(repsNum) || repsNum < 0)) {
            setToast({ message: "Les répétitions doivent être un nombre entier positif ou nul.", type: 'error' });
            setIsAddingExercise(false);
            return;
        }

        const seriesToStore = [];
        for (let i = 0; i < (setsNum || 1); i++) { // Default to 1 set
            seriesToStore.push({ weight: String(weight), reps: String(reps) });
        }

        const updatedWorkouts = JSON.parse(JSON.stringify(workouts));
        // Vérification de l'existence de la catégorie avant de pousser
        if (!updatedWorkouts.days[selectedDayForAdd] || !updatedWorkouts.days[selectedDayForAdd].categories) {
            setToast({ message: "Erreur: Jour ou catégorie sélectionné(e) introuvable.", type: 'error' });
            setIsAddingExercise(false);
            return;
        }
        if (!updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd]) {
            updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd] = [];
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
        setIsAddingExercise(false); // Fin de l'opération d'ajout
    };


    const handleDeleteExercise = (day, category, exerciseId) => {
        setExerciseToDelete({ day, category, exerciseId });
        setShowDeleteConfirm(true);
    };

    const confirmDeleteExercise = () => {
        if (!exerciseToDelete) return;

        setIsDeletingExercise(true); // Début de l'opération de suppression

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
        setIsDeletingExercise(false); // Fin de l'opération de suppression
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

    // Removed toggleHistoryView as navigation is now handled by BottomNavigationBar

    const handleDateChange = (e) => {
        const newSelectedDate = normalizeDateToStartOfDay(new Date(e.target.value));
        const today = normalizeDateToStartOfDay(new Date());

        if (newSelectedDate > today) {
            setToast({ message: "Impossible de sélectionner une date future pour l'historique.", type: 'error' });
            setSelectedDateForHistory(today);
        } else {
            setToast(null); // Clear any previous toast on successful navigation
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
        } else {
            setToast(null); // Clear any previous toast on successful navigation
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
        if (currentView === 'history' && (workouts.dayOrder || []).length > 0) {
            if (!selectedHistoryDayFilter || !(workouts.dayOrder || []).includes(selectedHistoryDayFilter)) {
                setSelectedHistoryDayFilter((workouts.dayOrder || [])[0]);
            }
        } else if (currentView === 'history' && (workouts.dayOrder || []).length === 0) {
            setSelectedHistoryDayFilter(null);
        }
    }, [selectedDateForHistory, workouts.dayOrder, currentView, selectedHistoryDayFilter]); 


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

    const handleOpenNotesModal = (day, category, exerciseId) => { // Removed currentNotes parameter
        setExerciseForNotes({ day, category, exerciseId });
        // Retrieve notes from the current workouts state
        const currentExercise = workouts.days[day]?.categories[category]?.find(ex => ex.id === exerciseId);
        setCurrentNoteContent(currentExercise?.notes || '');
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

    const handleAnalyzeProgressionClick = async (exercise) => {
        setExerciseForAnalysis(exercise);
        setProgressionAnalysisContent('');
        setShowProgressionAnalysisModal(true);
        setProgressionAnalysisLoading(true);

        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        let queryStartDate = new Date();
        queryStartDate.setMonth(queryStartDate.getMonth() - 6); // Analyze last 6 months for example
        queryStartDate.setHours(0,0,0,0);
        let queryEndDate = new Date();
        queryEndDate.setHours(23,59,59,999);

        const allDatesForDisplay = generateDateRange(queryStartDate, queryEndDate);

        const q = query(
            sessionsRef,
            where('timestamp', '>=', Timestamp.fromDate(queryStartDate)),
            where('timestamp', '<=', Timestamp.fromDate(queryEndDate)),
            orderBy('timestamp', 'asc')
        );
        
        try {
            const snapshot = await getDocs(q); 
            const fetchedData = snapshot.docs.map(doc => ({
                timestamp: doc.data().timestamp.toDate(),
                workoutData: doc.data().workoutData
            }));

            // Use only fetchedData, no historicalSessionsData
            const combinedDataForAnalysis = fetchedData;


            const latestDailyWeightsIndividual = {};
            combinedDataForAnalysis.forEach(session => {
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


            if (analysisDataPoints.length < 3) { 
                setProgressionAnalysisContent("Pas assez de données de progression pour cet exercice sur la période sélectionnée pour une analyse significative.");
                setProgressionAnalysisLoading(false);
                return;
            }

            const formattedDataString = analysisDataPoints.map(dp => `${dp.date}: ${dp.weight}kg`).join('; ');
            const prompt = `Analyse ma progression pour l'exercice '${exercise.name}'. Voici mes données de performance (date: poids soulevé en kg) sur les 6 derniers mois : ${formattedDataString}. Points à considérer : tendance générale, plateaux éventuels, régularité. Fournis une brève analyse (2-4 phrases) et 2-3 conseils actionnables et concis pour améliorer ma force ou ma technique sur cet exercice. Sois encourageant et direct.`;
            
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            // Utilisez la variable d'environnement pour la clé API Gemini
            const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY; 
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


    if (loading || !isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-xl">Chargement des données...</p>
            </div>
        );
    }

    const orderedDays = workouts.dayOrder || []; 

    return (
        <div className={`min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white font-inter p-4 sm:p-6 lg:p-8 pb-20`}> {/* Added pb-20 for bottom nav bar */}
            <style>{appStyles}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <h1 className={`text-2xl sm:text-4xl font-extrabold text-blue-400 tracking-tight text-center sm:text-left flex items-center`}>
                        Carnet Muscu
                    </h1>
                    <label htmlFor="advanced-mode-toggle" className="flex items-center cursor-pointer relative">
                        <input
                            type="checkbox"
                            id="advanced-mode-toggle"
                            className="sr-only"
                            checked={isAdvancedMode}
                            onChange={toggleAdvancedMode}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-all duration-300 ${isAdvancedMode ? 'bg-blue-400' : 'bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-all duration-300 ${isAdvancedMode ? 'translate-x-6 bg-blue-500' : ''}`}></div>
                        <span className={`ml-3 text-sm text-gray-300`}>Mode Avancé</span>
                    </label>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap justify-center sm:justify-end gap-2">
                    <button
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        className="p-2 rounded-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center"
                        title="Annuler"
                    >
                        <Undo2 className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        className="p-2 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center"
                        title="Rétablir"
                    >
                        <Redo2 className="h-5 w-5" />
                    </button>
                    {currentView === 'workout' && ( // Only show "Mode Édition" in workout view
                        <button
                            onClick={() => setIsEditMode(prev => !prev)}
                            className={`px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold shadow-lg transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 text-sm sm:text-base
                                ${isEditMode ? 'bg-gradient-to-r from-red-600 to-pink-700 hover:from-red-700 hover:to-pink-800' : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'}
                                text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isEditMode ? 'Quitter édition' : 'Mode Édition'}
                        </button>
                    )}
                    {/* Removed "Voir l'historique" button as it's now in the bottom nav */}
                </div>
            </header>

            {isEditMode && currentView === 'workout' && ( // Only show day actions dropdown in workout edit mode
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
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 10 111.414 1.414l-4 4a1 1  0 01-1.414 0l-4-4a1 1  0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                        {showDayActionsDropdown && (
                            <div
                                className="origin-top-right absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-10 transition-all duration-300 ease-out transform scale-95 opacity-0 data-[open=true]:scale-100 data-[open=true]:opacity-100"
                                role="menu"
                                aria-orientation="vertical"
                                aria-labelledby="menu-button"
                                tabIndex="-1"
                                data-open={showDayActionsDropdown} 
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

            {currentView === 'workout' && (
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

            {currentView === 'workout' && (
                <MainWorkoutView
                    workouts={workouts}
                    selectedDayFilter={selectedDayFilter}
                    isEditMode={isEditMode}
                    isAdvancedMode={isAdvancedMode}
                    handleEditClick={handleEditClick}
                    handleAddExerciseClick={handleAddExerciseClick}
                    handleDeleteExercise={handleDeleteExercise}
                    openExerciseGraphModal={openExerciseGraphModal}
                    handleOpenNotesModal={handleOpenNotesModal}
                    handleAnalyzeProgressionClick={handleAnalyzeProgressionClick}
                    personalBests={personalBests}
                    progressionInsights={progressionInsights}
                    handleReorderCategories={handleReorderCategories}
                    handleReorderExercises={handleReorderExercises}
                    openAddCategoryModalForDay={openAddCategoryModalForDay}
                    handleEditCategory={handleEditCategory}
                    handleDeleteCategory={handleDeleteCategory}
                    isSavingExercise={isSavingExercise}
                    isDeletingExercise={isDeletingExercise}
                    isAddingExercise={isAddingExercise}
                    dayButtonColors={dayButtonColors}
                    dayBorderAndTextColors={dayBorderAndTextColors}
                    formatDate={formatDate}
                    getSeriesDisplay={getSeriesDisplay}
                    // Timer props are now passed only to TimerView
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

            {currentView === 'history' && (
                <HistoryView
                    workouts={workouts}
                    selectedDateForHistory={selectedDateForHistory}
                    selectedHistoryDayFilter={selectedHistoryDayFilter}
                    showDeletedExercisesInHistory={showDeletedExercisesInHistory}
                    setShowDeletedExercisesInHistory={setShowDeletedExercisesInHistory}
                    handleDateChange={handleDateChange}
                    navigateHistory={navigateHistory}
                    setSelectedHistoryDayFilter={setSelectedHistoryDayFilter}
                    getAllUniqueDays={getAllUniqueDays}
                    formatDate={formatDate}
                    getSeriesDisplay={getSeriesDisplay}
                    handleReactivateExercise={handleReactivateExercise}
                    openExerciseGraphModal={openExerciseGraphModal}
                    handleOpenNotesModal={handleOpenNotesModal}
                    handleAnalyzeProgressionClick={handleAnalyzeProgressionClick}
                    personalBests={personalBests}
                    progressionInsights={progressionInsights}
                    isAdvancedMode={isAdvancedMode}
                />
            )}

            {/* Modals */}
            {editingExercise && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: editingExercise ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${editingExercise ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Modifier l'exercice</h2>
                        <div className="space-y-3 sm:space-y-4">
                            <div>
                                <label htmlFor="editExerciseName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom de l'exercice:</label>
                                <input type="text" id="editExerciseName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={editingExerciseName} onChange={(e) => setEditingExerciseName(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="editWeight" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Poids (kg):</label>
                                <input type="number" id="editWeight" step="0.1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="editSets" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Séries:</label>
                                <input type="number" id="editSets" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newSets} onChange={(e) => setNewSets(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="editReps" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Reps:</label>
                                <input type="number" id="editReps" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newReps} onChange={(e) => setNewReps(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setEditingExercise(null)} disabled={isSavingExercise} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler </button>
                            <button onClick={handleSaveEdit} disabled={isSavingExercise} className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base ${isSavingExercise ? 'button-saving' : ''}`}> Sauvegarder </button>
                        </div>
                    </div>
                </div>
            )}
            {showAddExerciseModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showAddExerciseModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showAddExerciseModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter un nouvel exercice</h2>
                        <div className="space-y-3 sm:space-y-4">
                            <div>
                                <label htmlFor="newExerciseName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom de l'exercice:</label>
                                <input type="text" id="newExerciseName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="newExerciseWeight" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Poids (kg):</label>
                                <input type="number" id="newExerciseWeight" step="0.1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="newExerciseSets" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Séries:</label>
                                <input type="number" id="newExerciseSets" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newSets} onChange={(e) => setNewSets(e.target.value)} />
                            </div>
                            <div>
                                <label htmlFor="newExerciseReps" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Reps:</label>
                                <input type="number" id="newExerciseReps" step="1" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newReps} onChange={(e) => setNewReps(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowAddExerciseModal(false)} disabled={isAddingExercise} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={() => handleAddNewExercise()} disabled={isAddingExercise} className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base ${isAddingExercise ? 'button-saving' : ''}`}> Ajouter</button>
                        </div>
                    </div>
                </div>
            )}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showDeleteConfirm ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showDeleteConfirm ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression</h2>
                        <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer l'exercice "{workouts.days[exerciseToDelete?.day]?.categories[exerciseToDelete?.category]?.find(ex => ex.id === exerciseToDelete?.exerciseId)?.name}" ? Il sera marqué comme supprimé. </p>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeletingExercise} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler </button>
                            <button onClick={confirmDeleteExercise} disabled={isDeletingExercise} className={`bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base ${isDeletingExercise ? 'button-deleting' : ''}`}> Supprimer </button>
                        </div>
                    </div>
                </div>
            )}
            {showAddDayModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showAddDayModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showAddDayModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter un nouveau jour</h2>
                        <div className="space-y-3 sm:space-y-4">
                            <div>
                                <label htmlFor="newDayName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom du jour:</label>
                                <input type="text" id="newDayName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newDayNameInput} onChange={(e) => setNewDayNameInput(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowAddDayModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={handleAddDay} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button>
                        </div>
                    </div>
                </div>
            )}
            {showSelectDayForEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showSelectDayForEditModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showSelectDayForEditModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Sélectionner le jour à renommer</h2>
                        <div className="space-y-3 sm:space-y-4">
                            {(orderedDays || []).map((day) => (
                                <button key={day} onClick={() => handleEditDay(day)} className={`w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base`} >
                                    {day}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end mt-6 sm:mt-8">
                            <button onClick={() => setShowSelectDayForEditModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                        </div>
                    </div>
                </div>
            )}
            {showEditDayModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showEditDayModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showEditDayModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Renommer le jour "{editingDayName}"</h2>
                        <div className="space-y-3 sm:space-y-4">
                            <div>
                                <label htmlFor="editedDayNewName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nouveau nom du jour:</label>
                                <input type="text" id="editedDayNewName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={editedDayNewNameInput} onChange={(e) => setEditedDayNewNameInput(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowEditDayModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={confirmEditDay} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Renommer</button>
                        </div>
                    </div>
                </div>
            )}
            {showSelectDayForDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showSelectDayForDeleteModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showSelectDayForDeleteModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Sélectionner le jour à supprimer</h2>
                        <div className="space-y-3 sm:space-y-4">
                            {(orderedDays || []).map((day) => (
                                <button key={day} onClick={() => handleDeleteDay(day)} className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base" >
                                    {day}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-end mt-6 sm:mt-8">
                            <button onClick={() => setShowSelectDayForDeleteModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                        </div>
                    </div>
                </div>
            )}
            {showDeleteDayConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showDeleteDayConfirm ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showDeleteDayConfirm ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression du jour</h2>
                        <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer le jour "{dayToDeleteName}" et toutes ses catégories et exercices ? Cette action est irréversible. </p>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowDeleteDayConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={confirmDeleteDay} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer</button>
                        </div>
                    </div>
                </div>
            )}
            {showAddCategoryModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showAddCategoryModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showAddCategoryModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Ajouter groupe musculaire à "{selectedDayForCategoryAdd}"</h2>
                        <div className="space-y-3 sm:space-y-4">
                            <div>
                                <label htmlFor="newCategoryNameInput" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nom du groupe musculaire:</label>
                                <input type="text" id="newCategoryNameInput" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newCategoryNameInput} onChange={(e) => setNewCategoryNameInput(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowAddCategoryModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={handleAddCategory} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Ajouter</button>
                        </div>
                    </div>
                </div>
            )}
            {showEditCategoryModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showEditCategoryModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showEditCategoryModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Renommer le groupe musculaire "{editingCategory?.oldCategoryName}"</h2>
                        <div className="space-y-3 sm:space-y-4">
                            <div>
                                <label htmlFor="newCategoryName" className={`block text-gray-300 text-sm font-bold mb-1 sm:mb-2`}>Nouveau nom:</label>
                                <input type="text" id="newCategoryName" className={`shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowEditCategoryModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={confirmEditCategory} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Renommer</button>
                        </div>
                    </div>
                </div>
            )}
            {showDeleteCategoryConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showDeleteCategoryConfirm ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showDeleteCategoryConfirm ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Confirmer la suppression</h2>
                        <p className={`text-gray-300 text-sm sm:text-base text-center mb-4 sm:mb-6`}> Êtes-vous sûr de vouloir supprimer "{categoryToDelete?.categoryName}" du jour "{categoryToDelete?.day}" et tous ses exercices ? Irréversible. </p>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowDeleteCategoryConfirm(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={confirmDeleteCategory} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Supprimer</button>
                        </div>
                    </div>
                </div>
            )}
            {showExerciseGraphModal && exerciseForGraph && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showExerciseGraphModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-lg sm:max-w-4xl border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showExerciseGraphModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Progression: {exerciseForGraph.name}</h2>
                        <div className={`bg-gray-700 p-4 rounded-lg mb-6`}>
                            <h3 className={`text-lg sm:text-xl font-semibold mb-4 text-center text-white`}>Plage de dates</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
                                <div>
                                    <label htmlFor="graphStartDate" className={`block text-gray-300 text-xs sm:text-sm font-bold mb-1 sm:mb-2`}>Début:</label>
                                    <input type="date" id="graphStartDate" value={graphStartDate} onChange={(e) => setGraphStartDate(e.target.value)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 w-full text-sm sm:text-base`} />
                                </div>
                                <div>
                                    <label htmlFor="graphEndDate" className={`block text-gray-300 text-xs sm:text-sm font-bold mb-1 sm:mb-2`}>Fin:</label>
                                    <input type="date" id="graphEndDate" value={graphEndDate} onChange={(e) => setGraphEndDate(e.target.value)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 w-full text-sm sm:text-base`} />
                                </div>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={individualExerciseGraphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                <XAxis dataKey="date" stroke="#cbd5e0" tickFormatter={formatDate} style={{fontSize: '10px'}} />
                                <YAxis stroke="#cbd5e0" domain={['auto', 'auto']} style={{fontSize: '10px'}} />
                                <Tooltip contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} itemStyle={{ color: '#a0aec0' }} formatter={(value) => value !== null ? `${value} kg` : 'N/A'} />
                                <Legend wrapperStyle={{ color: '#e2e8f0', fontSize: '12px' }} />
                                <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={2} dot={({ cx, cy, stroke, payload }) => { if (payload.hasNewData) { return ( <circle key={`${payload.date}-${payload.weight}`} cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={2} fill="#8884d8" /> );} return null; }} activeDot={{ r: 6 }} name="Poids" connectNulls={true} />
                            </LineChart>
                        </ResponsiveContainer>
                        <div className="flex justify-end mt-6 sm:mt-8">
                            <button onClick={() => setShowExerciseGraphModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Fermer</button>
                        </div>
                    </div>
                </div>
            )}
            {showReorderDaysModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showReorderDaysModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showReorderDaysModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Réorganiser les jours</h2>
                        <ul className="space-y-3">
                            {reorderingDayOrder.map((dayName, index) => (
                                <li key={dayName} className={`flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm transition-all duration-200 ease-out`}>
                                    <span className={`text-base sm:text-lg text-white`}>{dayName}</span>
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleReorderDays(dayName, -1)} disabled={index === 0} className="p-1 sm:p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le haut"><ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" /></button>
                                        <button onClick={() => handleReorderDays(dayName, 1)} disabled={index === reorderingDayOrder.length - 1} className="p-1 sm:p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le bas"><ArrowDown className="h-4 w-4 sm:h-5 sm:w-5" /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => setShowReorderDaysModal(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={saveReorderedDays} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}
            {showNotesModal && exerciseForNotes && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showNotesModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showNotesModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                        <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-white text-center`}>Notes pour {workouts.days[exerciseForNotes.day]?.categories[exerciseForNotes.category]?.find(ex => ex.id === exerciseForNotes.exerciseId)?.name}</h2>
                        <textarea className={`w-full h-24 sm:h-32 p-2 sm:p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 resize-none text-sm sm:text-base`} placeholder="Écrivez vos notes ici..." value={currentNoteContent} onChange={(e) => setCurrentNoteContent(e.target.value)} ></textarea>
                        <div className="flex justify-end space-x-3 sm:space-x-4 mt-6 sm:mt-8">
                            <button onClick={() => {setShowNotesModal(false); setExerciseForNotes(null); setCurrentNoteContent('');}} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Annuler</button>
                            <button onClick={handleDeleteNote} disabled={!currentNoteContent} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"> Supprimer Note</button>
                            <button onClick={handleSaveNote} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"> Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showProgressionAnalysisModal && exerciseForAnalysis && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-out"
                    style={{ opacity: showProgressionAnalysisModal ? 1 : 0 }}>
                    <div className={`p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-lg border border-gray-700 bg-gray-800 transition-all duration-300 ease-out transform ${showProgressionAnalysisModal ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
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

            <BottomNavigationBar currentView={currentView} setCurrentView={setCurrentView} />
        </div>
    );
};

export default App;
