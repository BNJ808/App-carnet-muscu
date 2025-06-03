import React from 'react';
import {
    Plus, Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    ArrowUp, ArrowDown
} from 'lucide-react';

/**
 * Composant MainWorkoutView pour afficher la vue principale des entraînements.
 * Gère l'affichage des jours, catégories et exercices, ainsi que les interactions d'édition.
 * @param {object} props - Les props du composant.
 * @param {object} props.currentWorkout - L'entraînement actuel en cours d'édition/création.
 * @param {function} props.setCurrentWorkout - Fonction pour mettre à jour l'entraînement actuel.
 * @param {function} props.saveWorkout - Fonction pour sauvegarder l'entraînement.
 * @param {string | null} props.editWorkoutId - L'ID de l'entraînement en cours d'édition.
 * @param {function} props.setEditWorkoutId - Fonction pour définir l'ID de l'entraînement en cours d'édition.
 */
const MainWorkoutView = ({ currentWorkout, setCurrentWorkout, saveWorkout, editWorkoutId, setEditWorkoutId }) => {
    // Handler pour ajouter un jour d'entraînement
    const handleAddDay = () => {
        const newDayOrder = (currentWorkout.days ? Math.max(...currentWorkout.days.map(d => d.dayOrder)) : 0) + 1;
        setCurrentWorkout({
            ...currentWorkout,
            days: [
                ...(currentWorkout.days || []),
                { id: Date.now(), name: `Jour ${newDayOrder}`, dayOrder: newDayOrder, categories: [] }
            ]
        });
    };

    // Handler pour modifier le nom d'un jour
    const handleDayNameChange = (dayId, newName) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? { ...day, name: newName } : day
            )
        });
    };

    // Handler pour supprimer un jour
    const handleDeleteDay = (dayId) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.filter(day => day.id !== dayId)
        });
    };

    // Handler pour ajouter une catégorie à un jour
    const handleAddCategory = (dayId) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? { ...day, categories: [...(day.categories || []), { id: Date.now(), name: 'Nouvelle Catégorie', exercises: [] }] } : day
            )
        });
    };

    // Handler pour modifier le nom d'une catégorie
    const handleCategoryNameChange = (dayId, categoryId, newName) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.map(category =>
                        category.id === categoryId ? { ...category, name: newName } : category
                    )
                } : day
            )
        });
    };

    // Handler pour supprimer une catégorie
    const handleDeleteCategory = (dayId, categoryId) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.filter(category => category.id !== categoryId)
                } : day
            )
        });
    };

    // Handler pour ajouter un exercice à une catégorie
    const handleAddExercise = (dayId, categoryId) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.map(category =>
                        category.id === categoryId ? { ...category, exercises: [...(category.exercises || []), { id: Date.now(), name: '', sets: [{ reps: '', weight: '' }], notes: '' }] } : category
                    )
                } : day
            )
        });
    };

    // Handler pour modifier le nom d'un exercice
    const handleExerciseNameChange = (dayId, categoryId, exerciseId, newName) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.map(category =>
                        category.id === categoryId ? {
                            ...category,
                            exercises: category.exercises.map(exercise =>
                                exercise.id === exerciseId ? { ...exercise, name: newName } : exercise
                            )
                        } : category
                    )
                } : day
            )
        });
    };

    // Handler pour modifier les sets (répétitions et poids) d'un exercice
    const handleSetChange = (dayId, categoryId, exerciseId, setIndex, field, value) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.map(category =>
                        category.id === categoryId ? {
                            ...category,
                            exercises: category.exercises.map(exercise =>
                                exercise.id === exerciseId ? {
                                    ...exercise,
                                    sets: exercise.sets.map((set, sIdx) =>
                                        sIdx === setIndex ? { ...set, [field]: value } : set
                                    )
                                } : exercise
                            )
                        } : category
                    )
                } : day
            )
        });
    };

    // Handler pour ajouter un set à un exercice
    const handleAddSet = (dayId, categoryId, exerciseId) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.map(category =>
                        category.id === categoryId ? {
                            ...category,
                            exercises: category.exercises.map(exercise =>
                                exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, { reps: '', weight: '' }] } : exercise
                            )
                        } : category
                    )
                } : day
            )
        });
    };

    // Handler pour supprimer un set d'un exercice
    const handleDeleteSet = (dayId, categoryId, exerciseId, setIndex) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.map(category =>
                        category.id === categoryId ? {
                            ...category,
                            exercises: exercise.id === exerciseId ? {
                                ...exercise,
                                sets: exercise.sets.filter((_, sIdx) => sIdx !== setIndex)
                            } : exercise
                        } : category
                    )
                } : day
            )
        });
    };

    // Handler pour supprimer un exercice
    const handleDeleteExercise = (dayId, categoryId, exerciseId) => {
        setCurrentWorkout({
            ...currentWorkout,
            days: currentWorkout.days.map(day =>
                day.id === dayId ? {
                    ...day,
                    categories: day.categories.map(category =>
                        category.id === categoryId ? {
                            ...category,
                            exercises: category.exercises.filter(exercise => exercise.id !== exerciseId)
                        } : category
                    )
                } : day
            )
        });
    };

    const handleSaveWorkout = () => {
        saveWorkout(currentWorkout);
        setEditWorkoutId(null);
    };

    // Tri des jours pour l'affichage
    const sortedDays = (currentWorkout.days || []).sort((a, b) => {
        const orderA = typeof a.dayOrder === 'number' ? a.dayOrder : Infinity;
        const orderB = typeof b.dayOrder === 'number' ? b.dayOrder : Infinity;
        return orderA - orderB;
    });

    return (
        <div className="w-full max-w-4xl bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-blue-300">
                {editWorkoutId ? 'Modifier l\'entraînement' : 'Nouvel Entraînement'}
            </h2>

            <div className="flex flex-col space-y-4">
                {sortedDays.map(day => (
                    <div key={day.id} className="bg-gray-700 p-4 rounded-lg shadow-md border border-gray-600">
                        <div className="flex justify-between items-center mb-3">
                            <input
                                type="text"
                                value={day.name}
                                onChange={(e) => handleDayNameChange(day.id, e.target.value)}
                                className="bg-transparent text-xl sm:text-2xl font-semibold text-white outline-none border-b border-gray-500 focus:border-blue-400 pb-1"
                                placeholder="Nom du Jour (ex: Push)"
                            />
                            <button
                                onClick={() => handleDeleteDay(day.id)}
                                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition transform hover:scale-110 shadow-md"
                                title="Supprimer le jour"
                            >
                                <Trash2 className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {day.categories.map(category => (
                                <div key={category.id} className="bg-gray-600 p-3 rounded-lg shadow-sm border border-gray-500">
                                    <div className="flex justify-between items-center mb-2">
                                        <input
                                            type="text"
                                            value={category.name}
                                            onChange={(e) => handleCategoryNameChange(day.id, category.id, e.target.value)}
                                            className="bg-transparent text-lg sm:text-xl font-medium text-white outline-none border-b border-gray-400 focus:border-blue-300 pb-1"
                                            placeholder="Nom Catégorie (ex: Pectoraux)"
                                        />
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleDeleteCategory(day.id, category.id)}
                                                className="bg-red-400 hover:bg-red-500 text-white p-1.5 rounded-full transition transform hover:scale-110"
                                                title="Supprimer la catégorie"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAddExercise(day.id, category.id)}
                                                className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-full transition transform hover:scale-110"
                                                title="Ajouter un exercice"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {category.exercises.map(exercise => (
                                            <div key={exercise.id} className="bg-gray-500 p-3 rounded-lg shadow-xs">
                                                <div className="flex justify-between items-center mb-2">
                                                    <input
                                                        type="text"
                                                        value={exercise.name}
                                                        onChange={(e) => handleExerciseNameChange(day.id, category.id, exercise.id, e.target.value)}
                                                        className="bg-transparent text-white outline-none border-b border-gray-300 focus:border-blue-200 pb-1 text-base sm:text-lg w-full"
                                                        placeholder="Nom de l'exercice"
                                                    />
                                                    <button
                                                        onClick={() => handleDeleteExercise(day.id, category.id, exercise.id)}
                                                        className="bg-red-300 hover:bg-red-400 text-white p-1 rounded-full transition transform hover:scale-110"
                                                        title="Supprimer l'exercice"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    {exercise.sets.map((set, setIndex) => (
                                                        <div key={setIndex} className="flex items-center space-x-2">
                                                            <input
                                                                type="number"
                                                                value={set.reps}
                                                                onChange={(e) => handleSetChange(day.id, category.id, exercise.id, setIndex, 'reps', e.target.value)}
                                                                className="w-1/3 bg-gray-400 text-white placeholder-gray-200 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                                placeholder="Reps"
                                                            />
                                                            <span className="text-gray-200">x</span>
                                                            <input
                                                                type="number"
                                                                value={set.weight}
                                                                onChange={(e) => handleSetChange(day.id, category.id, exercise.id, setIndex, 'weight', e.target.value)}
                                                                className="w-1/3 bg-gray-400 text-white placeholder-gray-200 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                                placeholder="Poids (kg)"
                                                                step="0.5"
                                                            />
                                                            <span className="text-gray-200">kg</span>
                                                            {exercise.sets.length > 1 && (
                                                                <button
                                                                    onClick={() => handleDeleteSet(day.id, category.id, exercise.id, setIndex)}
                                                                    className="bg-red-300 hover:bg-red-400 text-white p-1 rounded-full transition transform hover:scale-110"
                                                                    title="Supprimer le set"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={() => handleAddSet(day.id, category.id, exercise.id)}
                                                    className="mt-2 bg-blue-400 hover:bg-blue-500 text-white text-sm py-1 px-2 rounded-full transition transform hover:scale-105"
                                                    title="Ajouter un set"
                                                >
                                                    Ajouter Set
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => handleAddCategory(day.id)}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg mt-3 transition transform hover:scale-[1.02] shadow-md text-sm sm:text-base"
                            >
                                Ajouter Catégorie
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={handleAddDay}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-6 mb-4 transition transform hover:scale-[1.01] shadow-lg text-base sm:text-lg"
            >
                Ajouter Jour d'Entraînement
            </button>

            <button
                onClick={handleSaveWorkout}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-[1.01] shadow-lg text-base sm:text-lg"
            >
                {editWorkoutId ? 'Mettre à jour l\'entraînement' : 'Enregistrer l\'entraînement'}
            </button>
        </div>
    );
};

export default MainWorkoutView;