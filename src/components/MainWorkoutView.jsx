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
    onToggleSerieCompleted,
    onUpdateSerie,
    onAddSerie,
    onRemoveSerie,
    onUpdateExerciseNotes,
    onEditClick,
    onDeleteExercise,
    onAnalyzeProgression,
    searchTerm,
    setSearchTerm,
    selectedDayFilter,
    setSelectedDayFilter, 
    selectedCategoryFilter,
    onCategoryFilterChange,
    showOnlyCompleted,
    onToggleCompletedFilter,
    onAddExercise,
    onSaveToHistory,
    isCompactView = false,
    historicalData = [],
    personalBests = {}, 
    getDayButtonColors, 
    formatDate, 
    getSeriesDisplay, 
    isSavingExercise, 
    isDeletingExercise, 
    isAddingExercise, 
    days, 
    categories, 
    handleAddDay, 
    handleEditDay, 
    handleDeleteDay,
    handleAddCategory, 
    handleEditCategory, 
    handleDeleteCategory,
    isAdvancedMode = false 
}) {
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [expandedExercises, setExpandedExercises] = useState(new Set());
    const [showDayMenu, setShowDayMenu] = useState(null); 
    const [showCategoryMenu, setShowCategoryMenu] = useState(null); 

    // Toggle expansion for a category
    const toggleCategory = useCallback((categoryName) => {
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

    // Toggle expansion for an exercise
    const toggleExercise = useCallback((exerciseId) => {
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


    // Filtrer les jours disponibles
    const getAvailableDays = useMemo(() => {
        if (!workouts || !workouts.days) return [];
        const filteredDays = (workouts.dayOrder || Object.keys(workouts.days)).filter(dayName => {
            const dayData = workouts.days[dayName];
            if (!dayData || !dayData.categories) return false;

            // Check if any category or exercise within the day matches the search term
            const dayMatchesSearch = Object.keys(dayData.categories).some(categoryName => {
                const exercisesInCat = dayData.categories[categoryName];
                return categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (Array.isArray(exercisesInCat) && exercisesInCat.some(exercise => 
                           exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
                       ));
            });
            return dayMatchesSearch;
        });
        return filteredDays;
    }, [workouts, searchTerm]);


    // Filtrer et trier les exercices
    const getFilteredAndSortedExercises = useCallback((dayName, categoryName) => {
        const exercises = workouts.days[dayName]?.categories[categoryName] || [];
        const filtered = exercises.filter(exercise => {
            const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCompleted = showOnlyCompleted ? exercise.series.every(s => s.completed) : true;
            return matchesSearch && matchesCompleted && !exercise.isDeleted;
        });

        return stableSort(filtered, (a, b) => a.name.localeCompare(b.name));
    }, [workouts, searchTerm, showOnlyCompleted]);

    const renderSerie = useCallback((serie, dayName, categoryName, exerciseId, serieIndex) => (
        <div key={serieIndex} className="flex items-center gap-2 text-sm">
            <input
                type="text"
                value={serie.weight}
                onChange={(e) => onUpdateSerie(dayName, categoryName, exerciseId, serieIndex, 'weight', e.target.value)}
                className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 text-center"
                placeholder="Poids"
                inputMode="numeric"
            />
            <span className="text-gray-400">kg x</span>
            <input
                type="text"
                value={serie.reps}
                onChange={(e) => onUpdateSerie(dayName, categoryName, exerciseId, serieIndex, 'reps', e.target.value)}
                className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 text-center"
                placeholder="Reps"
                inputMode="numeric"
            />
            <button
                onClick={() => onRemoveSerie(dayName, categoryName, exerciseId, serieIndex)}
                className="p-1 rounded-full text-red-400 hover:bg-red-500/20 transition-colors"
                title="Supprimer la série"
            >
                <Trash2 className="h-4 w-4" />
            </button>
            <button
                onClick={() => onToggleSerieCompleted(dayName, categoryName, exerciseId, serieIndex)}
                className={`p-1 rounded-full transition-colors ${
                    serie.completed ? 'text-green-400 bg-green-500/20' : 'text-gray-400 hover:bg-gray-700'
                }`}
                title={serie.completed ? "Marquer comme non complété" : "Marquer comme complété"}
            >
                {serie.completed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </button>
        </div>
    ), [onRemoveSerie, onToggleSerieCompleted, onUpdateSerie]);

    const renderExercise = useCallback((exercise, dayName, categoryName) => {
        const isExpanded = expandedExercises.has(exercise.id);
        const exerciseBests = personalBests[exercise.name]; 

        return (
            <div key={exercise.id} className="bg-gray-800 rounded-lg shadow-md border border-gray-700">
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggleExercise(exercise.id)}>
                    <div className="flex-1 flex col">
                        <h4 className="font-semibold text-white text-base sm:text-lg">
                            {exercise.name}
                            {exercise.isDeleted && <span className="ml-2 text-red-500 text-xs">(Supprimé)</span>}
                        </h4>
                        <p className="text-gray-400 text-sm">
                            {getSeriesDisplay(exercise.series)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {exerciseBests && (
                            <span className="text-yellow-400 text-xs font-medium flex items-center gap-1" title="Record personnel">
                                <Award className="h-4 w-4" /> {exerciseBests.maxWeight}kg x {exerciseBests.maxReps}
                            </span>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleExercise(exercise.id); }}
                            className="p-1 rounded-full text-gray-400 hover:bg-gray-700 transition-colors"
                        >
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-4 border-t border-gray-700 space-y-3">
                        <div className="space-y-2">
                            {exercise.series.map((serie, serieIndex) => (
                                renderSerie(serie, dayName, categoryName, exercise.id, serieIndex)
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => onAddSerie(dayName, categoryName, exercise.id)}
                                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
                            >
                                <Plus className="h-4 w-4" /> Ajouter une série
                            </button>
                        </div>
                        <div className="mt-4 space-y-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                                <textarea
                                    value={exercise.notes}
                                    onChange={(e) => onUpdateExerciseNotes(dayName, categoryName, exercise.id, e.target.value)}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 min-h-[60px]"
                                    placeholder="Ajouter des notes sur cet exercice..."
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onEditClick(dayName, categoryName, exercise.id, exercise)}
                                    className="flex-1 py-2 px-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Pencil className="h-4 w-4" /> Modifier
                                </button>
                                <button
                                    onClick={() => onDeleteExercise(dayName, categoryName, exercise.id)}
                                    disabled={isDeletingExercise}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-1 transition-colors ${
                                        isDeletingExercise ? 'bg-red-500/50 cursor-wait' : 'bg-red-600 hover:bg-red-700 text-white'
                                    }`}
                                >
                                    {isDeletingExercise ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    Supprimer
                                </button>
                            </div>
                            {isAdvancedMode && (
                                <button
                                    onClick={() => onAnalyzeProgression(exercise)}
                                    className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Sparkles className="h-4 w-4" /> Analyser la progression (IA)
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }, [expandedExercises, isDeletingExercise, isAdvancedMode, personalBests, onAddSerie, onEditClick, onDeleteExercise, onUpdateExerciseNotes, onAnalyzeProgression, renderSerie, toggleExercise, getSeriesDisplay]);

    const renderCategory = useCallback((categoryName, dayName) => {
        const isExpanded = expandedCategories.has(`${dayName}-${categoryName}`);
        const filteredExercises = getFilteredAndSortedExercises(dayName, categoryName);

        if (filteredExercises.length === 0 && searchTerm) {
            return null; 
        }

        return (
            <div key={categoryName} className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
                <div 
                    className="flex items-center justify-between p-4 bg-gray-700/50 cursor-pointer"
                    onClick={() => toggleCategory(`${dayName}-${categoryName}`)}
                >
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Layers className="h-5 w-5 text-purple-400" />
                        {categoryName} ({filteredExercises.length})
                    </h3>
                    <div className="flex items-center gap-2">
                         {isAdvancedMode && (
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowCategoryMenu(showCategoryMenu === `${dayName}-${categoryName}` ? null : `${dayName}-${categoryName}`); }}
                                    className="p-1 rounded-full text-gray-400 hover:bg-gray-600 transition-colors"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </button>
                                {showCategoryMenu === `${dayName}-${categoryName}` && (
                                    <div className="absolute right-0 mt-2 w-40 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditCategory(dayName, categoryName); setShowCategoryMenu(null); }}
                                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 rounded-t-lg"
                                        >
                                            <Pencil className="h-4 w-4" /> Modifier
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(dayName, categoryName); setShowCategoryMenu(null); }}
                                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600"
                                        >
                                            <Trash2 className="h-4 w-4" /> Supprimer
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleAddCategory(dayName); setShowCategoryMenu(null); }}
                                            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-gray-600 rounded-b-lg"
                                        >
                                            <Plus className="h-4 w-4" /> Ajouter Catégorie
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleCategory(`${dayName}-${categoryName}`); }}
                            className="p-1 rounded-full text-gray-400 hover:bg-gray-700 transition-colors"
                        >
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                {isExpanded && (
                    <div className="p-4 space-y-4">
                        {filteredExercises.length > 0 ? (
                            filteredExercises.map(exercise => renderExercise(exercise, dayName, categoryName))
                        ) : (
                            <div className="text-gray-400 text-sm italic text-center py-4">
                                {searchTerm ? "Aucun exercice trouvé avec ce filtre." : "Aucun exercice dans cette catégorie."}
                            </div>
                        )}
                        <button
                            onClick={() => onAddExercise(dayName, categoryName)}
                            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center justify-center gap-1 transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Ajouter un exercice
                        </button>
                    </div>
                )}
            </div>
        );
    }, [expandedCategories, searchTerm, getFilteredAndSortedExercises, renderExercise, toggleCategory, isAdvancedMode, showCategoryMenu, handleEditCategory, handleDeleteCategory, handleAddCategory]); 

    return (
        <div className="space-y-6">
            {/* Barre de recherche et filtres améliorée */}
            <div className="flex flex-col sm:flex-row gap-3 sticky top-[76px] sm:top-[80px] bg-gray-900/95 backdrop-blur-sm z-30 py-3 -mx-4 px-4 border-b border-gray-700/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={selectedCategoryFilter}
                        onChange={onCategoryFilterChange}
                        className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Toutes catégories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <button
                        onClick={onToggleCompletedFilter}
                        className={`px-4 py-2 rounded-lg transition-all ${showOnlyCompleted ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        title="Filtrer par exercices complétés"
                    >
                        <Check className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Boutons Jours d'entraînement avec gestion CRUD */}
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {getAvailableDays.length > 0 ? (
                    getAvailableDays.map((dayName, index) => (
                        <div key={dayName} className="relative">
                            <button
                                onClick={() => setSelectedDayFilter(dayName)}
                                className={`px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-all duration-200 ${getDayButtonColors(index, selectedDayFilter === dayName)}`}
                            >
                                <Calendar className="h-5 w-5" />
                                {dayName}
                            </button>
                            {isAdvancedMode && (
                                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 z-10">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowDayMenu(showDayMenu === dayName ? null : dayName); }}
                                        className="p-1 bg-gray-700 rounded-full text-gray-400 hover:bg-gray-600 transition-colors"
                                        title="Options du jour"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                    {showDayMenu === dayName && (
                                        <div className="absolute right-0 mt-2 w-40 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-20">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditDay(dayName); setShowDayMenu(null); }}
                                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 rounded-t-lg"
                                            >
                                                <Pencil className="h-4 w-4" /> Modifier
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteDay(dayName); setShowDayMenu(null); }}
                                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600"
                                            >
                                                <Trash2 className="h-4 w-4" /> Supprimer
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleAddCategory(dayName); setShowDayMenu(null); }}
                                                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-gray-600 rounded-b-lg"
                                            >
                                                <Plus className="h-4 w-4" /> Ajouter Catégorie
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-gray-400 italic text-center py-4">
                        <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Aucun jour d'entraînement trouvé. Ajoutez-en un !
                    </div>
                )}
                {isAdvancedMode && (
                    <button
                        onClick={handleAddDay}
                        className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all flex items-center gap-2"
                        title="Ajouter un nouveau jour d'entraînement"
                    >
                        <Plus className="h-5 w-5" /> Nouveau Jour
                    </button>
                )}
            </div>

            {/* Affichage des entraînements par jour et catégorie */}
            <div className="space-y-6 mt-4">
                {workouts.dayOrder.filter(dayName => selectedDayFilter === '' || dayName === selectedDayFilter).map(dayName => {
                    const dayData = workouts.days[dayName];
                    if (!dayData) return null;

                    const orderedCategories = dayData.categoryOrder || Object.keys(dayData.categories || {});

                    const visibleCategoriesForDay = orderedCategories.filter(categoryName => {
                        const exercisesInCat = dayData.categories[categoryName];
                        if (selectedCategoryFilter && categoryName !== selectedCategoryFilter) return false;
                        
                        // Only show category if it has exercises matching search or if no search is active
                        const hasMatchingExercises = Array.isArray(exercisesInCat) && exercisesInCat.some(exercise => 
                            exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) && !exercise.isDeleted
                        );
                        return hasMatchingExercises || !searchTerm;
                    });

                    if (visibleCategoriesForDay.length === 0 && (searchTerm || selectedCategoryFilter)) {
                        return null; 
                    }

                    return (
                        <div key={dayName} className="space-y-4">
                            {visibleCategoriesForDay.length > 0 && (
                                <h2 className="text-2xl font-bold text-blue-400 mt-6 mb-4">{dayName}</h2>
                            )}
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
            {getAvailableDays().length === 0 && (
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
