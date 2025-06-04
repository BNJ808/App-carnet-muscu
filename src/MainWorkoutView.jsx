import React from 'react';
import {
    Plus, Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    ArrowUp, ArrowDown
} from 'lucide-react';

/**
 * Composant MainWorkoutView pour afficher la vue principale des entraînements.
 * Gère l'affichage des jours, catégories et exercices, ainsi que les interactions d'édition.
 * @param {object} props - Les props du composant.
 * @param {object} props.workouts - L'objet contenant toutes les données d'entraînement.
 * @param {string | null} props.selectedDayFilter - Le jour actuellement sélectionné pour l'affichage.
 * @param {boolean} props.isEditMode - Indique si le mode édition est activé.
 * @param {boolean} props.isAdvancedMode - Indique si le mode avancé est activé.
 * @param {function} props.handleEditClick - Fonction pour gérer le clic sur le bouton d'édition d'un exercice.
 * @param {function} props.handleAddExerciseClick - Fonction pour gérer le clic sur le bouton d'ajout d'exercice.
 * @param {function} props.handleDeleteExercise - Fonction pour gérer la suppression d'un exercice.
 * @param {function} props.openExerciseGraphModal - Fonction pour ouvrir la modale du graphique d'exercice.
 * @param {function} props.handleOpenNotesModal - Fonction pour ouvrir la modale des notes.
 * @param {function} props.handleAnalyzeProgressionClick - Fonction pour analyser la progression avec l'IA.
 * @param {object} props.personalBests - Les records personnels des exercices.
 * @param {object} props.progressionInsights - Les analyses de progression des exercices.
 * @param {function} props.handleReorderCategories - Fonction pour réorganiser les catégories.
 * @param {function} props.handleReorderExercises - Fonction pour réorganiser les exercices.
 * @param {function} props.openAddCategoryModalForDay - Fonction pour ouvrir la modale d'ajout de catégorie.
 * @param {function} props.handleEditCategory - Fonction pour éditer une catégorie.
 * @param {function} props.handleDeleteCategory - Fonction pour supprimer une catégorie.
 * @param {boolean} props.isSavingExercise - Indique si un exercice est en cours de sauvegarde.
 * @param {boolean} props.isDeletingExercise - Indique si un exercice est en cours d'ajout.
 * @param {boolean} props.isAddingExercise - Indique si un exercice est en cours d'ajout.
 * @param {string[]} props.dayButtonColors - Couleurs pour les boutons de jour.
 * @param {string[]} props.dayBorderAndTextColors - Couleurs de bordure et de texte pour les jours.
 * @param {string[]} props.dayTitleColors - NOUVEAU : Couleurs spécifiques pour les titres des jours (h2).
 * @param {function} props.formatDate - Fonction pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction pour afficher les séries d'un exercice.
 */
const MainWorkoutView = ({
    workouts,
    selectedDayFilter,
    isEditMode,
    isAdvancedMode,
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
    dayTitleColors, // AJOUT DE LA NOUVELLE PROP
    formatDate,
    getSeriesDisplay,
}) => {
    const safeWorkoutsDays = workouts?.days || {}; // Ensure workouts.days is an object
    const filteredWorkouts = selectedDayFilter
        ? (safeWorkoutsDays[selectedDayFilter] ? { [selectedDayFilter]: safeWorkoutsDays[selectedDayFilter] } : {})
        : safeWorkoutsDays;

    const orderedDays = workouts?.dayOrder || []; // Ensure workouts.dayOrder is an array

    return (
        <>
            {Object.keys(filteredWorkouts).length === 0 && (
                <p className="text-gray-400 text-center mt-8 text-lg sm:text-xl">
                    Aucun entraînement trouvé pour le jour sélectionné.
                    {isEditMode && (
                        <span className="block mt-2">
                            Cliquez sur "Actions sur les jours" pour ajouter un nouveau jour.
                        </span>
                    )}
                </p>
            )}

            <div className="space-y-8">
                {orderedDays.filter(dayName => !selectedDayFilter || dayName === selectedDayFilter).map((dayName, dayIndex) => {
                    const dayData = safeWorkoutsDays[dayName]; // Use safeWorkoutsDays
                    if (!dayData || typeof dayData !== 'object' || !dayData.categories || typeof dayData.categories !== 'object') {
                        console.warn(`Données de jour invalides ou manquantes pour: ${dayName}`, dayData);
                        return null; // Skip rendering this day
                    }

                    const categoryOrder = Array.isArray(dayData.categoryOrder)
                        ? dayData.categoryOrder
                        : Object.keys(dayData.categories || {}).sort(); // Ensure Object.keys is called on an object

                    // Utilise directement la prop dayTitleColors passée depuis App.jsx
                    const dayTitleColorClass = dayTitleColors[dayIndex % dayTitleColors.length];

                    return (
                        <div key={dayName} className={`bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg border-2 ${dayBorderAndTextColors[dayIndex % dayBorderAndTextColors.length]}`}>
                            <h2 className={`text-xl sm:text-3xl font-extrabold mb-6 text-center ${dayTitleColorClass}`}>
                                {dayName}
                            </h2>
                            {isEditMode && (
                                <div className="flex justify-center mb-4 space-x-2">
                                    <button
                                        onClick={() => openAddCategoryModalForDay(dayName)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base flex items-center"
                                        title="Ajouter un groupe musculaire"
                                    >
                                        <Plus className="h-4 w-4 mr-2" /> Groupe Musculaire
                                    </button>
                                </div>
                            )}

                            {categoryOrder.length === 0 && (
                                <p className="text-gray-400 text-center mt-4">
                                    Aucun groupe musculaire pour ce jour.
                                    {isEditMode && (
                                        <span className="block mt-1">
                                            Cliquez sur "Ajouter Groupe Musculaire" ci-dessus.
                                        </span>
                                    )}
                                </p>
                            )}

                            <div className="space-y-6">
                                {categoryOrder.map((categoryName, categoryIndex) => {
                                    const exercises = dayData.categories?.[categoryName]; // Use optional chaining
                                    if (!Array.isArray(exercises)) { // Only check if it's not an array
                                        console.warn(`Exercices pour la catégorie ${categoryName} du jour ${dayName} ne sont pas un tableau ou sont manquants.`, exercises);
                                        return null; // Skip rendering this category
                                    }

                                    return (
                                        <div key={categoryName} className="bg-gray-700 p-4 sm:p-5 rounded-lg shadow-md">
                                            <h3 className="text-lg sm:text-2xl font-bold mb-4 text-white flex items-center justify-between">
                                                {categoryName}
                                                {isEditMode && (
                                                    <div className="flex space-x-2 ml-auto">
                                                        <button onClick={() => handleEditCategory(dayName, categoryName)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Renommer le groupe musculaire">
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteCategory(dayName, categoryName)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer le groupe musculaire">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleReorderCategories(dayName, categoryName, -1)} disabled={categoryIndex === 0} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le haut">
                                                            <ArrowUp className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleReorderCategories(dayName, categoryName, 1)} disabled={categoryIndex === categoryOrder.length - 1} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le bas">
                                                            <ArrowDown className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </h3>
                                            {isEditMode && (
                                                <button
                                                    onClick={() => handleAddExerciseClick(dayName, categoryName)}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base flex items-center justify-center mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={isAddingExercise}
                                                >
                                                    <Plus className="h-4 w-4 mr-2" /> Ajouter Exercice
                                                </button>
                                            )}
                                            {exercises.length === 0 && (
                                                <p className="text-gray-400 text-center mt-4">
                                                    Aucun exercice dans ce groupe musculaire.
                                                    {isEditMode && (
                                                        <span className="block mt-1">
                                                            Cliquez sur "Ajouter Exercice" ci-dessus.
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                            <ul className="space-y-3">
                                                {exercises.filter(ex => !ex.isDeleted).map((exercise, exerciseIndex) => (
                                                    <li key={exercise.id} id={`exercise-item-${exercise.id}`} className={`bg-gray-800 p-3 sm:p-4 rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-200 ease-out
                                                        ${isSavingExercise && exercise.id === exercise.id ? 'saved-animation' : ''}
                                                    `}>
                                                        <div className="flex-grow mb-2 sm:mb-0">
                                                            <p className="text-lg sm:text-xl font-semibold text-blue-300">{exercise.name}</p>
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
                                                            {isEditMode && (
                                                                <>
                                                                    <button onClick={() => handleEditClick(dayName, categoryName, exercise.id, exercise)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed" title="Modifier l'exercice" disabled={isSavingExercise}>
                                                                        <Pencil className="h-4 w-4" />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteExercise(dayName, categoryName, exercise.id)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed" title="Supprimer l'exercice" disabled={isDeletingExercise}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                    <button onClick={() => handleReorderExercises(dayName, categoryName, exercise.id, -1)} disabled={exerciseIndex === 0} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le haut">
                                                                        <ArrowUp className="h-4 w-4" />
                                                                    </button>
                                                                    <button onClick={() => handleReorderExercises(dayName, categoryName, exercise.id, 1)} disabled={exerciseIndex === exercises.filter(ex => !ex.isDeleted).length - 1} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" title="Déplacer vers le bas">
                                                                        <ArrowDown className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {isAdvancedMode && (
                                                                <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec l'IA">
                                                                    <Sparkles className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                                                <LineChartIcon className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => handleOpenNotesModal(dayName, categoryName, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
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
            </div>
        </>
    );
};

export default MainWorkoutView;
