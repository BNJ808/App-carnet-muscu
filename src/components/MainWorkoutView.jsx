// MainWorkoutView.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Search,
    Filter,
    Plus,
    Pencil,
    Trash2,
    NotebookText,
    Sparkles,
    LineChart as LineChartIcon,
    Calendar,
    Target,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    MoreVertical,
    Copy,
    History,
    TrendingUp,
    Dumbbell,
    Layers,
    Activity,
    Zap, // Added Zap for AI suggestions
    RotateCcw, // For AI generation spinner
    Undo2, Redo2,
    Settings,
    XCircle, // For clearing AI analysis
    CheckCircle,
    Download,
    Upload,
    Share,
    Eye, EyeOff, Maximize2, Minimize2,
    Award
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // Recharts for progression graph
import ExerciseSelector from './ExerciseSelector.jsx';

/**
 * Fonction pour un tri stable (préserve l'ordre relatif des éléments égaux).
 * @param {Array<object>} array - Le tableau à trier.
 * @param {function} compareFunction - La fonction de comparaison.
 * @returns {Array<object>} Le tableau trié de manière stable.
 */
const stableSort = (array, compareFunction) => {
    return array
        .map((item, index) => ({ item, index }))
        .sort((a, b) => compareFunction(a.item, b.item) || a.index - b.index)
        .map(({ item }) => item);
};

/**
 * Composant principal pour la vue d'entraînement.
 * @param {object} props - Les props du composant.
 * @param {object} props.workouts - L'objet des entraînements.
 * @param {function} props.setWorkouts - Fonction pour mettre à jour les entraînements.
 * @param {Array<object>} props.historicalData - Les données historiques des séances.
 * @param {function} props.setHistoricalData - Fonction pour mettre à jour les données historiques.
 * @param {object} props.personalBests - Les records personnels.
 * @param {function} props.setPersonalBests - Fonction pour mettre à jour les records personnels.
 * @param {function} props.formatDate - Fonction pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction pour afficher les séries d'un exercice.
 * @param {boolean} props.isAdvancedMode - Indique si le mode avancé est activé.
 * @param {function} props.analyzeProgressionWithAI - Fonction pour analyser la progression avec l'IA.
 * @param {string} props.progressionAnalysisContent - Le contenu de l'analyse de progression de l'IA.
 * @param {function} props.setProgressionAnalysisContent - Fonction pour définir le contenu de l'analyse de progression de l'IA.
 * @param {boolean} props.isLoadingAI - Indique si l'IA est en cours de chargement.
 * @param {function} props.showToast - Fonction pour afficher un toast.
 * @param {function} props.startTimer - Fonction pour démarrer le minuteur.
 * @param {function} props.setTimerSeconds - Fonction pour définir les secondes du minuteur.
 * @param {function} props.setCurrentView - Fonction pour changer la vue principale.
 */
function MainWorkoutView({
    workouts = { days: {}, dayOrder: [] },
    setWorkouts,
    historicalData = [],
    setHistoricalData,
    personalBests = {},
    setPersonalBests,
    formatDate,
    getSeriesDisplay,
    isAdvancedMode,
    analyzeProgressionWithAI,
    progressionAnalysisContent = '',
    setProgressionAnalysisContent,
    isLoadingAI = false,
    showToast,
    startTimer,
    setTimerSeconds,
    setCurrentView
}) {
    const today = useMemo(() => new Date().toISOString().split('T')[0], []); // 'YYYY-MM-DD'
    const [currentDay, setCurrentDay] = useState(today);
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [isExerciseSelectorOpen, setIsExerciseSelectorOpen] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [expandedExercise, setExpandedExercise] = useState(null); // L'ID de l'exercice actuellement étendu
    const [isEditingWorkoutName, setIsEditingWorkoutName] = useState(false);
    const [editedWorkoutName, setEditedWorkoutName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeletedExercises, setShowDeletedExercises] = useState(false); // État pour l'affichage des exercices supprimés
    const [isDraggingWorkout, setIsDraggingWorkout] = useState(false);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // États pour le drag and drop des exercices
    const [isDraggingExercise, setIsDraggingExercise] = useState(false);
    const dragExerciseItem = useRef(null); // {dayIndex, exerciseIndex}
    const dragOverExerciseItem = useRef(null); // {dayIndex, exerciseIndex}

    // États pour la gestion des exercices favoris et récents
    const [favoriteExercises, setFavoriteExercises] = useState([]);
    const [recentExercises, setRecentExercises] = useState([]);

    // Synchronisation des jours avec la date actuelle si nécessaire
    useEffect(() => {
        if (!workouts.days[today]) {
            setWorkouts(prevWorkouts => ({
                ...prevWorkouts,
                days: {
                    ...prevWorkouts.days,
                    [today]: prevWorkouts.days[today] || { name: 'Entraînement du jour', exercises: [] }
                },
                dayOrder: prevWorkouts.dayOrder.includes(today) ? prevWorkouts.dayOrder : [today, ...prevWorkouts.dayOrder]
            }));
        }
    }, [today, workouts, setWorkouts]);

    // Définir le nom de l'entraînement pour édition
    useEffect(() => {
        if (workouts.days[currentDay]) {
            setEditedWorkoutName(workouts.days[currentDay].name || 'Entraînement du jour');
        }
    }, [currentDay, workouts]);

    // Calculer les exercices récents basés sur l'historique
    useEffect(() => {
        const exerciseFrequency = {};
        
        // Compter la fréquence des exercices dans l'historique récent (30 derniers jours)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        historicalData
            .filter(session => {
                const sessionDate = typeof session.date.toDate === 'function' 
                    ? session.date.toDate() 
                    : new Date(session.date);
                return sessionDate >= thirtyDaysAgo;
            })
            .forEach(session => {
                session.exercises.forEach(exercise => {
                    if (!exercise.deleted) {
                        exerciseFrequency[exercise.name] = (exerciseFrequency[exercise.name] || 0) + 1;
                    }
                });
            });

        // Trier par fréquence et prendre les 10 plus récents
        const sortedExercises = Object.entries(exerciseFrequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([name]) => name);

        setRecentExercises(sortedExercises);
    }, [historicalData]);

    // Gestion des favoris
    const toggleFavoriteExercise = useCallback((exerciseName) => {
        setFavoriteExercises(prev => {
            if (prev.includes(exerciseName)) {
                return prev.filter(name => name !== exerciseName);
            } else {
                return [...prev, exerciseName];
            }
        });
    }, []);

    // Gestion de la sélection d'exercice depuis le sélecteur
    const handleSelectExercise = useCallback((exerciseName) => {
        // Ajouter l'exercice à l'entraînement du jour
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const newExercise = {
                    id: Date.now(), // ID unique pour l'exercice
                    name: exerciseName.trim(),
                    sets: [{ id: Date.now() + 1, reps: 0, weight: 0 }],
                    notes: '',
                    deleted: false // S'assurer qu'il n'est pas marqué comme supprimé
                };
                currentWorkout.exercises = [...currentWorkout.exercises, newExercise];
            } else {
                updatedDays[currentDay] = {
                    name: 'Entraînement du jour',
                    exercises: [{
                        id: Date.now(),
                        name: exerciseName.trim(),
                        sets: [{ id: Date.now() + 1, reps: 0, weight: 0 }],
                        notes: '',
                        deleted: false
                    }]
                };
                if (!prevWorkouts.dayOrder.includes(currentDay)) {
                    prevWorkouts.dayOrder = [currentDay, ...prevWorkouts.dayOrder];
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });

        // Mettre à jour les exercices récents (ajouter en premier)
        setRecentExercises(prev => {
            const filtered = prev.filter(name => name !== exerciseName);
            return [exerciseName, ...filtered].slice(0, 10);
        });

        showToast(`Exercice "${exerciseName}" ajouté !`, "success");
    }, [currentDay, setWorkouts, showToast]);

    // Mise à jour de l'historique quand une séance est marquée comme terminée
    const updateHistoricalData = useCallback((sessionId, sessionData) => {
        setHistoricalData(prevData => {
            // Supprimer l'ancienne entrée si elle existe (pour éviter les doublons en cas de réenregistrement)
            const filteredData = prevData.filter(session => session.id !== sessionId);
            const updatedData = [...filteredData, { ...sessionData, id: sessionId, date: sessionData.date || new Date() }];

            // Tri par date pour que l'historique soit toujours ordonné
            return updatedData.sort((a, b) => {
                const dateA = a.date instanceof Date ? a.date.getTime() : (a.date && typeof a.date.toDate === 'function' ? a.date.toDate().getTime() : new Date(a.date).getTime());
                const dateB = b.date instanceof Date ? b.date.getTime() : (b.date && typeof b.date.toDate === 'function' ? b.date.toDate().getTime() : new Date(b.date).getTime());
                return dateB - dateA; // Du plus récent au plus ancien
            });
        });
    }, [setHistoricalData]);

    const calculatePersonalBests = useCallback((exerciseName, sets) => {
        const newPBs = { ...personalBests };
        const currentExercisePB = newPBs[exerciseName] || { maxWeight: 0, maxReps: 0, weightForMaxReps: 0, maxRepsForWeight: 0, date: null };

        sets.forEach(set => {
            const { reps, weight } = set;

            // Calcul du PB pour le poids maximal (peu importe les reps)
            if (weight > currentExercisePB.maxWeight) {
                currentExercisePB.maxWeight = weight;
                currentExercisePB.maxReps = reps;
                currentExercisePB.date = new Date();
            } else if (weight === currentExercisePB.maxWeight && reps > currentExercisePB.maxReps) {
                currentExercisePB.maxReps = reps;
                currentExercisePB.date = new Date();
            }

            // Calcul du PB pour les reps maximales (pour un poids donné, ou toutes reps confondues)
            // Cette logique peut être plus complexe si on veut "max reps @ X kg"
            // Pour l'instant, on va prendre le max reps absolu ou pour un certain poids significatif
            if (reps > currentExercisePB.maxRepsForWeight && weight >= currentExercisePB.weightForMaxReps) {
                currentExercisePB.maxRepsForWeight = reps;
                currentExercisePB.weightForMaxReps = weight;
                currentExercisePB.date = new Date();
            }
        });

        newPBs[exerciseName] = currentExercisePB;
        setPersonalBests(newPBs);
    }, [personalBests, setPersonalBests]);

    // Ajouter un exercice avec l'ancien système (conservé pour compatibilité)
    const addExercise = useCallback(() => {
        if (newExerciseName.trim() === '') {
            showToast("Le nom de l'exercice ne peut pas être vide.", "warning");
            return;
        }
        handleSelectExercise(newExerciseName);
        setNewExerciseName('');
        setIsAddingExercise(false);
    }, [newExerciseName, handleSelectExercise, showToast]);

    const addSet = useCallback((exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    currentWorkout.exercises[exerciseIndex].sets.push({ id: Date.now(), reps: 0, weight: 0 });
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts]);

    const updateSet = useCallback((exerciseId, setId, field, value) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    const setIndex = currentWorkout.exercises[exerciseIndex].sets.findIndex(s => s.id === setId);
                    if (setIndex !== -1) {
                        currentWorkout.exercises[exerciseIndex].sets[setIndex][field] = Number(value);
                    }
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts]);

    const deleteSet = useCallback((exerciseId, setId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    currentWorkout.exercises[exerciseIndex].sets = currentWorkout.exercises[exerciseIndex].sets.filter(s => s.id !== setId);
                    // Si plus de séries, supprimer l'exercice
                    if (currentWorkout.exercises[exerciseIndex].sets.length === 0) {
                        currentWorkout.exercises = currentWorkout.exercises.filter(ex => ex.id !== exerciseId);
                    }
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts]);

    const deleteExercise = useCallback((exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                currentWorkout.exercises = currentWorkout.exercises.filter(ex => ex.id !== exerciseId);
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts]);

    const softDeleteExercise = useCallback((exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                currentWorkout.exercises = currentWorkout.exercises.map(ex =>
                    ex.id === exerciseId ? { ...ex, deleted: !ex.deleted } : ex
                );
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts]);

    const updateExerciseNotes = useCallback((exerciseId, notes) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    currentWorkout.exercises[exerciseIndex].notes = notes;
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts]);

    const toggleExpandExercise = useCallback((exerciseId) => {
        setExpandedExercise(prevId => (prevId === exerciseId ? null : exerciseId));
    }, []);

    const completeWorkout = useCallback(() => {
        const currentWorkoutData = workouts.days[currentDay];
        if (!currentWorkoutData || currentWorkoutData.exercises.length === 0) {
            showToast("Impossible de terminer : aucun exercice dans l'entraînement du jour.", "warning");
            return;
        }

        const sessionToAdd = {
            id: `session-${Date.now()}`,
            date: new Date(),
            notes: currentWorkoutData.notes || '',
            duration: currentWorkoutData.duration || null, // S'assurer que la durée est incluse
            exercises: currentWorkoutData.exercises
                .filter(ex => !ex.deleted) // N'ajouter que les exercices non supprimés à l'historique
                .map(ex => ({
                    name: ex.name,
                    sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight })),
                    notes: ex.notes || ''
                }))
        };

        if (sessionToAdd.exercises.length === 0) {
            showToast("Impossible de terminer : tous les exercices sont marqués comme supprimés ou aucun n'a été ajouté.", "warning");
            return;
        }

        updateHistoricalData(sessionToAdd.id, sessionToAdd);

        // Mettre à jour les records personnels
        sessionToAdd.exercises.forEach(ex => {
            calculatePersonalBests(ex.name, ex.sets);
        });

        // Vider l'entraînement du jour après complétion
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            updatedDays[currentDay] = { name: 'Entraînement du jour', exercises: [] };
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast("Séance terminée et ajoutée à l'historique !", "success");
    }, [workouts, currentDay, updateHistoricalData, calculatePersonalBests, setWorkouts, showToast]);

    const handleEditWorkoutName = useCallback(() => {
        if (editedWorkoutName.trim() === '') {
            showToast("Le nom de l'entraînement ne peut pas être vide.", "warning");
            return;
        }
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            if (updatedDays[currentDay]) {
                updatedDays[currentDay].name = editedWorkoutName.trim();
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        setIsEditingWorkoutName(false);
    }, [editedWorkoutName, currentDay, setWorkouts, showToast]);

    const handleDragStart = (e, position) => {
        dragItem.current = position;
        setIsDraggingWorkout(true);
    };

    const handleDragEnter = (e, position) => {
        dragOverItem.current = position;
    };

    const handleDrop = useCallback(() => {
        const dayOrder = [...workouts.dayOrder];
        const dragItemIndex = dragItem.current;
        const dragOverItemIndex = dragOverItem.current;

        if (dragItemIndex === null || dragOverItemIndex === null) {
            setIsDraggingWorkout(false);
            return;
        }

        // Réordonner dayOrder
        const [reorderedItem] = dayOrder.splice(dragItemIndex, 1);
        dayOrder.splice(dragOverItemIndex, 0, reorderedItem);

        setWorkouts(prevWorkouts => ({
            ...prevWorkouts,
            dayOrder: dayOrder
        }));

        dragItem.current = null;
        dragOverItem.current = null;
        setIsDraggingWorkout(false);
    }, [workouts, setWorkouts]);

    const handleDragEnd = () => {
        setIsDraggingWorkout(false);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    // Fonctions de glisser-déposer pour les exercices
    const handleExerciseDragStart = (e, dayId, exerciseId) => {
        dragExerciseItem.current = { dayId, exerciseId };
        setIsDraggingExercise(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", ""); // Required for Firefox
    };

    const handleExerciseDragEnter = (e, dayId, exerciseId) => {
        dragOverExerciseItem.current = { dayId, exerciseId };
    };

    const handleExerciseDrop = useCallback(() => {
        if (!dragExerciseItem.current || !dragOverExerciseItem.current) {
            setIsDraggingExercise(false);
            return;
        }

        const { dayId: sourceDayId, exerciseId: sourceExerciseId } = dragExerciseItem.current;
        const { dayId: targetDayId, exerciseId: targetExerciseId } = dragOverExerciseItem.current;

        setWorkouts(prevWorkouts => {
            const updatedWorkouts = { ...prevWorkouts };
            const sourceDay = updatedWorkouts.days[sourceDayId];
            const targetDay = updatedWorkouts.days[targetDayId];

            if (!sourceDay || !targetDay) return prevWorkouts;

            // Find the exercise to move
            const sourceExerciseIndex = sourceDay.exercises.findIndex(ex => ex.id === sourceExerciseId);
            if (sourceExerciseIndex === -1) return prevWorkouts;

            const [movedExercise] = sourceDay.exercises.splice(sourceExerciseIndex, 1);

            // Find the target index in the target day
            const targetExerciseIndex = targetDay.exercises.findIndex(ex => ex.id === targetExerciseId);

            if (sourceDayId === targetDayId) {
                // Moving within the same day
                targetDay.exercises.splice(targetExerciseIndex, 0, movedExercise);
            } else {
                // Moving to a different day
                targetDay.exercises.splice(targetExerciseIndex, 0, movedExercise);
            }

            return updatedWorkouts;
        });

        dragExerciseItem.current = null;
        dragOverExerciseItem.current = null;
        setIsDraggingExercise(false);
    }, [setWorkouts]);

    const handleExerciseDragEnd = () => {
        setIsDraggingExercise(false);
        dragExerciseItem.current = null;
        dragOverExerciseItem.current = null;
    };

    // Filtrer les exercices du jour actuel
    const currentWorkoutExercises = useMemo(() => {
        const exercises = workouts.days[currentDay]?.exercises || [];
        const filtered = showDeletedExercises
            ? exercises
            : exercises.filter(ex => !ex.deleted);

        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            return filtered.filter(ex =>
                ex.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                ex.notes.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }
        return filtered;
    }, [workouts, currentDay, searchTerm, showDeletedExercises]);

    // Fonction pour obtenir l'historique d'un exercice spécifique pour le graphique
    const getExerciseHistoryForGraph = useCallback((exerciseName) => {
        const history = [];
        historicalData.forEach(session => {
            const exerciseEntry = session.exercises.find(ex => ex.name === exerciseName && !ex.deleted);
            if (exerciseEntry) {
                // Pour le graphique de progression, nous voulons une métrique simple par séance, par exemple le volume total.
                const volume = exerciseEntry.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
                history.push({
                    date: typeof session.date.toDate === 'function' ? session.date.toDate().getTime() : new Date(session.date).getTime(), // Timestamp for Recharts
                    volume: volume,
                    sets: exerciseEntry.sets // Keep sets to pass to AI
                });
            }
        });
        // Trier par date croissante pour le graphique
        return history.sort((a, b) => a.date - b.date);
    }, [historicalData]);

    const getVolumeForExercise = useCallback((exercise) => {
        return exercise.sets.reduce((total, set) => total + (set.reps * set.weight), 0);
    }, []);

    const getEstimated1RM = useCallback((reps, weight) => {
        if (reps === 0 || weight === 0) return 0;
        // Brzycki formula
        return Math.round(weight * (36 / (37 - reps)));
    }, []);

    const renderWorkoutCard = useCallback((exercise, index) => {
        const isCurrentExerciseExpanded = expandedExercise === exercise.id;
        const exerciseHistory = getExerciseHistoryForGraph(exercise.name);
        const currentExercisePB = personalBests[exercise.name] || null;

        return (
            <div
                key={exercise.id}
                draggable={isAdvancedMode && !isAddingExercise} // Rendre l'exercice draggable en mode avancé
                onDragStart={(e) => handleExerciseDragStart(e, currentDay, exercise.id)}
                onDragEnter={(e) => handleExerciseDragEnter(e, currentDay, exercise.id)}
                onDragEnd={handleExerciseDragEnd}
                onDragOver={(e) => e.preventDefault()} // Nécessaire pour que le drop fonctionne
                onDrop={handleExerciseDrop} // Gérer le drop sur cet élément
                className={`bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700 shadow-md transition-all duration-200 ease-in-out ${exercise.deleted ? 'opacity-60 border-red-600' : ''} ${isDraggingExercise && dragExerciseItem.current?.exerciseId === exercise.id ? 'opacity-30 border-dashed border-blue-400' : ''}`}
            >
                <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => toggleExpandExercise(exercise.id)}
                >
                    <h3 className={`text-lg font-semibold ${exercise.deleted ? 'line-through text-red-300' : 'text-blue-400'} flex items-center gap-2`}>
                        <Dumbbell className="h-5 w-5" />
                        {exercise.name}
                        {exercise.deleted && <span className="text-xs text-red-300 ml-2">(Supprimé)</span>}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Vol: {getVolumeForExercise(exercise).toFixed(0)} kg</span>
                        {currentExercisePB && (
                            <div className="text-xs text-yellow-300 flex items-center gap-1">
                                <Award className="h-4 w-4" />
                                PB
                            </div>
                        )}
                        {isCurrentExerciseExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                </div>

                {isCurrentExerciseExpanded && (
                    <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
                        {exercise.sets.map((set, setIndex) => (
                            <div key={set.id} className="flex items-center bg-gray-700 p-2 rounded-md">
                                <span className="text-gray-300 font-medium w-12 flex-shrink-0">Série {setIndex + 1}:</span>
                                <input
                                    type="number"
                                    value={set.reps}
                                    onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)}
                                    className="w-16 bg-gray-600 text-white text-center rounded-md p-1 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                    aria-label={`Répétitions pour la série ${setIndex + 1}`}
                                />
                                <span className="text-gray-400">x</span>
                                <input
                                    type="number"
                                    value={set.weight}
                                    onChange={(e) => updateSet(exercise.id, set.id, 'weight', e.target.value)}
                                    className="w-20 bg-gray-600 text-white text-center rounded-md p-1 mx-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    step="2.5"
                                    min="0"
                                    aria-label={`Poids pour la série ${setIndex + 1}`}
                                />
                                <span className="text-gray-400">kg</span>
                                {set.reps > 0 && set.weight > 0 && (
                                    <span className="ml-auto text-sm text-gray-300">
                                        ~1RM: {getEstimated1RM(set.reps, set.weight).toFixed(0)}kg
                                    </span>
                                )}
                                <button
                                    onClick={() => deleteSet(exercise.id, set.id)}
                                    className="ml-2 text-red-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-600 transition-colors"
                                    aria-label="Supprimer la série"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => addSet(exercise.id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            <Plus className="h-5 w-5" /> Ajouter une série
                        </button>

                        <div className="mt-4">
                            <label htmlFor={`notes-${exercise.id}`} className="block text-gray-300 text-sm font-medium mb-1">Notes :</label>
                            <textarea
                                id={`notes-${exercise.id}`}
                                value={exercise.notes}
                                onChange={(e) => updateExerciseNotes(exercise.id, e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[60px]"
                                placeholder="Notes sur l'exercice (sensations, difficultés, etc.)"
                                rows="3"
                            ></textarea>
                        </div>

                        {isAdvancedMode && (
                            <div className="mt-4 flex flex-col gap-2">
                                <button
                                    onClick={() => softDeleteExercise(exercise.id)}
                                    className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${exercise.deleted ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white font-medium`}
                                >
                                    {exercise.deleted ? (
                                        <> <RotateCcw className="h-5 w-5" /> Réactiver l'exercice </>
                                    ) : (
                                        <> <Trash2 className="h-5 w-5" /> Supprimer l'exercice </>
                                    )}
                                </button>
                                {exerciseHistory.length > 1 && (
                                    <>
                                        <h6 className="text-md font-semibold text-white mb-2 flex items-center gap-2 mt-4">
                                            <LineChartIcon className="h-5 w-5 text-purple-400" /> Progression du volume
                                        </h6>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <LineChart data={exerciseHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                                <XAxis
                                                    dataKey="date"
                                                    type="number"
                                                    domain={['dataMin', 'dataMax']}
                                                    tickFormatter={(unixTime) => formatDate(new Date(unixTime))}
                                                    stroke="#999"
                                                    tick={{ fontSize: 10 }}
                                                    minTickGap={30}
                                                />
                                                <YAxis stroke="#999" tick={{ fontSize: 10 }} />
                                                <Tooltip labelFormatter={(label) => formatDate(new Date(label))} formatter={(value) => [`${value.toFixed(0)} kg`, 'Volume']} />
                                                <Line type="monotone" dataKey="volume" stroke="#8884d8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                        <button
                                            onClick={() => analyzeProgressionWithAI(exercise.name, exerciseHistory)}
                                            disabled={isLoadingAI}
                                            className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoadingAI ? (
                                                <RotateCcw className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <Sparkles className="h-4 w-4 mr-2" />
                                            )}
                                            Analyser la progression (IA)
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }, [expandedExercise, personalBests, isAdvancedMode, isAddingExercise, isDraggingExercise, currentDay, isLoadingAI, analyzeProgressionWithAI, deleteSet, updateSet, softDeleteExercise, updateExerciseNotes, toggleExpandExercise, getExerciseHistoryForGraph, getVolumeForExercise, getEstimated1RM, formatDate, handleExerciseDragStart, handleExerciseDragEnter, handleExerciseDragEnd, handleExerciseDrop]);

    const handleCopyPreviousWorkout = useCallback(() => {
        const previousDayIndex = workouts.dayOrder.indexOf(currentDay) + 1;
        if (previousDayIndex >= workouts.dayOrder.length) {
            showToast("Pas de séance précédente à copier.", "info");
            return;
        }

        const previousDay = workouts.dayOrder[previousDayIndex];
        const previousWorkoutData = workouts.days[previousDay];

        if (previousWorkoutData && previousWorkoutData.exercises.length > 0) {
            setWorkouts(prevWorkouts => {
                const updatedDays = { ...prevWorkouts.days };
                const copiedExercises = previousWorkoutData.exercises.map(ex => ({
                    ...ex,
                    id: Date.now() + Math.random(), // Nouvel ID
                    sets: ex.sets.map(s => ({ ...s, id: Date.now() + Math.random() + 100 })), // Nouveaux IDs pour les séries
                    deleted: false // S'assurer que les exercices copiés ne sont pas supprimés
                }));
                updatedDays[currentDay] = {
                    name: previousWorkoutData.name ? `Copie de ${previousWorkoutData.name}` : 'Entraînement du jour',
                    exercises: copiedExercises
                };
                return { ...prevWorkouts, days: updatedDays };
            });
            showToast("Séance précédente copiée avec succès !", "success");
        } else {
            showToast("La séance précédente est vide ou n'existe pas.", "warning");
        }
    }, [workouts, currentDay, setWorkouts, showToast]);

    // JSX de la vue principale
    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Dumbbell className="h-8 w-8 text-blue-400" /> Mon Entraînement
                </h2>
                <div className="flex items-center gap-2">
                    {/* Bouton pour copier la séance précédente */}
                    <button
                        onClick={handleCopyPreviousWorkout}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-medium px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                        aria-label="Copier la séance précédente"
                        title="Copier la séance du jour précédent"
                    >
                        <Copy className="h-4 w-4" /> Copier
                    </button>
                </div>
            </div>

            {/* Navigation et gestion des jours */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">
                        {isEditingWorkoutName ? (
                            <input
                                type="text"
                                value={editedWorkoutName}
                                onChange={(e) => setEditedWorkoutName(e.target.value)}
                                onBlur={handleEditWorkoutName}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleEditWorkoutName(); }}
                                className="bg-gray-700 text-white rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                aria-label="Éditer le nom de l'entraînement"
                            />
                        ) : (
                            <span onClick={() => setIsEditingWorkoutName(true)} className="cursor-pointer hover:text-blue-300 transition-colors flex items-center gap-2">
                                {workouts.days[currentDay]?.name || 'Entraînement du jour'} <Pencil className="h-4 w-4 text-gray-500" />
                            </span>
                        )}
                    </h3>
                    <p className="text-gray-400 text-sm">{formatDate(currentDay)}</p>
                </div>

                {isAdvancedMode && (
                    <div className="mb-4">
                        <label htmlFor="workout-notes" className="block text-gray-300 text-sm font-medium mb-1">Notes de la séance :</label>
                        <textarea
                            id="workout-notes"
                            value={workouts.days[currentDay]?.notes || ''}
                            onChange={(e) => setWorkouts(prev => ({
                                ...prev,
                                days: {
                                    ...prev.days,
                                    [currentDay]: {
                                        ...prev.days[currentDay],
                                        notes: e.target.value
                                    }
                                }
                            }))}
                            className="w-full bg-gray-700 text-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[60px]"
                            placeholder="Notes générales pour cette séance (humeur, énergie, etc.)"
                            rows="2"
                        ></textarea>

                        <label htmlFor="workout-duration" className="block text-gray-300 text-sm font-medium mb-1 mt-3">Durée de la séance (minutes) :</label>
                        <input
                            type="number"
                            id="workout-duration"
                            value={workouts.days[currentDay]?.duration || ''}
                            onChange={(e) => setWorkouts(prev => ({
                                ...prev,
                                days: {
                                    ...prev.days,
                                    [currentDay]: {
                                        ...prev.days[currentDay],
                                        duration: Number(e.target.value) || null
                                    }
                                }
                            }))}
                            className="w-full bg-gray-700 text-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 60"
                            min="0"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between mt-4 border-t border-gray-700 pt-4">
                    <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filtrer exercices..."
                            className="bg-gray-700 text-white rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {isAdvancedMode && (
                        <button
                            onClick={() => setShowDeletedExercises(prev => !prev)}
                            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm"
                        >
                            {showDeletedExercises ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            {showDeletedExercises ? 'Masquer Supprimés' : 'Afficher Supprimés'}
                        </button>
                    )}
                </div>
            </div>

            {/* Liste des exercices */}
            <div className="space-y-4">
                {currentWorkoutExercises.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">Aucun exercice pour aujourd'hui.</p>
                        <p className="text-sm text-gray-500">Ajoutez un exercice pour commencer votre entraînement !</p>
                    </div>
                ) : (
                    currentWorkoutExercises.map((exercise, index) => renderWorkoutCard(exercise, index))
                )}
            </div>

            {/* Ajouter un exercice */}
            <div className="bg-gray-800 rounded-lg p-4 mt-6 border border-gray-700 shadow-xl">
                {isAddingExercise ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newExerciseName}
                            onChange={(e) => setNewExerciseName(e.target.value)}
                            placeholder="Nom du nouvel exercice..."
                            className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => { if (e.key === 'Enter') addExercise(); }}
                            autoFocus
                            aria-label="Nom du nouvel exercice"
                        />
                        <button
                            onClick={addExercise}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors flex items-center gap-2"
                            aria-label="Ajouter l'exercice"
                        >
                            <Check className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setIsAddingExercise(false)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors flex items-center gap-2"
                            aria-label="Annuler l'ajout"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsExerciseSelectorOpen(true)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            aria-label="Choisir un exercice prédéfini"
                        >
                            <Dumbbell className="h-5 w-5" /> Choisir un exercice
                        </button>
                        <button
                            onClick={() => setIsAddingExercise(true)}
                            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            aria-label="Créer un exercice personnalisé"
                            title="Exercice personnalisé"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Bouton Terminer la séance */}
            <div className="mt-6">
                <button
                    onClick={completeWorkout}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg flex items-center justify-center gap-3 transition-colors text-lg"
                    aria-label="Terminer la séance"
                >
                    <CheckCircle className="h-6 w-6" /> Terminer la séance
                </button>
            </div>

            {/* Sélecteur d'exercices */}
            <ExerciseSelector
                isOpen={isExerciseSelectorOpen}
                onClose={() => setIsExerciseSelectorOpen(false)}
                onSelectExercise={handleSelectExercise}
                recentExercises={recentExercises}
                favoriteExercises={favoriteExercises}
                onToggleFavorite={toggleFavoriteExercise}
            />

            {/* Résultat de l'analyse IA */}
            {progressionAnalysisContent && (
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4 relative mb-4 mt-6">
                    <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-yellow-400" /> Analyse IA
                        <button
                            onClick={() => setProgressionAnalysisContent('')}
                            className="ml-auto text-gray-400 hover:text-white transition-colors"
                            aria-label="Effacer l'analyse IA"
                        >
                            <XCircle className="h-5 w-5" />
                        </button>
                    </h3>
                    <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                        {progressionAnalysisContent}
                    </div>
                    <div className="text-xs text-gray-400 mt-4">
                        💡 Cette analyse est générée par IA et doit être considérée comme un conseil général.
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainWorkoutView;