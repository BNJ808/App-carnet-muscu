import React, { useState, useMemo } from 'react';
import {
    Plus, Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    ArrowUp, ArrowDown, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Search, Dumbbell
} from 'lucide-react';

/**
 * Composant MainWorkoutView pour afficher la vue principale des entraînements.
 */
const MainWorkoutView = ({ 
    workouts, 
    selectedDayFilter, 
    setSelectedDayFilter,
    isAdvancedMode,
    isCompactView,
    handleEditClick,
    handleAddExerciseClick,
    handleDeleteExercise,
    handleToggleSeriesCompleted, 
    handleUpdateSeries, 
    handleDeleteSeries, // Nouvelle prop
    handleAddSeries, // Nouvelle prop pour ajouter une série
    analyzeProgressionWithAI,
    showProgressionGraphForExercise, // Nouvelle prop pour le graphique
    personalBests,
    getDayButtonColors,
    formatDate,
    getSeriesDisplay,
    isSavingExercise,
    isDeletingExercise,
    isAddingExercise,
    searchTerm,
    setSearchTerm,
    days = [],
    categories = [],
    handleAddDay, // Gestion des jours
    handleEditDay, // Gestion des jours
    handleDeleteDay, // Gestion des jours
}) => {
    const [expandedDays, setExpandedDays] = useState(new Set(workouts?.dayOrder)); 
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [showAddDayModal, setShowAddDayModal] = useState(false);
    const [newDayName, setNewDayName] = useState('');
    const [editingDay, setEditingDay] = useState(null); 

    const toggleDayExpansion = (dayName) => {
        setExpandedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayName)) {
                newSet.delete(dayName);
            } else {
                newSet.add(dayName);
            }
            return newSet;
        });
    };

    const toggleCategoryExpansion = (categoryName) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryName)) {
                newSet.delete(categoryName);
            } else {
                newSet.add(categoryName);
            }
            return newSet;
        });
    };

    const handleAddDaySubmit = () => {
        if (newDayName.trim()) {
            handleAddDay(newDayName.trim());
            setNewDayName('');
            setShowAddDayModal(false);
        }
    };

    const handleEditDayTrigger = (dayName) => {
        setEditingDay(dayName);
        setNewDayName(dayName); 
    };

    const handleEditDaySubmit = () => {
        if (editingDay && newDayName.trim()) {
            handleEditDay(editingDay, newDayName.trim());
            setEditingDay(null);
            setNewDayName('');
        }
    };

    const filteredWorkouts = useMemo(() => {
        const filteredDays = {};
        const orderedDays = selectedDayFilter
            ? [selectedDayFilter]
            : (workouts?.dayOrder || []);

        orderedDays.forEach(dayName => {
            const dayData = workouts.days[dayName];
            if (dayData) {
                filteredDays[dayName] = {
                    ...dayData,
                    categories: Object.fromEntries(
                        Object.entries(dayData.categories).map(([categoryName, exercises]) => {
                            const filteredExercises = exercises.filter(exercise => {
                                const matchesSearch = searchTerm ? exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                                return !exercise.isDeleted && matchesSearch;
                            });
                            return [categoryName, filteredExercises];
                        }).filter(([, exercises]) => exercises.length > 0)
                    )
                };
            }
        });

        return { days: filteredDays, dayOrder: orderedDays.filter(dayName => Object.keys(filteredDays[dayName].categories).length > 0) };
    }, [workouts, selectedDayFilter, searchTerm]);


    return (
        <div className="space-y-6">
            {/* Barre de recherche et filtres de jour */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <Search className="h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-base"
                    />
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setSelectedDayFilter('')}
                        className={`px-4 py-2 rounded-full font-medium transition-all text-sm ${selectedDayFilter === ''
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        Tous les jours
                    </button>
                    {(workouts?.dayOrder || []).map((dayName, index) => (
                        <button
                            key={dayName}
                            onClick={() => setSelectedDayFilter(dayName)}
                            className={`px-4 py-2 rounded-full font-medium transition-all text-sm ${getDayButtonColors(index, selectedDayFilter === dayName)}`}
                        >
                            {dayName}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowAddDayModal(true)}
                        className="px-4 py-2 rounded-full font-medium transition-all bg-green-500 text-white hover:bg-green-600 text-sm flex items-center gap-1"
                    >
                        <Plus className="h-4 w-4" /> Ajouter un jour
                    </button>
                </div>

                {searchTerm && filteredWorkouts.dayOrder.length === 0 && (
                    <p className="text-gray-400 text-center text-sm">
                        Aucun exercice trouvé pour "{searchTerm}"
                    </p>
                )}
            </div>

            {/* Liste des jours et exercices */}
            {filteredWorkouts.dayOrder.length === 0 && !searchTerm ? (
                <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
                    <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2 text-lg font-medium">Commencez votre entraînement !</p>
                    <p className="text-sm text-gray-500 mb-4">
                        Ajoutez votre premier jour et vos premiers exercices pour commencer à suivre votre progression.
                    </p>
                    <button
                        onClick={() => setShowAddDayModal(true)}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold"
                    >
                        <Plus className="h-5 w-5 inline-block mr-2" /> Ajouter un jour d'entraînement
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredWorkouts.dayOrder.map((dayName, dayIndex) => (
                        <div key={dayName} className="bg-gray-800 rounded-xl shadow-lg border border-gray-700">
                            <button
                                onClick={() => toggleDayExpansion(dayName)}
                                className={`w-full flex items-center justify-between p-4 font-bold text-xl rounded-t-xl transition-all ${getDayButtonColors(dayIndex, expandedDays.has(dayName))}`}
                            >
                                {dayName}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditDayTrigger(dayName); }}
                                        className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                        title="Renommer le jour"
                                    >
                                        <Pencil className="h-4 w-4 text-white" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteDay(dayName); }}
                                        className="p-1 rounded-full bg-red-500/30 hover:bg-red-500/50 transition-colors"
                                        title="Supprimer le jour"
                                    >
                                        <Trash2 className="h-4 w-4 text-white" />
                                    </button>
                                    {expandedDays.has(dayName) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </div>
                            </button>

                            {expandedDays.has(dayName) && (
                                <div className="p-4 space-y-6">
                                    {Object.keys(filteredWorkouts.days[dayName].categories).sort().map(categoryName => (
                                        <div key={categoryName} className="bg-gray-700/50 rounded-lg border border-gray-600">
                                            <button
                                                onClick={() => toggleCategoryExpansion(categoryName)}
                                                className="w-full flex items-center justify-between p-3 font-semibold text-lg text-white bg-gray-700 rounded-t-lg hover:bg-gray-600 transition-colors"
                                            >
                                                {categoryName}
                                                {expandedCategories.has(categoryName) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                            </button>

                                            {expandedCategories.has(categoryName) && (
                                                <div className="p-3 space-y-4">
                                                    {filteredWorkouts.days[dayName].categories[categoryName].map(exercise => (
                                                        <div key={exercise.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-md">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-lg font-bold text-blue-400">{exercise.name}</h4>
                                                                <div className="flex items-center gap-2">
                                                                    {personalBests[exercise.id] && (
                                                                        <span className="text-yellow-400 text-sm font-medium flex items-center gap-1">
                                                                            <Award className="h-4 w-4" /> PB: {personalBests[exercise.id].maxWeight}kg
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Notes de l'exercice */}
                                                            {exercise.notes && (
                                                                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs p-2 rounded-md mb-3 whitespace-pre-wrap">
                                                                    <NotebookText className="inline-block h-3 w-3 mr-1" /> {exercise.notes}
                                                                </div>
                                                            )}

                                                            <div className="space-y-2 mb-4">
                                                                {(exercise.series || []).map((serie, serieIndex) => (
                                                                    <div key={serieIndex} className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={serie.completed}
                                                                            onChange={() => handleToggleSeriesCompleted(dayName, categoryName, exercise.id, serieIndex)}
                                                                            className="form-checkbox h-5 w-5 text-green-500 rounded border-gray-600 bg-gray-700"
                                                                        />
                                                                        <div className="flex flex-1 gap-2">
                                                                            <input
                                                                                type="number"
                                                                                value={serie.weight}
                                                                                onChange={(e) => handleUpdateSeries(dayName, categoryName, exercise.id, serieIndex, 'weight', e.target.value)}
                                                                                className="w-1/2 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                                                                placeholder="Poids"
                                                                                step="0.5"
                                                                            />
                                                                            <span className="text-gray-400">kg ×</span>
                                                                            <input
                                                                                type="number"
                                                                                value={serie.reps}
                                                                                onChange={(e) => handleUpdateSeries(dayName, categoryName, exercise.id, serieIndex, 'reps', e.target.value)}
                                                                                className="w-1/2 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                                                                placeholder="Reps"
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteSeries(dayName, categoryName, exercise.id, serieIndex)}
                                                                            className="p-1 rounded-full bg-red-500/30 hover:bg-red-500/50 text-white transition-colors"
                                                                            title="Supprimer la série"
                                                                        >
                                                                            <XCircle className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    onClick={() => handleAddSeries(dayName, categoryName, exercise.id)}
                                                                    className="w-full mt-2 px-3 py-1 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all text-sm flex items-center justify-center gap-1"
                                                                >
                                                                    <Plus className="h-4 w-4" /> Ajouter une série
                                                                </button>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 mt-4">
                                                                <button
                                                                    onClick={() => handleEditClick(dayName, categoryName, exercise.id, exercise)}
                                                                    className="flex-1 px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all text-sm flex items-center justify-center gap-1 min-w-[120px]"
                                                                >
                                                                    <Pencil className="h-4 w-4" /> Éditer
                                                                </button>
                                                                <button
                                                                    onClick={() => showProgressionGraphForExercise(exercise)}
                                                                    className="flex-1 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all text-sm flex items-center justify-center gap-1 min-w-[120px]"
                                                                    disabled={isSavingExercise}
                                                                >
                                                                    <LineChartIcon className="h-4 w-4" /> Graphique
                                                                </button>
                                                                <button
                                                                    onClick={() => analyzeProgressionWithAI(exercise)}
                                                                    className="flex-1 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all text-sm flex items-center justify-center gap-1 min-w-[120px]"
                                                                    disabled={isSavingExercise}
                                                                >
                                                                    <Sparkles className="h-4 w-4" /> IA
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteExercise(dayName, categoryName, exercise.id)}
                                                                    className={`flex-1 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all text-sm flex items-center justify-center gap-1 min-w-[120px] ${isDeletingExercise ? 'opacity-50 cursor-wait' : ''}`}
                                                                    disabled={isDeletingExercise}
                                                                >
                                                                    <Trash2 className="h-4 w-4" /> Supprimer
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => handleAddExerciseClick(dayName, categoryName)} 
                                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium flex items-center justify-center gap-2 mt-4"
                                                    >
                                                        <Plus className="h-5 w-5" /> Ajouter un exercice à {categoryName}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleAddExerciseClick(dayName, null)} 
                                        className="w-full px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold flex items-center justify-center gap-2 mt-4"
                                    >
                                        <Plus className="h-5 w-5" /> Ajouter un exercice à {dayName}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modale d'ajout de jour */}
            {showAddDayModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 animate-slide-up">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-4">Ajouter un nouveau jour</h3>
                            <input
                                type="text"
                                value={newDayName}
                                onChange={(e) => setNewDayName(e.target.value)}
                                placeholder="Nom du jour (ex: Lundi - Pecs/Triceps)"
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
                                    disabled={!newDayName.trim()}
                                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    Ajouter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modale d'édition de jour */}
            {editingDay && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 animate-slide-up">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-4">Renommer le jour</h3>
                            <input
                                type="text"
                                value={newDayName}
                                onChange={(e) => setNewDayName(e.target.value)}
                                placeholder="Nouveau nom du jour"
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-base"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setEditingDay(null);
                                        setNewDayName('');
                                    }}
                                    className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all active:scale-95"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleEditDaySubmit}
                                    disabled={!newDayName.trim()}
                                    className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    Sauvegarder
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainWorkoutView;
