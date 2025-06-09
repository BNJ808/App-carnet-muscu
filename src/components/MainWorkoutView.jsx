import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
    BarChart3,
    Layers,
    Activity,
    Clock,
    Download,
    Upload,
    Undo2,
    Redo2
} from 'lucide-react';

const stableSort = (array, compareFunction) => {
    return array
        .map((item, index) => ({ item, index }))
        .sort((a, b) => compareFunction(a.item, b.item) || a.index - b.index)
        .map(({ item }) => item);
};

function MainWorkoutView({
    workouts,
    setWorkouts,
    onToggleSerieCompleted = () => { },
    onUpdateSerie = () => { },
    onAddSerie = () => { },
    onRemoveSerie = () => { },
    onUpdateExerciseNotes = () => { },
    onEditClick = () => { },
    onDeleteExercise = () => { },
    addDay = () => { },
    renameDay = () => { },
    deleteDay = () => { },
    moveDay = () => { },
    moveExercise = () => { },
    saveWorkoutSession = () => { },
    showToast = () => { },
    formatDate = () => { },
    getSeriesDisplay = () => { },
    isAdvancedMode,
    personalBests = {},
    startRestTimer = () => { },
    restTimeInput = '90',
    hasValidFirebaseConfig,
    saveStateToHistory = () => { }
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDayFilter, setSelectedDayFilter] = useState('all');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);
    const [expandedExercises, setExpandedExercises] = useState(new Set());
    const [editingExercise, setEditingExercise] = useState(null); // { dayKey, exerciseId, name, category }
    const [editingDay, setEditingDay] = useState(null); // { dayKey, name }
    const [exerciseMenuOpen, setExerciseMenuOpen] = useState(null); // { dayKey, exerciseId }
    const [dayMenuOpen, setDayMenuOpen] = useState(null); // { dayKey }

    // Catégories d'exercices prédéfinies
    const exerciseCategories = useMemo(() => [
        'Autre', 'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps',
        'Quadriceps', 'Ischio-jambiers', 'Mollets', 'Abdominaux', 'Cardio', 'Full Body'
    ], []);

    // Ferme tous les menus d'exercice et de jour lors d'un clic à l'extérieur
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exerciseMenuOpen && !event.target.closest('.exercise-menu')) {
                setExerciseMenuOpen(null);
            }
            if (dayMenuOpen && !event.target.closest('.day-menu')) {
                setDayMenuOpen(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [exerciseMenuOpen, dayMenuOpen]);

    const getAvailableDays = useCallback(() => {
        const filteredDays = workouts.dayOrder.filter(dayKey => {
            const day = workouts.days[dayKey];
            if (!day) return false;

            const exercises = day.exercises;

            // Filtrer les exercices en fonction du terme de recherche
            const filteredExercises = exercises.filter(ex => {
                const matchesSearch = searchTerm ?
                    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    ex.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    ex.notes?.toLowerCase().includes(searchTerm.toLowerCase())
                    : true;
                const matchesCategory = selectedCategoryFilter === 'all' || ex.category === selectedCategoryFilter;
                const matchesCompleted = !showOnlyCompleted || ex.series.every(s => s.completed); // Uniquement si toutes les séries de l'exercice sont complétées

                return matchesSearch && matchesCategory && matchesCompleted;
            });

            return filteredExercises.length > 0;
        });

        // Appliquer le filtre par jour (après les autres filtres pour s'assurer que les jours vides filtrés restent vides)
        return filteredDays.filter(dayKey => {
            if (selectedDayFilter === 'all') return true;
            return dayKey === selectedDayFilter;
        });

    }, [workouts, searchTerm, selectedDayFilter, selectedCategoryFilter, showOnlyCompleted]);

    const handleSaveWorkoutSession = useCallback((dayKey) => {
        const completedDay = {
            id: dayKey,
            name: workouts.days[dayKey].name,
            exercises: workouts.days[dayKey].exercises.map(ex => ({
                ...ex,
                series: ex.series.filter(s => s.completed && (s.reps > 0 || s.weight > 0))
            })).filter(ex => ex.series.length > 0)
        };

        if (completedDay.exercises.length === 0) {
            showToast('Aucune série complétée avec des valeurs pour cette séance.', 'warning');
            return;
        }
        saveWorkoutSession(completedDay);
    }, [workouts, saveWorkoutSession, showToast]);

    const handleStartEditExercise = useCallback((dayKey, exercise) => {
        setEditingExercise({ dayKey, exerciseId: exercise.id, name: exercise.name, category: exercise.category });
        setExerciseMenuOpen(null); // Fermer le menu après la sélection
    }, []);

    const handleConfirmEditExercise = useCallback(() => {
        if (editingExercise) {
            onEditClick(editingExercise.dayKey, editingExercise.exerciseId, editingExercise.name, editingExercise.category);
            setEditingExercise(null);
        }
    }, [editingExercise, onEditClick]);

    const handleStartEditDay = useCallback((dayKey) => {
        setEditingDay({ dayKey, name: workouts.days[dayKey].name });
        setDayMenuOpen(null); // Fermer le menu après la sélection
    }, [workouts]);

    const handleConfirmEditDay = useCallback(() => {
        if (editingDay) {
            renameDay(editingDay.dayKey, editingDay.name);
            setEditingDay(null);
        }
    }, [editingDay, renameDay]);

    const toggleExerciseExpansion = useCallback((exerciseId) => {
        setExpandedExercises(prev => {
            const newSet = new Set(prev);
            if (newSet.has(exerciseId)) {
                newSet.delete(exerciseId);
            } else {
                newSet.add(exerciseId);
            }
            return newSet;
        });
    }, []);

    const calculateExerciseVolume = useCallback((exercise) => {
        return exercise.series.reduce((total, serie) => total + (serie.weight || 0) * (serie.reps || 0), 0);
    }, []);

    // Fonctions pour gérer le drag and drop des jours
    const handleDragStartDay = (e, index) => {
        e.dataTransfer.setData("dayIndex", index);
    };

    const handleDropDay = (e, dropIndex) => {
        const dragIndex = parseInt(e.dataTransfer.getData("dayIndex"), 10);
        if (dragIndex === dropIndex) return;
        moveDay(dragIndex, dropIndex);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Nécessaire pour permettre le drop
    };

    // Fonctions pour gérer le drag and drop des exercices
    const handleDragStartExercise = (e, dayKey, index) => {
        e.dataTransfer.setData("dayKey", dayKey);
        e.dataTransfer.setData("exerciseIndex", index);
    };

    const handleDropExercise = (e, dayKey, dropIndex) => {
        const dragDayKey = e.dataTransfer.getData("dayKey");
        const dragExerciseIndex = parseInt(e.dataTransfer.getData("exerciseIndex"), 10);

        // Si l'exercice est déplacé dans le même jour
        if (dragDayKey === dayKey) {
            if (dragExerciseIndex === dropIndex) return;
            moveExercise(dayKey, dragExerciseIndex, dropIndex);
        } else {
            // Implémenter le déplacement entre jours si nécessaire, plus complexe
            showToast('Le déplacement d\'exercices entre jours n\'est pas encore supporté.', 'warning');
        }
    };

    // Rendu d'une carte d'exercice
    const renderExerciseCard = useCallback((dayKey, exercise, dayIndex, exerciseIndex) => {
        const isExpanded = expandedExercises.has(exercise.id);
        const bests = personalBests[exercise.name] || {};

        return (
            <div
                key={exercise.id}
                draggable={isAdvancedMode} // Rendre draggable uniquement en mode avancé
                onDragStart={(e) => handleDragStartExercise(e, dayKey, exerciseIndex)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropExercise(e, dayKey, exerciseIndex)}
                className={`bg-gray-700/50 rounded-lg shadow-md mb-3 last:mb-0 transition-all duration-200 ease-in-out ${isAdvancedMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
                <div
                    className="flex items-center justify-between p-3 cursor-pointer bg-gray-600/30 hover:bg-gray-600/50 rounded-t-lg"
                    onClick={() => toggleExerciseExpansion(exercise.id)}
                >
                    <h4 className="text-md font-semibold text-white flex items-center gap-2">
                        <Dumbbell className="h-5 w-5 text-purple-400" />
                        {exercise.name}
                        <span className="text-sm text-gray-400 font-normal">({exercise.category})</span>
                        <span className="text-xs ml-2 px-2 py-0.5 bg-blue-500/30 text-blue-300 rounded-full">
                            Volume: {calculateExerciseVolume(exercise)} kg
                        </span>
                    </h4>
                    <button
                        onClick={(e) => { e.stopPropagation(); setExerciseMenuOpen({ dayKey, exerciseId: exercise.id }); }}
                        className="p-1 rounded-full text-gray-400 hover:bg-gray-500 transition-colors relative z-10"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </button>
                    {exerciseMenuOpen && exerciseMenuOpen.dayKey === dayKey && exerciseMenuOpen.exerciseId === exercise.id && (
                        <div className="exercise-menu absolute right-2 mt-2 w-48 bg-gray-700 rounded-md shadow-lg py-1 z-20 border border-gray-600">
                            <button
                                onClick={() => handleStartEditExercise(dayKey, exercise)}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                            >
                                <Pencil className="h-4 w-4" /> Éditer l'exercice
                            </button>
                            <button
                                onClick={() => { saveStateToHistory(); onDeleteExercise(dayKey, exercise.id); setExerciseMenuOpen(null); }}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/50"
                            >
                                <Trash2 className="h-4 w-4" /> Supprimer l'exercice
                            </button>
                            <button
                                onClick={() => { showToast('Fonctionnalité Copier/Coller bientôt disponible !', 'info'); setExerciseMenuOpen(null); }}
                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                            >
                                <Copy className="h-4 w-4" /> Dupliquer l'exercice
                            </button>
                            {isAdvancedMode && (
                                <>
                                    <hr className="border-gray-600 my-1" />
                                    <button
                                        onClick={() => { showToast('Fonctionnalité Exporter bientôt disponible !', 'info'); setExerciseMenuOpen(null); }}
                                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                    >
                                        <Download className="h-4 w-4" /> Exporter Exercice
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {isExpanded && (
                    <div className="p-3 border-t border-gray-600">
                        {/* Notes de l'exercice */}
                        <div className="mb-3">
                            <label htmlFor={`notes-${exercise.id}`} className="block text-gray-400 text-xs font-medium mb-1 flex items-center gap-1">
                                <NotebookText className="h-4 w-4" /> Notes
                            </label>
                            <textarea
                                id={`notes-${exercise.id}`}
                                value={exercise.notes || ''}
                                onChange={(e) => onUpdateExerciseNotes(dayKey, exercise.id, e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm text-white placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                                rows="2"
                                placeholder="Ajouter des notes spécifiques à cet exercice..."
                            ></textarea>
                        </div>

                        {/* Séries de l'exercice */}
                        <div className="space-y-2">
                            {exercise.series.map((serie, serieIndex) => (
                                <div key={serie.id} className="flex items-center bg-gray-800 rounded-md p-2 border border-gray-600">
                                    <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                                        <span className="text-gray-300 text-sm font-medium">Série {serieIndex + 1}</span>
                                        <input
                                            type="number"
                                            value={serie.reps === null ? '' : serie.reps}
                                            onChange={(e) => onUpdateSerie(dayKey, exercise.id, serie.id, { reps: parseInt(e.target.value) || null })}
                                            placeholder="Reps"
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-white text-sm placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                                            inputMode="numeric"
                                        />
                                        <input
                                            type="number"
                                            value={serie.weight === null ? '' : serie.weight}
                                            onChange={(e) => onUpdateSerie(dayKey, exercise.id, serie.id, { weight: parseFloat(e.target.value) || null })}
                                            placeholder="Poids (kg)"
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-white text-sm placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                                            inputMode="decimal"
                                        />
                                    </div>
                                    <button
                                        onClick={() => { saveStateToHistory(); onToggleSerieCompleted(dayKey, exercise.id, serie.id); }}
                                        className={`ml-3 p-2 rounded-full ${serie.completed ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600 hover:bg-gray-500'} text-white transition-colors flex-shrink-0`}
                                        title={serie.completed ? "Démarquer comme non complétée" : "Marquer comme complétée"}
                                    >
                                        {serie.completed ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                                    </button>
                                    <button
                                        onClick={() => { saveStateToHistory(); onRemoveSerie(dayKey, exercise.id, serie.id); }}
                                        className="ml-2 p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors flex-shrink-0"
                                        title="Supprimer la série"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => { saveStateToHistory(); onAddSerie(dayKey, exercise.id); }}
                            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="h-5 w-5" /> Ajouter Série
                        </button>

                        {/* Best personnel pour l'exercice */}
                        {bests.maxWeight > 0 && (
                            <div className="mt-4 p-3 bg-gray-800 rounded-md text-sm text-gray-300 border border-gray-700">
                                <h5 className="font-semibold text-white mb-2 flex items-center gap-1">
                                    <Award className="h-4 w-4 text-yellow-300" /> Vos records pour cet exercice:
                                </h5>
                                <p>Max Poids: <span className="text-blue-300 font-bold">{bests.maxWeight} kg</span></p>
                                <p>Max 1 Rép (estimé): <span className="text-purple-300 font-bold">{bests.oneRepMax.toFixed(1)} kg</span></p>
                                <p>Meilleur Volume: <span className="text-green-300 font-bold">{bests.volume} kg</span></p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }, [expandedExercises, personalBests, onToggleSerieCompleted, onUpdateSerie, onAddSerie, onRemoveSerie, onUpdateExerciseNotes,
        onDeleteExercise, handleStartEditExercise, calculateExerciseVolume, exerciseMenuOpen, toggleExerciseExpansion,
        isAdvancedMode, saveStateToHistory, showToast]);

    const workoutDays = useMemo(() => {
        return stableSort(
            getAvailableDays().map(dayKey => ({ ...workouts.days[dayKey], id: dayKey })),
            (a, b) => workouts.dayOrder.indexOf(a.id) - workouts.dayOrder.indexOf(b.id)
        );
    }, [workouts, getAvailableDays]);

    return (
        <div className="container mx-auto p-4 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Dumbbell className="h-8 w-8 text-blue-400" />
                Mes Entraînements
            </h2>

            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Rechercher exercice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <select
                            value={selectedDayFilter}
                            onChange={(e) => setSelectedDayFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                            <option value="all">Tous les jours</option>
                            {workouts.dayOrder.map(dayKey => (
                                <option key={dayKey} value={dayKey}>{workouts.days[dayKey]?.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                            <option value="all">Toutes les catégories</option>
                            {exerciseCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex items-center justify-end">
                    <label htmlFor="show-completed" className="flex items-center text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            id="show-completed"
                            checked={showOnlyCompleted}
                            onChange={() => setShowOnlyCompleted(!showOnlyCompleted)}
                            className="mr-2 h-4 w-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                        />
                        <Check className="h-4 w-4 mr-1" /> Afficher seulement les exercices complétés
                    </label>
                </div>
            </div>

            {/* Modale d'édition d'exercice */}
            {editingExercise && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl border border-gray-700 transform animate-scale-in">
                        <h3 className="text-xl font-bold text-white mb-4">Éditer l'Exercice</h3>
                        <div className="mb-4">
                            <label htmlFor="edit-exercise-name" className="block text-gray-300 text-sm font-medium mb-2">Nom de l'exercice</label>
                            <input
                                type="text"
                                id="edit-exercise-name"
                                value={editingExercise.name}
                                onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="edit-exercise-category" className="block text-gray-300 text-sm font-medium mb-2">Catégorie</label>
                            <select
                                id="edit-exercise-category"
                                value={editingExercise.category}
                                onChange={(e) => setEditingExercise({ ...editingExercise, category: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 appearance-none"
                                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                            >
                                {exerciseCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setEditingExercise(null)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleConfirmEditExercise}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modale d'édition de jour */}
            {editingDay && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl border border-gray-700 transform animate-scale-in">
                        <h3 className="text-xl font-bold text-white mb-4">Éditer le Jour</h3>
                        <div className="mb-4">
                            <label htmlFor="edit-day-name" className="block text-gray-300 text-sm font-medium mb-2">Nom du jour</label>
                            <input
                                type="text"
                                id="edit-day-name"
                                value={editingDay.name}
                                onChange={(e) => setEditingDay({ ...editingDay, name: e.target.value })}
                                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setEditingDay(null)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleConfirmEditDay}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Liste des jours d'entraînement */}
            <div className="space-y-6">
                {workoutDays.map((day, dayIndex) => {
                    const filteredExercisesForDay = day.exercises.filter(ex => {
                        const matchesSearch = searchTerm ?
                            ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            ex.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            ex.notes?.toLowerCase().includes(searchTerm.toLowerCase())
                            : true;
                        const matchesCategory = selectedCategoryFilter === 'all' || ex.category === selectedCategoryFilter;
                        const matchesCompleted = !showOnlyCompleted || ex.series.every(s => s.completed);
                        return matchesSearch && matchesCategory && matchesCompleted;
                    });

                    if (filteredExercisesForDay.length === 0 && (searchTerm || selectedCategoryFilter !== 'all' || showOnlyCompleted)) {
                        return null; // Ne pas afficher le jour s'il n'a pas d'exercices correspondants aux filtres
                    }

                    return (
                        <div
                            key={day.id}
                            draggable={isAdvancedMode}
                            onDragStart={(e) => handleDragStartDay(e, dayIndex)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDropDay(e, dayIndex)}
                            className={`bg-gray-800 rounded-xl shadow-lg border border-gray-700 transition-all duration-300 ease-in-out ${isAdvancedMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                            <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-t-xl">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Calendar className="h-6 w-6 text-orange-400" />
                                    {day.name}
                                </h3>
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDayMenuOpen({ dayKey: day.id }); }}
                                        className="p-2 rounded-full text-gray-400 hover:bg-gray-600 transition-colors"
                                        aria-label="Options du jour"
                                    >
                                        <MoreVertical className="h-6 w-6" />
                                    </button>
                                    {dayMenuOpen && dayMenuOpen.dayKey === day.id && (
                                        <div className="day-menu absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg py-1 z-20 border border-gray-600">
                                            <button
                                                onClick={() => handleStartEditDay(day.id)}
                                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                            >
                                                <Pencil className="h-4 w-4" /> Renommer le jour
                                            </button>
                                            <button
                                                onClick={() => { saveStateToHistory(); deleteDay(day.id); setDayMenuOpen(null); }}
                                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/50"
                                            >
                                                <Trash2 className="h-4 w-4" /> Supprimer le jour
                                            </button>
                                            <button
                                                onClick={() => { showToast('Fonctionnalité Dupliquer bientôt disponible !', 'info'); setDayMenuOpen(null); }}
                                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                            >
                                                <Copy className="h-4 w-4" /> Dupliquer le jour
                                            </button>
                                            {isAdvancedMode && (
                                                <>
                                                    <hr className="border-gray-600 my-1" />
                                                    <button
                                                        onClick={() => { showToast('Fonctionnalité Exporter bientôt disponible !', 'info'); setDayMenuOpen(null); }}
                                                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                                                    >
                                                        <Download className="h-4 w-4" /> Exporter Jour
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="space-y-3 mb-4">
                                    {filteredExercisesForDay.length === 0 ? (
                                        <p className="text-gray-400 text-center py-4">Aucun exercice correspondant aux filtres.</p>
                                    ) : (
                                        stableSort(
                                            filteredExercisesForDay,
                                            (a, b) => day.exercises.indexOf(a) - day.exercises.indexOf(b)
                                        ).map((exercise, exerciseIndex) => renderExerciseCard(day.id, exercise, dayIndex, exerciseIndex))
                                    )}
                                </div>
                                <button
                                    onClick={() => { saveStateToHistory(); onAddSerie(day.id, Date.now()); }} // Ajoute un exercice temporaire pour la série
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
                                >
                                    <Plus className="h-5 w-5" /> Ajouter Exercice
                                </button>
                                <button
                                    onClick={() => handleSaveWorkoutSession(day.id)}
                                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                                >
                                    <History className="h-5 w-5" /> Sauvegarder Séance
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bouton pour ajouter un nouveau jour */}
            <button
                onClick={addDay}
                className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
            >
                <Plus className="h-5 w-5" /> Ajouter un nouveau jour d'entraînement
            </button>

            {/* Message si aucun résultat */}
            {(getAvailableDays().length === 0 && (searchTerm || selectedDayFilter || selectedCategoryFilter || showOnlyCompleted)) && (
                <div className="text-center py-8">
                    <div className="text-gray-400">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-gray-300 mb-2">Aucun exercice trouvé</h3>
                        <p className="text-gray-400">Essayez de modifier vos critères de recherche</p>
                    </div>
                </div>
            )}

            {/* Message si aucune donnée d'entraînement */}
            {workouts.dayOrder.length === 0 && (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700 mt-8">
                    <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Commencez votre entraînement !</p>
                    <p className="text-sm text-gray-500">
                        Cliquez sur "Ajouter Exercice" pour créer votre premier entraînement.
                    </p>
                </div>
            )}
        </div>
    );
}

export default MainWorkoutView;