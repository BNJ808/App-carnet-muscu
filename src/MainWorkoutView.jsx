import React, { useState } from 'react';
import {
    Plus, Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    ArrowUp, ArrowDown, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp
} from 'lucide-react';

/**
 * Composant MainWorkoutView pour afficher la vue principale des entraînements.
 */
const MainWorkoutView = ({ 
    workouts, 
    selectedDayFilter, 
    isEditMode,
    isAdvancedMode,
    isCompactView,
    handleEditClick,
    handleAddExerciseClick,
    handleDeleteExercise,
    openExerciseGraphModal,
    handleOpenNotesModal,
    handleAnalyzeProgressionClick,
    personalBests,
    progressionInsights,
    handleReorderCategories,
    handleReorderExercises,
    openAddCategoryModalForDay,
    handleEditCategory,
    handleDeleteCategory,
    isSavingExercise,
    isDeletingExercise,
    isAddingExercise,
    dayButtonColors,
    dayBorderAndTextColors,
    dayTitleColors,
    formatDate,
    getSeriesDisplay,
    startTimer,
    updateSerieValue,
    toggleSerieCompletion,
    addSerie,
    deleteSerie,
    categories,
    days
}) => {
    const [expandedDays, setExpandedDays] = useState(new Set(days));
    const [expandedCategories, setExpandedCategories] = useState(new Set());

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
        return selectedDayFilter ? [selectedDayFilter] : days;
    };

    const renderExerciseSeries = (exercise, dayName, categoryName) => {
        if (!exercise.series || exercise.series.length === 0) {
            return (
                <div className="text-gray-400 text-sm italic">
                    Aucune série configurée
                </div>
            );
        }

        return (
            <div className="space-y-2 mt-3">
                {exercise.series.map((serie, serieIndex) => (
                    <div key={serie.id || serieIndex} className="flex items-center gap-2 bg-gray-600/50 rounded-md p-2">
                        <span className="text-xs text-gray-400 w-6">#{serieIndex + 1}</span>
                        
                        <input
                            type="number"
                            placeholder="Poids"
                            value={serie.weight || ''}
                            onChange={(e) => updateSerieValue && updateSerieValue(dayName, categoryName, exercise.id, serie.id, 'weight', e.target.value)}
                            className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-16 text-center"
                        />
                        <span className="text-gray-400 text-xs">kg</span>
                        
                        <span className="text-gray-400">×</span>
                        
                        <input
                            type="number"
                            placeholder="Reps"
                            value={serie.reps || ''}
                            onChange={(e) => updateSerieValue && updateSerieValue(dayName, categoryName, exercise.id, serie.id, 'reps', e.target.value)}
                            className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-16 text-center"
                        />
                        
                        <button
                            onClick={() => toggleSerieCompletion && toggleSerieCompletion(dayName, categoryName, exercise.id, serie.id)}
                            className={`p-1 rounded transition-colors ${
                                serie.completed 
                                    ? 'text-green-400 hover:text-green-300' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                            title={serie.completed ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
                        >
                            {serie.completed ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        </button>
                        
                        {isAdvancedMode && (
                            <>
                                <button
                                    onClick={() => startTimer && startTimer(90)}
                                    className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Démarrer minuteur de repos"
                                >
                                    <Clock className="h-4 w-4" />
                                </button>
                                
                                <button
                                    onClick={() => deleteSerie && deleteSerie(dayName, categoryName, exercise.id, serie.id)}
                                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                    title="Supprimer cette série"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
                
                {isAdvancedMode && (
                    <button
                        onClick={() => addSerie && addSerie(dayName, categoryName, exercise.id)}
                        className="w-full bg-gray-600/30 hover:bg-gray-600/50 text-gray-300 text-sm py-2 rounded-md transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="h-3 w-3" />
                        Ajouter une série
                    </button>
                )}
            </div>
        );
    };

    const renderExercise = (exercise, dayName, categoryName) => {
        const personalBest = personalBests[exercise.name];
        const insight = progressionInsights[exercise.name];
        
        return (
            <div key={exercise.id} className={`bg-gray-700/50 rounded-lg p-4 border border-gray-600/50 transition-all ${isCompactView ? 'p-3' : 'p-4'}`}>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <h4 className="font-medium text-white mb-1">{exercise.name}</h4>
                        
                        {personalBest && (
                            <div className="text-xs text-yellow-400 mb-1">
                                🏆 Record: {personalBest.maxWeight}kg × {personalBest.maxWeightReps} reps
                            </div>
                        )}
                        
                        {insight && (
                            <div className="text-xs text-blue-400 mb-1">
                                💡 {insight.trend}
                            </div>
                        )}
                        
                        {exercise.notes && (
                            <div className="text-xs text-gray-400 mb-2">
                                📝 {exercise.notes}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-3">
                        {isAdvancedMode && (
                            <>
                                <button
                                    onClick={() => openExerciseGraphModal && openExerciseGraphModal(exercise.name)}
                                    className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors"
                                    title="Voir graphique de progression"
                                >
                                    <LineChartIcon className="h-4 w-4" />
                                </button>
                                
                                <button
                                    onClick={() => handleOpenNotesModal && handleOpenNotesModal(exercise)}
                                    className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded transition-colors"
                                    title="Modifier les notes"
                                >
                                    <NotebookText className="h-4 w-4" />
                                </button>
                                
                                <button
                                    onClick={() => handleAnalyzeProgressionClick && handleAnalyzeProgressionClick(exercise.name)}
                                    className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                                    title="Analyser avec IA"
                                >
                                    <Sparkles className="h-4 w-4" />
                                </button>
                            </>
                        )}
                        
                        <button
                            onClick={() => handleEditClick && handleEditClick(exercise, dayName, categoryName)}
                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                            title="Modifier l'exercice"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        
                        <button
                            onClick={() => handleDeleteExercise && handleDeleteExercise(dayName, categoryName, exercise.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                            title="Supprimer l'exercice"
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
        const activeExercises = exercises.filter(ex => !ex.isDeleted);
        if (activeExercises.length === 0) return null;
        
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
                        
                        {isAdvancedMode && (
                            <button
                                onClick={() => handleAddExerciseClick && handleAddExerciseClick(dayName, categoryName)}
                                className="w-full bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-gray-600"
                            >
                                <Plus className="h-4 w-4" />
                                Ajouter un exercice à {categoryName}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderDay = (dayName, dayIndex) => {
        const dayData = workouts?.days?.[dayName];
        if (!dayData || !dayData.categories) return null;
        
        const isExpanded = expandedDays.has(dayName);
        const totalExercises = Object.values(dayData.categories).reduce((total, exercises) => {
            return total + (Array.isArray(exercises) ? exercises.filter(ex => !ex.isDeleted).length : 0);
        }, 0);
        
        const buttonColors = dayButtonColors ? dayButtonColors(dayIndex) : { default: 'bg-gray-700', selected: 'bg-blue-600' };
        const titleColor = dayTitleColors ? dayTitleColors[dayIndex] : 'text-blue-400';
        
        return (
            <div key={dayName} className="mb-8">
                <button
                    onClick={() => toggleDayExpanded(dayName)}
                    className={`w-full flex items-center justify-between p-4 ${buttonColors.default} hover:${buttonColors.selected} rounded-xl transition-all border border-gray-600/50`}
                >
                    <div className="flex items-center gap-3">
                        <h2 className={`text-xl font-bold ${titleColor}`}>{dayName}</h2>
                        <span className="text-sm bg-gray-600/50 text-gray-300 px-3 py-1 rounded-full">
                            {totalExercises} exercice{totalExercises !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </button>
                
                {isExpanded && (
                    <div className="mt-4 pl-4">
                        {categories.map(categoryName => {
                            const exercises = dayData.categories[categoryName];
                            if (!Array.isArray(exercises)) return null;
                            return renderCategory(categoryName, exercises, dayName);
                        })}
                        
                        {totalExercises === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                <p className="mb-4">Aucun exercice programmé pour {dayName}</p>
                                <button
                                    onClick={() => handleAddExerciseClick && handleAddExerciseClick(dayName)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
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

    return (
        <div className="space-y-6">
            {/* Bouton d'ajout rapide */}
            <div className="flex justify-center">
                <button
                    onClick={() => handleAddExerciseClick && handleAddExerciseClick()}
                    disabled={isAddingExercise}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg"
                >
                    <Plus className="h-5 w-5" />
                    {isAddingExercise ? 'Ajout en cours...' : 'Ajouter un exercice'}
                </button>
            </div>
            
            {/* Liste des jours */}
            <div className="space-y-6">
                {getDaysToShow().map((dayName, dayIndex) => renderDay(dayName, dayIndex))}
            </div>
            
            {/* Indicateur de sauvegarde */}
            {isSavingExercise && (
                <div className="fixed bottom-20 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sauvegarde...
                </div>
            )}
        </div>
    );
};

export default MainWorkoutView;