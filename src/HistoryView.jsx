import React, { useState, useEffect } from 'react';
import {
    Pencil, Trash2, Sparkles, LineChart as LineChartIcon, NotebookText,
    RotateCcw
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const HistoryView = ({
    workouts,
    selectedDateForHistory, selectedHistoryDayFilter, showDeletedExercisesInHistory,
    handleDateChange, navigateHistory, setSelectedHistoryDayFilter,
    formatDate, getSeriesDisplay, handleReactivateExercise, openExerciseGraphModal,
    handleOpenNotesModal, handleAnalyzeProgressionClick, personalBests, progressionInsights,
    isAdvancedMode
}) => {

    const safeWorkouts = Array.isArray(workouts) ? workouts : [];

    const uniqueDates = Array.from(new Set(safeWorkouts.map(session => session.timestamp?.toISOString().split('T')[0])))
        .filter(Boolean)
        .sort()
        .map(dateString => new Date(dateString));

    useEffect(() => {
        if (!selectedDateForHistory && uniqueDates.length > 0) {
            handleDateChange({ target: { value: uniqueDates[uniqueDates.length - 1].toISOString().split('T')[0] } });
        }
    }, [safeWorkouts, uniqueDates, selectedDateForHistory, handleDateChange]);

    const navigateHistoryWrapper = (direction) => {
        if (!selectedDateForHistory) return;
        const currentIndex = uniqueDates.findIndex(date =>
            date.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]
        );
        if (direction === 'prev' && currentIndex > 0) {
            navigateHistory(-1);
        } else if (direction === 'next' && currentIndex < uniqueDates.length - 1) {
            navigateHistory(1);
        }
    };

    const getAllUniqueDaysFromWorkouts = () => {
        const uniqueDays = new Set(['All']);
        safeWorkouts.forEach(session => {
            if (session.workoutData && session.workoutData.days && typeof session.workoutData.days === 'object') {
                Object.keys(session.workoutData.days).forEach(dayName => uniqueDays.add(dayName));
            }
        });
        return Array.from(uniqueDays);
    };

    const filteredWorkouts = safeWorkouts.filter(session => {
        const matchesDate = !selectedDateForHistory ||
            (session.timestamp && session.timestamp.toISOString().split('T')[0] === selectedDateForHistory.toISOString().split('T')[0]);
        const matchesDayFilter = selectedHistoryDayFilter === 'All' ||
            (session.workoutData && session.workoutData.days && typeof session.workoutData.days === 'object' &&
                Object.keys(session.workoutData.days).some(dayName => dayName === selectedHistoryDayFilter));
        return matchesDate && matchesDayFilter;
    });

    const groupedWorkouts = filteredWorkouts.reduce((acc, session) => {
        if (session.workoutData && session.workoutData.days && typeof session.workoutData.days === 'object') {
            Object.keys(session.workoutData.days).forEach(dayKey => {
                const dayData = session.workoutData.days[dayKey];
                if (dayData && typeof dayData === 'object' && dayData.categories) {
                    if (!acc[dayKey]) {
                        acc[dayKey] = {
                            dayName: dayKey,
                            categories: {},
                            sessions: []
                        };
                    }
                    acc[dayKey].sessions.push(session);
                    Object.keys(dayData.categories).forEach(categoryKey => {
                        const categoryExercises = dayData.categories[categoryKey];
                        if (Array.isArray(categoryExercises)) {
                            if (!acc[dayKey].categories[categoryKey]) {
                                acc[dayKey].categories[categoryKey] = {
                                    categoryName: categoryKey,
                                    exercises: []
                                };
                            }
                            categoryExercises.forEach(exercise => {
                                if (showDeletedExercisesInHistory || !exercise.isDeleted) {
                                    acc[dayKey].categories[categoryKey].exercises.push({
                                        ...exercise,
                                        sessionId: session.id,
                                        sessionTimestamp: session.timestamp
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

                <select
                    value={selectedHistoryDayFilter || 'All'}
                    onChange={(e) => setSelectedHistoryDayFilter(e.target.value)}
                    className="bg-gray-700 text-white p-2 rounded-lg w-full sm:w-auto"
                >
                    {getAllUniqueDaysFromWorkouts().map(day => (
                        <option key={day} value={day}>{day}</option>
                    ))}
                </select>

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

            {Object.values(groupedWorkouts)
                .sort((a, b) => a.dayName.localeCompare(b.dayName))
                .map((dayData) => {
                    if (!dayData || typeof dayData !== 'object' || !dayData.categories) return null;

                    return (
                        <div key={dayData.dayName} className="bg-gray-700 p-4 rounded-lg shadow-md mb-4 border border-gray-600">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xl sm:text-2xl font-semibold text-white">{dayData.dayName}</h3>
                            </div>
                            <div className="space-y-3">
                                {Object.values(dayData.categories).map((categoryData) => {
                                    if (!categoryData || typeof categoryData !== 'object' || !Array.isArray(categoryData.exercises)) return null;

                                    const exercisesToDisplay = categoryData.exercises.filter(ex => showDeletedExercisesInHistory || !ex.isDeleted);

                                    if (exercisesToDisplay.length === 0 && !showDeletedExercisesInHistory) return null;

                                    return (
                                        <div key={categoryData.categoryName} className="bg-gray-600 p-3 rounded-lg shadow-sm border border-gray-500">
                                            <h4 className="text-lg sm:text-xl font-medium text-white mb-2">{categoryData.categoryName}</h4>
                                            <ul className="space-y-2">
                                                {exercisesToDisplay.map(exercise => (
                                                    <li key={exercise.id} className={`bg-gray-500 p-3 rounded-lg flex justify-between items-center ${exercise.isDeleted ? 'opacity-50' : ''}`}>
                                                        <div>
                                                            <p className="text-white text-base sm:text-lg font-bold">{exercise.name}</p>
                                                            <p className="text-gray-200 text-sm">{getSeriesDisplay(exercise.series)}</p>
                                                            {exercise.notes && (
                                                                <p className="text-yellow-200 text-xs sm:text-sm italic mt-1">Notes: {exercise.notes}</p>
                                                            )}
                                                            {isAdvancedMode && personalBests[exercise.name] && (
                                                                <p className="text-yellow-300 text-xs mt-1">
                                                                    PB: {personalBests[exercise.name].weight}kg x {personalBests[exercise.name].reps} reps ({formatDate(personalBests[exercise.name].date)})
                                                                </p>
                                                            )}
                                                            {isAdvancedMode && progressionInsights[exercise.name] && (
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
                                                            ) : null}
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
