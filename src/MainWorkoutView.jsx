import React, { useState, useMemo } from 'react';
import {
    Plus, Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    ArrowUp, ArrowDown, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Search, Dumbbell, Award
} from 'lucide-react';

/**
 * Composant MainWorkoutView pour afficher la vue principale des entraînements.
 */
const MainWorkoutView = ({
    workouts = { days: {}, dayOrder: [] },
    selectedDayFilter,
    setSelectedDayFilter,
    isAdvancedMode,
    isCompactView,
    handleEditClick,
    handleAddExerciseClick,
    handleDeleteExercise,
    handleToggleSeriesCompleted,
    handleUpdateSeries,
    handleDeleteSeries,
    handleAddSeries,
    analyzeProgressionWithAI,
    showProgressionGraphForExercise,
    personalBests = {},
    getDayButtonColors,
    formatDate,
    getSeriesDisplay,
    isSavingExercise,
    isDeletingExercise,
    isAddingExercise,
    searchTerm = '',
    setSearchTerm,
    days = [],
    categories = [],
    handleAddDay,
    handleEditDay,
    handleDeleteDay,
}) => {
    const [expandedDays, setExpandedDays] = useState(new Set(workouts?.dayOrder || []));
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [showAddDayModal, setShowAddDayModal] = useState(false);
    const [newDayName, setNewDayName] = useState('');
    const [showEditDayModal, setShowEditDayModal] = useState(false);
    const [editingDay, setEditingDay] = useState(null);
    const [tempDayName, setTempDayName] = useState('');
    const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
    const [currentDayIdForExercise, setCurrentDayIdForExercise] = useState(null);
    const [currentCategoryForExercise, setCurrentCategoryForExercise] = useState(null);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newExerciseCategory, setNewExerciseCategory] = useState('');
    const [activeExerciseNotes, setActiveExerciseNotes] = useState({});
    const [editingNotesExerciseId, setEditingNotesExerciseId] = useState(null);

    const toggleDayExpansion = (dayId) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayId)) {
                newSet.delete(dayId);
            } else {
                newSet.add(dayId);
            }
            return newSet;
        });
    };

    const toggleCategoryExpansion = (categoryId) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };

    const handleAddDaySubmit = () => {
        if (newDayName?.trim()) {
            handleAddDay(newDayName);
            setNewDayName('');
            setShowAddDayModal(false);
        }
    };

    const handleEditDayClick = (dayId) => {
        setEditingDay(dayId);
        setTempDayName(dayId);
        setShowEditDayModal(true);
    };

    const handleEditDaySubmit = () => {
        if (editingDay && tempDayName?.trim()) {
            handleEditDay(editingDay, tempDayName);
            setShowEditDayModal(false);
            setEditingDay(null);
            setTempDayName('');
        }
    };

    const handleAddExerciseModalOpen = (dayId, categoryName) => {
        setCurrentDayIdForExercise(dayId);
        setCurrentCategoryForExercise(categoryName);
        setNewExerciseName('');
        setNewExerciseCategory('');
        setShowAddExerciseModal(true);
    };

    const handleAddExerciseSubmit = () => {
        if (currentDayIdForExercise && (currentCategoryForExercise || newExerciseCategory?.trim()) && newExerciseName?.trim()) {
            const categoryToUse = newExerciseCategory?.trim() || currentCategoryForExercise;
            handleAddExerciseClick(currentDayIdForExercise, categoryToUse, newExerciseName);
            setNewExerciseName('');
            setNewExerciseCategory('');
            setShowAddExerciseModal(false);
            setCurrentDayIdForExercise(null);
            setCurrentCategoryForExercise(null);
        }
    };

    // Filter exercises by search term
    const filteredWorkouts = useMemo(() => {
        if (!searchTerm || !workouts?.dayOrder) return workouts;

        const filtered = { ...workouts, days: {} };
        const dayOrder = workouts?.dayOrder || [];
        const workoutDays = workouts?.days || {};
        
        dayOrder.forEach(dayIdentifier => {
            const dayData = workoutDays[dayIdentifier];
            if (dayData?.categories) {
                const newCategories = {};
                Object.entries(dayData.categories).forEach(([categoryName, exercisesList]) => {
                    if (Array.isArray(exercisesList)) {
                        const filteredExercises = exercisesList.filter(exerciseItem =>
                            exerciseItem?.name?.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        if (filteredExercises.length > 0) {
                            newCategories[categoryName] = filteredExercises;
                        }
                    }
                });
                if (Object.keys(newCategories).length > 0) {
                    filtered.days[dayIdentifier] = { ...dayData, categories: newCategories };
                }
            }
        });
        filtered.dayOrder = (filtered.dayOrder || []).filter(dayId => filtered.days[dayId]);
        return filtered;
    }, [workouts, searchTerm]);

    const renderSeriesInput = (dayId, categoryName, exerciseId, series) => {
        if (!Array.isArray(series)) return null;
        
        return series.map((seriesItem, seriesIndex) => (
            <div key={seriesItem?.id || seriesIndex} className={`flex items-center space-x-2 py-1 ${seriesItem?.completed ? 'opacity-60' : ''}`}>
                <input
                    type="number"
                    value={seriesItem?.weight || ''}
                    onChange={(e) => handleUpdateSeries(dayId, categoryName, exerciseId, seriesItem?.id, { weight: parseFloat(e.target.value) || 0 })}
                    className="w-1/3 p-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    placeholder="Poids (kg)"
                    min="0"
                />
                <span className="text-gray-300">x</span>
                <input
                    type="number"
                    value={seriesItem?.reps || ''}
                    onChange={(e) => handleUpdateSeries(dayId, categoryName, exerciseId, seriesItem?.id, { reps: parseInt(e.target.value) || 0 })}
                    className="w-1/3 p-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                    placeholder="Reps"
                    min="0"
                />
                <button
                    onClick={() => handleToggleSeriesCompleted(dayId, categoryName, exerciseId, seriesItem?.id)}
                    className={`p-1 rounded-full ${seriesItem?.completed ? 'bg-green-500' : 'bg-gray-500'} text-white transition-colors`}
                    aria-label={seriesItem?.completed ? "Démarquer comme non complétée" : "Marquer comme complétée"}
                >
                    {seriesItem?.completed ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </button>
                <button
                    onClick={() => handleDeleteSeries(dayId, categoryName, exerciseId, seriesItem?.id)}
                    className="p-1 text-red-400 hover:text-red-500 transition-colors"
                    aria-label="Supprimer la série"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>
        ));
    };

    const handleSaveNotes = (dayId, categoryName, exerciseId) => {
        const notesToSave = activeExerciseNotes[exerciseId] || '';
        handleEditClick(dayId, categoryName, exerciseId, { notes: notesToSave });
        setEditingNotesExerciseId(null);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                <Dumbbell className="h-7 w-7" />
                Vos Entraînements
            </h2>

            {/* Barre de recherche */}
            <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher un exercice..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Bouton Ajouter un nouveau jour */}
            <button
                onClick={() => setShowAddDayModal(true)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                <Plus className="h-5 w-5" /> Ajouter un jour
            </button>

            {/* Liste des jours d'entraînement */}
            <div className="space-y-4">
                {(!filteredWorkouts?.dayOrder || filteredWorkouts.dayOrder.length === 0) ? (
                    <div className="bg-gray-800 rounded-2xl p-8 text-center border border-gray-700">
                        <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">Aucun jour d'entraînement ajouté.</p>
                        <p className="text-sm text-gray-500">Commencez par ajouter votre premier jour d'entraînement !</p>
                    </div>
                ) : (
                    (filteredWorkouts.dayOrder || []).map(dayId => {
                        const dayContent = filteredWorkouts.days?.[dayId];
                        if (!dayContent) return null;

                        const isDayExpanded = expandedDays.has(dayId);

                        return (
                            <div key={dayId} className="bg-gray-800 rounded-2xl shadow-lg border border-gray-700 overflow-hidden">
                                <div className={`flex justify-between items-center p-4 ${getDayButtonColors(dayId)} transition-all duration-300 ease-in-out`}>
                                    <button
                                        onClick={() => toggleDayExpansion(dayId)}
                                        className="flex-1 text-left flex items-center gap-2 focus:outline-none"
                                    >
                                        {isDayExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                        <h3 className="text-xl font-semibold">{dayId}</h3>
                                    </button>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleEditDayClick(dayId)}
                                            className="p-2 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors"
                                            title="Modifier le jour"
                                        >
                                            <Pencil className="h-5 w-5 text-gray-300" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDay(dayId)}
                                            className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                                            title="Supprimer le jour et ses exercices"
                                        >
                                            <Trash2 className="h-5 w-5 text-white" />
                                        </button>
                                    </div>
                                </div>
                                {isDayExpanded && (
                                    <div className="p-4 pt-0">
                                        {!dayContent.categories || Object.keys(dayContent.categories).length === 0 ? (
                                            <div className="py-4 text-center text-gray-400">
                                                Aucun exercice dans ce jour.
                                                <button
                                                    onClick={() => handleAddExerciseModalOpen(dayId, 'Nouveau')}
                                                    className="block mx-auto mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    Ajouter un exercice
                                                </button>
                                            </div>
                                        ) : (
                                            Object.entries(dayContent.categories).map(([categoryName, exercisesList]) => {
                                                if (!Array.isArray(exercisesList) || exercisesList.length === 0) return null;

                                                const isCategoryExpanded = expandedCategories.has(`${dayId}-${categoryName}`);

                                                return (
                                                    <div key={categoryName} className="mt-4 bg-gray-700 rounded-xl border border-gray-600 overflow-hidden">
                                                        <button
                                                            onClick={() => toggleCategoryExpansion(`${dayId}-${categoryName}`)}
                                                            className="w-full flex justify-between items-center p-3 bg-gray-700 text-left text-white font-medium focus:outline-none"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                {isCategoryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                {categoryName}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAddExerciseModalOpen(dayId, categoryName);
                                                                }}
                                                                className="p-1 bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors"
                                                                title="Ajouter un exercice à cette catégorie"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                        </button>
                                                        {isCategoryExpanded && (
                                                            <div className="p-3 border-t border-gray-600">
                                                                <ul className="space-y-4">
                                                                    {exercisesList.map(exerciseData => {
                                                                        if (!exerciseData) return null;
                                                                        
                                                                        const personalBest = personalBests[exerciseData.name?.toLowerCase()];
                                                                        const hasPb = personalBest && (personalBest.maxWeight > 0 || personalBest.maxReps > 0 || personalBest.maxVolume > 0);
                                                                        const isEditingNotes = editingNotesExerciseId === exerciseData.id;

                                                                        return (
                                                                            <li key={exerciseData.id} className="bg-gray-600 rounded-lg p-3 shadow border border-gray-500">
                                                                                <div className="flex justify-between items-center mb-2">
                                                                                    <h4 className="text-lg font-semibold text-white">{exerciseData.name}</h4>
                                                                                    <div className="flex space-x-2">
                                                                                        {isAdvancedMode && (
                                                                                            <>
                                                                                                <button
                                                                                                    onClick={() => analyzeProgressionWithAI && analyzeProgressionWithAI(exerciseData.name, [])}
                                                                                                    className="p-1 bg-purple-600 rounded-full text-white hover:bg-purple-700 transition-colors"
                                                                                                    title="Analyser avec l'IA"
                                                                                                >
                                                                                                    <Sparkles className="h-4 w-4" />
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => showProgressionGraphForExercise && showProgressionGraphForExercise(exerciseData.name, exerciseData.id)}
                                                                                                    className="p-1 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors"
                                                                                                    title="Voir le graphique de progression"
                                                                                                >
                                                                                                    <LineChartIcon className="h-4 w-4" />
                                                                                                </button>
                                                                                            </>
                                                                                        )}
                                                                                        <button
                                                                                            onClick={() => handleDeleteExercise(dayId, categoryName, exerciseData.id)}
                                                                                            className="p-1 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors"
                                                                                            title="Supprimer l'exercice"
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>

                                                                                {isCompactView ? (
                                                                                    <div className="text-gray-300 text-sm mb-2">{getSeriesDisplay(exerciseData.series)}</div>
                                                                                ) : (
                                                                                    <div className="space-y-2 mb-2">
                                                                                        {renderSeriesInput(dayId, categoryName, exerciseData.id, exerciseData.series)}
                                                                                        <button
                                                                                            onClick={() => handleAddSeries(dayId, categoryName, exerciseData.id)}
                                                                                            className="w-full py-2 border border-gray-500 text-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-500 transition-colors"
                                                                                        >
                                                                                            <Plus className="h-4 w-4" /> Ajouter une série
                                                                                        </button>
                                                                                    </div>
                                                                                )}

                                                                                {/* Notes de l'exercice */}
                                                                                <div className="mt-2 text-sm">
                                                                                    {isEditingNotes ? (
                                                                                        <div className="flex flex-col gap-2">
                                                                                            <textarea
                                                                                                value={activeExerciseNotes[exerciseData.id] ?? exerciseData.notes}
                                                                                                onChange={(e) => setActiveExerciseNotes(prev => ({ ...prev, [exerciseData.id]: e.target.value }))}
                                                                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                                                rows="2"
                                                                                                placeholder="Ajouter des notes..."
                                                                                            />
                                                                                            <div className="flex gap-2">
                                                                                                <button
                                                                                                    onClick={() => handleSaveNotes(dayId, categoryName, exerciseData.id)}
                                                                                                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                                                                                >
                                                                                                    Sauvegarder
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => setEditingNotesExerciseId(null)}
                                                                                                    className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                                                                                                >
                                                                                                    Annuler
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div
                                                                                            className="flex items-start justify-between bg-gray-700 p-2 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-600 transition-colors"
                                                                                            onClick={() => {
                                                                                                setEditingNotesExerciseId(exerciseData.id);
                                                                                                setActiveExerciseNotes(prev => ({ ...prev, [exerciseData.id]: exerciseData.notes || '' }));
                                                                                            }}
                                                                                        >
                                                                                            <p className={`flex-grow ${exerciseData.notes ? 'text-gray-300' : 'text-gray-500 italic'}`}>
                                                                                                <NotebookText className="inline-block h-4 w-4 mr-1 align-text-bottom" />
                                                                                                {exerciseData.notes || "Ajouter des notes..."}
                                                                                            </p>
                                                                                            <Pencil className="h-4 w-4 text-gray-400 ml-2" />
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {hasPb && isAdvancedMode && (
                                                                                    <div className="mt-2 text-xs text-gray-400 border-t border-gray-500 pt-2">
                                                                                        <p className="font-semibold text-yellow-400 flex items-center gap-1">
                                                                                            <Award className="h-3 w-3" />Records Personnels :
                                                                                        </p>
                                                                                        {personalBest.bestWeightSeries && <p>Max Poids: {personalBest.bestWeightSeries.weight}kg x {personalBest.bestWeightSeries.reps} reps</p>}
                                                                                        {personalBest.bestRepsSeries && <p>Max Reps: {personalBest.bestRepsSeries.reps} reps @ {personalBest.bestRepsSeries.weight}kg</p>}
                                                                                        {personalBest.maxVolume > 0 && <p>Max Volume: {personalBest.maxVolume} kg</p>}
                                                                                        {personalBest.lastAchieved && <p>Dernier record: {formatDate(personalBest.lastAchieved)}</p>}
                                                                                    </div>
                                                                                )}
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal pour ajouter un jour */}
            {showAddDayModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm border border-gray-700">
                        <h3 className="text-xl font-semibold text-white mb-4">Ajouter un nouveau jour</h3>
                        <input
                            type="text"
                            value={newDayName}
                            onChange={(e) => setNewDayName(e.target.value)}
                            placeholder="Nom du jour (ex: Jambes, Haut du corps)"
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-base"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAddDayModal(false);
                                    setNewDayName('');
                                }}
                                className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleAddDaySubmit}
                                disabled={!newDayName?.trim()}
                                className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                Ajouter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal pour modifier un jour */}
            {showEditDayModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm border border-gray-700">
                        <h3 className="text-xl font-semibold text-white mb-4">Modifier le jour</h3>
                        <input
                            type="text"
                            value={tempDayName}
                            onChange={(e) => setTempDayName(e.target.value)}
                            placeholder="Nouveau nom du jour"
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-base"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setEditingDay(null);
                                    setTempDayName('');
                                    setShowEditDayModal(false);
                                }}
                                className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleEditDaySubmit}
                                disabled={!tempDayName?.trim()}
                                className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                Sauvegarder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal pour ajouter un exercice */}
            {showAddExerciseModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm border border-gray-700">
                        <h3 className="text-xl font-semibold text-white mb-4">Ajouter un exercice</h3>
                        <div className="mb-4">
                            <label htmlFor="exercise-name" className="block text-sm font-medium text-gray-300 mb-2">Nom de l'exercice:</label>
                            <input
                                type="text"
                                id="exercise-name"
                                value={newExerciseName}
                                onChange={(e) => setNewExerciseName(e.target.value)}
                                placeholder="Ex: Développé couché"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                autoFocus
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="exercise-category" className="block text-sm font-medium text-gray-300 mb-2">Catégorie:</label>
                            <select
                                id="exercise-category"
                                value={currentCategoryForExercise || newExerciseCategory}
                                onChange={(e) => {
                                    if (e.target.value === 'new-category') {
                                        setCurrentCategoryForExercise(null);
                                        setNewExerciseCategory('');
                                    } else {
                                        setCurrentCategoryForExercise(e.target.value);
                                        setNewExerciseCategory('');
                                    }
                                }}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none mb-2 text-base"
                            >
                                <option value="">Sélectionnez ou créez une catégorie</option>
                                {currentCategoryForExercise && (
                                    <option value={currentCategoryForExercise}>{currentCategoryForExercise}</option>
                                )}
                                {Object.keys(workouts?.days?.[currentDayIdForExercise]?.categories || {})
                                    .filter(categoryOption => categoryOption !== currentCategoryForExercise)
                                    .map(categoryOption => (
                                        <option key={categoryOption} value={categoryOption}>{categoryOption}</option>
                                    ))}
                                <option value="new-category">--- Nouvelle catégorie ---</option>
                            </select>
                            {(currentCategoryForExercise === null || (currentCategoryForExercise === '' && newExerciseCategory === '')) && (
                                <input
                                    type="text"
                                    value={newExerciseCategory}
                                    onChange={(e) => setNewExerciseCategory(e.target.value)}
                                    placeholder="Nom de la nouvelle catégorie"
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                                />
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowAddExerciseModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleAddExerciseSubmit}
                                disabled={!newExerciseName?.trim() || (!currentCategoryForExercise && !newExerciseCategory?.trim())}
                                className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                Ajouter
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainWorkoutView;