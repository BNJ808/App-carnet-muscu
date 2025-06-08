import React, { useState } from 'react';
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
    handleToggleSeriesCompleted, // New prop
    handleUpdateSeries, // New prop
    analyzeProgressionWithAI,
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
    handleAddDay,
    handleEditDay,
    handleDeleteDay
}) => {
    const [expandedDays, setExpandedDays] = useState(new Set(workouts?.dayOrder)); // Initialize with all days expanded
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [showAddDayModal, setShowAddDayModal] = useState(false);
    const [newDayName, setNewDayName] = useState('');
    const [editingDay, setEditingDay] = useState(null);

    const toggleDayExpanded = (day) => {
        const newExpanded = new Set(expandedDays);
        if (newExpanded.has(day)) {
            newExpanded.delete(day);
        } else {
            newExpanded.add(day);
        }
        setExpandedDays(newExpanded);
    };

    const toggleCategoryExpanded = (dayCategory) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(dayCategory)) {
            newExpanded.delete(dayCategory);
        } else {
            newExpanded.add(dayCategory);
        }
        setExpandedCategories(newExpanded);
    };

    const getDaysToShow = () => {
        if (!workouts?.dayOrder || !Array.isArray(workouts.dayOrder)) {
            return [];
        }
        return selectedDayFilter ? [selectedDayFilter] : workouts.dayOrder;
    };

    const getAvailableCategories = (dayName) => {
        if (!workouts?.days?.[dayName]?.categories) {
            return [];
        }
        
        // Retourner les catégories qui ont des exercices
        return Object.keys(workouts.days[dayName].categories).filter(categoryName => {
            const exercises = workouts.days[dayName].categories[categoryName];
            return Array.isArray(exercises) && exercises.length > 0;
        });
    };

    const handleAddDaySubmit = () => {
        if (!newDayName.trim()) return;
        
        if (handleAddDay) {
            handleAddDay(newDayName.trim());
        }
        
        setNewDayName('');
        setShowAddDayModal(false);
    };

    const handleEditDaySubmit = () => {
        if (!editingDay || !newDayName.trim()) return;
        
        if (handleEditDay) {
            handleEditDay(editingDay, newDayName.trim());
        }
        
        setEditingDay(null);
        setNewDayName('');
    };

    const renderExerciseSeries = (exercise, dayName, categoryName) => {
        if (!exercise.series || !Array.isArray(exercise.series) || exercise.series.length === 0) {
            return (
                <div className="text-gray-400 text-sm italic">
                    Aucune série configurée
                </div>
            );
        }

        return (
            <div className="space-y-2 mt-3">
                {exercise.series.map((serie, serieIndex) => (
                    <div key={serie.id || serieIndex} className={`flex items-center gap-2 bg-gray-600/50 rounded-md p-2 ${serie.completed ? 'opacity-60 grayscale' : ''}`}>
                        <span className="text-xs text-gray-400 w-6">#{serieIndex + 1}</span>
                        
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={serie.weight}
                                onChange={(e) => handleUpdateSeries(dayName, categoryName, exercise.id, serieIndex, 'weight', e.target.value)}
                                className="bg-transparent text-white text-xs w-12 text-center border-b border-gray-500 focus:outline-none focus:border-blue-400"
                                placeholder="Poids"
                                step="0.5"
                            />
                            <span className="text-xs text-gray-300">kg</span>
                            <span className="text-gray-400">×</span>
                            <input
                                type="number"
                                value={serie.reps}
                                onChange={(e) => handleUpdateSeries(dayName, categoryName, exercise.id, serieIndex, 'reps', e.target.value)}
                                className="bg-transparent text-white text-xs w-12 text-center border-b border-gray-500 focus:outline-none focus:border-blue-400"
                                placeholder="Reps"
                            />
                        </div>
                        
                        <div className="flex-1"></div>
                        
                        <button
                            onClick={() => handleToggleSeriesCompleted(dayName, categoryName, exercise.id, serieIndex)}
                            className={`p-1 rounded transition-colors ${
                                serie.completed 
                                    ? 'text-green-400 hover:text-green-300' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title={serie.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
                        >
                            {serie.completed ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </button>
                        
                        {/* <button
                            onClick={() => console.log('Démarrer minuteur de repos')}
                            className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                            title="Démarrer minuteur de repos"
                        >
                            <Clock className="h-4 w-4" />
                        </button> */}
                    </div>
                ))}
            </div>
        );
    };

    const renderExercise = (exercise, dayName, categoryName) => {
        if (!exercise || exercise.isDeleted) {
            return null;
        }

        const personalBest = personalBests?.[exercise.id];
        
        // Filtrage par terme de recherche
        if (searchTerm && !exercise.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            return null;
        }
        
        return (
            <div key={exercise.id} className={`bg-gray-700/50 rounded-lg border border-gray-600/50 transition-all p-4`}>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <h4 className="font-medium text-white mb-1">{exercise.name}</h4>
                        
                        {personalBest && (
                            <div className="text-xs text-yellow-400 mb-1">
                                🏆 Record: {personalBest.maxWeight}kg × {personalBest.maxReps} reps
                            </div>
                        )}
                        
                        {exercise.notes && (
                            <div className="text-xs text-gray-400 mb-2">
                                📝 {exercise.notes}
                            </div>
                        )}

                        <div className="text-sm text-gray-300 mb-2">
                            {getSeriesDisplay(exercise.series)}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-3">
                        {/* Fonctionnalités par défaut (plus en mode avancé uniquement) */}
                        {/* <button
                            onClick={() => analyzeProgressionWithAI && analyzeProgressionWithAI(exercise)}
                            className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                            title="Analyser avec IA"
                        >
                            <Sparkles className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={() => console.log('Voir graphique de progression')}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                            title="Voir graphique de progression"
                        >
                            <LineChartIcon className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={() => console.log('Modifier les notes')}
                            className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded transition-colors"
                            title="Modifier les notes"
                        >
                            <NotebookText className="h-4 w-4" />
                        </button> */}
                        
                        <button
                            onClick={() => handleEditClick && handleEditClick(dayName, categoryName, exercise.id, exercise)}
                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                            title="Modifier l'exercice"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={() => handleDeleteExercise && handleDeleteExercise(dayName, categoryName, exercise.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                            title="Supprimer l'exercice"
                            disabled={isDeletingExercise}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                
                {renderExerciseSeries(exercise, dayName, categoryName)}
            </div>
        );
    };

    const renderCategory = (categoryName, exercises, dayName) => {
        if (!Array.isArray(exercises)) {
            return null;
        }

        const activeExercises = exercises.filter(ex => ex && !ex.isDeleted);
        if (activeExercises.length === 0 && !searchTerm) return null; // Hide if no active exercises and not searching
        
        const categoryKey = `${dayName}-${categoryName}`;
        const isExpanded = expandedCategories.has(categoryKey);
        
        return (
            <div key={categoryName} className="mb-6">
                <button
                    onClick={() => toggleCategoryExpanded(categoryKey)}
                    className="w-full flex items-center justify-between p-3 bg-gray-600/30 hover:bg-gray-600/50 rounded-lg transition-colors mb-3"
                >
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-purple-300">{categoryName}</span>
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                            {activeExercises.length}
                        </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                
                {isExpanded && (
                    <div className="space-y-3">
                        {activeExercises.map(exercise => renderExercise(exercise, dayName, categoryName))}
                        
                        {/* Bouton toujours visible par défaut */}
                        <button
                            onClick={() => handleAddExerciseClick && handleAddExerciseClick(dayName, categoryName)}
                            className="w-full bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-gray-600"
                            disabled={isAddingExercise}
                        >
                            <Plus className="h-4 w-4" />
                            Ajouter un exercice à {categoryName}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderDay = (dayName, dayIndex) => {
        const dayData = workouts?.days?.[dayName];
        if (!dayData || !dayData.categories) return null;
        
        const isExpanded = expandedDays.has(dayName);
        const availableCategories = getAvailableCategories(dayName);
        
        const totalExercises = availableCategories.reduce((total, categoryName) => {
            const exercises = dayData.categories[categoryName];
            return total + (Array.isArray(exercises) ? exercises.filter(ex => ex && !ex.isDeleted).length : 0);
        }, 0);
        
        const dayColors = [
            'bg-blue-600/20 text-blue-400 border-blue-600/50',
            'bg-green-600/20 text-green-400 border-green-600/50',
            'bg-purple-600/20 text-purple-400 border-purple-600/50',
            'bg-yellow-600/20 text-yellow-400 border-yellow-600/50',
            'bg-red-600/20 text-red-400 border-red-600/50',
            'bg-indigo-600/20 text-indigo-400 border-indigo-600/50',
            'bg-pink-600/20 text-pink-400 border-pink-600/50',
        ];
        const currentDayColorClass = dayColors[dayIndex % dayColors.length];
        
        return (
            <div key={dayName} className="mb-8">
                <button
                    onClick={() => toggleDayExpanded(dayName)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border ${currentDayColorClass}`}
                >
                    <div className="flex items-center gap-3">
                        <h2 className={`text-xl font-bold ${currentDayColorClass.includes('text-') ? currentDayColorClass.split(' ').find(cls => cls.startsWith('text-')) : 'text-white'}`}>{dayName}</h2>
                        <span className="text-sm bg-gray-600/50 text-gray-300 px-3 py-1 rounded-full">
                            {totalExercises} exercice{totalExercises !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Boutons de gestion du jour */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingDay(dayName);
                                setNewDayName(dayName);
                            }}
                            className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                            title="Modifier le jour"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                // Using confirm for now, will replace with custom modal if needed
                                if (confirm(`Êtes-vous sûr de vouloir supprimer le jour "${dayName}" et tous ses exercices ?`)) { 
                                    handleDeleteDay(dayName);
                                }
                            }}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                            title="Supprimer le jour"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                        
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                </button>
                
                {isExpanded && (
                    <div className="mt-4 pl-4">
                        {availableCategories.map(categoryName => {
                            const exercises = dayData.categories[categoryName];
                            return renderCategory(categoryName, exercises, dayName);
                        })}
                        
                        {totalExercises === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                <p className="mb-4">Aucun exercice programmé pour {dayName}</p>
                                <button
                                    onClick={() => handleAddExerciseClick && handleAddExerciseClick(dayName)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                                    disabled={isAddingExercise}
                                >
                                    <Plus className="h-4 w-4" />
                                    Ajouter le premier exercice
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const filteredDays = getDaysToShow();

    return (
        <div className="space-y-6">
            {/* Sélecteur de jour modifié */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Jours d'entraînement</h3>
                    {searchTerm && (
                        <div className="text-sm text-gray-400">
                            Recherche: "{searchTerm}"
                        </div>
                    )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {Array.isArray(workouts?.dayOrder) && workouts.dayOrder.map((day, index) => (
                        <button
                            key={day}
                            onClick={() => setSelectedDayFilter(selectedDayFilter === day ? '' : day)}
                            className={`p-3 rounded-lg transition-all ${
                                selectedDayFilter === day
                                    ? getDayButtonColors ? getDayButtonColors(index, true) : 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {day}
                        </button>
                    ))}
                    
                    {/* Bouton d'ajout de jour */}
                    <button
                        onClick={() => setShowAddDayModal(true)}
                        className="p-3 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 border-2 border-dashed border-green-600/50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Ajouter un jour
                    </button>
                </div>

                {/* Barre de recherche */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm && setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Liste des jours */}
            <div className="space-y-6">
                {filteredDays.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="mb-4">
                            <Dumbbell className="h-16 w-16 mx-auto text-gray-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Aucun jour d'entraînement configuré</h3>
                        <p className="mb-6">Commencez par ajouter votre premier jour d'entraînement</p>
                        <button
                            onClick={() => setShowAddDayModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                        >
                            <Plus className="h-4 w-4" />
                            Créer mon premier jour
                        </button>
                    </div>
                ) : (
                    filteredDays.map((dayName, dayIndex) => renderDay(dayName, dayIndex))
                )}
            </div>

            {/* Modal d'ajout de jour */}
            {showAddDayModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-4">Ajouter un jour d'entraînement</h3>
                            <input
                                type="text"
                                value={newDayName}
                                onChange={(e) => setNewDayName(e.target.value)}
                                placeholder="Ex: Lundi - Push, Mardi - Pull..."
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowAddDayModal(false);
                                        setNewDayName('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleAddDaySubmit}
                                    disabled={!newDayName.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Ajouter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal d'édition de jour */}
            {editingDay && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-4">Modifier le jour d'entraînement</h3>
                            <input
                                type="text"
                                value={newDayName}
                                onChange={(e) => setNewDayName(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setEditingDay(null);
                                        setNewDayName('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleEditDaySubmit}
                                    disabled={!newDayName.trim()}
                                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Modifier
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Indicateurs de statut */}
            {isSavingExercise && (
                <div className="fixed bottom-20 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-40">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sauvegarde...
                </div>
            )}

            {isDeletingExercise && (
                <div className="fixed bottom-20 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-40">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Suppression...
                </div>
            )}

            {isAddingExercise && (
                <div className="fixed bottom-20 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-40">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Ajout...
                </div>
            )}
        </div>
    );
};

export default MainWorkoutView;
