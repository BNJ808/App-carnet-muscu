import React, { useState, useMemo } from 'react';
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
    TrendingUp
} from 'lucide-react';

const stableSort = (array, compareFunction) => {
    return array
        .map((item, index) => ({ item, index }))
        .sort((a, b) => compareFunction(a.item, b.item) || a.index - b.index)
        .map(({ item }) => item);
};

function MainWorkoutView({
    workouts,
    onToggleSerieCompleted,
    onUpdateSerie,
    onAddSerie,
    onRemoveSerie,
    onUpdateExerciseNotes,
    onEditClick,
    onDeleteExercise,
    onAnalyzeProgression,
    searchTerm,
    onSearchChange,
    selectedDayFilter,
    onDayFilterChange,
    selectedCategoryFilter,
    onCategoryFilterChange,
    showOnlyCompleted,
    onToggleCompletedFilter,
    onAddExercise,
    onSaveToHistory,
    isCompactView = false,
    historicalData = []
}) {
    // États locaux pour l'interface
    const [expandedExercises, setExpandedExercises] = useState(new Set());
    const [editingNotes, setEditingNotes] = useState(null);
    const [tempNotes, setTempNotes] = useState('');
    const [editingSerie, setEditingSerie] = useState(null);
    const [tempWeight, setTempWeight] = useState('');
    const [tempReps, setTempReps] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Obtenir les jours disponibles
    const getAvailableDays = () => {
        return workouts?.dayOrder || Object.keys(workouts?.days || {});
    };

    // Obtenir les catégories pour un jour donné
    const getAvailableCategories = (dayName) => {
        if (!workouts?.days?.[dayName]?.categories) {
            return [];
        }
        
        return Object.keys(workouts.days[dayName].categories).filter(categoryName => {
            const exercises = workouts.days[dayName].categories[categoryName];
            return Array.isArray(exercises) && exercises.length > 0;
        });
    };

    // Obtenir toutes les catégories disponibles (pour le filtre global)
    const getAllCategories = () => {
        const categories = new Set();
        Object.values(workouts?.days || {}).forEach(day => {
            Object.keys(day.categories || {}).forEach(category => {
                categories.add(category);
            });
        });
        return Array.from(categories);
    };

    // Calculer les records personnels pour un exercice
    const getPersonalBest = (exerciseName) => {
        if (!historicalData.length) return null;

        let maxWeight = 0;
        let maxReps = 0;
        let maxVolume = 0;

        historicalData.forEach(session => {
            Object.values(session.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        const exercise = exercises.find(ex => ex.name === exerciseName);
                        if (exercise?.series) {
                            exercise.series.forEach(serie => {
                                if (serie.completed) {
                                    const weight = parseFloat(serie.weight) || 0;
                                    const reps = parseInt(serie.reps) || 0;
                                    const volume = weight * reps;

                                    if (weight > maxWeight) maxWeight = weight;
                                    if (reps > maxReps) maxReps = reps;
                                    if (volume > maxVolume) maxVolume = volume;
                                }
                            });
                        }
                    }
                });
            });
        });

        if (maxWeight === 0 && maxReps === 0) return null;

        return {
            maxWeight,
            maxReps,
            maxVolume
        };
    };

    // Basculer l'expansion d'un exercice
    const toggleExerciseExpansion = (exerciseId) => {
        const newExpanded = new Set(expandedExercises);
        if (newExpanded.has(exerciseId)) {
            newExpanded.delete(exerciseId);
        } else {
            newExpanded.add(exerciseId);
        }
        setExpandedExercises(newExpanded);
    };

    // Démarrer l'édition des notes
    const startEditingNotes = (exerciseId, currentNotes) => {
        setEditingNotes(exerciseId);
        setTempNotes(currentNotes || '');
    };

    // Sauvegarder les notes
    const saveNotes = (dayName, categoryName, exerciseId) => {
        if (onUpdateExerciseNotes) {
            onUpdateExerciseNotes(dayName, categoryName, exerciseId, tempNotes);
        }
        setEditingNotes(null);
        setTempNotes('');
    };

    // Annuler l'édition des notes
    const cancelEditingNotes = () => {
        setEditingNotes(null);
        setTempNotes('');
    };

    // Démarrer l'édition d'une série
    const startEditingSerie = (exerciseId, serieIndex, weight, reps) => {
        setEditingSerie(`${exerciseId}-${serieIndex}`);
        setTempWeight(weight.toString());
        setTempReps(reps.toString());
    };

    // Sauvegarder une série modifiée
    const saveSerie = (dayName, categoryName, exerciseId, serieIndex) => {
        if (onUpdateSerie) {
            onUpdateSerie(dayName, categoryName, exerciseId, serieIndex, tempWeight, tempReps);
        }
        setEditingSerie(null);
        setTempWeight('');
        setTempReps('');
    };

    // Annuler l'édition d'une série
    const cancelEditingSerie = () => {
        setEditingSerie(null);
        setTempWeight('');
        setTempReps('');
    };

    // Obtenir l'affichage des séries pour un exercice
    const getSeriesDisplay = (series) => {
        if (!series || series.length === 0) return "Aucune série";
        
        const completedSeries = series.filter(s => s.completed).length;
        const totalSeries = series.length;
        
        return `${completedSeries}/${totalSeries} séries terminées`;
    };

    // Calculer le volume total d'un exercice
    const getExerciseVolume = (series) => {
        if (!series) return 0;
        
        return series.reduce((total, serie) => {
            if (serie.completed) {
                const weight = parseFloat(serie.weight) || 0;
                const reps = parseInt(serie.reps) || 0;
                return total + (weight * reps);
            }
            return total;
        }, 0);
    };

    // Rendu d'une série individuelle
    const renderSerie = (serie, serieIndex, exerciseId, dayName, categoryName) => {
        const serieKey = `${exerciseId}-${serieIndex}`;
        const isEditing = editingSerie === serieKey;

        return (
            <div 
                key={serie.id || serieIndex} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    serie.completed 
                        ? 'bg-green-500/20 border border-green-500/30' 
                        : 'bg-gray-600/50 border border-gray-600/50'
                }`}
            >
                <span className="text-xs text-gray-400 w-8 text-center">
                    #{serieIndex + 1}
                </span>
                
                {isEditing ? (
                    <>
                        <div className="flex items-center gap-2 flex-1">
                            <input
                                type="number"
                                value={tempWeight}
                                onChange={(e) => setTempWeight(e.target.value)}
                                className="w-16 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
                                placeholder="kg"
                            />
                            <span className="text-gray-400 text-xs">×</span>
                            <input
                                type="number"
                                value={tempReps}
                                onChange={(e) => setTempReps(e.target.value)}
                                className="w-16 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
                                placeholder="reps"
                            />
                        </div>
                        
                        <div className="flex gap-1">
                            <button
                                onClick={() => saveSerie(dayName, categoryName, exerciseId, serieIndex)}
                                className="p-1 text-green-400 hover:text-green-300 transition-colors"
                                title="Sauvegarder"
                            >
                                <Check className="h-3 w-3" />
                            </button>
                            <button
                                onClick={cancelEditingSerie}
                                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                title="Annuler"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div 
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => startEditingSerie(exerciseId, serieIndex, serie.weight, serie.reps)}
                        >
                            <span className="text-sm font-medium text-white">
                                {serie.weight || '?'}kg
                            </span>
                            <span className="text-gray-400">×</span>
                            <span className="text-sm font-medium text-white">
                                {serie.reps || '?'}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">
                                ({((parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0))}kg)
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onToggleSerieCompleted?.(dayName, categoryName, exerciseId, serieIndex)}
                                className={`p-1.5 rounded transition-colors ${
                                    serie.completed 
                                        ? 'text-green-400 hover:text-green-300 bg-green-400/10' 
                                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-400/10'
                                }`}
                                title={serie.completed ? "Marquer comme non terminée" : "Marquer comme terminée"}
                            >
                                <Check className="h-4 w-4" />
                            </button>
                            
                            {serie.completed && (
                                <button
                                    onClick={() => onRemoveSerie?.(dayName, categoryName, exerciseId, serieIndex)}
                                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                    title="Supprimer la série"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    // Rendu d'un exercice
    const renderExercise = (exercise, dayName, categoryName) => {
        const personalBest = getPersonalBest(exercise.name);
        const isExpanded = expandedExercises.has(exercise.id);
        const isEditingNotesForThisExercise = editingNotes === exercise.id;
        const exerciseVolume = getExerciseVolume(exercise.series);

        // Filtrage par terme de recherche
        if (searchTerm && !exercise.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return null;
        }

        return (
            <div key={exercise.id} className={`bg-gray-700/50 rounded-xl border border-gray-600/50 transition-all hover:bg-gray-700/70 ${isCompactView ? 'p-3' : 'p-4'}`}>
                {/* En-tête de l'exercice */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white text-lg">{exercise.name}</h4>
                            <button
                                onClick={() => toggleExerciseExpansion(exercise.id)}
                                className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                                title={isExpanded ? "Réduire" : "Développer"}
                            >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                        </div>
                        
                        {personalBest && (
                            <div className="text-xs text-yellow-400 mb-2 flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                Record: {personalBest.maxWeight}kg × {personalBest.maxReps} reps 
                                <span className="text-gray-400">({personalBest.maxVolume}kg volume)</span>
                            </div>
                        )}

                        <div className="flex items-center gap-4 text-sm text-gray-300 mb-2">
                            <span>{getSeriesDisplay(exercise.series)}</span>
                            {exerciseVolume > 0 && (
                                <span className="text-blue-400">Volume: {exerciseVolume}kg</span>
                            )}
                        </div>

                        {/* Notes de l'exercice */}
                        {isEditingNotesForThisExercise ? (
                            <div className="mt-2">
                                <textarea
                                    value={tempNotes}
                                    onChange={(e) => setTempNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                                    placeholder="Ajouter des notes..."
                                    rows={3}
                                />
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={() => saveNotes(dayName, categoryName, exercise.id)}
                                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    >
                                        Sauvegarder
                                    </button>
                                    <button
                                        onClick={cancelEditingNotes}
                                        className="px-3 py-1 text-xs bg-gray-600 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        ) : (
                            exercise.notes && (
                                <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-600/30 rounded border-l-2 border-blue-500">
                                    📝 {exercise.notes}
                                </div>
                            )
                        )}
                    </div>
                    
                    {/* Menu d'actions */}
                    <div className="flex items-center gap-1 ml-3">
                        {/* Analyse IA */}
                        <button
                            onClick={() => onAnalyzeProgression?.(exercise)}
                            className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                            title="Analyser avec IA"
                        >
                            <Sparkles className="h-4 w-4" />
                        </button>
                        
                        {/* Graphique de progression */}
                        <button
                            onClick={() => console.log('Voir graphique de progression pour', exercise.name)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                            title="Voir graphique de progression"
                        >
                            <LineChartIcon className="h-4 w-4" />
                        </button>
                        
                        {/* Modifier les notes */}
                        <button
                            onClick={() => startEditingNotes(exercise.id, exercise.notes)}
                            className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded transition-colors"
                            title="Modifier les notes"
                        >
                            <NotebookText className="h-4 w-4" />
                        </button>
                        
                        {/* Modifier l'exercice */}
                        <button
                            onClick={() => onEditClick?.(dayName, categoryName, exercise.id, exercise)}
                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                            title="Modifier l'exercice"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        
                        {/* Supprimer l'exercice */}
                        <button
                            onClick={() => onDeleteExercise?.(dayName, categoryName, exercise.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                            title="Supprimer l'exercice"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Séries de l'exercice */}
                {isExpanded && (
                    <div className="space-y-2 mt-4">
                        {useMemo(() => {
    const sortedExercises = stableSort(activeExercises, (a, b) => {
        // Tri principal par createdAt (ordre d'ajout)
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
        }
        // Tri secondaire par nom si même date
        return a.name.localeCompare(b.name);
    });
    
    return sortedExercises.map(exercise => 
        renderExercise(exercise, dayName, categoryName)
    );
}, [activeExercises, dayName, categoryName])}
                                
                                {/* Bouton d'ajout de série */}
                                <button
                                    onClick={() => onAddSerie?.(dayName, categoryName, exercise.id)}
                                    className="w-full p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-gray-300 hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Ajouter une série
                                </button>
                            </>
                        ) } (
                            <div className="text-gray-400 text-sm italic text-center py-4">
                                Aucune série configurée
                            </div>
                        )}
                    </div>
                )}

                {/* Résumé compact quand l'exercice n'est pas développé */}
                {!isExpanded && exercise.series && exercise.series.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {exercise.series.slice(0, 4).map((serie, index) => (
                            <div 
                                key={serie.id || index}
                                className={`text-xs px-2 py-1 rounded ${
                                    serie.completed 
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                        : 'bg-gray-600/50 text-gray-300'
                                }`}
                            >
                                {serie.weight}kg × {serie.reps}
                            </div>
                        ))}
                        {exercise.series.length > 4 && (
                            <div className="text-xs px-2 py-1 rounded bg-gray-600/50 text-gray-400">
                                +{exercise.series.length - 4} autres
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Si pas de données
    if (!workouts?.days || Object.keys(workouts.days).length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                    <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-medium text-gray-300 mb-2">Aucun entraînement configuré</h3>
                    <p className="text-gray-400">Commencez par ajouter votre premier exercice !</p>
                </div>
                <button
                    onClick={onAddExercise}
                    className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                    <Plus className="h-5 w-5" />
                    Ajouter un exercice
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Recherche */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            placeholder="Rechercher un exercice..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                showFilters
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            <Filter className="h-4 w-4" />
                            Filtres
                        </button>

                        <button
                            onClick={onAddExercise}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Exercice
                        </button>

                        <button
                            onClick={onSaveToHistory}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                            title="Sauvegarder la séance dans l'historique"
                        >
                            <Calendar className="h-4 w-4" />
                            Historique
                        </button>
                    </div>
                </div>

                {/* Filtres étendus */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Filtre par jour */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Jour
                            </label>
                            <select
                                value={selectedDayFilter}
                                onChange={(e) => onDayFilterChange?.(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Tous les jours</option>
                                {getAvailableDays().map(day => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtre par catégorie */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Catégorie
                            </label>
                            <select
                                value={selectedCategoryFilter}
                                onChange={(e) => onCategoryFilterChange?.(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Toutes les catégories</option>
                                {getAllCategories().map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtre exercices terminés */}
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showOnlyCompleted}
                                    onChange={(e) => onToggleCompletedFilter?.(e.target.checked)}
                                    className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                                />
                                Exercices terminés uniquement
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Liste des jours et exercices */}
            <div className="space-y-6">
                {getAvailableDays().map(dayName => {
                    const day = workouts.days[dayName];
                    if (!day?.categories || Object.keys(day.categories).length === 0) {
                        return null;
                    }

                    const hasVisibleExercises = Object.values(day.categories).some(exercises => 
                        Array.isArray(exercises) && exercises.some(exercise => {
                            const matchesSearch = !searchTerm || 
                                exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
                            const matchesCompletion = !showOnlyCompleted || 
                                (exercise.series && exercise.series.some(serie => serie.completed));
                            const notDeleted = !exercise.isDeleted;
                            return matchesSearch && matchesCompletion && notDeleted;
                        })
                    );

                    if (!hasVisibleExercises) {
                        return null;
                    }

                    return (
                        <div key={dayName} className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
                            {/* En-tête du jour */}
                            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50 p-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-blue-400" />
                                        {dayName}
                                    </h2>
                                    
                                    <div className="text-sm text-gray-400">
                                        {Object.values(day.categories).reduce((total, exercises) => 
                                            total + (Array.isArray(exercises) ? exercises.filter(ex => !ex.isDeleted).length : 0), 0
                                        )} exercices
                                    </div>
                                </div>
                            </div>

                            {/* Contenu du jour */}
                            <div className="p-4">
                                {Object.entries(day.categories).map(([categoryName, exercises]) => {
                                    if (!Array.isArray(exercises) || exercises.length === 0) {
                                        return null;
                                    }

                                    const visibleExercises = exercises.filter(exercise => {
                                        const matchesSearch = !searchTerm || 
                                            exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
                                        const matchesCompletion = !showOnlyCompleted || 
                                            (exercise.series && exercise.series.some(serie => serie.completed));
                                        const notDeleted = !exercise.isDeleted;
                                        const matchesCategory = !selectedCategoryFilter || categoryName === selectedCategoryFilter;
                                        return matchesSearch && matchesCompletion && notDeleted && matchesCategory;
                                    });

                                    if (visibleExercises.length === 0) {
                                        return null;
                                    }

                                    return (
                                        <div key={categoryName} className="mb-6 last:mb-0">
                                            {/* En-tête de catégorie */}
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                                                    <TrendingUp className="h-4 w-4 text-green-400" />
                                                    {categoryName}
                                                </h3>
                                                <span className="text-sm text-gray-500">
                                                    {visibleExercises.length} exercices
                                                </span>
                                            </div>

                                            {/* Liste des exercices */}
                                            <div className="space-y-4">
                                                {visibleExercises.map(exercise => 
                                                    renderExercise(exercise, dayName, categoryName)
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Message si aucun résultat */}
            {getAvailableDays().length > 0 && (
                searchTerm || selectedDayFilter || selectedCategoryFilter || showOnlyCompleted
            ) && (
                <div className="text-center py-8">
                    <div className="text-gray-400">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-gray-300 mb-2">Aucun exercice trouvé</h3>
                        <p className="text-gray-400">Essayez de modifier vos critères de recherche</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MainWorkoutView;