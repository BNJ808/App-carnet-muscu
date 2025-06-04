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
 * @param {object} props.personalBests - Les meilleurs records personnels.
 * @param {object} props.progressionInsights - Les analyses de progression.
 * @param {function} props.handleReorderCategories - Fonction pour réorganiser les catégories.
 * @param {function} props.handleReorderExercises - Fonction pour réorganiser les exercices.
 * @param {function} props.openAddCategoryModalForDay - Fonction pour ouvrir la modale d'ajout de catégorie.
 * @param {function} props.handleEditCategory - Fonction pour modifier une catégorie.
 * @param {function} props.handleDeleteCategory - Fonction pour supprimer une catégorie.
 * @param {boolean} props.isSavingExercise - Indique si un exercice est en cours de sauvegarde.
 * @param {boolean} props.isDeletingExercise - Indique si un exercice est en cours de suppression.
 * @param {boolean} props.isAddingExercise - Indique si un exercice est en cours d'ajout.
 * @param {Array<string>} props.dayButtonColors - Couleurs pour les boutons de jour.
 * @param {Array<string>} props.dayBorderAndTextColors - Couleurs de bordure et de texte pour les jours.
 * @param {function} props.formatDate - Fonction utilitaire pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction utilitaire pour afficher les séries d'un exercice.
 * @param {number} props.timerSeconds - Secondes restantes du minuteur.
 * @param {boolean} props.timerIsRunning - Indique si le minuteur est en cours.
 * @param {boolean} props.timerIsFinished - Indique si le minuteur est terminé.
 * @param {function} props.startTimer - Fonction pour démarrer le minuteur.
 * @param {function} props.pauseTimer - Fonction pour mettre en pause le minuteur.
 * @param {function} props.resetTimer - Fonction pour réinitialiser le minuteur.
 * @param {function} props.setTimerSeconds - Fonction pour définir les secondes du minuteur.
 * @param {string} props.restTimeInput - Valeur du champ de saisie du temps de repos.
 * @param {function} props.setRestTimeInput - Fonction pour définir le temps de repos.
 * @param {function} props.formatTime - Fonction pour formater le temps du minuteur.
 */
const MainWorkoutView = ({
    workouts, selectedDayFilter, isEditMode, isAdvancedMode,
    handleEditClick, handleAddExerciseClick, handleDeleteExercise,
    openExerciseGraphModal, handleOpenNotesModal, handleAnalyzeProgressionClick,
    personalBests, progressionInsights, handleReorderCategories, handleReorderExercises,
    openAddCategoryModalForDay, handleEditCategory, handleDeleteCategory, // Added for category management
    isSavingExercise, isDeletingExercise, isAddingExercise,
    dayButtonColors, dayBorderAndTextColors, formatDate, getSeriesDisplay,
    timerSeconds, timerIsRunning, timerIsFinished, startTimer, pauseTimer, resetTimer,
    setTimerSeconds, restTimeInput, setRestTimeInput, formatTime
}) => {
    const filteredWorkouts = selectedDayFilter
        ? { [selectedDayFilter]: workouts.days[selectedDayFilter] }
        : workouts.days;

    const orderedDays = workouts.dayOrder || [];

    return (
        <>
            <div className="mb-8 p-4 bg-gray-800 rounded-lg shadow-xl">
                <h2 className="text-2xl sm:text-3xl font-bold text-center text-blue-400 mb-4">Minuteur de repos</h2>
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="text-5xl sm:text-6xl font-extrabold text-white">
                        {formatTime(timerSeconds)}
                    </div>
                    <div className="flex space-x-3 sm:space-x-4">
                        <button
                            onClick={() => startTimer(restTimeInput === '' ? 90 : parseInt(restTimeInput, 10))} // Pass restTimeInput to startTimer
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            disabled={timerIsRunning && timerSeconds > 0}
                        >
                            {timerIsRunning ? 'Reprendre' : 'Démarrer'}
                        </button>
                        <button
                            onClick={pauseTimer}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            disabled={!timerIsRunning}
                        >
                            Pause
                        </button>
                        <button
                            onClick={() => resetTimer(restTimeInput === '' ? 90 : parseInt(restTimeInput, 10))} // Pass restTimeInput to resetTimer
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                        >
                            Réinitialiser
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="restTimeInput" className="text-gray-300 text-sm sm:text-base">Temps de repos (secondes):</label>
                        <input
                            type="number"
                            id="restTimeInput"
                            className="shadow appearance-none border border-gray-600 rounded w-24 py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            value={restTimeInput}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Allow empty string, but if it's not empty, try to parse as int.
                                // If parsing results in NaN, set to empty string or 0 depending on desired behavior.
                                // For now, allow empty string for user to clear.
                                setRestTimeInput(value === '' ? '' : (parseInt(value, 10) || 0));
                            }}
                            min="0"
                        />
                    </div>
                    {timerIsFinished && (
                        <p className="text-red-400 text-lg sm:text-xl font-bold mt-2 animate-pulse">Temps écoulé !</p>
                    )}
                </div>
            </div>

            <div className="space-y-8">
                {orderedDays.filter(dayName => !selectedDayFilter || dayName === selectedDayFilter).map((day, dayIndex) => {
                    const dayData = workouts.days[day];
                    if (!dayData) return null;

                    const categoryOrder = dayData.categoryOrder || [];

                    return (
                        <div key={day} className={`bg-gray-800 rounded-lg shadow-xl p-4 sm:p-6 border-t-4 ${dayBorderAndTextColors[dayIndex % dayBorderAndTextColors.length]}`}>
                            <h2 className={`text-2xl sm:text-3xl font-extrabold mb-6 text-center ${dayBorderAndTextColors[dayIndex % dayBorderAndTextColors.length].replace('border-', 'text-')}`}>
                                {day}
                            </h2>
                            {isEditMode && (
                                <div className="flex justify-center mb-6">
                                    <button
                                        onClick={() => openAddCategoryModalForDay(day)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                                    >
                                        Ajouter un groupe musculaire
                                    </button>
                                </div>
                            )}

                            {categoryOrder.map((category, catIndex) => {
                                const categoryExercises = dayData.categories[category];
                                if (!categoryExercises || categoryExercises.length === 0 && !isEditMode) return null; // Hide empty categories in view mode

                                const visibleExercises = categoryExercises.filter(ex => !ex.isDeleted);
                                if (visibleExercises.length === 0 && !isEditMode) return null; // Hide if all are deleted and not in edit mode

                                return (
                                    <div key={category} className="mb-8 p-4 sm:p-5 bg-gray-700 rounded-lg shadow-md border border-gray-600">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl sm:text-2xl font-semibold text-white">{category}</h3>
                                            <div className="flex items-center space-x-2">
                                                {isEditMode && (
                                                    <>
                                                        {/* Bouton Ajouter un exercice - Visible UNIQUEMENT en mode édition */}
                                                        <button onClick={() => handleAddExerciseClick(day, category)} className="p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition transform hover:scale-110" title="Ajouter un exercice">
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                        {/* Bouton Modifier le groupe musculaire */}
                                                        <button onClick={() => handleEditCategory(day, category)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110" title="Modifier le groupe musculaire">
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        {/* Bouton Supprimer le groupe musculaire */}
                                                        <button onClick={() => handleDeleteCategory(day, category)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer le groupe musculaire">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                        {/* Boutons de réorganisation de catégorie */}
                                                        <button onClick={() => handleReorderCategories(day, category, -1)} disabled={catIndex === 0} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Déplacer vers le haut">
                                                            <ArrowUp className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleReorderCategories(day, category, 1)} disabled={catIndex === dayData.categoryOrder.length - 1} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Déplacer vers le bas">
                                                            <ArrowDown className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <ul className="space-y-3">
                                            {categoryExercises.filter(ex => isEditMode || !ex.isDeleted).map((exercise, index) => (
                                                <li key={exercise.id} id={`exercise-item-${exercise.id}`} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-800 p-3 rounded-md shadow-sm transition-all duration-200 ease-out ${exercise.isDeleted ? 'opacity-50 line-through' : ''}`}>
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
                                                        {isEditMode ? (
                                                            <>
                                                                {/* Bouton Modifier l'exercice */}
                                                                <button onClick={() => handleEditClick(day, category, exercise.id, exercise)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110" title="Modifier l'exercice">
                                                                    <Pencil className="h-4 w-4" />
                                                                </button>
                                                                {/* Bouton Supprimer l'exercice */}
                                                                <button onClick={() => handleDeleteExercise(day, category, exercise.id)} className={`p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110 ${isDeletingExercise ? 'button-deleting' : ''}`} title="Supprimer l'exercice">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                                {/* Boutons de réorganisation d'exercice */}
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, -1)} disabled={index === 0} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Déplacer vers le haut">
                                                                    <ArrowUp className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, 1)} disabled={index === categoryExercises.length - 1} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Déplacer vers le bas">
                                                                    <ArrowDown className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {/* Boutons visibles en mode initial */}
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
                                                            </>
                                                        )}
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

export default MainWorkoutView;
