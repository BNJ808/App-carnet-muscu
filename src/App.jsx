import React, { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, orderBy, limit, addDoc, where, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import * as Tone from 'tone';

// Importation des composants séparés
const MainWorkoutView = lazy(() => import('./MainWorkoutView.jsx'));
const HistoryView = lazy(() => import('./HistoryView.jsx'));
const Toast = lazy(() => import('./Toast.jsx'));

// Helper functions (déplacées en dehors du composant pour éviter les recréations inutiles)
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const normalizeDateToStartOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

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

// Custom Hook: useTimer (déplacé ici pour être accessible globalement)
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

    const startTimer = useCallback(() => {
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
    }, [seconds, initialSeconds]);

    const pauseTimer = useCallback(() => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
    }, []);

    const resetTimer = useCallback((newInitialSeconds = initialSeconds) => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        setIsFinished(false);
        setSeconds(newInitialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        return () => clearInterval(intervalRef.current);
    }, []);

    const formatTime = useCallback((totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }, []);

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
                    { id: generateUUID(), name: 'Ecartés Couchés', series: [{ weight: '6', reps: '6' }, { weight: '6', reps: '6' }, { weight: '6', reps: '6' }], isDeleted: false, notes: '' },
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


// Composant principal de l'application
const App = () => {
    // States globaux ou partagés
    const [workouts, setWorkouts] = useState({ days: {}, dayOrder: [] });
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [toast, setToast] = useState(null); 

    const [showDatePicker, setShowDatePicker] = useState(false); // Contrôle la vue principale/historique
    const [isEditMode, setIsEditMode] = useState(false); // Mode édition global

    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const MAX_UNDO_STATES = 10; 

    const [personalBests, setPersonalBests] = useState({});
    const [progressionInsights, setProgressionInsights] = useState({});
    const [historicalDataForGraphs, setHistoricalDataForGraphs] = useState([]); 

    // Gemini API Integration States
    const [showProgressionAnalysisModal, setShowProgressionAnalysisModal] = useState(false);
    const [progressionAnalysisLoading, setProgressionAnalysisLoading] = useState(false);
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [exerciseForAnalysis, setExerciseForAnalysis] = useState(null);

    const [isAdvancedMode, setIsAdvancedMode] = useState(false);

    // Initialisation et authentification Firebase
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

    // Récupération des données d'entraînement (toujours dans App.jsx car c'est la source de vérité)
    useEffect(() => {
        if (isAuthReady && userId) {
            setLoading(true);
            const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
            let q;

            // La requête pour l'historique est maintenant gérée par le composant HistoryView si nécessaire
            // Ici, nous voulons toujours la dernière version de l'entraînement principal
            q = query(sessionsRef, orderBy('timestamp', 'desc'), limit(1));
            
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
                } else {
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
    }, [isAuthReady, userId, appId]); 

    // Récupération des données historiques pour les graphiques et insights
    // Ce useEffect est maintenant plus général et ne déclenche pas le graphique individuel
    useEffect(() => {
        if (!isAuthReady || !userId) {
            setHistoricalDataForGraphs([]);
            return;
        }

        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        // Récupère les données des 6 derniers mois par défaut pour les insights
        let queryStartDate = new Date();
        queryStartDate.setMonth(queryStartDate.getMonth() - 6); 
        queryStartDate.setHours(0, 0, 0, 0);
        let queryEndDate = new Date();
        queryEndDate.setHours(23, 59, 59, 999);

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
            setHistoricalDataForGraphs(fetchedData);
        }, (error) => {
            console.error("Erreur lors de la récupération des données historiques:", error);
            setToast({ message: `Erreur Firestore (historique): ${error.message}`, type: 'error' });
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, appId]);

    // Calcul des insights et des records personnels (mémoïsé)
    const { insights: memoizedProgressionInsights, pbs: memoizedPersonalBests } = useMemo(() => {
        if (historicalDataForGraphs.length > 0) {
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
            historicalDataForGraphs.forEach(session => {
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
        }
        return { insights: {}, pbs: {} };
    }, [historicalDataForGraphs]);

    useEffect(() => {
        setProgressionInsights(memoizedProgressionInsights);
        setPersonalBests(memoizedPersonalBests);
    }, [memoizedProgressionInsights, memoizedPersonalBests]);


    // Fonctions de gestion de l'état (passées aux enfants via useCallback)
    const saveWorkouts = useCallback(async (updatedWorkoutsState, successMessage = "Données sauvegardées avec succès !", errorMessage = "Erreur lors de la sauvegarde des données.") => {
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
    }, [userId, appId, setToast]);


    const applyChanges = useCallback((newWorkoutsState, successMessage, errorMessage) => {
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
    }, [workouts, saveWorkouts]);

    const handleUndo = useCallback(() => {
        if (undoStack.length > 0) {
            const previousState = undoStack[undoStack.length - 1];
            setUndoStack(prev => prev.slice(0, prev.length - 1));
            setRedoStack(prev => [...prev, workouts]);
            setWorkouts(previousState);
            setToast({ message: "Action annulée avec succès !", type: 'success' });
        } else {
            setToast({ message: "Rien à annuler.", type: 'error' });
        }
    }, [undoStack, workouts, setToast]);

    const handleRedo = useCallback(() => {
        if (redoStack.length > 0) {
            const nextState = redoStack[redoStack.length - 1];
            setRedoStack(prev => prev.slice(0, prev.length - 1));
            setUndoStack(prev => [...prev, workouts]);
            setWorkouts(nextState);
            setToast({ message: "Action rétablie avec succès !", type: 'success' });
        } else {
            setToast({ message: "Rien à rétablir.", type: 'error' });
        }
    }, [redoStack, workouts, setToast]);

    const handleAnalyzeProgressionClick = useCallback(async (exercise) => {
        setExerciseForAnalysis(exercise);
        setProgressionAnalysisContent('');
        setShowProgressionAnalysisModal(true);
        setProgressionAnalysisLoading(true);

        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        let queryStartDate = new Date();
        queryStartDate.setMonth(queryStartDate.getMonth() - 6); 
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
            const snapshot = await getDocs(q); 
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


            if (analysisDataPoints.length < 3) { 
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
    }, [userId, appId, setToast, db, generateDateRange]);


    const toggleHistoryView = useCallback(() => {
        setShowDatePicker(prev => !prev);
        setIsEditMode(false); // Quitte le mode édition en changeant de vue
    }, []);

    const toggleEditMode = useCallback(() => {
        setIsEditMode(prev => !prev);
    }, []);

    const toggleProgressionAnalysisModal = useCallback(() => {
        setShowProgressionAnalysisModal(prev => !prev);
    }, []);

    const toggleAdvancedMode = useCallback(() => {
        setIsAdvancedMode(prevMode => !prevMode);
    }, []);


    if (loading || !isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-xl">Chargement des données...</p>
            </div>
        );
    }

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
                        onClick={toggleEditMode}
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

            <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh] text-white">Chargement de la vue...</div>}>
                {showDatePicker ? (
                    <HistoryView
                        userId={userId}
                        appId={appId}
                        db={db}
                        setToast={setToast}
                        workouts={workouts}
                        personalBests={personalBests}
                        progressionInsights={progressionInsights}
                        handleAnalyzeProgressionClick={handleAnalyzeProgressionClick}
                        generateDateRange={generateDateRange}
                        normalizeDateToStartOfDay={normalizeDateToStartOfDay}
                        calculate1RM={calculate1RM}
                        generateUUID={generateUUID}
                        applyChanges={applyChanges}
                    />
                ) : (
                    <MainWorkoutView
                        workouts={workouts}
                        userId={userId}
                        appId={appId}
                        db={db}
                        setToast={setToast}
                        applyChanges={applyChanges}
                        isEditMode={isEditMode}
                        personalBests={personalBests}
                        progressionInsights={progressionInsights}
                        handleAnalyzeProgressionClick={handleAnalyzeProgressionClick}
                        useTimer={useTimer} // Pass the hook itself
                        generateUUID={generateUUID}
                        calculate1RM={calculate1RM}
                        normalizeDateToStartOfDay={normalizeDateToStartOfDay}
                        generateDateRange={generateDateRange}
                        isAdvancedMode={isAdvancedMode}
                    />
                )}
            </Suspense>

            {/* Progression Analysis Modal (Gemini) - Rendu ici car l'état est dans App.jsx */}
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
                                onClick={toggleProgressionAnalysisModal}
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