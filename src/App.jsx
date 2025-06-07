import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

// Constantes
const AUTO_SAVE_DELAY = 2000;
const MAX_UNDO_STATES = 20;
const CATEGORIES = ['Pectoraux', 'Dos', 'Épaules', 'Bras', 'Jambes', 'Abdos', 'Cardio'];
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Données de base
const baseInitialData = {
    days: {
        Lundi: { categories: {} },
        Mardi: { categories: {} },
        Mercredi: { categories: {} },
        Jeudi: { categories: {} },
        Vendredi: { categories: {} },
        Samedi: { categories: {} },
        Dimanche: { categories: {} }
    }
};

// Fonctions utilitaires
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'Date invalide';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

const getSeriesDisplay = (series) => {
    if (!Array.isArray(series) || series.length === 0) return 'Aucune série';
    return series.map(s => `${s.weight || '?'}kg × ${s.reps || '?'}`).join(' | ');
};

// Hook personnalisé pour les notifications natives
const useNotifications = () => {
    const [permission, setPermission] = useState(Notification?.permission || 'default');

    const requestPermission = useCallback(async () => {
        if ('Notification' in window) {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result === 'granted';
        }
        return false;
    }, []);

    const showNotification = useCallback((title, options = {}) => {
        if (permission === 'granted') {
            return new Notification(title, {
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                ...options
            });
        }
        return null;
    }, [permission]);

    return { permission, requestPermission, showNotification };
};

// Composant principal App
function App() {
    // États principaux
    const [workouts, setWorkouts] = useState(baseInitialData);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [lastSaveTime, setLastSaveTime] = useState(null);
    const [currentView, setCurrentView] = useState('workout');
    
    // États pour les exercices
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newSets, setNewSets] = useState('3');
    const [selectedDayForAdd, setSelectedDayForAdd] = useState('Lundi');
    const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState('Pectoraux');
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    
    // États pour le minuteur
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerIsRunning, setTimerIsRunning] = useState(false);
    const [timerIsFinished, setTimerIsFinished] = useState(false);
    const [showTimerModal, setShowTimerModal] = useState(false);
    const [timerPresets] = useState([30, 60, 90, 120, 180, 300]);
    
    // États pour l'historique et statistiques
    const [historicalData, setHistoricalData] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    
    // États pour l'undo/redo
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    
    // États pour l'analyse IA
    const [progressionAnalysisContent, setProgressionAnalysisContent] = useState('');
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    
    // Refs
    const timerRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    
    // Hook pour les notifications
    const { permission, requestPermission, showNotification } = useNotifications();

    // Fonction pour nettoyer les données
    const sanitizeWorkoutData = useCallback((data) => {
        const sanitized = { days: {} };
        
        DAYS.forEach(day => {
            sanitized.days[day] = {
                categories: {}
            };
            
            if (data?.days?.[day]?.categories) {
                CATEGORIES.forEach(category => {
                    const exercises = data.days[day].categories[category];
                    if (Array.isArray(exercises)) {
                        sanitized.days[day].categories[category] = exercises.map(exercise => ({
                            id: exercise.id || generateUniqueId(),
                            name: exercise.name || 'Exercice sans nom',
                            series: Array.isArray(exercise.series) ? exercise.series.map(serie => ({
                                id: serie.id || generateUniqueId(),
                                weight: serie.weight || '',
                                reps: serie.reps || '',
                                completed: Boolean(serie.completed)
                            })) : [],
                            isDeleted: Boolean(exercise.isDeleted),
                            notes: exercise.notes || ''
                        }));
                    }
                });
            }
        });
        
        return sanitized;
    }, []);

    // Fonction de sauvegarde optimisée
    const saveWorkoutsOptimized = useCallback(async (workoutsData, successMessage = "Sauvegardé automatiquement") => {
        if (!userId) {
            setToast({ message: "Utilisateur non connecté", type: 'error' });
            return;
        }
        
        // Annuler la sauvegarde précédente si en cours
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Sauvegarder après un délai pour éviter les sauvegardes multiples
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const workoutDocRef = doc(db, 'users', userId, 'workout', 'data');
                await setDoc(workoutDocRef, { 
                    workouts: workoutsData,
                    lastModified: serverTimestamp()
                }, { merge: true });
                
                const sessionsRef = collection(db, 'users', userId, 'sessions');
                await addDoc(sessionsRef, {
                    timestamp: serverTimestamp(),
                    workoutData: workoutsData,
                    version: '2.0'
                });
                
                setLastSaveTime(new Date());
                setToast({ message: successMessage, type: 'success' });
            } catch (error) {
                console.error("Erreur sauvegarde:", error);
                setToast({ 
                    message: "Erreur de sauvegarde", 
                    type: 'error',
                    action: { 
                        label: 'Réessayer', 
                        onClick: () => saveWorkoutsOptimized(workoutsData, successMessage) 
                    }
                });
            }
        }, AUTO_SAVE_DELAY);
    }, [userId]);

    // Fonction pour appliquer les changements avec undo/redo
    const applyChanges = useCallback((newWorkoutsState, message = "Modification effectuée") => {
        setUndoStack(prev => {
            const newStack = [...prev, workouts];
            return newStack.length > MAX_UNDO_STATES 
                ? newStack.slice(-MAX_UNDO_STATES) 
                : newStack;
        });
        setRedoStack([]);
        setWorkouts(newWorkoutsState);
        saveWorkoutsOptimized(newWorkoutsState, message);
    }, [workouts, saveWorkoutsOptimized]);

    // Fonction pour charger les données historiques
    const loadHistoricalData = useCallback(() => {
        if (!userId) return;
        
        try {
            const sessionsRef = collection(db, 'users', userId, 'sessions');
            const q = query(sessionsRef, orderBy('timestamp', 'desc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => {
                    const docData = doc.data();
                    const timestamp = docData.timestamp?.toDate ? docData.timestamp.toDate() : new Date();
                    
                    return {
                        id: doc.id,
                        timestamp,
                        workoutData: docData.workoutData
                    };
                }).filter(item => item.timestamp);
                
                setHistoricalData(data);
                calculatePersonalBests(data);
            });
            
            return unsubscribe;
        } catch (error) {
            console.error("Erreur chargement historique:", error);
            setToast({ message: "Erreur lors du chargement de l'historique", type: 'error' });
        }
    }, [userId]);

    // Fonction pour calculer les records personnels
    const calculatePersonalBests = useCallback((data) => {
        const bests = {};
        
        data.forEach(session => {
            const workoutData = session.workoutData;
            if (!workoutData?.days) return;
            
            Object.values(workoutData.days).forEach(day => {
                if (!day.categories) return;
                
                Object.values(day.categories).forEach(exercises => {
                    if (!Array.isArray(exercises)) return;
                    
                    exercises.forEach(exercise => {
                        if (!exercise.series || exercise.isDeleted) return;
                        
                        exercise.series.forEach(serie => {
                            const weight = parseFloat(serie.weight) || 0;
                            const reps = parseInt(serie.reps) || 0;
                            const volume = weight * reps;
                            
                            if (weight > 0 && reps > 0) {
                                const exerciseName = exercise.name;
                                
                                if (!bests[exerciseName] || weight > bests[exerciseName].maxWeight) {
                                    bests[exerciseName] = {
                                        maxWeight: weight,
                                        maxWeightReps: reps,
                                        maxVolume: volume,
                                        totalVolume: (bests[exerciseName]?.totalVolume || 0) + volume,
                                        lastUpdate: session.timestamp
                                    };
                                }
                                
                                if (volume > (bests[exerciseName]?.maxVolume || 0)) {
                                    bests[exerciseName].maxVolume = volume;
                                }
                                
                                bests[exerciseName].totalVolume = (bests[exerciseName]?.totalVolume || 0) + volume;
                            }
                        });
                    });
                });
            });
        });
        
        setPersonalBests(bests);
    }, []);

    // Fonctions du minuteur
    const startTimer = useCallback((seconds) => {
        setTimerSeconds(seconds);
        setTimerIsRunning(true);
        setTimerIsFinished(false);
        setShowTimerModal(true);
    }, []);
    
    const pauseTimer = useCallback(() => {
        setTimerIsRunning(prev => !prev);
    }, []);
    
    const stopTimer = useCallback(() => {
        setTimerIsRunning(false);
        setTimerSeconds(0);
        setTimerIsFinished(false);
        setShowTimerModal(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    // Fonctions d'undo/redo
    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) {
            setToast({ message: "Rien à annuler", type: 'warning' });
            return;
        }
        
        const previousState = undoStack[undoStack.length - 1];
        setRedoStack(prev => [...prev, workouts]);
        setWorkouts(previousState);
        setUndoStack(prev => prev.slice(0, -1));
        setToast({ message: "Action annulée", type: 'success' });
    }, [undoStack, workouts]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) {
            setToast({ message: "Rien à rétablir", type: 'warning' });
            return;
        }
        
        const nextState = redoStack[redoStack.length - 1];
        setUndoStack(prev => [...prev, workouts]);
        setWorkouts(nextState);
        setRedoStack(prev => prev.slice(0, -1));
        setToast({ message: "Action rétablie", type: 'success' });
    }, [redoStack, workouts]);

    // Fonction pour ajouter un exercice
    const handleAddExercise = useCallback(() => {
        if (!newExerciseName.trim()) {
            setToast({ message: "Le nom de l'exercice est requis", type: 'error' });
            return;
        }
        
        if (!selectedDayForAdd || !selectedCategoryForAdd) {
            setToast({ message: "Sélectionnez un jour et une catégorie", type: 'error' });
            return;
        }
        
        setIsAddingExercise(true);
        
        const setsNum = parseInt(newSets) || 1;
        const updatedWorkouts = { ...workouts };
        
        // S'assurer que la structure existe
        if (!updatedWorkouts.days[selectedDayForAdd]) {
            updatedWorkouts.days[selectedDayForAdd] = { categories: {} };
        }
        
        if (!updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd]) {
            updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd] = [];
        }
        
        const newExercise = {
            id: generateUniqueId(),
            name: newExerciseName.trim(),
            series: Array.from({ length: setsNum }, () => ({
                id: generateUniqueId(),
                weight: '',
                reps: '',
                completed: false
            })),
            isDeleted: false,
            notes: ''
        };
        
        updatedWorkouts.days[selectedDayForAdd].categories[selectedCategoryForAdd].push(newExercise);
        
        applyChanges(updatedWorkouts, `Exercice "${newExerciseName}" ajouté`);
        
        // Reset du formulaire
        setNewExerciseName('');
        setNewSets('3');
        setIsAddingExercise(false);
    }, [newExerciseName, selectedDayForAdd, selectedCategoryForAdd, newSets, workouts, applyChanges]);

    // Fonctions d'export/import
    const exportData = useCallback(() => {
        try {
            const dataToExport = {
                workouts,
                personalBests,
                historicalSample: historicalData.slice(0, 10),
                exportDate: new Date().toISOString(),
                version: "2.0",
                appName: "Carnet Muscu Pro"
            };
            
            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `carnet-muscu-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setToast({ message: "Données exportées avec succès !", type: 'success' });
        } catch (error) {
            console.error("Erreur export:", error);
            setToast({ message: "Erreur lors de l'export", type: 'error' });
        }
    }, [workouts, personalBests, historicalData]);

    const importData = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (importedData.workouts) {
                    const sanitizedWorkouts = sanitizeWorkoutData(importedData.workouts);
                    setWorkouts(sanitizedWorkouts);
                    saveWorkoutsOptimized(sanitizedWorkouts, "Données importées avec succès !");
                    
                    setToast({ 
                        message: "Import réussi !", 
                        type: 'success'
                    });
                } else {
                    setToast({ message: "Format de fichier invalide", type: 'error' });
                }
            } catch (error) {
                console.error("Erreur import:", error);
                setToast({ message: "Erreur lors de l'import", type: 'error' });
            }
        };
        reader.readAsText(file);
        
        // Reset input
        event.target.value = '';
    }, [sanitizeWorkoutData, saveWorkoutsOptimized]);

    // Calculs pour les statistiques
    const getWorkoutStats = useCallback(() => {
        if (!workouts?.days || !historicalData) {
            return {
                totalExercises: 0,
                totalSessions: 0,
                thisWeekSessions: 0,
                totalVolume: 0,
                averageSessionsPerWeek: 0
            };
        }

        let totalExercises = 0;
        try {
            Object.values(workouts.days).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        totalExercises += exercises.filter(ex => !ex.isDeleted).length;
                    }
                });
            });
        } catch (error) {
            console.warn("Erreur calcul exercices:", error);
            totalExercises = 0;
        }

        const totalSessions = historicalData.length || 0;
        
        let thisWeekSessions = 0;
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            thisWeekSessions = historicalData.filter(session => {
                return session.timestamp && session.timestamp > weekAgo;
            }).length;
        } catch (error) {
            console.warn("Erreur calcul sessions semaine:", error);
            thisWeekSessions = 0;
        }

        let totalVolume = 0;
        try {
            Object.values(personalBests || {}).forEach(best => {
                totalVolume += (best.totalVolume || 0);
            });
        } catch (error) {
            console.warn("Erreur calcul volume:", error);
            totalVolume = 0;
        }

        const averageSessionsPerWeek = totalSessions > 0 ? Math.round((totalSessions / 12) * 10) / 10 : 0;

        return {
            totalExercises,
            totalSessions,
            thisWeekSessions,
            totalVolume: Math.round(totalVolume),
            averageSessionsPerWeek
        };
    }, [workouts, historicalData, personalBests]);

    // Effets d'initialisation
    useEffect(() => {
        const initAuth = async () => {
            try {
                await signInAnonymously(auth);
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        setUserId(user.uid);
                        setIsAuthReady(true);
                    } else {
                        setLoading(false);
                        setToast({ 
                            message: "Erreur d'authentification", 
                            type: 'error',
                            action: { label: 'Réessayer', onClick: () => window.location.reload() }
                        });
                    }
                });
            } catch (error) {
                console.error("Erreur d'authentification:", error);
                setLoading(false);
                setToast({ message: "Erreur de connexion", type: 'error' });
            }
        };
        initAuth();
    }, []);
    
    // Effet pour charger les données
    useEffect(() => {
        if (!userId || !isAuthReady) return;

        const workoutDocRef = doc(db, 'users', userId, 'workout', 'data');
        const unsubscribe = onSnapshot(workoutDocRef, (doc) => {
            try {
                if (doc.exists()) {
                    const data = doc.data();
                    const sanitizedWorkouts = sanitizeWorkoutData(data.workouts || baseInitialData);
                    setWorkouts(sanitizedWorkouts);
                } else {
                    console.log("Aucune donnée trouvée, initialisation avec données de base");
                    setWorkouts(baseInitialData);
                }
            } catch (error) {
                console.error("Erreur traitement données:", error);
                setToast({ message: "Erreur lors du chargement des données", type: 'error' });
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("Erreur Firestore:", error);
            setToast({ message: `Erreur Firestore: ${error.message}`, type: 'error' });
            setLoading(false);
        });

        loadHistoricalData();
        return () => unsubscribe();
    }, [userId, isAuthReady, sanitizeWorkoutData, loadHistoricalData]);

    // Effet pour le minuteur
    useEffect(() => {
        if (timerIsRunning && timerSeconds > 0) {
            timerRef.current = setTimeout(() => {
                setTimerSeconds(prev => prev - 1);
            }, 1000);
        } else if (timerSeconds === 0 && timerIsRunning) {
            setTimerIsRunning(false);
            setTimerIsFinished(true);
            
            // Notifications
            showNotification('Temps de repos terminé !', {
                body: 'Prêt pour la prochaine série ?',
                tag: 'timer-finished'
            });
        }
        
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [timerIsRunning, timerSeconds, showNotification]);

    // Effet pour les raccourcis clavier
    useEffect(() => {
        const handleKeyPress = (event) => {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'z':
                        event.preventDefault();
                        if (event.shiftKey) {
                            handleRedo();
                        } else {
                            handleUndo();
                        }
                        break;
                    case 'y':
                        event.preventDefault();
                        handleRedo();
                        break;
                    case 's':
                        event.preventDefault();
                        saveWorkoutsOptimized(workouts, "Sauvegarde manuelle effectuée");
                        break;
                    case 'e':
                        event.preventDefault();
                        exportData();
                        break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [handleUndo, handleRedo, workouts, saveWorkoutsOptimized, exportData]);

    // Demande de permission pour les notifications
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            requestPermission();
        }
    }, [requestPermission]);

    // Nettoyage des timeouts
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    // Rendu du composant
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Interface principale */}
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-center mb-8">Carnet Muscu Pro</h1>
                
                {/* Navigation */}
                <div className="flex justify-center mb-8">
                    <div className="bg-gray-800 rounded-lg p-2">
                        <button
                            onClick={() => setCurrentView('workout')}
                            className={`px-4 py-2 rounded-md mr-2 ${
                                currentView === 'workout' ? 'bg-blue-600' : 'hover:bg-gray-700'
                            }`}
                        >
                            Séances
                        </button>
                        <button
                            onClick={() => setCurrentView('stats')}
                            className={`px-4 py-2 rounded-md mr-2 ${
                                currentView === 'stats' ? 'bg-blue-600' : 'hover:bg-gray-700'
                            }`}
                        >
                            Statistiques
                        </button>
                        <button
                            onClick={() => setCurrentView('history')}
                            className={`px-4 py-2 rounded-md ${
                                currentView === 'history' ? 'bg-blue-600' : 'hover:bg-gray-700'
                            }`}
                        >
                            Historique
                        </button>
                    </div>
                </div>

                {/* Contenu basé sur la vue actuelle */}
                {currentView === 'workout' && (
                    <div>
                        {/* Formulaire d'ajout d'exercice */}
                        <div className="bg-gray-800 rounded-lg p-6 mb-8">
                            <h2 className="text-xl font-semibold mb-4">Ajouter un exercice</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <input
                                    type="text"
                                    placeholder="Nom de l'exercice"
                                    value={newExerciseName}
                                    onChange={(e) => setNewExerciseName(e.target.value)}
                                    className="bg-gray-700 rounded-md px-3 py-2"
                                />
                                <select
                                    value={selectedDayForAdd}
                                    onChange={(e) => setSelectedDayForAdd(e.target.value)}
                                    className="bg-gray-700 rounded-md px-3 py-2"
                                >
                                    {DAYS.map(day => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                                <select
                                    value={selectedCategoryForAdd}
                                    onChange={(e) => setSelectedCategoryForAdd(e.target.value)}
                                    className="bg-gray-700 rounded-md px-3 py-2"
                                >
                                    {CATEGORIES.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Nombre de séries"
                                    value={newSets}
                                    onChange={(e) => setNewSets(e.target.value)}
                                    min="1"
                                    max="10"
                                    className="bg-gray-700 rounded-md px-3 py-2"
                                />
                            </div>
                            <button
                                onClick={handleAddExercise}
                                disabled={isAddingExercise || !newExerciseName.trim()}
                                className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-md"
                            >
                                {isAddingExercise ? 'Ajout...' : 'Ajouter l\'exercice'}
                            </button>
                        </div>

                        {/* Affichage des séances par jour */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {DAYS.map(day => (
                                <div key={day} className="bg-gray-800 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold mb-4">{day}</h3>
                                    {CATEGORIES.map(category => {
                                        const exercises = workouts?.days?.[day]?.categories?.[category] || [];
                                        const activeExercises = exercises.filter(ex => !ex.isDeleted);
                                        
                                        if (activeExercises.length === 0) return null;
                                        
                                        return (
                                            <div key={category} className="mb-4">
                                                <h4 className="text-blue-400 font-medium mb-2">{category}</h4>
                                                {activeExercises.map(exercise => (
                                                    <div key={exercise.id} className="bg-gray-700 rounded-md p-3 mb-2">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-medium">{exercise.name}</span>
                                                            <button
                                                                onClick={() => {
                                                                    const updatedWorkouts = { ...workouts };
                                                                    const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(ex => ex.id === exercise.id);
                                                                    if (exerciseIndex !== -1) {
                                                                        updatedWorkouts.days[day].categories[category][exerciseIndex].isDeleted = true;
                                                                        applyChanges(updatedWorkouts, `Exercice "${exercise.name}" supprimé`);
                                                                    }
                                                                }}
                                                                className="text-red-400 hover:text-red-300 text-sm"
                                                            >
                                                                Supprimer
                                                            </button>
                                                        </div>
                                                        <div className="text-sm text-gray-300">
                                                            {getSeriesDisplay(exercise.series)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                    {CATEGORIES.every(category => {
                                        const exercises = workouts?.days?.[day]?.categories?.[category] || [];
                                        return exercises.filter(ex => !ex.isDeleted).length === 0;
                                    }) && (
                                        <p className="text-gray-400 text-center py-4">Aucun exercice programmé</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Vue Statistiques */}
                {currentView === 'stats' && (
                    <div className="space-y-6">
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h2 className="text-xl font-semibold mb-4">Statistiques générales</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {(() => {
                                    const stats = getWorkoutStats();
                                    return (
                                        <>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-400">{stats.totalExercises}</div>
                                                <div className="text-sm text-gray-400">Exercices actifs</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-400">{stats.totalSessions}</div>
                                                <div className="text-sm text-gray-400">Sessions totales</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-yellow-400">{stats.thisWeekSessions}</div>
                                                <div className="text-sm text-gray-400">Cette semaine</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-purple-400">{stats.totalVolume}</div>
                                                <div className="text-sm text-gray-400">Volume total (kg)</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Records personnels */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h2 className="text-xl font-semibold mb-4">Records personnels</h2>
                            {Object.keys(personalBests).length === 0 ? (
                                <p className="text-gray-400 text-center py-4">Aucun record enregistré</p>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(personalBests).map(([exerciseName, best]) => (
                                        <div key={exerciseName} className="bg-gray-700 rounded-md p-3">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">{exerciseName}</span>
                                                <div className="text-sm text-gray-300">
                                                    Max: {best.maxWeight}kg × {best.maxWeightReps} reps
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Vue Historique */}
                {currentView === 'history' && (
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Historique des séances</h2>
                        {historicalData.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">Aucune séance enregistrée</p>
                        ) : (
                            <div className="space-y-3">
                                {historicalData.slice(0, 20).map(session => (
                                    <div key={session.id} className="bg-gray-700 rounded-md p-3">
                                        <div className="text-sm text-gray-300">
                                            {formatDate(session.timestamp)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Boutons d'action */}
                <div className="flex justify-center space-x-4 mt-8">
                    <button
                        onClick={() => startTimer(90)}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md"
                    >
                        Timer 90s
                    </button>
                    <button
                        onClick={exportData}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md"
                    >
                        Exporter
                    </button>
                    <label className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-md cursor-pointer">
                        Importer
                        <input
                            type="file"
                            accept=".json"
                            onChange={importData}
                            className="hidden"
                        />
                    </label>
                    <button
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-md"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-md"
                    >
                        Rétablir
                    </button>
                </div>
            </div>

            {/* Modal du minuteur */}
            {showTimerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4 text-center">
                            {timerIsFinished ? 'Temps écoulé !' : 'Minuteur'}
                        </h3>
                        <div className="text-center">
                            <div className={`text-4xl font-bold mb-4 ${timerIsFinished ? 'text-red-400' : 'text-blue-400'}`}>
                                {formatTime(timerSeconds)}
                            </div>
                            <div className="space-x-2">
                                {!timerIsFinished && (
                                    <button
                                        onClick={pauseTimer}
                                        className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-md"
                                    >
                                        {timerIsRunning ? 'Pause' : 'Reprendre'}
                                    </button>
                                )}
                                <button
                                    onClick={stopTimer}
                                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md"
                                >
                                    {timerIsFinished ? 'Fermer' : 'Arrêter'}
                                </button>
                            </div>
                            {timerIsFinished && (
                                <div className="mt-4">
                                    <p className="text-green-400 mb-2">Prêt pour la prochaine série ?</p>
                                    <div className="space-x-2">
                                        {timerPresets.map(seconds => (
                                            <button
                                                key={seconds}
                                                onClick={() => startTimer(seconds)}
                                                className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-sm"
                                            >
                                                {seconds}s
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Toast */}
            {toast && (
                <div className={`fixed bottom-4 right-4 max-w-sm w-full mx-4 p-4 rounded-lg shadow-lg z-50 animate-fade-in-up ${
                    toast.type === 'success' ? 'bg-green-600' :
                    toast.type === 'error' ? 'bg-red-600' :
                    toast.type === 'warning' ? 'bg-yellow-600' :
                    'bg-blue-600'
                }`}>
                    <div className="flex justify-between items-start">
                        <p className="text-white">{toast.message}</p>
                        <button
                            onClick={() => setToast(null)}
                            className="text-white/80 hover:text-white ml-2"
                        >
                            ×
                        </button>
                    </div>
                    {toast.action && (
                        <button
                            onClick={() => {
                                toast.action.onClick();
                                setToast(null);
                            }}
                            className="mt-2 text-white underline text-sm"
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
            )}

            {/* Informations de sauvegarde */}
            {lastSaveTime && (
                <div className="fixed bottom-4 left-4 text-xs text-gray-400">
                    Dernière sauvegarde: {lastSaveTime.toLocaleTimeString()}
                </div>
            )}

            {/* Styles CSS */}
            <style jsx>{`
                .animate-fade-in-up {
                    animation: fadeInUp 0.5s ease-out forwards;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .scrollbar-thin {
                    scrollbar-width: thin;
                    scrollbar-color: rgb(75 85 99) rgb(31 41 55);
                }

                .scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                }

                .scrollbar-thin::-webkit-scrollbar-track {
                    background: rgb(31 41 55);
                }

                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: rgb(75 85 99);
                    border-radius: 3px;
                }

                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: rgb(107 114 128);
                }
            `}</style>
        </div>
    );
}

export default App;