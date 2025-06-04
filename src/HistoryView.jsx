import React, { useState, useEffect } from 'react';
import {
    Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    RotateCcw
} from 'lucide-react';
import DatePicker from 'react-datepicker'; // Assurez-vous que react-datepicker est installé
import 'react-datepicker/dist/react-datepicker.css'; // Importez le CSS

/**
 * Composant HistoryView pour afficher l'historique des entraînements.
 * Permet de naviguer entre les dates, de filtrer par jour et d'afficher les exercices supprimés.
 * @param {object} props - Les props du composant.
 * @param {object} props.workouts - L'objet contenant toutes les données d'entraînement.
 * @param {Date | null} props.selectedDateForHistory - La date sélectionnée pour l'historique.
 * @param {string | null} props.selectedHistoryDayFilter - Le jour sélectionné pour filtrer l'historique.
 * @param {boolean} props.showDeletedExercisesInHistory - Indique si les exercices supprimés doivent être affichés.
 * @param {function} props.setShowDeletedExercisesInHistory - Fonction pour définir l'état d'affichage des exercices supprimés.
 * @param {function} props.handleDateChange - Fonction pour gérer le changement de date.
 * @param {function} props.navigateHistory - Fonction pour naviguer dans l'historique (jour précédent/suivant).
 * @param {function} props.setSelectedHistoryDayFilter - Fonction pour définir le filtre de jour de l'historique.
 * @param {function} props.getAllUniqueDays - Fonction pour obtenir tous les noms de jours uniques.
 * @param {function} props.formatDate - Fonction utilitaire pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction utilitaire pour afficher les séries d'un exercice.
 * @param {function} props.handleReactivateExercise - Fonction pour réactiver un exercice supprimé.
 * @param {function} props.openExerciseGraphModal - Fonction pour ouvrir la modale du graphique d'exercice.
 * @param {function} props.handleOpenNotesModal - Fonction pour ouvrir la modale des notes.
 * @param {function} props.handleAnalyzeProgressionClick - Fonction pour analyser la progression avec l'IA.
 * @param {object} props.personalBests - Les meilleurs records personnels.
 * @param {object} props.progressionInsights - Les analyses de progression.
 * @param {boolean} props.isAdvancedMode - Indique si le mode avancé est activé.
 */
const HistoryView = ({
    workouts, selectedDateForHistory, selectedHistoryDayFilter,
    showDeletedExercisesInHistory, setShowDeletedExercisesInHistory,
    handleDateChange, navigateHistory, setSelectedHistoryDayFilter,
    getAllUniqueDays, formatDate, getSeriesDisplay, handleReactivateExercise,
    openExerciseGraphModal, handleOpenNotesModal, handleAnalyzeProgressionClick,
    personalBests, progressionInsights, isAdvancedMode
}) => {
    const orderedDays = workouts.dayOrder || [];

    // Filter workouts for history view
    const filteredWorkouts = Object.keys(workouts.days)
        .filter(dayName => !selectedHistoryDayFilter || dayName === selectedHistoryDayFilter)
        .reduce((acc, dayName) => {
            acc[dayName] = workouts.days[dayName];
            return acc;
        }, {});

    return (
        <div className="history-view">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 p-4 bg-gray-800 rounded-lg shadow-xl">
                <div className="flex items-center space-x-2 sm:space-x-4 mb-4 sm:mb-0">
                    <button
                        onClick={() => navigateHistory(-1)}
                        className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition transform hover:scale-105"
                        title="Jour précédent"
                    >
                        &lt;
                    </button>
                    <DatePicker
                        selected={selectedDateForHistory}
                        onChange={(date) => handleDateChange({ target: { value: date } })}
                        dateFormat="dd/MM/yyyy"
                        className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                        popperPlacement="bottom-end"
                    />
                    <button
                        onClick={() => navigateHistory(1)}
                        className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition transform hover:scale-105"
                        title="Jour suivant"
                    >
                        &gt;
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <select
                        value={selectedHistoryDayFilter || ''}
                        onChange={(e) => setSelectedHistoryDayFilter(e.target.value || null)}
                        className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                    >
                        <option value="">Tous les jours</option>
                        {getAllUniqueDays().map(day => (
                            <option key={day} value={day}>{day}</option>
                        ))}
                    </select>

                    <label className="flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={showDeletedExercisesInHistory}
                            onChange={() => setShowDeletedExercisesInHistory(prev => !prev)}
                        />
                        <div className="relative w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-300">Afficher supprimés</span>
                    </label>
                </div>
            </div>

            {orderedDays.filter(dayName => !selectedHistoryDayFilter || dayName === selectedHistoryDayFilter).map((day, dayIndex) => {
                const dayData = workouts.days[day];
                if (!dayData) return null;

                const categoryOrder = dayData.categoryOrder || [];

                return (
                    <div key={day} className={`bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 mb-8 border-t-4 border-blue-500`}>
                        <h2 className={`text-2xl sm:text-3xl font-extrabold mb-6 text-center text-blue-400`}>
                            {day}
                        </h2>
                        <div className="space-y-6">
                            {categoryOrder.map((category) => {
                                const categoryExercises = dayData.categories[category];
                                if (!categoryExercises) return null;

                                const visibleExercises = categoryExercises.filter(ex => showDeletedExercisesInHistory || !ex.isDeleted);
                                if (visibleExercises.length === 0) return null;

                                return (
                                    <div key={category} className="mb-4 p-4 sm:p-5 bg-gray-700 rounded-lg shadow-md border border-gray-600">
                                        <h3 className="text-xl sm:text-2xl font-semibold text-white mb-4">{category}</h3>
                                        <ul className="space-y-3">
                                            {visibleExercises.map((exercise) => (
                                                <li key={exercise.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-800 p-3 rounded-md shadow-sm ${exercise.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                                    <div className="flex-1 mb-2 sm:mb-0">
                                                        <h4 className="text-lg font-medium text-blue-300">{exercise.name}</h4>
                                                        <p className="text-gray-300 text-sm">
                                                            {getSeriesDisplay(exercise)}
                                                        </p>
                                                        {isAdvancedMode && personalBests[exercise.id] && (
                                                            <p className="text-yellow-300 text-xs mt-1">
                                                                Record: {personalBests[exercise.id].maxWeight} kg ({personalBests[exercise.id].reps} reps) le {formatDate(personalBests[exercise.id].date)}
                                                            </p>
                                                        )}
                                                        {isAdvancedMode && progressionInsights[exercise.id] && (
                                                            <p className="text-sky-300 text-xs mt-1">
                                                                Analyse: {progressionInsights[exercise.id]}
                                                            </p>
                                                        )}
                                                        {exercise.notes && (
                                                            <p className="text-gray-400 text-xs mt-1 italic">
                                                                Note: {exercise.notes.substring(0, 50)}{exercise.notes.length > 50 ? '...' : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex space-x-2 mt-2 sm:mt-0">
                                                        {exercise.isDeleted && (
                                                            <button onClick={() => handleReactivateExercise(day, category, exercise.id)} className="p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition transform hover:scale-110" title="Réactiver l'exercice">
                                                                <RotateCcw className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {isAdvancedMode && (
                                                            <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec l'IA">
                                                                <Sparkles className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                                            <LineChartIcon className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleOpenNotesModal(day, category, exercise.id)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
                                                            <NotebookText className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            {Object.keys(filteredWorkouts).length === 0 && (
                <p className="text-gray-400 text-center mt-8 text-lg sm:text-xl">
                    Aucun entraînement trouvé pour cette date et ces filtres.
                </p>
            )}
        </div>
    );
};

export default HistoryView;
