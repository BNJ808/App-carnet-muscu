import React, { useState, useMemo, useCallback } from 'react'; 
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
    Layers 
} from 'lucide-react';

const stableSort = (array, compareFunction) => {
    return array
        .map((item, index) => ({ item, index }))
        .sort((a, b) => compareFunction(a.item, b.item) || a.index - b.index)
        .map(({ item }) => item);
};

function MainWorkoutView({
    workouts,
    onToggleSerieCompleted = () => {}, // Default empty function
    onUpdateSerie = () => {}, // Default empty function
    onAddSerie = () => {}, // Default empty function
    onRemoveSerie = () => {}, // Default empty function
    onUpdateExerciseNotes = () => {}, // Default empty function
    onEditClick = () => {}, // Default empty function
    onDeleteExercise = () => {}, // Default empty function
    onAnalyzeProgression = () => {}, // Default empty function
    searchTerm,
    setSearchTerm = () => {}, // Default empty function
    selectedDayFilter,
    setSelectedDayFilter = () => {}, // Default empty function
    selectedCategoryFilter,
    onCategoryFilterChange = () => {}, // Default empty function
    showOnlyCompleted,
    onToggleCompletedFilter = () => {}, // Default empty function
    onAddExercise = () => {}, // Default empty function
    onSaveToHistory = () => {}, // Default empty function
    isCompactView = false,
    historicalData = [],
    personalBests = {}, // Added for PB display in MainWorkoutView
    getDayButtonColors = () => 'bg-gray-700', // Default color if not provided
    formatDate = (date) => date.toLocaleString(), // Default formatting
    getSeriesDisplay = (series) => '', // Default empty string
    isSavingExercise = false, // Added for loading state
    isDeletingExercise = false, // Added for loading state
    isAddingExercise = false, // Added for loading state
    isAdvancedMode = false, // Added for advanced features toggle
    days = [], // Explicitly accept days array
    categories = [], // Explicitly accept categories array
    handleAddDay = () => {},
    handleEditDay = () => {},
    handleDeleteDay = () => {},
    handleAddCategory = () => {},
    handleEditCategory = () => {},
    handleDeleteCategory = () => {}
}) {
    // État local pour gérer l'expansion des jours et catégories
    const [expandedDays, setExpandedDays] = useState(new Set(workouts.dayOrder));
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [exerciseMenuOpen, setExerciseMenuOpen] = useState(null); // { dayName, categoryName, exerciseId }

    // Filtrer les exercices basés sur le terme de recherche
    const filterExercises = useCallback((exercises, dayName, categoryName) => {
        if (!exercises) return [];
        return exercises.filter(exercise => {
            const matchesSearch = searchTerm ? exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
            const matchesCategory = selectedCategoryFilter === 'all' || selectedCategoryFilter === '' ? true : exercise.category === selectedCategoryFilter;
            const matchesCompletion = showOnlyCompleted ? exercise.series.every(s => s.isCompleted) : true;
            const isNotDeleted = !exercise.isDeleted;
            return matchesSearch && matchesCategory && matchesCompletion && isNotDeleted;
        });
    }, [searchTerm, selectedCategoryFilter, showOnlyCompleted]);

    // Obtenir les jours disponibles après filtrage
    const getAvailableDays = useCallback(() => {
        return (workouts?.dayOrder || []).filter(dayName => {
            if (selectedDayFilter && selectedDayFilter !== 'all' && dayName !== selectedDayFilter) {
                return false;
            }
            const dayData = workouts.days[dayName];
            if (!dayData || !dayData.categories) return false;

            const hasVisibleExercises = Object.entries(dayData.categories).some(([categoryName, exercises]) => {
                const filteredExercises = filterExercises(exercises, dayName, categoryName);
                return filteredExercises.length > 0;
            });
            return hasVisibleExercises;
        });
    }, [workouts, selectedDayFilter, filterExercises]);


    const toggleDayExpansion = useCallback((dayName) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayName)) {
                newSet.delete(dayName);
            } else {
                newSet.add(dayName);
            }
            return newSet;
        });
    }, []);

    const toggleCategoryExpansion = useCallback((categoryName) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryName)) {
                newSet.delete(categoryName);
            } else {
                newSet.add(categoryName);
            }
            return newSet;
        });
    }, []);

    const toggleExerciseMenu = useCallback((dayName, categoryName, exerciseId) => {
        setExerciseMenuOpen(prev => 
            (prev?.dayName === dayName && prev?.categoryName === categoryName && prev?.exerciseId === exerciseId)
                ? null 
                : { dayName, categoryName, exerciseId }
        );
    }, []);

    // Fermer le menu si on clique en dehors
    const handleClickOutside = useCallback((event) => {
        if (exerciseMenuOpen && !event.target.closest('.exercise-menu-button') && !event.target.closest('.exercise-menu-dropdown')) {
            setExerciseMenuOpen(null);
        }
    }, [exerciseMenuOpen]);

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleClickOutside]);


    const renderSerie = useCallback((dayName, categoryName, exerciseId, serie, serieIndex, exerciseName) => {
        const volume = (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
        const isCompleted = serie.isCompleted;

        // Récupérer le record personnel pour cet exercice
        const pb = personalBests[exerciseName];
        const isMaxWeight = pb && parseFloat(serie.weight) === pb.maxWeight;
        const isMaxReps = pb && parseInt(serie.reps) === pb.maxReps;
        const isMaxVolume = pb && volume === pb.maxVolume && volume > 0;

        return (
            <div key={serieIndex} className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-200 ${isCompleted ? 'bg-green-700/30' : 'bg-gray-700/30'}`}>
                <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={() => onToggleSerieCompleted(dayName, categoryName, exerciseId, serieIndex)}
                    className="form-checkbox h-5 w-5 text-green-500 rounded border-gray-500 bg-gray-600 cursor-pointer"
                />
                <span className="text-gray-400 text-sm w-4 text-center">{serieIndex + 1}.</span>
                
                <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="flex items-center border border-gray-600 rounded-md overflow-hidden">
                        <input
                            type="number"
                            value={serie.weight}
                            onChange={(e) => onUpdateSerie(dayName, categoryName, exerciseId, serieIndex, 'weight', e.target.value)}
                            className={`w-full p-2 bg-gray-800 text-white text-center focus:outline-none text-sm ${isMaxWeight ? 'font-bold text-yellow-300' : ''}`}
                            placeholder="Poids"
                            step="0.5"
                            min="0"
                        />
                        <span className="bg-gray-600 text-gray-300 p-2 text-xs">kg</span>
                    </div>
                    <div className="flex items-center border border-gray-600 rounded-md overflow-hidden">
                        <input
                            type="number"
                            value={serie.reps}
                            onChange={(e) => onUpdateSerie(dayName, categoryName, exerciseId, serieIndex, 'reps', e.target.value)}
                            className={`w-full p-2 bg-gray-800 text-white text-center focus:outline-none text-sm ${isMaxReps ? 'font-bold text-yellow-300' : ''}`}
                            placeholder="Reps"
                            min="0"
                        />
                        <span className="bg-gray-600 text-gray-300 p-2 text-xs">reps</span>
                    </div>
                </div>

                <div className="text-right text-gray-400 text-sm w-16 flex-shrink-0">
                    <span className={`inline-flex items-center ${isMaxVolume ? 'font-bold text-yellow-300' : ''}`}>
                        {volume} <Activity className="ml-1 h-4 w-4" />
                    </span>
                </div>
                
                <button
                    onClick={() => onRemoveSerie(dayName, categoryName, exerciseId, serieIndex)}
                    className="p-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors flex-shrink-0"
                    title="Supprimer la série"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        );
    }, [onToggleSerieCompleted, onUpdateSerie, onRemoveSerie, personalBests]);

    const renderExercise = useCallback((exercise, dayName, categoryName) => {
        const exerciseVolume = (exercise.series || []).reduce((sum, serie) => sum + ((parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0)), 0);
        const isExpanded = expandedCategories.has(exercise.id);

        return (
            <div key={exercise.id} className="bg-gray-800 rounded-lg shadow-xl border border-gray-700">
                <button
                    onClick={() => toggleCategoryExpansion(exercise.id)}
                    className="w-full p-4 flex justify-between items-center text-left focus:outline-none"
                >
                    <div className="flex items-center gap-3 flex-grow">
                        <Dumbbell className="h-6 w-6 text-yellow-400 flex-shrink-0" />
                        <h4 className="text-xl font-semibold text-white flex-grow">
                            {exercise.name}
                        </h4>
                        <span className="text-sm text-gray-400 flex-shrink-0">
                            {Math.round(exerciseVolume)} kg
                        </span>
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-6 w-6 text-gray-400 ml-2" />
                    ) : (
                        <ChevronDown className="h-6 w-6 text-gray-400 ml-2" />
                    )}
                </button>

                {isExpanded && (
                    <div className="border-t border-gray-700 p-4 space-y-3">
                        <div className="space-y-2 mb-4">
                            {(exercise.series || []).map((serie, serieIndex) => 
                                renderSerie(dayName, categoryName, exercise.id, serie, serieIndex, exercise.name)
                            )}
                        </div>

                        <button
                            onClick={() => onAddSerie(dayName, categoryName, exercise.id)}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <Plus className="h-4 w-4" /> Ajouter une série
                        </button>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Notes:</label>
                            <textarea
                                value={exercise.notes}
                                onChange={(e) => onUpdateExerciseNotes(dayName, categoryName, exercise.id, e.target.value)}
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows="3"
                                placeholder="Ajoutez des notes sur votre performance, vos sensations..."
                            ></textarea>
                        </div>

                        {isAdvancedMode && (
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
                                <button
                                    onClick={() => onAnalyzeProgression({ name: exercise.name, series: exercise.series })}
                                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm"
                                    disabled={onAnalyzeProgression === null} // Check if function is available
                                >
                                    <Sparkles className="h-4 w-4" /> Analyse IA
                                </button>
                                <div className="relative inline-block text-left">
                                    <button
                                        onClick={() => toggleExerciseMenu(dayName, categoryName, exercise.id)}
                                        className="exercise-menu-button p-2 bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-500 transition-colors"
                                        title="Plus d'options"
                                    >
                                        <MoreVertical className="h-5 w-5" />
                                    </button>
                                    {exerciseMenuOpen?.dayName === dayName && 
                                     exerciseMenuOpen?.categoryName === categoryName && 
                                     exerciseMenuOpen?.exerciseId === exercise.id && (
                                        <div className="exercise-menu-dropdown origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                            <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                                <button
                                                    onClick={() => { onEditClick(dayName, categoryName, exercise.id, exercise); setExerciseMenuOpen(null); }}
                                                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 w-full text-left"
                                                    disabled={onEditClick === null}
                                                >
                                                    <Pencil className="inline-block h-4 w-4 mr-2" /> Modifier
                                                </button>
                                                <button
                                                    onClick={() => { onDeleteExercise(dayName, categoryName, exercise.id); setExerciseMenuOpen(null); }}
                                                    className="block px-4 py-2 text-sm text-red-400 hover:bg-gray-600 w-full text-left"
                                                    disabled={onDeleteExercise === null}
                                                >
                                                    <Trash2 className="inline-block h-4 w-4 mr-2" /> Supprimer
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }, [expandedCategories, toggleCategoryExpansion, renderSerie, onAddSerie, onUpdateExerciseNotes, isAdvancedMode, onAnalyzeProgression, onEditClick, onDeleteExercise, exerciseMenuOpen, toggleExerciseMenu, personalBests]);


    const renderCategory = useCallback((categoryName, dayName) => {
        const exercises = workouts.days[dayName]?.categories[categoryName] || [];
        const visibleExercises = filterExercises(exercises, dayName, categoryName);

        if (visibleExercises.length === 0 && (searchTerm || selectedCategoryFilter)) {
            return null; // Don't render category if no exercises match filters
        }

        return (
            <div key={categoryName} className="space-y-4">
                <div className="flex items-center justify-between mt-6 mb-4">
                    <h3 className="text-xl font-bold text-green-400 flex items-center gap-2">
                        <Layers className="h-6 w-6" />
                        {categoryName} ({visibleExercises.length})
                    </h3>
                    {isAdvancedMode && (
                        <div className="flex gap-2">
                             <button
                                onClick={() => handleEditCategory(dayName, categoryName)}
                                className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                                title="Modifier la catégorie"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => handleDeleteCategory(dayName, categoryName)}
                                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors"
                                title="Supprimer la catégorie"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="space-y-4">
                    {stableSort(visibleExercises, (a, b) => a.name.localeCompare(b.name)).map(exercise => (
                        renderExercise(exercise, dayName, categoryName)
                    ))}
                </div>
            </div>
        );
    }, [workouts, filterExercises, searchTerm, selectedCategoryFilter, renderExercise, isAdvancedMode, handleEditCategory, handleDeleteCategory]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2 mb-6">
                <Dumbbell className="h-7 w-7" />
                Votre Entraînement
            </h2>

            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <div className="mb-4">
                    <label htmlFor="search-main" className="block text-sm font-medium text-gray-300 mb-2">Rechercher un exercice:</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            id="search-main"
                            placeholder="Ex: Développé couché, Squat..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="day-filter" className="block text-sm font-medium text-gray-300 mb-2">Filtrer par jour:</label>
                        <select
                            id="day-filter"
                            value={selectedDayFilter}
                            onChange={(e) => setSelectedDayFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            <option value="all">Tous les jours</option>
                            {(workouts?.dayOrder || []).map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="category-filter" className="block text-sm font-medium text-gray-300 mb-2">Filtrer par catégorie:</label>
                        <select
                            id="category-filter"
                            value={selectedCategoryFilter}
                            onChange={(e) => onCategoryFilterChange(e)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            <option value="all">Toutes les catégories</option>
                            {categories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <label htmlFor="show-completed" className="flex items-center text-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            id="show-completed"
                            checked={showOnlyCompleted}
                            onChange={onToggleCompletedFilter}
                            className="form-checkbox h-4 w-4 text-green-500 rounded border-gray-600 bg-gray-700 focus:ring-green-500 mr-2"
                        />
                        Afficher seulement les séries complétées
                    </label>
                </div>
            </div>

            {/* Boutons d'actions rapides */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                <button
                    onClick={onAddExercise}
                    className="p-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    <Plus className="h-5 w-5" /> Ajouter Exercice
                </button>
                <button
                    onClick={onSaveToHistory}
                    className="p-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                    <History className="h-5 w-5" /> Sauvegarder Séance
                </button>
                {isAdvancedMode && (
                    <button
                        onClick={handleAddDay}
                        className="p-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                        <Calendar className="h-5 w-5" /> Ajouter Jour
                    </button>
                )}
            </div>

            {/* Affichage des entraînements par jour et catégorie */}
            <div className="mt-8 space-y-8">
                {(workouts?.dayOrder || []).map((dayName, index) => {
                    const dayData = workouts.days[dayName];
                    if (!dayData) return null;

                    const visibleCategoriesForDay = (dayData?.categoryOrder || []).filter(categoryName => {
                        const exercises = dayData.categories[categoryName];
                        return filterExercises(exercises, dayName, categoryName).length > 0;
                    });

                    // Si aucun exercice ne correspond aux filtres pour ce jour, ne pas l'afficher
                    if (visibleCategoriesForDay.length === 0 && (searchTerm || selectedDayFilter || selectedCategoryFilter || showOnlyCompleted)) {
                        return null; 
                    }

                    return (
                        <div key={dayName} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className={`text-2xl font-bold ${getDayButtonColors(index, selectedDayFilter === dayName)} mt-6 mb-4`}>
                                    {dayName}
                                </h2>
                                {isAdvancedMode && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditDay(dayName)}
                                            className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                                            title="Modifier le jour"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDay(dayName)}
                                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors"
                                            title="Supprimer le jour"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleAddCategory(dayName)}
                                            className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/40 transition-colors"
                                            title="Ajouter une catégorie à ce jour"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                {stableSort(visibleCategoriesForDay, (a, b) => a.localeCompare(b)).map(categoryName => {
                                    return renderCategory(categoryName, dayName);
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

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
