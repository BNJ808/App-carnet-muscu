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
 * @param {object} props.personalBests - Les records personnels des exercices.
 * @param {object} props.progressionInsights - Les analyses de progression des exercices.
 * @param {boolean} props.isAdvancedMode - Indique si le mode avancé est activé.
 */
const HistoryView = ({
    workouts,
    selectedDateForHistory,
    selectedHistoryDayFilter,
    showDeletedExercisesInHistory,
    setShowDeletedExercisesInHistory,
    handleDateChange,
    navigateHistory,
    setSelectedHistoryDayFilter,
    getAllUniqueDays,
    formatDate,
    getSeriesDisplay,
    handleReactivateExercise,
    openExerciseGraphModal,
    handleOpenNotesModal,
    handleAnalyzeProgressionClick,
    personalBests,
    progressionInsights,
    isAdvancedMode,
}) => {

    const uniqueDays = getAllUniqueDays();

    // Filter workouts based on selected date and day filter
    const filteredWorkouts = {};
    if (workouts && workouts.days) {
        // Find the workout data for the selected date
        // Note: The workouts prop here is the LATEST workout data from App.jsx's onSnapshot.
        // For history, we are relying on App.jsx to fetch the correct historical snapshot
        // based on selectedDateForHistory. So, 'workouts' here already represents the
        // state of the workout plan at 'selectedDateForHistory'.
        
        // Apply day filter
        Object.keys(workouts.days).forEach(dayName => {
            if (!selectedHistoryDayFilter || dayName === selectedHistoryDayFilter) {
                const dayData = workouts.days[dayName];
                if (dayData && dayData.categories) {
                    filteredWorkouts[dayName] = {
                        ...dayData,
                        categories: Object.keys(dayData.categories).reduce((acc, categoryName) => {
                            const exercises = dayData.categories[categoryName];
                            if (Array.isArray(exercises)) {
                                acc[categoryName] = exercises.filter(exercise => 
                                    showDeletedExercisesInHistory || !exercise.isDeleted
                                );
                            } else {
                                acc[categoryName] = []; // Ensure it's an array even if malformed
                            }
                            return acc;
                        }, {})
                    };
                }
            }
        });
    }

    const orderedDays = workouts.dayOrder || [];

    return (
        <div className="history-view bg-gray-900 p-4 sm:p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-400 mb-6 text-center">Historique des Entraînements</h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                <button
                    onClick={() => navigateHistory(-1)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                >
                    Jour Précédent
                </button>
                <DatePicker
                    selected={selectedDateForHistory}
                    onChange={(date) => handleDateChange({ target: { value: date.toISOString().split('T')[0] } })}
                    dateFormat="dd/MM/yyyy"
                    className="p-2 rounded-md bg-gray-700 text-white border border-gray-600 text-center text-sm sm:text-base"
                    maxDate={new Date()} // Prevent selecting future dates
                />
                <button
                    onClick={() => navigateHistory(1)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                >
                    Jour Suivant
                </button>
            </div>

            <div className="flex flex-wrap gap-3 mb-6 justify-center">
                {uniqueDays.map(day => (
                    <button
                        key={day}
                        onClick={() => setSelectedHistoryDayFilter(day)}
                        className={`px-4 py-2 rounded-full font-bold shadow-md transition transform hover:scale-105 text-sm sm:text-base
                            ${selectedHistoryDayFilter === day
                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                                : 'bg-gray-700 border-2 border-green-500 text-green-300'
                            }`}
                    >
                        {day}
                    </button>
                ))}
                <button
                    onClick={() => setSelectedHistoryDayFilter(null)}
                    className={`px-4 py-2 rounded-full font-bold shadow-md transition transform hover:scale-105 text-sm sm:text-base
                        ${selectedHistoryDayFilter === null
                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                            : 'bg-gray-700 border-2 border-red-500 text-red-300'
                        }`}
                >
                    Tous les Jours
                </button>
            </div>

            <div className="flex items-center justify-center mb-6">
                <input
                    type="checkbox"
                    id="showDeleted"
                    checked={showDeletedExercisesInHistory}
                    onChange={(e) => setShowDeletedExercisesInHistory(e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="showDeleted" className="text-gray-300 text-sm sm:text-base">Afficher les exercices supprimés</label>
            </div>

            {orderedDays.filter(dayName => Object.keys(filteredWorkouts).includes(dayName)).map((dayName, dayIndex) => {
                const dayData = filteredWorkouts[dayName];
                if (!dayData || !dayData.categories) {
                    console.warn(`Données de jour invalides pour l'historique: ${dayName}`, dayData);
                    return null;
                }

                const categoryOrder = Array.isArray(dayData.categoryOrder)
                    ? dayData.categoryOrder
                    : Object.keys(dayData.categories).sort();

                // Check if there are any exercises to display for this day based on filters
                const hasExercisesToDisplay = categoryOrder.some(categoryName => {
                    const exercises = dayData.categories[categoryName];
                    return Array.isArray(exercises) && exercises.length > 0;
                });

                if (!hasExercisesToDisplay) {
                    return null; // Skip rendering this day if no exercises match filters
                }

                return (
                    <div key={dayName} className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg mb-8">
                        <h3 className="text-xl sm:text-3xl font-extrabold text-blue-300 mb-6 text-center">{dayName}</h3>
                        <div className="space-y-6">
                            {categoryOrder.map((categoryName, categoryIndex) => {
                                const exercises = dayData.categories[categoryName];
                                if (!Array.isArray(exercises) || exercises.length === 0) {
                                    return null; // Skip rendering empty or invalid categories
                                }

                                return (
                                    <div key={categoryName} className="bg-gray-700 p-4 sm:p-5 rounded-lg shadow-md">
                                        <h4 className="text-lg sm:text-2xl font-bold mb-4 text-white">{categoryName}</h4>
                                        <ul className="space-y-3">
                                            {exercises.map((exercise) => (
                                                <li key={exercise.id} className={`bg-gray-800 p-3 sm:p-4 rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center ${exercise.isDeleted ? 'opacity-60 border-red-500 border' : ''}`}>
                                                    <div className="flex-grow mb-2 sm:mb-0">
                                                        <p className="text-lg sm:text-xl font-semibold text-blue-300">
                                                            {exercise.name}
                                                            {exercise.isDeleted && <span className="ml-2 text-red-400 text-sm">(Supprimé)</span>}
                                                        </p>
                                                        <p className="text-gray-300 text-sm sm:text-base">
                                                            {getSeriesDisplay(exercise)}
                                                        </p>
                                                        {isAdvancedMode && personalBests[exercise.id] && (
                                                            <p className="text-yellow-400 text-xs sm:text-sm mt-1">
                                                                Meilleur: {personalBests[exercise.id].maxWeight} kg ({personalBests[exercise.id].reps} reps) le {formatDate(personalBests[exercise.id].date)}
                                                            </p>
                                                        )}
                                                        {isAdvancedMode && progressionInsights[exercise.id] && (
                                                            <p className="text-green-400 text-xs sm:text-sm mt-1">
                                                                Analyse: {progressionInsights[exercise.id]}
                                                            </p>
                                                        )}
                                                        {exercise.notes && (
                                                            <p className="text-gray-400 text-xs sm:text-sm mt-1 italic">
                                                                Notes: {exercise.notes.substring(0, 50)}{exercise.notes.length > 50 ? '...' : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex space-x-2 mt-2 sm:mt-0">
                                                        {exercise.isDeleted && (
                                                            <button onClick={() => handleReactivateExercise(dayName, categoryName, exercise.id)} className="p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition transform hover:scale-110" title="Réactiver l'exercice">
                                                                <RotateCcw className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                                            <LineChartIcon className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleOpenNotesModal(dayName, categoryName, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
                                                            <NotebookText className="h-4 w-4" />
                                                        </button>
                                                        {isAdvancedMode && (
                                                            <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec l'IA">
                                                                <Sparkles className="h-4 w-4" />
                                                            </button>
                                                        )}
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
