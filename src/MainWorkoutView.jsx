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
 * @param {object} props.personalBests - Les records personnels.
 * @param {object} props.progressionInsights - Les analyses de progression.
 * @param {function} props.handleReorderCategories - Fonction pour réorganiser les catégories.
 * @param {function} props.handleReorderExercises - Fonction pour réorganiser les exercices.
 * @param {function} props.openAddCategoryModalForDay - Fonction pour ouvrir la modale d'ajout de catégorie.
 * @param {boolean} props.isSavingExercise - Indique si une sauvegarde d'exercice est en cours.
 * @param {boolean} props.isDeletingExercise - Indique si une suppression d'exercice est en cours.
 * @param {boolean} props.isAddingExercise - Indique si un ajout d'exercice est en cours.
 * @param {Array<string>} props.dayButtonColors - Couleurs pour les boutons de jour.
 * @param {Array<string>} props.dayBorderAndTextColors - Couleurs de bordure et de texte pour les jours.
 * @param {function} props.formatDate - Fonction pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction pour afficher les séries d'un exercice.
 * @param {number} props.timerSeconds - Secondes restantes du minuteur.
 * @param {boolean} props.timerIsRunning - Indique si le minuteur est en cours.
 * @param {boolean} props.timerIsFinished - Indique si le minuteur est terminé.
 * @param {function} props.startTimer - Fonction pour démarrer le minuteur.
 * @param {function} props.pauseTimer - Fonction pour mettre en pause le minuteur.
 * @param {function} props.resetTimer - Fonction pour réinitialiser le minuteur.
 * @param {function} props.setTimerSeconds - Fonction pour définir les secondes du minuteur.
 * @param {number} props.restTimeInput - Temps de repos saisi par l'utilisateur.
 * @param {function} props.setRestTimeInput - Fonction pour définir le temps de repos saisi.
 * @param {function} props.formatTime - Fonction pour formater le temps du minuteur.
 */
const MainWorkoutView = ({
    workouts, selectedDayFilter, isEditMode, isAdvancedMode,
    handleEditClick, handleAddExerciseClick, handleDeleteExercise,
    openExerciseGraphModal, handleOpenNotesModal, handleAnalyzeProgressionClick,
    personalBests, progressionInsights, handleReorderCategories, handleReorderExercises,
    openAddCategoryModalForDay, isSavingExercise, isDeletingExercise, isAddingExercise,
    dayButtonColors, dayBorderAndTextColors, formatDate, getSeriesDisplay,
    timerSeconds, timerIsRunning, timerIsFinished, startTimer, pauseTimer, resetTimer, setTimerSeconds,
    restTimeInput, setRestTimeInput, formatTime
}) => {

    const currentDayData = workouts.days[selectedDayFilter];
    const categoriesOrder = currentDayData?.categoryOrder || [];

    const handleRestTimeChange = (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0) {
            setRestTimeInput(value);
            resetTimer(value);
        }
    };

    return (
        <div className="w-full max-w-4xl bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
            {workouts.dayOrder && workouts.dayOrder.length > 0 && selectedDayFilter ? (
                <>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-blue-300 text-center">
                        {selectedDayFilter}
                    </h2>

                    {/* Rest Timer Section */}
                    <div className="bg-gray-700 p-4 rounded-lg shadow-md mb-6 border border-gray-600 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <label htmlFor="restTimeInput" className="text-white text-lg font-semibold">Temps de repos:</label>
                            <input
                                type="number"
                                id="restTimeInput"
                                value={restTimeInput}
                                onChange={handleRestTimeChange}
                                className="w-24 bg-gray-600 text-white p-2 rounded-md border border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                min="0"
                            />
                            <span className="text-white">secondes</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <span className="text-4xl font-extrabold text-blue-400">{formatTime(timerSeconds)}</span>
                            <button
                                onClick={timerIsRunning ? pauseTimer : startTimer}
                                className={`py-2 px-4 rounded-full font-bold transition transform hover:scale-105 shadow-lg text-sm sm:text-base
                                    ${timerIsRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                            >
                                {timerIsRunning ? 'Pause' : 'Démarrer'}
                            </button>
                            <button
                                onClick={() => resetTimer(restTimeInput)}
                                className="py-2 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Reset
                            </button>
                        </div>
                        {timerIsFinished && (
                            <span className="text-green-400 font-bold text-lg animate-pulse">Temps écoulé !</span>
                        )}
                    </div>

                    {isEditMode && (
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => openAddCategoryModalForDay(selectedDayFilter)}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition transform hover:scale-105 shadow-lg text-sm sm:text-base"
                            >
                                Ajouter Groupe Musculaire
                            </button>
                        </div>
                    )}

                    <div className="space-y-6 sm:space-y-8">
                        {categoriesOrder.map((categoryName, catIndex) => {
                            const categoryExercises = currentDayData.categories[categoryName];
                            
                            // Ajout d'une vérification pour s'assurer que categoryExercises est un tableau
                            if (!Array.isArray(categoryExercises)) {
                                console.warn(`Catégorie "${categoryName}" pour le jour "${selectedDayFilter}" n'est pas un tableau d'exercices. Skipping.`);
                                return null; // Ne pas rendre cette catégorie si elle est malformée
                            }

                            const visibleExercises = categoryExercises.filter(ex => !ex.isDeleted);

                            if (visibleExercises.length === 0 && !isEditMode) {
                                return null; // Ne pas afficher la catégorie si elle est vide en mode non-édition
                            }

                            return (
                                <div key={categoryName} className="bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-xl sm:text-2xl font-semibold text-white">{categoryName}</h3>
                                        {isEditMode && (
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleReorderCategories(selectedDayFilter, categoryName, -1)} disabled={catIndex === 0} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110 disabled:opacity-50" title="Déplacer vers le haut"><ArrowUp className="h-4 w-4" /></button>
                                                <button onClick={() => handleReorderCategories(selectedDayFilter, categoryName, 1)} disabled={catIndex === categoriesOrder.length - 1} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110 disabled:opacity-50" title="Déplacer vers le bas"><ArrowDown className="h-4 w-4" /></button>
                                                <button onClick={() => handleEditCategory(selectedDayFilter, categoryName)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Renommer le groupe musculaire">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleDeleteCategory(selectedDayFilter, categoryName)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer le groupe musculaire">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleAddExerciseClick(selectedDayFilter, categoryName)} className="p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition transform hover:scale-110" title="Ajouter un exercice">
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <ul className="space-y-3">
                                        {visibleExercises.map((exercise, exIndex) => (
                                            <li key={exercise.id} id={`exercise-item-${exercise.id}`} className="bg-gray-600 p-3 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                <div className="flex-grow">
                                                    <p className="text-white text-lg font-bold">{exercise.name}</p>
                                                    <p className="text-gray-200 text-sm">{getSeriesDisplay(exercise)}</p>
                                                    {isAdvancedMode && personalBests[exercise.id] && (
                                                        <p className="text-yellow-300 text-xs mt-1">
                                                            PB: {personalBests[exercise.id].maxWeight}kg x {personalBests[exercise.id].reps} reps ({formatDate(personalBests[exercise.id].date)})
                                                        </p>
                                                    )}
                                                    {isAdvancedMode && progressionInsights[exercise.id] && (
                                                        <p className="text-sky-300 text-xs mt-1">
                                                            Progression: {progressionInsights[exercise.id]}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap justify-end gap-2 mt-2 sm:mt-0">
                                                    {isEditMode && (
                                                        <>
                                                            <button onClick={() => handleReorderExercises(selectedDayFilter, categoryName, exercise.id, -1)} disabled={exIndex === 0} className="p-1 rounded-full bg-blue-400 hover:bg-blue-500 text-white transition transform hover:scale-110 disabled:opacity-50" title="Déplacer vers le haut"><ArrowUp className="h-4 w-4" /></button>
                                                            <button onClick={() => handleReorderExercises(selectedDayFilter, categoryName, exercise.id, 1)} disabled={exIndex === visibleExercises.length - 1} className="p-1 rounded-full bg-blue-400 hover:bg-blue-500 text-white transition transform hover:scale-110 disabled:opacity-50" title="Déplacer vers le bas"><ArrowDown className="h-4 w-4" /></button>
                                                            <button onClick={() => handleEditClick(selectedDayFilter, categoryName, exercise.id, exercise)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Modifier l'exercice">
                                                                <Pencil className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => handleDeleteExercise(selectedDayFilter, categoryName, exercise.id)} className={`p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110 ${isDeletingExercise ? 'button-deleting' : ''}`} title="Supprimer l'exercice">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique">
                                                        <LineChartIcon className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleOpenNotesModal(selectedDayFilter, categoryName, exercise.id, exercise.notes)} className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white transition transform hover:scale-110" title="Notes de l'exercice">
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
                </>
            ) : (
                <p className="text-gray-400 text-center text-lg sm:text-xl mt-8">
                    {workouts.dayOrder && workouts.dayOrder.length > 0
                        ? "Sélectionnez un jour d'entraînement ci-dessus."
                        : "Aucun entraînement configuré. Ajoutez un jour pour commencer !"
                    }
                </p>
            )}
        </div>
    );
};

export default MainWorkoutView;
