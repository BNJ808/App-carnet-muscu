// HistoryView.jsx
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
    isAdvancedMode
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredExercises, setFilteredExercises] = useState([]);
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'

    useEffect(() => {
        let exercises = historicalDataForGraphs
            .flatMap(day =>
                day.categories.flatMap(category =>
                    category.exercises.map(exercise => ({
                        ...exercise,
                        date: day.date // Ajouter la date de l'entraînement à l'exercice
                    }))
                )
            );

        if (!showDeletedExercisesInHistory) {
            exercises = exercises.filter(exercise => exercise.isActive);
        }

        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const matchedExercises = exercises.filter(exercise =>
            exercise.name.toLowerCase().includes(lowerCaseSearchTerm)
        );

        // Sort by date
        matchedExercises.sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date.getTime() : a.date.toDate().getTime();
            const dateB = b.date instanceof Date ? b.date.getTime() : b.date.toDate().getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        setFilteredExercises(matchedExercises);
    }, [historicalDataForGraphs, showDeletedExercisesInHistory, searchTerm, sortOrder]);

    return (
        <div className="p-4 sm:p-6 bg-gray-800 min-h-screen text-white pb-20"> {/* Ajout de pb-20 */}
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-purple-400 border-b-2 border-purple-500 pb-2 text-center">Historique des Entraînements</h2>

            <div className="mb-6 flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative w-full sm:w-1/2">
                    <input
                        type="text"
                        placeholder="Rechercher un exercice..."
                        className="w-full p-2 pl-10 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                </div>

                <div className="flex items-center space-x-4 w-full sm:w-auto justify-end">
                    <div className="flex items-center">
                        <label htmlFor="sortOrder" className="text-gray-300 mr-2 text-sm sm:text-base">Trier par:</label>
                        <select
                            id="sortOrder"
                            className="p-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500 text-sm sm:text-base"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option value="newest">Plus récent</option>
                            <option value="oldest">Plus ancien</option>
                        </select>
                    </div>

                    <label className="flex items-center text-sm sm:text-base cursor-pointer">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-600 rounded"
                            checked={showDeletedExercisesInHistory}
                            onChange={() => setShowDeletedExercisesInHistory(!showDeletedExercisesInHistory)}
                        />
                        <span className="ml-2 text-gray-300">Afficher supprimés</span>
                    </label>
                </div>
            </div>

            <div className="space-y-6">
                {filteredExercises.length > 0 ? (
                    filteredExercises.map((exercise, index) => (
                        <div key={exercise.id + '-' + index} className={`p-4 rounded-lg shadow-md ${exercise.isActive ? 'bg-gray-900' : 'bg-red-900 opacity-70'}`}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 border-b border-gray-700 pb-2">
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-semibold text-white">{exercise.name}</h3>
                                    <p className="text-gray-400 text-sm sm:text-base">
                                        Date: {formatDate(exercise.date)}
                                        {exercise.isDeleted && <span className="ml-2 text-red-300">(Supprimé)</span>}
                                    </p>
                                </div>
                                {isAdvancedMode && personalBests[exercise.id] && (
                                    <span className="mt-2 sm:mt-0 text-yellow-300 text-sm sm:text-base font-semibold">
                                        BP: {personalBests[exercise.id].weight}kg x {personalBests[exercise.id].reps}
                                        {personalBests[exercise.id].oneRM && ` (1RM: ${personalBests[exercise.id].oneRM.toFixed(1)}kg)`}
                                    </span>
                                )}
                            </div>
                            <div className="mt-2">
                                {exercise.series && exercise.series.map((series, sIndex) => (
                                    <div key={sIndex} className="flex flex-col sm:flex-row sm:items-center">
                                        <p className="text-gray-300 text-xs sm:text-sm">
                                            {getSeriesDisplay(series)}
                                        </p>
                                        {isAdvancedMode && series.oneRM && (
                                            <p className="text-blue-300 font-medium text-xs sm:text-sm mt-1 sm:mt-0 sm:ml-2">
                                                (1RM: {series.oneRM.toFixed(1)} kg)
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end space-x-3 mt-4">
                                {!exercise.isActive && (
                                    <button onClick={() => handleReactivateExercise(exercise)} className="p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition transform hover:scale-110" title="Réactiver l'exercice">
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
