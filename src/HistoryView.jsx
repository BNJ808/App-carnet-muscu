import React from 'react';
import {
    Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    RotateCcw
} from 'lucide-react';

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
 * @param {object} props.progressionInsights - Les insights de progression des exercices.
 * @param {boolean} props.isAdvancedMode - Indique si le mode avancé est activé.
 */
const HistoryView = ({
    workouts,
    selectedDateForHistory,
    selectedHistoryDayFilter,
    showDeletedExercisesInHistory,
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
    const daysToDisplay = selectedHistoryDayFilter && Object.keys(workouts.days).includes(selectedHistoryDayFilter)
        ? [selectedHistoryDayFilter]
        : Object.keys(workouts.days); // Show selected day or all days if no specific day is selected

    return (
        <>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <div className="flex items-center space-x-2">
                    <button onClick={() => navigateHistory(-1)} className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition transform hover:scale-105 text-sm sm:text-base">
                        {'< Précédent'}
                    </button>
                    <input
                        type="date"
                        value={selectedDateForHistory ? selectedDateForHistory.toISOString().split('T')[0] : ''}
                        onChange={handleDateChange}
                        className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`}
                    />
                    <button onClick={() => navigateHistory(1)} className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition transform hover:scale-105 text-sm sm:text-base">
                        {'Suivant >'}
                    </button>
                </div>
                <select
                    value={selectedHistoryDayFilter || ''}
                    onChange={(e) => setSelectedHistoryDayFilter(e.target.value || null)}
                    className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`}
                >
                    {getAllUniqueDays().map(day => (
                        <option key={day} value={day}>{day}</option>
                    ))}
                </select>
                <label className={`flex items-center space-x-2 text-gray-300 text-sm sm:text-base`}>
                    <input
                        type="checkbox"
                        checked={showDeletedExercisesInHistory}
                        onChange={(e) => setShowDeletedExercisesInHistory(e.target.checked)}
                        className="form-checkbox h-4 w-4 sm:h-5 sm:w-5 text-blue-600 rounded"
                    />
                    <span>Afficher exos supprimés</span>
                </label>
            </div>

            <div className="grid grid-cols-1 gap-8 max-w-6xl mx-auto">
                {daysToDisplay.map((day) => {
                    const currentDayData = workouts.days?.[day];
                    if (!currentDayData) {
                        return <div key={day} className="text-center text-gray-500">Journée "{day}" non trouvée ou vide.</div>;
                    }

                    const categoriesToIterate = Object.keys(currentDayData.categories || {});

                    return (
                        <div key={day} className={`bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 border border-gray-700`}>
                            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                                <h2 className={`text-2xl sm:text-3xl font-bold text-blue-400`}>{day}</h2>
                            </div>

                            {categoriesToIterate.map((category) => {
                                const exercises = currentDayData.categories?.[category] || [];

                                let exercisesToRender = showDeletedExercisesInHistory ? exercises : exercises.filter(ex => !ex.isDeleted);

                                if (exercisesToRender.length === 0) {
                                    return null;
                                }

                                return (
                                    <div key={category} className={`mb-8 bg-gray-700 rounded-lg p-3 sm:p-5 shadow-inner border border-gray-700 transition-all duration-300 ease-out`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className={`text-xl sm:text-2xl font-semibold text-green-300`}>{category}</h3>
                                        </div>
                                        <ul className="space-y-4">
                                            {exercisesToRender.map((exercise) => (
                                                <li key={exercise.id} id={`exercise-item-${exercise.id}`} className={`bg-gray-800 p-3 sm:p-4 rounded-md shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-200 ${exercise.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                                    <div className="flex-grow mb-2 sm:mb-0">
                                                        <p className={`text-base sm:text-lg font-medium text-white`}>{exercise.name}</p>
                                                        <p className={`text-sm sm:text-base text-gray-300`}>{getSeriesDisplay(exercise)}</p>
                                                        {isAdvancedMode && personalBests[exercise.id] && (
                                                            <p className="text-xs sm:text-sm text-yellow-300 mt-1">
                                                                Meilleure Perf: {personalBests[exercise.id].maxWeight}kg ({personalBests[exercise.id].reps} reps) le {formatDate(personalBests[exercise.id].date)}
                                                            </p>
                                                        )}
                                                        {isAdvancedMode && progressionInsights[exercise.id] && (
                                                            <p className="text-xs sm:text-sm text-cyan-300 mt-1">
                                                                Insight: {progressionInsights[exercise.id]}
                                                            </p>
                                                        )}
                                                        {exercise.notes && (
                                                            <p className={`text-xs sm:text-sm text-gray-300 mt-2 italic`}>
                                                                Notes: "{exercise.notes}"
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex space-x-1 sm:space-x-2 flex-wrap gap-1 mt-2 sm:mt-0">
                                                        {exercise.isDeleted && (
                                                            <button onClick={() => handleReactivateExercise(day, category, exercise.id)} className="px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs" title="Réactiver l'exercice">
                                                                <RotateCcw className="h-4 w-4 inline-block mr-1" /> Réactiver
                                                            </button>
                                                        )}
                                                        {isAdvancedMode && !exercise.isDeleted && (
                                                            <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec IA">
                                                                <Sparkles className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                                            <LineChartIcon className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleOpenNotesModal(day, category, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
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
                    );
                })}
            </div>
        </>
    );
};

export default HistoryView;
