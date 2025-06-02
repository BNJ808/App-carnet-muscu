import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, onSnapshot, limit } from 'firebase/firestore'; // Ajout de orderBy et limit
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Composant de la vue historique
const HistoryView = ({
    userId,
    appId,
    db,
    setToast,
    workouts, // Pour accéder à dayOrder
    personalBests,
    progressionInsights,
    handleAnalyzeProgressionClick,
    generateDateRange,
    normalizeDateToStartOfDay,
    calculate1RM,
    generateUUID,
    applyChanges, // Pour réactiver les exercices
}) => {
    const [selectedDateForHistory, setSelectedDateForHistory] = useState(normalizeDateToStartOfDay(new Date())); 
    const [selectedHistoryDayFilter, setSelectedHistoryDayFilter] = useState(null);
    const [showDeletedExercisesInHistory, setShowDeletedExercisesInHistory] = useState(false);
    const [historyWorkouts, setHistoryWorkouts] = useState({ days: {}, dayOrder: [] });
    const [loadingHistory, setLoadingHistory] = useState(true);

    const [showExerciseGraphModal, setShowExerciseGraphModal] = useState(false); 
    const [exerciseForGraph, setExerciseForGraph] = useState(null); 
    const [individualExerciseGraphData, setIndividualExerciseGraphData] = useState([]); 
    const [graphStartDate, setGraphStartDate] = useState('');
    const [graphEndDate, setGraphEndDate] = useState('');

    // Récupération des données historiques pour la vue spécifique
    useEffect(() => {
        if (!userId || !appId || !selectedDateForHistory) {
            setLoadingHistory(false);
            return;
        }

        setLoadingHistory(true);
        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        
        const endOfDay = new Date(selectedDateForHistory);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(
            sessionsRef,
            where('timestamp', '<=', endOfDay),
            orderBy('timestamp', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const fetchedWorkoutData = snapshot.docs[0].data().workoutData;
                const sanitizedDays = fetchedWorkoutData.days || {};
                const sanitizedDayOrder = fetchedWorkoutData.dayOrder && Array.isArray(fetchedWorkoutData.dayOrder) && fetchedWorkoutData.dayOrder.length > 0
                    ? fetchedWorkoutData.dayOrder
                    : Object.keys(sanitizedDays).sort();

                const finalSanitizedDays = {};
                for (const dayKey in sanitizedDays) {
                    if (sanitizedDays.hasOwnProperty(dayKey)) {
                        const dayData = sanitizedDays[dayKey];
                        const newCategories = {};
                        if (dayData && dayData.categories) {
                            for (const categoryKey in dayData.categories) {
                                if (dayData.categories.hasOwnProperty(categoryKey)) {
                                    const exercisesInCat = Array.isArray(dayData.categories[categoryKey])
                                        ? dayData.categories[categoryKey]
                                        : [];
                                    newCategories[categoryKey] = exercisesInCat.map(exercise => {
                                        const sanitizedSeries = Array.isArray(exercise.series)
                                            ? exercise.series.map(s => ({
                                                weight: s.weight !== undefined ? String(s.weight) : '',
                                                reps: s.reps !== undefined ? String(s.reps) : ''
                                            }))
                                            : [{ weight: '', reps: '' }];
                                        return {
                                            ...exercise,
                                            id: exercise.id || generateUUID(), 
                                            series: sanitizedSeries,
                                            isDeleted: typeof exercise.isDeleted === 'boolean' ? exercise.isDeleted : false,
                                            notes: typeof exercise.notes === 'string' ? exercise.notes : ''
                                        };
                                    });
                                }
                            }
                        }
                        finalSanitizedDays[dayKey] = {
                            ...dayData,
                            categories: newCategories,
                            categoryOrder: Array.isArray(dayData.categoryOrder)
                                ? dayData.categoryOrder
                                : Object.keys(newCategories).sort()
                        };
                    }
                }
                setHistoryWorkouts({ days: finalSanitizedDays, dayOrder: sanitizedDayOrder });
                 if (!selectedHistoryDayFilter && sanitizedDayOrder.length > 0) {
                    setSelectedHistoryDayFilter(sanitizedDayOrder[0]);
                }
            } else {
                setHistoryWorkouts({ days: {}, dayOrder: [] });
                setSelectedHistoryDayFilter(null);
            }
            setLoadingHistory(false);
        }, (error) => {
            console.error("Erreur lors de la récupération des données historiques:", error);
            setToast({ message: `Erreur Firestore: ${error.message}`, type: 'error' });
            setLoadingHistory(false);
        });
        return () => unsubscribe();
    }, [userId, appId, db, selectedDateForHistory, setToast, generateUUID]); 

    // Mise à jour du filtre de jour historique
    useEffect(() => {
        const currentDayOrder = workouts.dayOrder || [];
        if (currentDayOrder.length > 0) {
            if (!selectedHistoryDayFilter || !currentDayOrder.includes(selectedHistoryDayFilter)) {
                setSelectedHistoryDayFilter(currentDayOrder[0]);
            }
        } else {
            setSelectedHistoryDayFilter(null);
        }
    }, [workouts.dayOrder, selectedHistoryDayFilter]); 

    const handleDateChange = useCallback((e) => {
        const newSelectedDate = normalizeDateToStartOfDay(new Date(e.target.value));
        const today = normalizeDateToStartOfDay(new Date());

        if (newSelectedDate > today) {
            setToast({ message: "Impossible de sélectionner une date future pour l'historique.", type: 'error' });
            setSelectedDateForHistory(today);
        } else {
            setSelectedDateForHistory(newSelectedDate);
        }
    }, [setToast, normalizeDateToStartOfDay]);

    const navigateHistory = useCallback((direction) => {
        if (!selectedDateForHistory) return;
        const newDate = normalizeDateToStartOfDay(new Date(selectedDateForHistory));
        newDate.setDate(newDate.getDate() + direction);

        const today = normalizeDateToStartOfDay(new Date());

        if (newDate > today) {
            setToast({ message: "Impossible de naviguer vers une date future.", type: 'error' });
        } else {
            setSelectedDateForHistory(newDate);
        }
    }, [selectedDateForHistory, setToast, normalizeDateToStartOfDay]);

    const getAllUniqueDays = useCallback(() => {
        return [...(workouts.dayOrder || [])]; 
    }, [workouts.dayOrder]);

    const handleReactivateExercise = useCallback((day, category, exerciseId) => {
        const updatedWorkouts = JSON.parse(JSON.stringify(workouts)); // Utilise les workouts de App.jsx
        if (updatedWorkouts.days[day] && updatedWorkouts.days[day].categories && updatedWorkouts.days[day].categories[category]) {
            const exerciseIndex = updatedWorkouts.days[day].categories[category].findIndex(
                (ex) => ex.id === exerciseId
            );

            if (exerciseIndex !== -1) {
                updatedWorkouts.days[day].categories[category][exerciseIndex].isDeleted = false;
                applyChanges(updatedWorkouts, "Exercice réactivé avec succès !");
            } else {
                setToast({ message: "Erreur: Exercice non trouvé pour la réactivation.", type: 'error' });
            }
        } else {
            setToast({ message: "Erreur: Catégorie ou jour non trouvé pour la réactivation.", type: 'error' });
        }
    }, [workouts, applyChanges, setToast]);

    const getSeriesDisplay = useCallback((exercise) => {
        const firstSeries = exercise.series && exercise.series.length > 0 ? exercise.series[0] : { weight: '', reps: '' };
        const setsCount = exercise.series ? exercise.series.length : 0;

        const weight = parseFloat(firstSeries.weight);
        const reps = parseInt(firstSeries.reps);
        const rmResult = calculate1RM(weight, reps);

        return (
            <span>
                Poids: <strong className="font-extrabold text-xl">{firstSeries.weight || '-'}</strong> kg | Séries: <strong className="font-extrabold text-xl">{setsCount || '-'}</strong> | Reps: <strong className="font-extrabold text-xl">{firstSeries.reps || '-'}</strong>
                {/* isAdvancedMode est géré par App.jsx, mais on peut l'ajouter si nécessaire ici */}
                {(!isNaN(weight) && !isNaN(reps) && rmResult.average !== 'N/A') && (
                    <span className="text-sm text-blue-300 ml-1">(1RM: {rmResult.average} kg)</span>
                )}
            </span>
        );
    }, [calculate1RM]);

    const openExerciseGraphModal = useCallback(async (exercise) => {
        setExerciseForGraph(exercise);
        setShowExerciseGraphModal(true);
        setGraphStartDate('');
        setGraphEndDate('');

        const sessionsRef = collection(db, `artifacts/${appId}/users/${userId}/sessions`);
        let queryStartDate = new Date();
        queryStartDate.setMonth(queryStartDate.getMonth() - 3); 
        queryStartDate.setHours(0, 0, 0, 0);
        let queryEndDate = new Date();
        queryEndDate.setHours(23, 59, 59, 999);

        const allDatesForDisplay = generateDateRange(queryStartDate, queryEndDate);

        const q = query(
            sessionsRef,
            where('timestamp', '>=', queryStartDate),
            where('timestamp', '<=', queryEndDate),
            orderBy('timestamp', 'asc')
        );

        try {
            const snapshot = await getDocs(q);
            const fetchedData = snapshot.docs.map(doc => ({
                timestamp: doc.data().timestamp.toDate(),
                workoutData: doc.data().workoutData
            }));

            const latestDailyWeightsIndividual = {};
            fetchedData.forEach(session => {
                const localDate = session.timestamp;
                const dateKey = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                const sessionDays = session.workoutData?.days || {};
                Object.keys(sessionDays).forEach(dayKey => {
                    const dayData = sessionDays[dayKey];
                    if (dayData && dayData.categories) {
                        Object.keys(dayData.categories).forEach(categoryKey => {
                            (dayData.categories[categoryKey] || []).forEach(exItem => {
                                if (exItem.id === exercise.id) {
                                    const exerciseSeries = Array.isArray(exItem.series) ? exItem.series : [];
                                    const maxWeightForDay = Math.max(0, ...exerciseSeries.map(s => parseFloat(s.weight)).filter(w => !isNaN(w)));
                                    if (maxWeightForDay > 0) {
                                        if (!latestDailyWeightsIndividual[dateKey] || session.timestamp > latestDailyWeightsIndividual[dateKey].timestamp) {
                                            latestDailyWeightsIndividual[dateKey] = {
                                                timestamp: session.timestamp,
                                                weight: maxWeightForDay,
                                            };
                                        }
                                    }
                                }
                            });
                        });
                    }
                });
            });

            const finalIndividualData = [];
            let lastKnownWeight = null;
            allDatesForDisplay.forEach(date => {
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const dataPoint = { date: dateKey, weight: null, hasNewData: false };
                if (latestDailyWeightsIndividual[dateKey]) {
                    dataPoint.weight = latestDailyWeightsIndividual[dateKey].weight;
                    dataPoint.hasNewData = true;
                    lastKnownWeight = dataPoint.weight;
                } else if (lastKnownWeight !== null) {
                    dataPoint.weight = lastKnownWeight;
                }
                finalIndividualData.push(dataPoint);
            });
            setIndividualExerciseGraphData(finalIndividualData);

        } catch (error) {
            console.error("Erreur lors de la récupération des données de graphique:", error);
            setToast({ message: `Erreur graphique: ${error.message}`, type: 'error' });
        }
    }, [userId, appId, db, setToast, generateDateRange]);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        if (dateString instanceof Date) {
            return dateString.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts;
            const date = new Date(year, month - 1, day);
            return date.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
        return dateString; 
    }, []);


    if (loadingHistory) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-lg">Chargement de l'historique...</p>
            </div>
        );
    }

    const daysToDisplay = selectedHistoryDayFilter && Object.keys(historyWorkouts.days).includes(selectedHistoryDayFilter) 
        ? [selectedHistoryDayFilter] 
        : Object.keys(historyWorkouts.days);

    return (
        <>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <div className="flex items-center space-x-2">
                    <button onClick={() => navigateHistory(-1)} className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition transform hover:scale-105 text-sm sm:text-base"> {'< Précédent'} </button>
                    <input type="date" value={selectedDateForHistory ? selectedDateForHistory.toISOString().split('T')[0] : ''} onChange={handleDateChange} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} />
                    <button onClick={() => navigateHistory(1)} className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition transform hover:scale-105 text-sm sm:text-base"> {'Suivant >'} </button>
                </div>
                <select value={selectedHistoryDayFilter || ''} onChange={(e) => setSelectedHistoryDayFilter(e.target.value || null)} className={`p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 text-sm sm:text-base`} >
                    {/* Removed "Tous les jours" option */}
                    {getAllUniqueDays().map(day => ( <option key={day} value={day}>{day}</option> ))}
                </select>
                <label className={`flex items-center space-x-2 text-gray-300 text-sm sm:text-base`}>
                    <input type="checkbox" checked={showDeletedExercisesInHistory} onChange={(e) => setShowDeletedExercisesInHistory(e.target.checked)} className="form-checkbox h-4 w-4 sm:h-5 sm:w-5 text-blue-600 rounded" />
                    <span>Afficher exos supprimés</span>
                </label>
            </div>

            <div className="grid grid-cols-1 gap-8 max-w-6xl mx-auto">
                {daysToDisplay.map((day) => {
                    const currentDayData = historyWorkouts.days?.[day];
                    if (!currentDayData) {
                        return <div key={day} className="text-center text-gray-500">Journée "{day}" non trouvée ou vide pour cette date.</div>;
                    }

                    const categoriesToIterate = Object.keys(currentDayData.categories || {});

                    return (
                        <div key={day} className={`bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 border border-gray-700`}>
                            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                                <h2 className={`text-2xl sm:text-3xl font-bold text-blue-400`}>{day}</h2>
                            </div>

                            {categoriesToIterate.map((category) => {
                                const exercises = currentDayData.categories?.[category] || [];

                                const exercisesToRender = showDeletedExercisesInHistory ? exercises : exercises.filter(ex => !ex.isDeleted);
                                
                                if (exercisesToRender.length === 0) {
                                    return null;
                                }

                                return (
                                    <div key={category} className={`mb-8 bg-gray-700 rounded-lg p-3 sm:p-5 shadow-inner border border-gray-700`}>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className={`text-xl sm:text-2xl font-semibold text-green-300`}>{category}</h3>
                                        </div>
                                        <ul className="space-y-4">
                                            {exercisesToRender.map((exercise) => (
                                                <li key={exercise.id} className={`bg-gray-800 p-3 sm:p-4 rounded-md shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center transition-all duration-200 ${exercise.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                                    <div className="flex-grow mb-2 sm:mb-0">
                                                        <p className={`text-base sm:text-lg font-medium text-white`}>{exercise.name}</p>
                                                        <p className={`text-sm sm:text-base text-gray-300`}>{getSeriesDisplay(exercise)}</p>
                                                        {personalBests[exercise.id] && ( <p className="text-xs sm:text-sm text-yellow-300 mt-1"> Meilleure Perf: {personalBests[exercise.id].maxWeight}kg ({personalBests[exercise.id].reps} reps) le {formatDate(personalBests[exercise.id].date)}</p>)}
                                                        {progressionInsights[exercise.id] && ( <p className="text-xs sm:text-sm text-cyan-300 mt-1"> Insight: {progressionInsights[exercise.id]} </p>)}
                                                        {exercise.notes && ( <p className={`text-xs sm:text-sm text-gray-300 mt-2 italic`}> Notes: "{exercise.notes}"</p>)}
                                                    </div>
                                                    <div className="flex space-x-1 sm:space-x-2 flex-wrap gap-1 mt-2 sm:mt-0"> 
                                                        {exercise.isDeleted && ( <button onClick={() => handleReactivateExercise(day, category, exercise.id)} className="px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold transition transform hover:scale-105 shadow-lg text-xs" title="Réactiver l'exercice">Réactiver</button>)}
                                                        {!exercise.isDeleted && (
                                                             <button onClick={() => handleAnalyzeProgressionClick(exercise)} className="p-1 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition transform hover:scale-110" title="Analyser la progression avec IA"> ✨ Analyser </button>
                                                        )}
                                                        <button onClick={() => openExerciseGraphModal(exercise)} className="p-1 rounded-full bg-purple-500 hover:bg-purple-600 text-white transition transform hover:scale-110" title="Voir le graphique"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg></button>
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

export default HistoryView;