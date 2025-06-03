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
 * @param {Array<object>} props.workouts - Le tableau contenant toutes les données d'entraînement historiques (sessions).
 * @param {Date | null} props.selectedDateForHistory - La date sélectionnée pour l'historique.
 * @param {string | null} props.selectedHistoryDayFilter - Le jour sélectionné pour filtrer l'historique.
 * @param {boolean} props.showDeletedExercisesInHistory - Indique si les exercices supprimés doivent être affichés.
 * @param {function} props.handleDateChange - Fonction pour gérer le changement de date.
 * @param {function} props.navigateHistory - Fonction pour naviguer dans l'historique (jour précédent/suivant).
 * @param {function} props.setSelectedHistoryDayFilter - Fonction pour définir le filtre de jour de l'historique.
 * @param {function} props.getAllUniqueDays - Fonction pour obtenir tous les noms de jours uniques.
 * @param {function} props.formatDate - Fonction utilitaire pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction utilitaire pour afficher les séries d'un exercice.
 * @param {function} props.handleReactivateExercise - Fonction pour réactiver un exercice.
 * @param {function} props.openExerciseGraphModal - Fonction pour ouvrir la modale du graphique d'exercice.
 * @param {function} props.handleOpenNotesModal - Fonction pour ouvrir la modale des notes.
 * @param {function} props.handleAnalyzeProgressionClick - Fonction pour analyser la progression avec l'IA.
 * @param {object} props.personalBests - Les records personnels.
 * @param {object} props.progressionInsights - Les analyses de progression.
 * @param {boolean} props.isAdvancedMode - Indique si le mode avancé est activé.
 */
const HistoryView = ({
    workouts, // Ce sera maintenant historicalDataForGraphs de App.jsx
    selectedDateForHistory, selectedHistoryDayFilter, showDeletedExercisesInHistory,
    handleDateChange, navigateHistory, setSelectedHistoryDayFilter,
    formatDate, getSeriesDisplay, handleReactivateExercise, openExerciseGraphModal,
    handleOpenNotesModal, handleAnalyzeProgressionClick, personalBests, progressionInsights,
    isAdvancedMode
}) => {

    // Assurez-vous que 'workouts' est toujours un tableau pour éviter l'erreur .map is not a function
    const safeWorkouts = Array.isArray(workouts) ? workouts : [];

    // Utilise session.timestamp pour les dates uniques
    const uniqueDates = Array.from(new Set(safeWorkouts.map(session => session.timestamp?.toISOString().split('T')[0]))).filter(Boolean).sort().map(dateString => new Date(dateString));

    useEffect(() => {
        if (!selectedDateForHistory && uniqueDates.length > 0) {
            setSelectedDateForHistory(uniqueDates[uniqueDates.length - 1]); // Sélectionne la dernière date par défaut
        }
    }, [safeWorkouts, uniqueDates, selectedDateForHistory, setSelectedDateForHistory]);


    // Fonction pour naviguer dans l'historique (jour précédent/suivant)
    const navigateHistoryWrapper = (direction) => {
        if (!selectedDateForHistory) return;
        const currentIndex = uniqueDates.findIndex(date =>
            date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]
        );
        if (direction === 'prev' && currentIndex > 0) {
            navigateHistory(-1); // Appelle la fonction passée en prop dans App.jsx
        } else if (direction === 'next' && currentIndex < uniqueDates.length - 1) {
            navigateHistory(1); // Appelle la fonction passée en prop dans App.jsx
        }
    };

    // Fonction pour obtenir tous les noms de jours uniques des entraînements historiques
    const getAllUniqueDaysFromWorkouts = () => {
        const uniqueDays = new Set(['All']);
        safeWorkouts.forEach(session => { // Itère sur les sessions historiques
            if (session.workoutData && session.workoutData.days && typeof session.workoutData.days === 'object') {
                Object.keys(session.workoutData.days).forEach(dayName => uniqueDays.add(dayName));
            }
        });
        return Array.from(uniqueDays);
    };

    const filteredWorkouts = safeWorkouts.filter(session => { // Filtre les sessions historiques
        const matchesDate = !selectedDateForHistory ||
            (session.timestamp && session.timestamp.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]);
        const matchesDayFilter = selectedHistoryDayFilter === 'All' ||
            (session.workoutData && session.workoutData.days && typeof session.workoutData.days === 'object' && Object.keys(session.workoutData.days).some(dayName => dayName === selectedHistoryDayFilter));

        return matchesDate && matchesDayFilter;
    });

    // Regroupe les entraînements filtrés par jour et catégorie
    const groupedWorkouts = filteredWorkouts.reduce((acc, session) => { // Réduit les sessions
        if (session.workoutData && session.workoutData.days && typeof session.workoutData.days === 'object') {
            Object.keys(session.workoutData.days).forEach(dayKey => { // Itère sur les clés de jour
                const dayData = session.workoutData.days[dayKey];
                if (dayData && typeof dayData === 'object' && dayData.categories) { // Vérifie dayData et ses catégories
                    if (!acc[dayKey]) {
                        acc[dayKey] = {
                            dayName: dayKey, // Utilise dayKey comme dayName
                            categories: {},
                            sessions: [] // Stocke les sessions liées à ce jour
                        };
                    }
                    acc[dayKey].sessions.push(session); // Ajoute la session aux sessions du jour

                    Object.keys(dayData.categories).forEach(categoryKey => { // Itère sur les clés de catégorie
                        const categoryExercises = dayData.categories[categoryKey];
                        if (Array.isArray(categoryExercises)) { // S'assure que c'est un tableau d'exercices
                            if (!acc[dayKey].categories[categoryKey]) {
                                acc[dayKey].categories[categoryKey] = {
                                    categoryName: categoryKey,
                                    exercises: []
                                };
                            }
                            categoryExercises.forEach(exercise => {
                                // Ajoute seulement si non supprimé, ou si l'option "afficher supprimés" est activée
                                if (showDeletedExercisesInHistory || !exercise.isDeleted) {
                                    acc[dayKey].categories[categoryKey].exercises.push({
                                        ...exercise,
                                        sessionId: session.id, // Lie l'exercice à son ID de session
                                        sessionTimestamp: session.timestamp // Lie l'exercice à son horodatage de session
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
        return acc;
    }, {});


    return (
        <div className="w-full max-w-4xl bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-blue-300">Historique des entraînements</h2>

            {/* Date Navigation and Picker */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button
                        onClick={() => navigateHistoryWrapper('prev')}
                        disabled={!selectedDateForHistory || uniqueDates.findIndex(date => date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]) === 0}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full disabled:opacity-50"
                    >
                        &lt;
                    </button>
                    <DatePicker
                        selected={selectedDateForHistory}
                        onChange={(date) => handleDateChange({ target: { value: date?.toISOString().split('T')[0] } })}
                        dateFormat="dd/MM/yyyy"
                        className="bg-gray-700 text-white p-2 rounded-lg text-center w-36 sm:w-48 cursor-pointer"
                        wrapperClassName="date-picker-wrapper"
                    />
                    <button
                        onClick={() => navigateHistoryWrapper('next')}
                        disabled={!selectedDateForHistory || uniqueDates.findIndex(date => date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]) === uniqueDates.length - 1}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full disabled:opacity-50"
                    >
                        &gt;
                    </button>
                </div>

                {/* Day Filter */}
                <select
                    value={selectedHistoryDayFilter || 'All'}
                    onChange={(e) => setSelectedHistoryDayFilter(e.target.value)}
                    className="bg-gray-700 text-white p-2 rounded-lg w-full sm:w-auto"
                >
                    {getAllUniqueDaysFromWorkouts().map(day => (
                        <option key={day} value={day}>{day}</option>
                    ))}
                </select>

                {/* Show Deleted Checkbox */}
                <label className="flex items-center text-white text-sm sm:text-base">
                    <input
                        type="checkbox"
                        checked={showDeletedExercisesInHistory}
                        onChange={(e) => setShowDeletedExercisesInHistory(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded mr-2"
                    />
                    Afficher supprimés
                </label>
            </div>

            {/* Le bouton "Tout Vider" est commenté car sa logique de "soft delete" complète doit être gérée dans App.jsx */}
            {/* <button
                onClick={confirmClearAllWorkouts}
                className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg shadow-md transition transform hover:scale-105 mb-4 w-full sm:w-auto"
            >
                Tout Vider (soft delete)
            </button> */}

            {Object.values(groupedWorkouts)
                .sort((a, b) => {
                    // Trie par nom de jour pour une cohérence visuelle
                    return a.dayName.localeCompare(b.dayName);
                })
                .map((dayData) => {
                    if (!dayData || typeof dayData !== 'object' || !dayData.categories) {
                        console.warn("Invalid dayData encountered in HistoryView:", dayData);
                        return null;
                    }

                    return (
                        <div key={dayData.dayName} className="bg-gray-700 p-4 rounded-lg shadow-md mb-4 border border-gray-600">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xl sm:text-2xl font-semibold text-white">{dayData.dayName}</h3>
                                {/* Le bouton "Éditer l'entraînement" est commenté car sa logique doit être gérée dans App.jsx */}
                                {/* {dayData.sessions && dayData.sessions.length > 0 && (
                                    <button
                                        onClick={() => editWorkout(dayData.sessions[0])}
                                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full transition transform hover:scale-110 shadow-md"
                                        title="Éditer l'entraînement"
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </button>
                                )} */}
                            </div>
                            <div className="space-y-3">
                                {Object.values(dayData.categories).map((categoryData) => {
                                    if (!categoryData || typeof categoryData !== 'object' || !Array.isArray(categoryData.exercises)) {
                                        console.warn("Invalid categoryData encountered in HistoryView:", categoryData);
                                        return null;
                                    }

                                    // Filtre les exercices pour n'afficher que ceux pertinents selon showDeletedExercisesInHistory
                                    const exercisesToDisplay = categoryData.exercises.filter(ex => showDeletedExercisesInHistory || !ex.isDeleted);

                                    if (exercisesToDisplay.length === 0 && !showDeletedExercisesInHistory) {
                                        return null; // Ne pas afficher les catégories vides, sauf si les supprimés sont affichés
                                    }

                                    return (
                                        <div key={categoryData.categoryName} className="bg-gray-600 p-3 rounded-lg shadow-sm border border-gray-500">
                                            <h4 className="text-lg sm:text-xl font-medium text-white mb-2">{categoryData.categoryName}</h4>
                                            <ul className="space-y-2">
                                                {exercisesToDisplay.map(exercise => (
                                                    <li key={exercise.id} className={`bg-gray-500 p-3 rounded-lg flex justify-between items-center ${exercise.isDeleted ? 'opacity-50' : ''}`}>
                                                        <div>
                                                            <p className="text-white text-base sm:text-lg font-bold">{exercise.name}</p>
                                                            <p className="text-gray-200 text-sm">{getSeriesDisplay(exercise.series)}</p> {/* Passe exercise.series */}
                                                            {exercise.notes && (
                                                                <p className="text-yellow-200 text-xs sm:text-sm italic mt-1">Notes: {exercise.notes}</p>
                                                            )}
                                                            {isAdvancedMode && personalBests[exercise.name] && ( // Utilise exercise.name pour la recherche PB
                                                                <p className="text-yellow-300 text-xs mt-1">
                                                                    PB: {personalBests[exercise.name].weight}kg x {personalBests[exercise.name].reps} reps ({formatDate(personalBests[exercise.name].date)})
                                                                </p>
                                                            )}
                                                            {isAdvancedMode && progressionInsights[exercise.name] && ( // Utilise exercise.name pour la recherche d'insights
                                                                <p className="text-sky-300 text-xs mt-1">
                                                                    Progression: {progressionInsights[exercise.name].hasImproved ? "Excellente progression !" : progressionInsights[exercise.name].hasRegressed ? "Baisse de performance." : "Progression stable."}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            {exercise.isDeleted ? (
                                                                <button onClick={() => handleReactivateExercise(dayData.dayName, categoryData.categoryName, exercise.id)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110" title="Réactiver l'exercice">
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </button>
                                                            ) : (
                                                                // Pas de suppression directe depuis l'historique, seulement réactivation ou visualisation
                                                                // La fonction handleDeleteExercise dans App.jsx marque comme supprimé, ne supprime pas complètement.
                                                                // Si l'utilisateur souhaite supprimer complètement de l'historique, il faut une fonction différente.
                                                                // Pour l'instant, le bouton de suppression est retiré de la vue historique.
                                                                null
                                                            )}
                                                            <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                                                <LineChartIcon className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => handleOpenNotesModal(dayData.dayName, categoryData.categoryName, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
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
            {filteredWorkouts.length === 0 && (
                <p className="text-gray-400 text-center mt-8 text-lg sm:text-xl">
                    Aucun entraînement trouvé pour cette date et ces filtres.
                </p>
            )}
        </div>
    );
};

export default HistoryView;
