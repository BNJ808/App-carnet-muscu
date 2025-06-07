// MainWorkoutView.jsx
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
 * @param {function} props.getSeriesDisplay - Fonction utilitaire pour afficher les séries d'un exercice.
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
    getSeriesDisplay
}) => {
    return (
        <>
            <div className="p-4 sm:p-6 bg-gray-800 min-h-screen text-white pb-20"> {/* Ajout de pb-20 pour éviter que le contenu ne soit caché par la barre de navigation */}
                {Object.entries(workouts).filter(([dayName]) =>
                    selectedDayFilter === null || selectedDayFilter === dayName
                ).map(([dayName, dayData]) => {
                    if (!dayData.isActive) return null; // Ne pas afficher les jours inactifs

                    return (
                        <div key={dayName} className="mb-8 p-4 bg-gray-900 rounded-lg shadow-lg">
                            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-purple-400 border-b-2 border-purple-500 pb-2">{dayName}</h2>
                            <div>
                                {Object.entries(dayData.categories).map(([categoryName, categoryData]) => {
                                    if (!categoryData.isActive) return null; // Ne pas afficher les catégories inactives

                                    return (
                                        <div key={categoryName} className="mb-6 p-3 bg-gray-800 rounded-md shadow-md">
                                            <h3 className="text-xl sm:text-2xl font-semibold mb-3 text-blue-300 border-b border-blue-400 pb-1 flex justify-between items-center">
                                                {categoryName}
                                                {isEditMode && (
                                                    <button
                                                        onClick={() => handleAddExerciseClick(dayName, categoryName)}
                                                        className="ml-2 p-1 rounded-full bg-green-500 hover:bg-green-600 text-white transition transform hover:scale-110"
                                                        title="Ajouter un exercice"
                                                    >
                                                        <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                                                    </button>
                                                )}
                                            </h3>
                                            <ul>
                                                {categoryData.exercises.filter(exercise => exercise.isActive).map((exercise, index) => (
                                                    <li key={exercise.id} className="mb-4 p-3 bg-gray-700 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center shadow">
                                                        <div className="flex-1 mb-2 sm:mb-0">
                                                            <div className="flex items-center">
                                                                <span className="text-lg sm:text-xl font-medium text-white">{exercise.name}</span>
                                                                {isAdvancedMode && personalBests[exercise.id] && (
                                                                    <span className="ml-2 text-yellow-300 text-xs sm:text-sm font-semibold">
                                                                        BP: {personalBests[exercise.id].weight}kg x {personalBests[exercise.id].reps}
                                                                        {personalBests[exercise.id].oneRM && ` (1RM: ${personalBests[exercise.id].oneRM.toFixed(1)}kg)`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1">
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
                                                        </div>
                                                        <div className="flex space-x-2 mt-2 sm:mt-0">
                                                            {isEditMode ? (
                                                                <>
                                                                    <button onClick={() => handleEditClick(dayName, categoryName, exercise.id)} className="p-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition transform hover:scale-110" title="Éditer l'exercice">
                                                                        <Pencil className="h-4 w-4" />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteExercise(dayName, categoryName, exercise.id)} className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition transform hover:scale-110" title="Supprimer l'exercice">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                isAdvancedMode && (
                                                                    <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec l'IA">
                                                                        <Sparkles className="h-4 w-4" />
                                                                    </button>
                                                                )
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