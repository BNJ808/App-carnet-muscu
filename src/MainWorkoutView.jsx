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
 * @param {object} props.progressionInsights - Les insights de progression des exercices.
 * @param {function} props.handleReorderCategories - Fonction pour réorganiser les catégories.
 * @param {function} props.handleReorderExercises - Fonction pour réorganiser les exercices.
 * @param {function} props.openAddCategoryModalForDay - Fonction pour ouvrir la modale d'ajout de catégorie pour un jour spécifique.
 * @param {boolean} props.isSavingExercise - Indique si une opération de sauvegarde d'exercice est en cours.
 * @param {boolean} props.isDeletingExercise - Indique si une opération de suppression d'exercice est en cours.
 * @param {boolean} props.isAddingExercise - Indique si une opération d'ajout d'exercice est en cours.
 * @param {string[]} props.dayButtonColors - Tableau des classes de couleurs pour les boutons de jour.
 * @param {string[]} props.dayBorderAndTextColors - Tableau des classes de couleurs pour les bordures et le texte des jours.
 * @param {function} props.formatDate - Fonction utilitaire pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction utilitaire pour afficher les séries d'un exercice.
 * @param {number} props.timerSeconds - Secondes restantes du minuteur.
 * @param {boolean} props.timerIsRunning - Indique si le minuteur est en cours.
 * @param {boolean} props.timerIsFinished - Indique si le minuteur est terminé.
 * @param {function} props.startTimer - Fonction pour démarrer le minuteur.
 * @param {function} props.pauseTimer - Fonction pour mettre en pause le minuteur.
 * @param {function} props.resetTimer - Fonction pour réinitialiser le minuteur.
 * @param {function} props.setTimerSeconds - Fonction pour définir les secondes du minuteur.
 * @param {number} props.restTimeInput - Temps de repos configuré.
 * @param {function} props.setRestTimeInput - Fonction pour définir le temps de repos.
 * @param {function} props.formatTime - Fonction pour formater le temps du minuteur.
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
    isSavingExercise,
    isDeletingExercise,
    isAddingExercise,
    dayButtonColors,
    dayBorderAndTextColors,
    formatDate,
    getSeriesDisplay,
    timerSeconds,
    timerIsRunning,
    timerIsFinished,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerSeconds,
    restTimeInput,
    setRestTimeInput,
    formatTime,
}) => {
    const orderedDays = workouts.dayOrder || [];
    const daysToDisplay = selectedDayFilter && orderedDays.includes(selectedDayFilter) ? [selectedDayFilter] : [];

    return (
        <>
            <div className="flex flex-col lg:flex-row gap-8 mb-8 max-w-6xl mx-auto">
                <div className={`bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 border border-gray-700 w-full`}>
                    <h2 className={`text-2xl sm:text-3xl font-bold text-red-400 mb-4 text-center`}>Minuteur de repos</h2>
                    <div className="flex items-center justify-center space-x-4 mb-4">
                        <input
                            type="number"
                            value={restTimeInput}
                            onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value >= 0) {
                                    setRestTimeInput(value);
                                    setTimerSeconds(value);
                                } else if (e.target.value === '') {
                                    setRestTimeInput('');
                                }
                            }}
                            onBlur={() => {
                                if (restTimeInput === '') {
                                    setRestTimeInput(90); // Default to 90 seconds
                                    setTimerSeconds(90);
                                }
                            }}
                            className={`w-20 sm:w-24 p-2 rounded-md bg-gray-700 text-white border border-gray-600 text-center text-base sm:text-lg focus:ring-2 focus:ring-blue-500`}
                            min="0"
                            max="3600"
                            aria-label="Temps de repos en secondes"
                        />
                        <span className={`text-lg sm:text-xl text-gray-300`}>secondes</span>
                    </div>
                    <p className={`text-5xl sm:text-6xl font-extrabold text-blue-400 mb-6 text-center transition-colors duration-500`}>
                        {formatTime(timerSeconds)}
                    </p>
                    <div className="flex justify-center space-x-4">
                        <button
                            onClick={timerIsRunning ? pauseTimer : () => startTimer()}
                            className={`px-6 py-3 sm:px-8 sm:py-4 rounded-full font-bold shadow-lg transition transform hover:scale-105 text-lg sm:text-xl ${timerIsRunning ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                        >
                            {timerIsRunning ? 'Pause' : 'Démarrer'}
                        </button>
                        <button
                            onClick={() => resetTimer(restTimeInput || 90)} // Default to 90 seconds
                            className="px-6 py-3 sm:px-8 sm:py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg transition transform hover:scale-105 text-lg sm:text-xl"
                        >
                            Réinitialiser
                        </button>
                    </div>
                    {timerIsFinished && (
                        <p className="text-yellow-400 text-xl sm:text-2xl font-bold mt-4 animate-bounce text-center">
                            Temps de repos terminé !
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 max-w-6xl mx-auto">
                {daysToDisplay.map((day) => {
                    const currentDayData = workouts.days?.[day];
                    if (!currentDayData) {
                        return <div key={day} className="text-center text-gray-500">Journée "{day}" non trouvée ou vide.</div>;
                    }

                    const categoriesToIterate = currentDayData.categoryOrder || [];

                    return (
                        <div key={day} className={`bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 border border-gray-700`}>
                            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                                <h2 className={`text-2xl sm:text-3xl font-bold text-blue-400`}>{day}</h2>
                                {isEditMode && (
                                    <button onClick={() => openAddCategoryModalForDay(day)} className="px-3 py-1 sm:px-4 sm:py-2 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs sm:text-sm" title="Ajouter un groupe musculaire">
                                        <Plus className="h-4 w-4 inline-block mr-1" /> Ajouter groupe musculaire
                                    </button>
                                )}
                            </div>

                            {categoriesToIterate.map((category) => {
                                const exercises = currentDayData.categories?.[category] || [];
                                const exercisesToRender = exercises.filter(ex => !ex.isDeleted);

                                if (!isEditMode && exercises.every(ex => ex.isDeleted)) {
                                    return null;
                                }

                                const categoryIndexInOrder = currentDayData.categoryOrder.indexOf(category);

                                return (
                                    <div key={category} className={`mb-8 bg-gray-700 rounded-lg p-3 sm:p-5 shadow-inner border border-gray-700 transition-all duration-300 ease-out`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className={`text-xl sm:text-2xl font-semibold text-green-300`}>{category}</h3>
                                            {isEditMode && (
                                                <div className="flex space-x-1 sm:space-x-2 flex-wrap gap-1">
                                                    <button onClick={() => handleAddExerciseClick(day, category)} className="p-1 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-110 shadow-lg text-xs" title="Ajouter un exercice">
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleEditCategory(day, category)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Renommer groupe musculaire">
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteExercise(day, category)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer groupe musculaire">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleReorderCategories(day, category, -1)} disabled={categoryIndexInOrder === 0 || categoryIndexInOrder === -1} className="p-1 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer le groupe musculaire vers le haut">
                                                        <ArrowUp className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleReorderCategories(day, category, 1)} disabled={categoryIndexInOrder === currentDayData.categoryOrder.length - 1 || categoryIndexInOrder === -1} className="p-1 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer le groupe musculaire vers le bas">
                                                        <ArrowDown className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <ul className="space-y-4">
                                            {exercisesToRender.map((exercise, exerciseIndex) => (
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
                                                        <button onClick={() => handleEditClick(day, category, exercise.id, exercise)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110 shadow-lg" title="Editer l'exercice">
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        {isEditMode && (
                                                            <>
                                                                <button onClick={() => handleDeleteExercise(day, category, exercise.id)} disabled={isDeletingExercise} className={`p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110 shadow-lg ${isDeletingExercise ? 'button-deleting' : ''}`} title="Supprimer l'exercice">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, -1)} disabled={exerciseIndex === 0} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer l'exercice vers le haut">
                                                                    <ArrowUp className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={() => handleReorderExercises(day, category, exercise.id, 1)} disabled={exerciseIndex === exercisesToRender.length - 1} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-110" title="Déplacer l'exercice vers le bas">
                                                                    <ArrowDown className="h-4 w-4" />
                                                                </button>
                                                            </>
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

export default MainWorkoutView;
