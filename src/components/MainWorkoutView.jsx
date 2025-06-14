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
    Zap,
    RotateCcw,
    Undo2, Redo2,
    Settings,
    XCircle,
    CheckCircle,
    Download,
    Upload,
    Share,
    Eye, EyeOff, Maximize2, Minimize2,
    Award
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
    analyzeProgressionWithAI,
    progressionAnalysisContent = '',
    setProgressionAnalysisContent,
    isLoadingAI = false,
    showToast,
    startTimer,
    setTimerSeconds,
    setCurrentView,
    settings = {}
}) {
    const today = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [currentDay, setCurrentDay] = useState(today);
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [isExerciseSelectorOpen, setIsExerciseSelectorOpen] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [expandedExercise, setExpandedExercise] = useState(null);
    const [isEditingWorkoutName, setIsEditingWorkoutName] = useState(false);
    const [editedWorkoutName, setEditedWorkoutName] = useState('');
    const [isDraggingWorkout, setIsDraggingWorkout] = useState(false);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // États pour le drag and drop des exercices
    const [isDraggingExercise, setIsDraggingExercise] = useState(false);
    const dragExerciseItem = useRef(null);
    const dragOverExerciseItem = useRef(null);

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
                dayOrder: prevWorkouts.dayOrder.includes(today) ?
                    prevWorkouts.dayOrder : [...prevWorkouts.dayOrder, today]
            }));
        }
    }, [today, setWorkouts, workouts.days, workouts.dayOrder]);

    // Initialiser le nom d'édition du workout
    useEffect(() => {
        if (workouts.days[currentDay]) {
            setEditedWorkoutName(workouts.days[currentDay].name || 'Entraînement du jour');
        }
    }, [currentDay, workouts]);

    // Gestion des exercices favoris
    const toggleFavoriteExercise = useCallback((exerciseName) => {
        setFavoriteExercises(prev => {
            const updated = prev.includes(exerciseName)
                ? prev.filter(name => name !== exerciseName)
                : [...prev, exerciseName];
            return updated;
        });
    }, []);

    // Mise à jour des exercices récents
    const updateRecentExercises = useCallback((exerciseName) => {
        setRecentExercises(prev => {
            const filtered = prev.filter(name => name !== exerciseName);
            return [exerciseName, ...filtered].slice(0, 10);
        });
    }, []);

    // Fonction pour calculer l'estimation du 1RM
    const getEstimated1RM = useCallback((reps, weight) => {
        if (reps === 0 || weight === 0) return 0;
        // Brzycki formula
        return Math.round(weight * (36 / (37 - reps)));
    }, []);

    // Fonction pour obtenir le volume d'un exercice
    const getVolumeForExercise = useCallback((exercise) => {
        return exercise.sets.reduce((total, set) => total + (set.reps * set.weight), 0);
    }, []);

    const handleSelectExercise = useCallback((exerciseName) => {
        const exerciseId = Date.now();
        
        // Créer le nombre correct de séries selon les paramètres
        const defaultSets = settings.defaultSets || 3;
        const defaultReps = settings.defaultReps || 10;
        
        const sets = [];
        for (let i = 0; i < defaultSets; i++) {
            sets.push({ 
                id: Date.now() + i, 
                reps: defaultReps, 
                weight: '' 
            });
        }

        const newExercise = {
            id: exerciseId,
            name: exerciseName,
            sets: sets,
            notes: '',
            deleted: false
        };

        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay] || { name: 'Entraînement du jour', exercises: [] };
            currentWorkout.exercises.push(newExercise);
            updatedDays[currentDay] = currentWorkout;
            return { ...prevWorkouts, days: updatedDays };
        });

        updateRecentExercises(exerciseName);
        showToast(`Exercice "${exerciseName}" ajouté !`, "success");
        setIsExerciseSelectorOpen(false);
    }, [currentDay, setWorkouts, updateRecentExercises, showToast, settings]);

    const deleteExercise = useCallback((exerciseId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    currentWorkout.exercises[exerciseIndex].deleted = true;
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
        showToast("Exercice supprimé.", "info");
    }, [currentDay, setWorkouts, showToast]);

    const deleteSet = useCallback((exerciseId, setId) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    currentWorkout.exercises[exerciseIndex].sets = 
                        currentWorkout.exercises[exerciseIndex].sets.filter(set => set.id !== setId);
                }
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

    const updateHistoricalData = useCallback((exerciseName, sets) => {
        const newSessionData = {
            date: new Date(),
            exercises: [{
                name: exerciseName,
                sets: sets.filter(set => set.reps > 0 && set.weight > 0),
                deleted: false
            }]
        };

        setHistoricalData(prevData => {
            const updatedData = [...prevData, newSessionData];
            return updatedData.sort((a, b) => {
                const dateA = a.date instanceof Date ? a.date.getTime() : (a.date && typeof a.date.toDate === 'function' ? a.date.toDate().getTime() : new Date(a.date).getTime());
                const dateB = b.date instanceof Date ? b.date.getTime() : (b.date && typeof b.date.toDate === 'function' ? b.date.toDate().getTime() : new Date(b.date).getTime());
                return dateB - dateA;
            });
        });
    }, [setHistoricalData]);

    const calculatePersonalBests = useCallback((exerciseName, sets) => {
        const newPBs = { ...personalBests };
        const currentExercisePB = newPBs[exerciseName] || { maxWeight: 0, maxReps: 0, weightForMaxReps: 0, maxRepsForWeight: 0, date: null };

        sets.forEach(set => {
            const { reps, weight } = set;

            if (weight > currentExercisePB.maxWeight) {
                currentExercisePB.maxWeight = weight;
                currentExercisePB.maxReps = reps;
                currentExercisePB.date = new Date();
            } else if (weight === currentExercisePB.maxWeight && reps > currentExercisePB.maxReps) {
                currentExercisePB.maxReps = reps;
                currentExercisePB.date = new Date();
            }

            if (reps > currentExercisePB.maxRepsForWeight && weight >= currentExercisePB.weightForMaxReps) {
                currentExercisePB.maxRepsForWeight = reps;
                currentExercisePB.weightForMaxReps = weight;
                currentExercisePB.date = new Date();
            }
        });

        newPBs[exerciseName] = currentExercisePB;
        setPersonalBests(newPBs);
    }, [personalBests, setPersonalBests]);

    // Ajouter un exercice avec l'ancien système
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
                    currentWorkout.exercises[exerciseIndex].sets.push({ 
                        id: Date.now(), 
                        reps: settings.defaultReps || 10, 
                        weight: '' 
                    });
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts, settings]);

    const updateSet = useCallback((exerciseId, setId, field, value) => {
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            const currentWorkout = updatedDays[currentDay];
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    const setIndex = currentWorkout.exercises[exerciseIndex].sets.findIndex(set => set.id === setId);
                    if (setIndex !== -1) {
                        // Pour les champs numériques, conserver la valeur vide si elle est vide
                        if (field === 'weight' || field === 'reps') {
                            currentWorkout.exercises[exerciseIndex].sets[setIndex][field] = value;
                        } else {
                            currentWorkout.exercises[exerciseIndex].sets[setIndex][field] = value;
                        }
                    }
                }
            }
            return { ...prevWorkouts, days: updatedDays };
        });
    }, [currentDay, setWorkouts]);

    const completeWorkout = useCallback(() => {
        const currentWorkout = workouts.days[currentDay];
        if (!currentWorkout || currentWorkout.exercises.length === 0) {
            showToast("Aucun exercice à enregistrer.", "warning");
            return;
        }

        const validExercises = currentWorkout.exercises.filter(exercise => 
            !exercise.deleted && exercise.sets.some(set => set.reps > 0 && parseFloat(set.weight) > 0)
        );

        if (validExercises.length === 0) {
            showToast("Aucun exercice valide à enregistrer.", "warning");
            return;
        }

        // Enregistrer les données historiques et calculer les PBs
        validExercises.forEach(exercise => {
            const validSets = exercise.sets.filter(set => set.reps > 0 && parseFloat(set.weight) > 0);
            if (validSets.length > 0) {
                updateHistoricalData(exercise.name, validSets);
                calculatePersonalBests(exercise.name, validSets);
            }
        });

        // Réinitialiser la séance actuelle
        setWorkouts(prevWorkouts => {
            const updatedDays = { ...prevWorkouts.days };
            updatedDays[currentDay] = {
                name: 'Entraînement du jour',
                exercises: [],
                notes: '',
                duration: null
            };
            return { ...prevWorkouts, days: updatedDays };
        });

        // Réinitialiser les états locaux
        setExpandedExercise(null);
        setIsAddingExercise(false);
        setNewExerciseName('');
        setProgressionAnalysisContent('');

        showToast("Séance terminée et enregistrée ! Nouvelle séance prête.", "success");
    }, [workouts, currentDay, updateHistoricalData, calculatePersonalBests, setWorkouts, showToast, setProgressionAnalysisContent]);

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
        e.dataTransfer.setData("text/plain", "");
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

            const sourceExerciseIndex = sourceDay.exercises.findIndex(ex => ex.id === sourceExerciseId);
            if (sourceExerciseIndex === -1) return prevWorkouts;

            const [movedExercise] = sourceDay.exercises.splice(sourceExerciseIndex, 1);
            const targetExerciseIndex = targetDay.exercises.findIndex(ex => ex.id === targetExerciseId);

            if (sourceDayId === targetDayId) {
                targetDay.exercises.splice(targetExerciseIndex, 0, movedExercise);
            } else {
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
        return exercises.filter(ex => !ex.deleted);
    }, [workouts, currentDay]);

    // Fonction pour obtenir l'historique d'un exercice spécifique pour le graphique
    const getExerciseHistoryForGraph = useCallback((exerciseName) => {
        const history = [];
        historicalData.forEach(session => {
            const exerciseEntry = session.exercises.find(ex => ex.name === exerciseName && !ex.deleted);
            if (exerciseEntry) {
                const volume = exerciseEntry.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
                history.push({
                    date: typeof session.date.toDate === 'function' ?
                        session.date.toDate() : new Date(session.date),
                    volume: volume,
                    maxWeight: Math.max(...exerciseEntry.sets.map(set => set.weight)),
                    sets: exerciseEntry.sets
                });
            }
        });
        return history.sort((a, b) => a.date - b.date);
    }, [historicalData]);

    // Formater la date pour l'affichage
    const formatDisplayDate = useCallback((dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }, []);

    // Fonction pour rendre une carte d'exercice
    const renderWorkoutCard = useCallback((exercise, index) => {
        const isCurrentExerciseExpanded = expandedExercise === exercise.id;
        const currentExercisePB = personalBests[exercise.name];

        return (
            <div 
                key={exercise.id} 
                className="bg-gray-800 border-gray-700 rounded-lg p-4 border shadow-xl"
                draggable
                onDragStart={(e) => handleExerciseDragStart(e, currentDay, exercise.id)}
                onDragEnter={(e) => handleExerciseDragEnter(e, currentDay, exercise.id)}
                onDragEnd={handleExerciseDragEnd}
                style={{ opacity: isDraggingExercise ? 0.7 : 1 }}
            >
                <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedExercise(isCurrentExerciseExpanded ? null : exercise.id)}
                >
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-blue-400">{exercise.name}</h3>
                        {exercise.notes && (
                            <NotebookText className="h-4 w-4 text-blue-400" title="Contient des notes" />
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteExercise(exercise.id);
                            }}
                            className="p-1 rounded-full transition-colors text-red-400 hover:text-red-500 hover:bg-gray-600"
                            aria-label="Supprimer l'exercice"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const history = getExerciseHistoryForGraph(exercise.name);
                                if (history.length > 0) {
                                    analyzeProgressionWithAI(exercise.name, history);
                                } else {
                                    showToast("Pas assez de données pour analyser la progression.", "info");
                                }
                            }}
                            disabled={isLoadingAI}
                            className="p-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-110"
                            title="Analyser cet exercice avec l'IA"
                            aria-label={`Analyser l'exercice ${exercise.name} avec l'IA`}
                        >
                            {isLoadingAI ? (
                                <RotateCcw className="h-4 w-4 text-white animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4 text-white" />
                            )}
                        </button>
                        
                        {settings.showVolume && (
                            <span className="text-sm text-gray-400">
                                Vol: {getVolumeForExercise(exercise).toFixed(0)} kg
                            </span>
                        )}
                        
                        {currentExercisePB && (
                            <div className="text-xs flex items-center gap-1 text-yellow-300">
                                <Award className="h-4 w-4" />
                                PB
                            </div>
                        )}
                        
                        {isCurrentExerciseExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                    </div>
                </div>

                {isCurrentExerciseExpanded && (
                    <div className="mt-4 border-t pt-4 space-y-3 border-gray-700">
                        {exercise.sets.map((set, setIndex) => (
                            <div key={set.id} className="flex items-center p-2 rounded-md bg-gray-700">
                                <span className="font-medium w-12 flex-shrink-0 text-gray-300">
                                    Série {setIndex + 1}:
                                </span>
                                <input
                                    type="number"
                                    value={set.reps}
                                    onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)}
                                    className="w-16 text-center rounded-md p-1 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white border-gray-500"
                                    min="0"
                                    placeholder="Reps"
                                    aria-label={`Répétitions pour la série ${setIndex + 1}`}
                                />
                                <span className="text-gray-400">x</span>
                                <input
                                    type="number"
                                    value={set.weight}
                                    onChange={(e) => updateSet(exercise.id, set.id, 'weight', e.target.value)}
                                    className="w-20 text-center rounded-md p-1 mx-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-600 text-white border-gray-500"
                                    step="0.5"
                                    min="0"
                                    placeholder="Poids"
                                    aria-label={`Poids pour la série ${setIndex + 1}`}
                                />
                                <span className="text-gray-400">kg</span>
                                
                                {settings.showEstimated1RM && set.reps > 0 && parseFloat(set.weight) > 0 && (
                                    <span className="ml-auto text-sm text-gray-300">
                                        ~1RM: {getEstimated1RM(set.reps, parseFloat(set.weight)).toFixed(0)}kg
                                    </span>
                                )}
                                
                                <button
                                    onClick={() => deleteSet(exercise.id, set.id)}
                                    className="ml-2 p-1 rounded-full transition-colors text-red-400 hover:text-red-500 hover:bg-gray-600"
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
                            <label htmlFor={`notes-${exercise.id}`} className="block text-sm font-medium mb-1 text-gray-300">Notes :</label>
                            <textarea
                                id={`notes-${exercise.id}`}
                                value={exercise.notes}
                                onChange={(e) => updateExerciseNotes(exercise.id, e.target.value)}
                                className="w-full rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[60px] bg-gray-700 text-white border-gray-600"
                                placeholder="Notes sur l'exercice (sensations, difficultés, etc.)"
                                rows="2"
                            ></textarea>
                        </div>
                    </div>
                )}
            </div>
        );
    }, [expandedExercise, personalBests, currentDay, handleExerciseDragStart, handleExerciseDragEnter, handleExerciseDragEnd, isDraggingExercise, deleteExercise, getExerciseHistoryForGraph, analyzeProgressionWithAI, isLoadingAI, showToast, settings, getVolumeForExercise, getEstimated1RM, updateSet, deleteSet, addSet, updateExerciseNotes]);

    // JSX de la vue principale
    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold flex items-center gap-3 text-white">
                    <Dumbbell className="h-8 w-8 text-blue-400" /> 
                    Mon Entraînement
                </h2>
            </div>

            {/* Navigation et gestion des jours */}
            <div className="bg-gray-800 border-gray-700 rounded-lg p-4 mb-6 border shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">
                        {isEditingWorkoutName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={editedWorkoutName}
                                    onChange={(e) => setEditedWorkoutName(e.target.value)}
                                    className="bg-gray-700 text-white rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleEditWorkoutName(); }}
                                    autoFocus
                                />
                                <button
                                    onClick={handleEditWorkoutName}
                                    className="text-green-400 hover:text-green-300 transition-colors"
                                >
                                    <Check className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => setIsEditingWorkoutName(false)}
                                    className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {workouts.days[currentDay]?.name || 'Entraînement du jour'}
                                <button
                                    onClick={() => setIsEditingWorkoutName(true)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </h3>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-300">
                        <Calendar className="h-4 w-4 inline mr-2" />
                        {formatDisplayDate(currentDay)}
                    </div>
                </div>

                <div className="mb-4">
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
                        className="w-full rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[60px] bg-gray-700 text-white border-gray-600"
                        placeholder="Notes générales sur cette séance d'entraînement..."
                        rows="2"
                    ></textarea>

                    <label htmlFor="workout-duration" className="block text-sm font-medium mb-1 mt-3 text-gray-300">Durée de la séance (minutes) :</label>
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
                        className="w-full rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white border-gray-600"
                        placeholder="Ex: 60"
                        min="0"
                    />
                </div>
            </div>

            {/* Liste des exercices */}
            <div className="space-y-4">
                {currentWorkoutExercises.length === 0 ? (
                    <div className="bg-gray-800 border-gray-700 rounded-lg p-8 text-center border">
                        <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="mb-2 text-gray-400">Aucun exercice pour aujourd'hui.</p>
                        <p className="text-sm text-gray-500">Ajoutez un exercice pour commencer votre entraînement !</p>
                    </div>
                ) : (
                    currentWorkoutExercises.map((exercise, index) => renderWorkoutCard(exercise, index))
                )}
            </div>

            {/* Ajouter un exercice */}
            <div className="bg-gray-800 border-gray-700 rounded-lg p-4 mt-6 border shadow-xl">
                {isAddingExercise ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newExerciseName}
                            onChange={(e) => setNewExerciseName(e.target.value)}
                            placeholder="Nom du nouvel exercice..."
                            className="flex-1 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white border-gray-600"
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
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20 border rounded-lg p-4 relative mb-4 mt-6">
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-white">
                        <Sparkles className="h-6 w-6 text-yellow-400" /> 
                        Analyse IA
                        <button
                            onClick={() => setProgressionAnalysisContent('')}
                            className="ml-auto transition-colors text-gray-400 hover:text-white"
                            aria-label="Effacer l'analyse IA"
                        >
                            <XCircle className="h-5 w-5" />
                        </button>
                    </h3>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-white">
                        {progressionAnalysisContent}
                    </div>
                    <div className="text-xs mt-4 text-gray-400">
                        💡 Cette analyse est générée par IA et doit être considérée comme un conseil général.
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainWorkoutView;