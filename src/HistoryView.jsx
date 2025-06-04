import React, { useState, useEffect } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText,
    RotateCcw, Search
} from 'lucide-react';
// Removed DatePicker and its CSS as primary date filtering is now handled by graph modal

/**
 * Composant HistoryView pour afficher l'historique des entraînements de manière centrée sur les exercices.
 * Permet de rechercher des exercices et d'afficher/masquer les exercices supprimés.
 * @param {object[]} props.historicalDataForGraphs - Toutes les données historiques des entraînements.
 * @param {boolean} props.showDeletedExercisesInHistory - Indique si les exercices supprimés doivent être affichés.
 * @param {function} props.setShowDeletedExercisesInHistory - Fonction pour définir l'état d'affichage des exercices supprimés.
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
    historicalDataForGraphs,
    showDeletedExercisesInHistory,
    setShowDeletedExercisesInHistory,
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
    const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
    const [uniqueExercises, setUniqueExercises] = useState([]);

    useEffect(() => {
        const processHistoricalData = () => {
            const exerciseMap = {};

            historicalDataForGraphs.forEach(session => {
                const sessionDate = session.timestamp;
                if (!sessionDate) return; // Skip if timestamp is null/undefined

                const workoutData = session.workoutData;

                if (workoutData && workoutData.days) {
                    Object.values(workoutData.days).forEach(dayData => {
                        if (dayData && dayData.categories) {
                            Object.values(dayData.categories).forEach(categoryExercises => {
                                if (Array.isArray(categoryExercises)) {
                                    categoryExercises.forEach(exercise => {
                                        if (!exercise.id) return; // Skip if no ID

                                        if (!exerciseMap[exercise.id]) {
                                            exerciseMap[exercise.id] = {
                                                id: exercise.id,
                                                name: exercise.name,
                                                allSeries: [],
                                                lastPerformance: null,
                                                personalBest: { weight: 0, reps: 0, date: null },
                                                isDeleted: exercise.isDeleted, // Track latest deletion status
                                                // Store day and category name for notes modal if needed, or reactivate
                                                dayName: '', // Will be updated by the last session it appears in
                                                categoryName: '' // Will be updated by the last session it appears in
                                            };
                                        }

                                        // Update latest deletion status and last known day/category
                                        exerciseMap[exercise.id].isDeleted = exercise.isDeleted;
                                        // This assumes the exercise name and structure is consistent across days/categories
                                        // If an exercise can move, this will store the last day/category it was found in.
                                        // For reactivating, we'll search globally in App.jsx anyway.
                                        // Find the actual dayName and categoryName from the original workoutData structure
                                        // This is a bit inefficient but necessary if we need these specific names for the modal.
                                        for (const dName in workoutData.days) {
                                            if (workoutData.days[dName] === dayData) {
                                                exerciseMap[exercise.id].dayName = dName;
                                                break;
                                            }
                                        }
                                        for (const cName in dayData.categories) {
                                            if (dayData.categories[cName] === categoryExercises) {
                                                exerciseMap[exercise.id].categoryName = cName;
                                                break;
                                            }
                                        }


                                        // Aggregate all series for this exercise
                                        if (Array.isArray(exercise.series)) {
                                            exercise.series.forEach(s => {
                                                const weight = parseFloat(s.weight);
                                                const reps = parseInt(s.reps);
                                                if (!isNaN(weight) && !isNaN(reps)) {
                                                    exerciseMap[exercise.id].allSeries.push({
                                                        date: sessionDate,
                                                        weight: weight,
                                                        reps: reps
                                                    });

                                                    // Update last performance (based on session date)
                                                    if (!exerciseMap[exercise.id].lastPerformance || sessionDate > exerciseMap[exercise.id].lastPerformance.date) {
                                                        exerciseMap[exercise.id].lastPerformance = { date: sessionDate, weight, reps };
                                                    }

                                                    // Update personal best (simple max weight for now)
                                                    if (weight > exerciseMap[exercise.id].personalBest.weight) {
                                                        exerciseMap[exercise.id].personalBest = { weight, reps, date: sessionDate };
                                                    } else if (weight === exerciseMap[exercise.id].personalBest.weight && reps > exerciseMap[exercise.id].personalBest.reps) {
                                                        // If same weight, check for more reps
                                                        exerciseMap[exercise.id].personalBest = { weight, reps, date: sessionDate };
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });

            // Convert map to array and sort by name
            const exercisesArray = Object.values(exerciseMap).sort((a, b) => a.name.localeCompare(b.name));
            setUniqueExercises(exercisesArray);
        };

        if (historicalDataForGraphs.length > 0) {
            processHistoricalData();
        } else {
            setUniqueExercises([]);
        }
    }, [historicalDataForGraphs]);

    const filteredExercises = uniqueExercises.filter(exercise => {
        const matchesSearch = exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase());
        const matchesDeletedStatus = showDeletedExercisesInHistory || !exercise.isDeleted;
        
        console.log(`Filtering: Exercise '${exercise.name}', isDeleted: ${exercise.isDeleted}, showDeleted: ${showDeletedExercisesInHistory}, matchesDeleted: ${matchesDeletedStatus}`);

        return matchesSearch && matchesDeletedStatus;
    });

    return (
        <div className="history-view bg-gray-900 p-4 sm:p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-400 mb-6 text-center">Historique des Exercices</h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                <div className="relative w-full sm:w-auto flex-grow">
                    <input
                        type="text"
                        placeholder="Rechercher un exercice..."
                        value={exerciseSearchTerm}
                        onChange={(e) => setExerciseSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="showDeleted"
                        checked={showDeletedExercisesInHistory}
                        onChange={(e) => setShowDeletedExercisesInHistory(e.target.checked)}
                        className="mr-2 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="showDeleted" className="text-gray-300 text-sm sm:text-base">Afficher les exercices supprimés</label>
                </div>
            </div>

            <div className="space-y-4">
                {filteredExercises.length > 0 ? (
                    filteredExercises.map((exercise) => (
                        <div key={exercise.id} className={`bg-gray-800 p-3 sm:p-4 rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center ${exercise.isDeleted ? 'opacity-60 border-red-500 border' : ''}`}>
                            <div className="flex-grow mb-2 sm:mb-0">
                                <p className="text-lg sm:text-xl font-semibold text-blue-300">
                                    {exercise.name}
                                    {exercise.isDeleted && <span className="ml-2 text-red-400 text-sm">(Supprimé)</span>}
                                </p>
                                {exercise.lastPerformance && (
                                    <p className="text-gray-300 text-sm sm:text-base mt-1">
                                        Dernière perf: {exercise.lastPerformance.weight} kg ({exercise.lastPerformance.reps} reps) le {formatDate(exercise.lastPerformance.date)}
                                    </p>
                                )}
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
                                {/* Notes are not aggregated here, but can be viewed via modal */}
                                {/* You might want to display a snippet of the latest note if available */}
                            </div>
                            <div className="flex space-x-2 mt-2 sm:mt-0">
                                {exercise.isDeleted && (
                                    <button onClick={() => handleReactivateExercise(exercise.id)} className="p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition transform hover:scale-110" title="Réactiver l'exercice">
                                        <RotateCcw className="h-4 w-4" />
                                    </button>
                                )}
                                <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                    <LineChartIcon className="h-4 w-4" />
                                </button>
                                {/* Pass exercise.dayName and exercise.categoryName for notes modal if needed, or remove them from the exercise object in HistoryView and modify handleOpenNotesModal to search globally if it only needs exercise.id */}
                                <button onClick={() => handleOpenNotesModal(exercise.dayName, exercise.categoryName, exercise.id)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
                                    <NotebookText className="h-4 w-4" />
                                </button>
                                {isAdvancedMode && (
                                    <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec l'IA">
                                        <Sparkles className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-400 text-center mt-8 text-lg sm:text-xl">
                        Aucun exercice trouvé correspondant à vos filtres.
                    </p>
                )}
            </div>
        </div>
    );
};

export default HistoryView;
