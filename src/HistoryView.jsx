import React, { useState, useMemo } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText, RotateCcw, Search,
    Filter, Calendar, Award, TrendingUp, Activity, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react';

/**
 * Composant HistoryView pour afficher l'historique des entraînements.
 */
const HistoryView = ({
    historicalData = [],
    personalBests = {},
    handleReactivateExercise,
    analyzeProgressionWithAI,
    showProgressionGraphForExercise, // Ajouté pour le graphique
    formatDate,
    getSeriesDisplay,
    isAdvancedMode,
    searchTerm = '',
    setSearchTerm,
    sortBy = 'date-desc',
    setSortBy
}) => {
    const [showDeletedExercises, setShowDeletedExercises] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [selectedExerciseFilter, setSelectedExerciseFilter] = useState('all');

    // Options de tri
    const sortOptions = [
        { value: 'date-desc', label: 'Plus récent' },
        { value: 'date-asc', label: 'Plus ancien' },
        { value: 'exercise-name', label: 'Nom d\'exercice' },
        { value: 'volume', label: 'Volume total' }
    ];

    // Options de plage temporelle
    const timeRangeOptions = [
        { value: 'all', label: 'Tout l\'historique' },
        { value: 'last30days', label: '30 derniers jours' },
        { value: 'last90days', label: '90 derniers jours' },
        { value: 'thisYear', label: 'Cette année' }
    ];

    // Calcul des exercices uniques et leurs catégories pour le filtre
    const allExercises = useMemo(() => {
        const exerciseMap = new Map();
        historicalData.forEach(session => {
            session.exercises.forEach(exercise => {
                if (!exercise.isDeleted || showDeletedExercises) {
                    exerciseMap.set(exercise.name, { name: exercise.name, category: exercise.category });
                }
            });
        });
        return Array.from(exerciseMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [historicalData, showDeletedExercises]);

    // Filtrage et tri de l'historique
    const filteredAndSortedSessions = useMemo(() => {
        let sessions = [...historicalData];

        // 1. Filtrer par état de suppression
        sessions = sessions.map(session => ({
            ...session,
            exercises: session.exercises.filter(ex => showDeletedExercises ? ex.isDeleted : !ex.isDeleted)
        })).filter(session => session.exercises.length > 0); // Supprimer les sessions sans exercices après filtrage

        // 2. Filtrer par plage temporelle
        const now = new Date();
        sessions = sessions.filter(session => {
            const sessionDate = session.timestamp?.toDate ? session.timestamp.toDate() : new Date(session.timestamp);
            switch (selectedTimeRange) {
                case 'last30days':
                    return (now - sessionDate) / (1000 * 60 * 60 * 24) <= 30;
                case 'last90days':
                    return (now - sessionDate) / (1000 * 60 * 60 * 24) <= 90;
                case 'thisYear':
                    return sessionDate.getFullYear() === now.getFullYear();
                case 'all':
                default:
                    return true;
            }
        });

        // 3. Filtrer par terme de recherche et exercice sélectionné
        sessions = sessions.map(session => ({
            ...session,
            exercises: session.exercises.filter(exercise => {
                const matchesSearch = searchTerm ? exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                const matchesFilter = selectedExerciseFilter === 'all' ? true : exercise.name === selectedExerciseFilter;
                return matchesSearch && matchesFilter;
            })
        })).filter(session => session.exercises.length > 0);


        // 4. Tri
        sessions.sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (new Date(a.timestamp)).getTime();
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (new Date(b.timestamp)).getTime();

            switch (sortBy) {
                case 'date-desc':
                    return dateB - dateA;
                case 'date-asc':
                    return dateA - dateB;
                case 'exercise-name':
                    // Trie par nom du premier exercice de la session
                    const nameA = a.exercises[0]?.name || '';
                    const nameB = b.exercises[0]?.name || '';
                    return nameA.localeCompare(nameB);
                case 'volume':
                    // Trie par volume total de la session (somme des volumes de tous les exercices)
                    const volumeA = a.exercises.reduce((sum, ex) => sum + ex.series.reduce((sSum, s) => sSum + (s.reps * s.weight), 0), 0);
                    const volumeB = b.exercises.reduce((sum, ex) => sum + ex.series.reduce((sSum, s) => sSum + (s.reps * s.weight), 0), 0);
                    return volumeB - volumeA; // Volume décroissant
                default:
                    return 0;
            }
        });

        return sessions;
    }, [historicalData, showDeletedExercises, selectedTimeRange, searchTerm, selectedExerciseFilter, sortBy]);

    // Groupement par jour pour l'affichage (si souhaité)
    const groupedBySessions = filteredAndSortedSessions; // Pour l'instant, on les garde comme des sessions individuelles

    const toggleSessionExpansion = (sessionId) => {
        setExpandedSessions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sessionId)) {
                newSet.delete(sessionId);
            } else {
                newSet.add(sessionId);
            }
            return newSet;
        });
    };

    const handleAnalyzeProgression = (exerciseName) => {
        // Filter historical data for the specific exercise
        const exerciseHistory = historicalData.flatMap(session =>
            session.exercises
                .filter(ex => ex.name === exerciseName && !ex.isDeleted)
                .map(ex => ({
                    timestamp: session.timestamp,
                    series: ex.series
                }))
        );

        if (exerciseHistory.length > 0) {
            analyzeProgressionWithAI(exerciseName, exerciseHistory);
        } else {
            // Show toast if no history found for the exercise
            showToast("Pas assez de données pour cet exercice pour une analyse IA.", "warning");
        }
    };


    const getProgressionGraphData = (exerciseName) => {
        const data = [];
        historicalData.forEach(session => {
            const exercise = session.exercises.find(ex => ex.name === exerciseName && !ex.isDeleted);
            if (exercise && exercise.series && exercise.series.length > 0) {
                let maxWeight = 0;
                let maxReps = 0;
                let maxVolume = 0;

                exercise.series.forEach(s => {
                    const currentWeight = s.weight || 0;
                    const currentReps = s.reps || 0;
                    const currentVolume = currentWeight * currentReps;

                    if (currentWeight > maxWeight) maxWeight = currentWeight;
                    if (currentReps > maxReps) maxReps = currentReps;
                    if (currentVolume > maxVolume) maxVolume = currentVolume;
                });
                data.push({
                    date: session.timestamp?.toDate ? session.timestamp.toDate() : new Date(session.timestamp),
                    maxWeight,
                    maxReps,
                    maxVolume
                });
            }
        });
        return data.sort((a, b) => a.date.getTime() - b.date.getTime());
    };


    const renderSessionCard = (session) => (
        <div key={session.id} className="bg-gray-800 rounded-lg shadow-md border border-gray-700">
            <button
                onClick={() => toggleSessionExpansion(session.id)}
                className="w-full flex justify-between items-center p-4 text-left focus:outline-none"
            >
                <div>
                    <h4 className="text-lg font-semibold text-white">
                        Séance du {formatDate(session.timestamp?.toDate ? session.timestamp.toDate() : session.timestamp)}
                    </h4>
                    <p className="text-sm text-gray-400">
                        {session.exercises.length} {session.exercises.length > 1 ? 'exercices' : 'exercice'}
                    </p>
                </div>
                {expandedSessions.has(session.id) ? (
                    <ChevronUp className="h-6 w-6 text-gray-400" />
                ) : (
                    <ChevronDown className="h-6 w-6 text-gray-400" />
                )}
            </button>

            {expandedSessions.has(session.id) && (
                <div className="border-t border-gray-700 p-4">
                    {session.exercises.length === 0 ? (
                        <p className="text-gray-400 text-center">Aucun exercice enregistré pour cette séance.</p>
                    ) : (
                        <ul className="space-y-4">
                            {session.exercises.map((exercise, index) => {
                                const pb = personalBests[exercise.name?.toLowerCase()];
                                const hasPb = pb && (pb.maxWeight > 0 || pb.maxReps > 0 || pb.maxVolume > 0);
                                const isDeletedIndicator = exercise.isDeleted ? <span className="text-red-500 text-xs font-semibold ml-2">(Supprimé)</span> : null;

                                return (
                                    <li key={`${exercise.id}-${index}`} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-md font-medium text-white flex-grow">
                                                {exercise.name} {isDeletedIndicator}
                                            </h5>
                                            <div className="flex space-x-2">
                                                {isAdvancedMode && !exercise.isDeleted && (
                                                    <button
                                                        onClick={() => handleAnalyzeProgression(exercise.name)}
                                                        className="p-1 bg-purple-600 rounded-full text-white hover:bg-purple-700 transition-colors"
                                                        title="Analyser avec l'IA"
                                                    >
                                                        <Sparkles className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {!exercise.isDeleted && (
                                                    <button
                                                        onClick={() => showProgressionGraphForExercise(exercise.name, getProgressionGraphData(exercise.name))}
                                                        className="p-1 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors"
                                                        title="Voir le graphique de progression"
                                                    >
                                                        <LineChartIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {exercise.isDeleted && (
                                                    <button
                                                        onClick={() => handleReactivateExercise(exercise.name)}
                                                        className="p-1 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors"
                                                        title="Réactiver l'exercice"
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-gray-300 text-sm mb-2">{getSeriesDisplay(exercise.series)}</p>
                                        {exercise.notes && (
                                            <p className="text-gray-400 text-xs mt-1 flex items-start">
                                                <NotebookText className="h-4 w-4 mr-1 flex-shrink-0" />
                                                <span className="italic">{exercise.notes}</span>
                                            </p>
                                        )}
                                        {hasPb && (
                                            <div className="mt-2 text-xs text-gray-400 border-t border-gray-600 pt-2">
                                                <p className="font-semibold text-yellow-400 flex items-center gap-1"><Award className="h-3 w-3" />Records Personnels :</p>
                                                {pb.bestWeightSeries && <p>Max Poids: {pb.bestWeightSeries.weight}kg x {pb.bestWeightSeries.reps} reps</p>}
                                                {pb.bestRepsSeries && <p>Max Reps: {pb.bestRepsSeries.reps} reps @ {pb.bestRepsSeries.weight}kg</p>}
                                                {pb.maxVolume > 0 && <p>Max Volume: {pb.maxVolume} kg</p>}
                                                {pb.lastAchieved && <p>Dernier record: {formatDate(pb.lastAchieved)}</p>}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                <History className="h-7 w-7" />
                Historique d'entraînement
            </h2>

            {/* Filtres et options */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <div className="mb-4">
                    <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">Rechercher un exercice:</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            id="search"
                            placeholder="Ex: Développé couché"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="sort-by" className="block text-sm font-medium text-gray-300 mb-2">Trier par:</label>
                        <select
                            id="sort-by"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            {sortOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="time-range" className="block text-sm font-medium text-gray-300 mb-2">Plage temporelle:</label>
                        <select
                            id="time-range"
                            value={selectedTimeRange}
                            onChange={(e) => setSelectedTimeRange(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            {timeRangeOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label htmlFor="exercise-filter" className="block text-sm font-medium text-gray-300 mb-2">Filtrer par exercice:</label>
                    <select
                        id="exercise-filter"
                        value={selectedExerciseFilter}
                        onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                    >
                        <option value="all">Tous les exercices</option>
                        {allExercises.map(ex => (
                            <option key={ex.name} value={ex.name}>{ex.name} {ex.category ? `(${ex.category})` : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <label htmlFor="show-deleted" className="flex items-center text-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            id="show-deleted"
                            checked={showDeletedExercises}
                            onChange={() => setShowDeletedExercises(prev => !prev)}
                            className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500 mr-2"
                        />
                        Afficher les exercices supprimés
                    </label>
                    <span className="text-gray-400 flex items-center gap-1">
                        <Filter className="h-4 w-4" />
                        {filteredAndSortedSessions.length} sessions
                    </span>
                </div>
            </div>

            {/* Records Personnels globaux */}
            {Object.keys(personalBests).length > 0 && (
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Records Personnels
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(personalBests).map(([exerciseName, pb]) => {
                            if (!pb || (pb.maxWeight === 0 && pb.maxReps === 0 && pb.maxVolume === 0)) {
                                return null; // Skip if no records
                            }

                            const exerciseDataForGraph = getProgressionGraphData(exerciseName);

                            return (
                                <div key={exerciseName} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-medium text-white mb-1 flex items-center justify-between">
                                            {exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)}
                                            <div className="flex space-x-2">
                                                {isAdvancedMode && (
                                                    <button
                                                        onClick={() => handleAnalyzeProgression(exerciseName)}
                                                        className="p-1 bg-purple-600 rounded-full text-white hover:bg-purple-700 transition-colors"
                                                        title="Analyser avec l'IA"
                                                    >
                                                        <Sparkles className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {exerciseDataForGraph.length > 0 && (
                                                    <button
                                                        onClick={() => showProgressionGraphForExercise(exerciseName, exerciseDataForGraph)}
                                                        className="p-1 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors"
                                                        title="Voir le graphique de progression"
                                                    >
                                                        <LineChartIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </h4>
                                        <ul className="text-sm text-gray-300">
                                            {pb.maxWeight > 0 && <li>Poids Max: {pb.bestWeightSeries?.weight || pb.maxWeight}kg x {pb.bestWeightSeries?.reps || '?'} reps</li>}
                                            {pb.maxReps > 0 && <li>Reps Max: {pb.bestRepsSeries?.reps || pb.maxReps} reps @ {pb.bestRepsSeries?.weight || '?'}kg</li>}
                                            {pb.maxVolume > 0 && <li>Volume Max: {pb.maxVolume} kg</li>}
                                        </ul>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Dernier record: {pb.lastAchieved ? formatDate(pb.lastAchieved.toDate ? pb.lastAchieved.toDate() : pb.lastAchieved) : 'N/A'}.
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Liste des sessions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Historique des séances ({groupedBySessions.length})
                </h3>

                {groupedBySessions.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">Aucune séance trouvée</p>
                        <p className="text-sm text-gray-500">
                            {searchTerm || selectedExerciseFilter !== 'all'
                                ? 'Essayez de modifier vos filtres de recherche'
                                : 'Commencez à vous entraîner pour voir votre historique ici'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedBySessions.map(session => renderSessionCard(session))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryView;