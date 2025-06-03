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
 * @param {Array<object>} props.workouts - La liste de tous les entraînements.
 * @param {function} props.editWorkout - Fonction pour éditer un entraînement existant.
 * @param {function} props.confirmDeleteWorkout - Fonction pour confirmer la suppression d'un entraînement.
 * @param {function} props.restoreWorkout - Fonction pour restaurer un entraînement supprimé.
 * @param {function} props.confirmClearAllWorkouts - Fonction pour confirmer la suppression de tous les entraînements.
 */
const HistoryView = ({ workouts, editWorkout, confirmDeleteWorkout, restoreWorkout, confirmClearAllWorkouts }) => {
    const [selectedDateForHistory, setSelectedDateForHistory] = useState(null);
    const [selectedHistoryDayFilter, setSelectedHistoryDayFilter] = useState('All');
    const [showDeletedExercisesInHistory, setShowDeletedExercisesInHistory] = useState(false);

    // Fonction pour formater une date en chaîne lisible
    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    // Fonction pour obtenir toutes les dates uniques des entraînements
    const getAllUniqueDates = () => {
        const uniqueDates = new Set();
        workouts.forEach(workout => {
            if (workout.date) {
                uniqueDates.add(workout.date.toISOString().split('T')[0]);
            }
        });
        return Array.from(uniqueDates).sort().map(dateString => new Date(dateString));
    };

    const uniqueDates = getAllUniqueDates();

    useEffect(() => {
        if (!selectedDateForHistory && uniqueDates.length > 0) {
            setSelectedDateForHistory(uniqueDates[uniqueDates.length - 1]); // Sélectionne la dernière date par défaut
        }
    }, [workouts, uniqueDates, selectedDateForHistory]);


    // Fonction pour naviguer dans l'historique (jour précédent/suivant)
    const navigateHistory = (direction) => {
        const currentIndex = uniqueDates.findIndex(date =>
            date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]
        );
        if (direction === 'prev' && currentIndex > 0) {
            setSelectedDateForHistory(uniqueDates[currentIndex - 1]);
        } else if (direction === 'next' && currentIndex < uniqueDates.length - 1) {
            setSelectedDateForHistory(uniqueDates[currentIndex + 1]);
        }
    };

    // Fonction pour obtenir tous les noms de jours uniques des entraînements
    const getAllUniqueDays = () => {
        const uniqueDays = new Set(['All']);
        workouts.forEach(workout => {
            if (workout.days) {
                workout.days.forEach(day => uniqueDays.add(day.name));
            }
        });
        return Array.from(uniqueDays);
    };

    // Fonction utilitaire pour afficher les séries d'un exercice
    const getSeriesDisplay = (sets) => {
        return sets.map(set => `${set.reps}x${set.weight}kg`).join(' / ');
    };

    const filteredWorkouts = workouts.filter(workout => {
        const matchesDate = !selectedDateForHistory ||
            (workout.date && workout.date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]);
        const matchesDayFilter = selectedHistoryDayFilter === 'All' ||
            (workout.days && workout.days.some(day => day.name === selectedHistoryDayFilter));
        const matchesDeletedStatus = showDeletedExercisesInHistory ? workout.deleted : !workout.deleted;

        return matchesDate && matchesDayFilter && matchesDeletedStatus;
    });

    // Regroupe les entraînements filtrés par jour et catégorie
    const groupedWorkouts = filteredWorkouts.reduce((acc, workout) => {
        (workout.days || []).forEach(day => {
            const dayKey = day.name; // Utilise le nom du jour comme clé
            if (!acc[dayKey]) {
                acc[dayKey] = {
                    dayId: day.id, // Garde l'ID du jour original si besoin
                    dayName: day.name,
                    dayOrder: day.dayOrder, // Important pour le tri !
                    categories: {},
                    workouts: [] // Pour stocker les infos de l'entraînement global (date, etc.)
                };
            }
            // Ajoutez l'entraînement au jour pour pouvoir éditer l'entraînement complet
            acc[dayKey].workouts.push(workout);

            (day.categories || []).forEach(category => {
                const categoryKey = category.name;
                if (!acc[dayKey].categories[categoryKey]) {
                    acc[dayKey].categories[categoryKey] = {
                        categoryId: category.id,
                        categoryName: category.name,
                        exercises: []
                    };
                }
                (category.exercises || []).forEach(exercise => {
                    const exerciseWithWorkoutId = { ...exercise, workoutId: workout.id };
                    acc[dayKey].categories[categoryKey].exercises.push(exerciseWithWorkoutId);
                });
            });
        });
        return acc;
    }, {});


    return (
        <div className="w-full max-w-4xl bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-blue-300">Historique des entraînements</h2>

            {/* Date Navigation and Picker */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button
                        onClick={() => navigateHistory('prev')}
                        disabled={!selectedDateForHistory || uniqueDates.findIndex(date => date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]) === 0}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full disabled:opacity-50"
                    >
                        &lt;
                    </button>
                    <DatePicker
                        selected={selectedDateForHistory}
                        onChange={(date) => setSelectedDateForHistory(date)}
                        dateFormat="dd/MM/yyyy"
                        className="bg-gray-700 text-white p-2 rounded-lg text-center w-36 sm:w-48 cursor-pointer"
                        wrapperClassName="date-picker-wrapper"
                    />
                    <button
                        onClick={() => navigateHistory('next')}
                        disabled={!selectedDateForHistory || uniqueDates.findIndex(date => date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]) === uniqueDates.length - 1}
                        className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full disabled:opacity-50"
                    >
                        &gt;
                    </button>
                </div>

                {/* Day Filter */}
                <select
                    value={selectedHistoryDayFilter}
                    onChange={(e) => setSelectedHistoryDayFilter(e.target.value)}
                    className="bg-gray-700 text-white p-2 rounded-lg w-full sm:w-auto"
                >
                    {getAllUniqueDays().map(day => (
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

            {/* Clear All Workouts Button */}
            <button
                onClick={confirmClearAllWorkouts}
                className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg shadow-md transition transform hover:scale-105 mb-4 w-full sm:w-auto"
            >
                Tout Vider (soft delete)
            </button>

            {Object.values(groupedWorkouts)
                .sort((a, b) => {
                    // Gère les cas où dayOrder est manquant ou non numérique
                    const orderA = typeof a.dayOrder === 'number' ? a.dayOrder : Infinity;
                    const orderB = typeof b.dayOrder === 'number' ? b.dayOrder : Infinity;
                    return orderA - orderB;
                }) // <-- MODIFICATION ICI
                .map((dayData) => (
                    <div key={dayData.dayId || dayData.dayName} className="bg-gray-700 p-4 rounded-lg shadow-md mb-4 border border-gray-600">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xl sm:text-2xl font-semibold text-white">{dayData.dayName}</h3>
                            {/* Bouton Editer le jour complet (associé au premier workout du jour) */}
                            {dayData.workouts && dayData.workouts.length > 0 && (
                                <button
                                    onClick={() => editWorkout(dayData.workouts[0])}
                                    className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full transition transform hover:scale-110 shadow-md"
                                    title="Éditer l'entraînement"
                                >
                                    <Pencil className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {Object.values(dayData.categories).map((categoryData) => {
                                // Regroupe les exercices par nom et filtre les supprimés
                                const uniqueExercises = Array.from(new Map(
                                    categoryData.exercises.filter(ex => showDeletedExercisesInHistory ? true : !ex.deleted)
                                        .map(exercise => [exercise.name, exercise])
                                ).values());

                                return (
                                    <div key={categoryData.categoryId || categoryData.categoryName} className="bg-gray-600 p-3 rounded-lg shadow-sm border border-gray-500">
                                        <h4 className="text-lg sm:text-xl font-medium text-white mb-2">{categoryData.categoryName}</h4>
                                        <ul className="space-y-2">
                                            {uniqueExercises.map(exercise => (
                                                <li key={exercise.id} className={`bg-gray-500 p-3 rounded-lg flex justify-between items-center ${exercise.deleted ? 'opacity-50' : ''}`}>
                                                    <div>
                                                        <p className="text-white text-base sm:text-lg font-bold">{exercise.name}</p>
                                                        <p className="text-gray-200 text-sm sm:text-base">{getSeriesDisplay(exercise.sets || [])}</p>
                                                        {exercise.notes && (
                                                            <p className="text-yellow-200 text-xs sm:text-sm italic mt-1">Notes: {exercise.notes}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        {exercise.deleted ? (
                                                            <button onClick={() => restoreWorkout(exercise.workoutId)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110" title="Restaurer l'entraînement">
                                                                <RotateCcw className="h-4 w-4" />
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => confirmDeleteWorkout(exercise.workoutId)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer l'entraînement">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                                            <LineChartIcon className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleOpenNotesModal(dayData.dayName, categoryData.categoryName, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
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
                ))}
            {filteredWorkouts.length === 0 && (
                <p className="text-gray-400 text-center mt-8 text-lg sm:text-xl">
                    Aucun entraînement trouvé pour cette date et ces filtres.
                </p>
            )}
        </div>
    );
};

export default HistoryView;