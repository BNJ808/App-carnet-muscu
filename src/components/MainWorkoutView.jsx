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
    onToggleSerieCompleted = () => { },
    onUpdateSerie = () => { },
    onAddSerie = () => { },
    onRemoveSerie = () => { },
    onUpdateExerciseNotes = () => { },
    onEditClick = () => { },
    onDeleteExercise = () => { },
    onAnalyzeProgression = () => { },
    searchTerm,
    setSearchTerm = () => { },
    selectedDayFilter,
    setSelectedDayFilter = () => { },
    selectedCategoryFilter,
    setSelectedCategoryFilter = () => { },
    showOnlyCompleted,
    setShowOnlyCompleted = () => { },
    onAddExerciseClick = () => { },
    onDuplicateExercise = () => { },
    onOpenTimer = () => { },
    formatTime,
    setRestTimeInput,
    isAdvancedMode,
    isToday = false,
    handleSaveWorkout = () => { },
    handleLoadWorkout = () => { },
    clearCurrentWorkout = () => { },
    undoLastAction = () => { },
    redoLastAction = () => { },
    canUndo = false,
    canRedo = false,
    aiAnalysisLoading = false,
    progressionAnalysisContent,
    setProgressionAnalysisContent,
    onGenerateAISuggestions,
    aiSuggestions = [],
    getAvailableDays = () => [], // Assurez-vous que cette fonction est passée
    getWorkoutStats = () => ({}) // Assurez-vous que cette fonction est passée
}) {
    const [expandedExercises, setExpandedExercises] = useState(new Set());
    const [editingNotesExerciseId, setEditingNotesExerciseId] = useState(null);
    const [tempNotes, setTempNotes] = useState('');
    const [showDayFilterDropdown, setShowDayFilterDropdown] = useState(false);
    const [showCategoryFilterDropdown, setShowCategoryFilterDropdown] = useState(false);

    // Mémoriser la liste des catégories uniques
    const allCategories = useMemo(() => {
        const categories = new Set();
        workouts.dayOrder.forEach(dayId => {
            if (workouts.days[dayId]) {
                workouts.days[dayId].exercises.forEach(exercise => {
                    if (exercise.category) {
                        categories.add(exercise.category);
                    }
                });
            }
        });
        return Array.from(categories).sort();
    }, [workouts]);

    // Filtrage et tri (logique existante, assurez-vous qu'elle est performante)
    const filteredAndSortedExercises = useMemo(() => {
        let exercises = [];
        if (selectedDayFilter === 'all') {
            workouts.dayOrder.forEach(dayId => {
                if (workouts.days[dayId]) {
                    exercises = exercises.concat(workouts.days[dayId].exercises.map(ex => ({ ...ex, dayId: dayId })));
                }
            });
        } else if (workouts.days[selectedDayFilter]) {
            exercises = workouts.days[selectedDayFilter].exercises.map(ex => ({ ...ex, dayId: selectedDayFilter }));
        }

        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            exercises = exercises.filter(exercise =>
                exercise.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                (exercise.notes && exercise.notes.toLowerCase().includes(lowerCaseSearchTerm))
            );
        }

        if (selectedCategoryFilter !== 'all') {
            exercises = exercises.filter(exercise => exercise.category === selectedCategoryFilter);
        }

        if (showOnlyCompleted) {
            exercises = exercises.filter(exercise =>
                exercise.series.every(serie => serie.isCompleted)
            );
        }

        // Tri des exercices (si vous avez un ordre par défaut ou un besoin de tri)
        // Par exemple, trier par isCompleted pour mettre les non complétés en premier
        return stableSort(exercises, (a, b) => {
            if (a.isCompleted && !b.isCompleted) return 1;
            if (!a.isCompleted && b.isCompleted) return -1;
            return 0; // Garde l'ordre stable
        });
    }, [workouts, searchTerm, selectedDayFilter, selectedCategoryFilter, showOnlyCompleted]);

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

    const handleEditNotes = useCallback((exercise) => {
        setEditingNotesExerciseId(exercise.id);
        setTempNotes(exercise.notes || '');
    }, []);

    const handleSaveNotes = useCallback((exerciseId) => {
        onUpdateExerciseNotes(exerciseId, tempNotes);
        setEditingNotesExerciseId(null);
    }, [onUpdateExerciseNotes, tempNotes]);

    const renderSerieInput = useCallback((serie, exerciseId, serieIndex, field, type = 'number') => (
        <input
            type={type}
            inputMode={type === 'number' ? 'numeric' : 'text'} // Clavier numérique pour les nombres
            value={serie[field]}
            onChange={(e) => onUpdateSerie(exerciseId, serieIndex, field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            onBlur={() => {
                if (type === 'number' && (serie[field] === '' || isNaN(serie[field]))) {
                    onUpdateSerie(exerciseId, serieIndex, field, 0); // S'assurer qu'un nombre est toujours présent
                }
            }}
            className="w-16 sm:w-20 bg-gray-700 text-white text-center rounded-md p-1 border border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
    ), [onUpdateSerie]);


    // Styles réutilisables pour les boutons
    const iconButtonClass = "p-2 rounded-md transition-colors duration-200 flex items-center justify-center";
    const primaryButtonClass = "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2";
    const secondaryButtonClass = "bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2";
    const dangerButtonClass = "bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2";


    return (
        <div className="p-4 sm:p-6 pb-20 max-w-2xl mx-auto"> {/* MODIFIED: Added pb-20 for mobile padding */}
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Dumbbell className="h-7 w-7 text-blue-400" />
                {isToday ? "Mon entraînement du jour" : "Mes entraînements"}
            </h2>

            {/* Barre d'outils supérieure */}
            <div className="flex flex-wrap gap-3 mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
                <button
                    onClick={onAddExerciseClick}
                    className={`${primaryButtonClass} flex-1 min-w-[150px]`}
                >
                    <Plus className="h-5 w-5" /> Ajouter Exercice
                </button>
                <button
                    onClick={onOpenTimer}
                    className={`${secondaryButtonClass} flex-1 min-w-[120px]`}
                >
                    <Clock className="h-5 w-5" /> Minuteur
                </button>
                {/* ... autres boutons comme Sauvegarder, Charger, Effacer */}
                <button
                    onClick={handleSaveWorkout}
                    className={`${secondaryButtonClass} flex-1 min-w-[150px]`}
                >
                    <Download className="h-5 w-5" /> Sauvegarder
                </button>
                <button
                    onClick={handleLoadWorkout}
                    className={`${secondaryButtonClass} flex-1 min-w-[120px]`}
                >
                    <Upload className="h-5 w-5" /> Charger
                </button>
                <button
                    onClick={clearCurrentWorkout}
                    className={`${dangerButtonClass} flex-1 min-w-[120px]`}
                >
                    <Trash2 className="h-5 w-5" /> Effacer
                </button>
                {/* Boutons annuler/rétablir */}
                <button
                    onClick={undoLastAction}
                    disabled={!canUndo}
                    className={`${secondaryButtonClass} flex-1 min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <Undo2 className="h-5 w-5" /> Annuler
                </button>
                <button
                    onClick={redoLastAction}
                    disabled={!canRedo}
                    className={`${secondaryButtonClass} flex-1 min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <Redo2 className="h-5 w-5" /> Rétablir
                </button>
            </div>

            {/* Filtres et recherche */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                    <Search className="h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 p-2 text-sm"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="relative">
                        <label htmlFor="day-filter" className="block text-gray-300 text-sm font-medium mb-1">Jour :</label>
                        <select
                            id="day-filter"
                            value={selectedDayFilter}
                            onChange={(e) => setSelectedDayFilter(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 p-2 text-sm appearance-none pr-8"
                        >
                            <option value="all">Tous les jours</option>
                            {getAvailableDays().map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none mt-2" />
                    </div>
                    <div className="relative">
                        <label htmlFor="category-filter" className="block text-gray-300 text-sm font-medium mb-1">Catégorie :</label>
                        <select
                            id="category-filter"
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 p-2 text-sm appearance-none pr-8"
                        >
                            <option value="all">Toutes les catégories</option>
                            {allCategories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none mt-2" />
                    </div>
                </div>

                <div className="flex items-center mt-4">
                    <input
                        type="checkbox"
                        id="show-completed"
                        checked={showOnlyCompleted}
                        onChange={(e) => setShowOnlyCompleted(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-600 bg-gray-700"
                    />
                    <label htmlFor="show-completed" className="ml-2 text-gray-300 text-sm flex items-center gap-1">
                        <Check className="h-4 w-4" /> Afficher uniquement les complétés
                    </label>
                </div>
            </div>

            {/* Liste des exercices */}
            <div className="space-y-6">
                {workouts.dayOrder.length > 0 && getAvailableDays().length > 0 && selectedDayFilter === 'all' && (
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Layers className="h-5 w-5 text-purple-400" />
                        Tous les exercices disponibles
                    </h3>
                )}

                {filteredAndSortedExercises.map((exercise) => {
                    const isExpanded = expandedExercises.has(exercise.id);
                    const totalExerciseVolume = exercise.series.reduce((sum, serie) => sum + (serie.weight * serie.reps || 0), 0);
                    const completedSeriesCount = exercise.series.filter(s => s.isCompleted).length;

                    return (
                        <div key={exercise.id} className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
                            <div
                                className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer transition-all duration-200 hover:bg-gray-700/50"
                                onClick={() => toggleExerciseExpansion(exercise.id)}
                            >
                                <div className="flex-1 mb-2 sm:mb-0">
                                    <h3 className="text-white font-semibold text-base mb-1 flex items-center gap-2">
                                        <Dumbbell className="h-5 w-5 text-blue-400" />
                                        {exercise.name}
                                        {exercise.dayId && selectedDayFilter === 'all' && (
                                            <span className="ml-2 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                                                Jour: {exercise.dayId}
                                            </span>
                                        )}
                                        {exercise.category && (
                                            <span className="ml-2 bg-purple-700/30 text-purple-300 text-xs px-2 py-0.5 rounded-full">
                                                {exercise.category}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-gray-400 text-sm">
                                        {completedSeriesCount}/{exercise.series.length} séries complétées
                                        {totalExerciseVolume > 0 && <span className="ml-2">| Volume: {totalExerciseVolume.toLocaleString()} kg</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onAnalyzeProgression(exercise.id); }}
                                        className={`${iconButtonClass} bg-green-600/20 text-green-400 hover:bg-green-600/30`}
                                        title="Analyser la progression IA"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDuplicateExercise(exercise.id); }}
                                        className={`${iconButtonClass} bg-purple-600/20 text-purple-400 hover:bg-purple-600/30`}
                                        title="Dupliquer l'exercice"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                    {isExpanded ? (
                                        <ChevronUp className="h-5 w-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5 text-gray-400" />
                                    )}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-4 border-t border-gray-700 bg-gray-850">
                                    {/* Notes de l'exercice */}
                                    <div className="mb-4">
                                        <label htmlFor={`notes-${exercise.id}`} className="block text-gray-300 text-sm font-medium mb-1 flex items-center gap-1">
                                            <NotebookText className="h-4 w-4" /> Notes de l'exercice:
                                        </label>
                                        {editingNotesExerciseId === exercise.id ? (
                                            <div className="flex gap-2">
                                                <textarea
                                                    id={`notes-${exercise.id}`}
                                                    value={tempNotes}
                                                    onChange={(e) => setTempNotes(e.target.value)}
                                                    className="flex-1 bg-gray-700 text-white rounded-md p-2 border border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y min-h-[60px]"
                                                    rows="2"
                                                ></textarea>
                                                <button
                                                    onClick={() => handleSaveNotes(exercise.id)}
                                                    className={`${iconButtonClass} bg-green-500 hover:bg-green-600 text-white`}
                                                    title="Sauvegarder les notes"
                                                >
                                                    <Check className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingNotesExerciseId(null)}
                                                    className={`${iconButtonClass} bg-red-500 hover:bg-red-600 text-white`}
                                                    title="Annuler"
                                                >
                                                    <X className="h-5 w-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-start">
                                                <p className="text-gray-400 text-sm whitespace-pre-wrap flex-1">
                                                    {exercise.notes || "Ajoutez des notes pour cet exercice..."}
                                                </p>
                                                <button
                                                    onClick={() => handleEditNotes(exercise)}
                                                    className={`${iconButtonClass} bg-gray-700 hover:bg-gray-600 text-gray-300 ml-2`}
                                                    title="Modifier les notes"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* En-tête des séries */}
                                    <div className="grid grid-cols-6 gap-2 text-gray-400 text-xs font-semibold mb-2">
                                        <div className="col-span-1 text-center">Série</div>
                                        <div className="col-span-1 text-center">Poids</div>
                                        <div className="col-span-1 text-center">Reps</div>
                                        <div className="col-span-1 text-center">RPE</div>
                                        <div className="col-span-1 text-center">Notes</div>
                                        <div className="col-span-1 text-center">Action</div>
                                    </div>

                                    {/* Liste des séries */}
                                    <div className="space-y-3 mb-4">
                                        {exercise.series.map((serie, serieIndex) => (
                                            <div key={serie.id} className="grid grid-cols-6 gap-2 items-center bg-gray-700/50 p-2 rounded-md border border-gray-600">
                                                <div className="col-span-1 text-center text-gray-300 font-medium">
                                                    {serieIndex + 1}
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    {renderSerieInput(serie, exercise.id, serieIndex, 'weight')}
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    {renderSerieInput(serie, exercise.id, serieIndex, 'reps')}
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    {renderSerieInput(serie, exercise.id, serieIndex, 'rpe')}
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    {renderSerieInput(serie, exercise.id, serieIndex, 'notes', 'text')}
                                                </div>
                                                <div className="col-span-1 flex flex-col sm:flex-row gap-1 justify-center">
                                                    <button
                                                        onClick={() => onToggleSerieCompleted(exercise.id, serie.id)}
                                                        className={`${iconButtonClass} ${serie.isCompleted ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
                                                        title={serie.isCompleted ? "Démarquer comme non complétée" : "Marquer comme complétée"}
                                                    >
                                                        {serie.isCompleted ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => onRemoveSerie(exercise.id, serie.id)}
                                                        className={`${iconButtonClass} bg-red-500 hover:bg-red-600 text-white`}
                                                        title="Supprimer la série"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 justify-end mt-4">
                                        <button
                                            onClick={() => onAddSerie(exercise.id)}
                                            className={`${secondaryButtonClass} text-xs`}
                                        >
                                            <Plus className="h-4 w-4" /> Ajouter Série
                                        </button>
                                        <button
                                            onClick={() => onDeleteExercise(exercise.id)}
                                            className={`${dangerButtonClass} text-xs`}
                                        >
                                            <Trash2 className="h-4 w-4" /> Supprimer Exercice
                                        </button>
                                    </div>
                                </div>
                            )}
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
