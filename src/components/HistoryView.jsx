import React, { useState, useMemo } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText, RotateCcw, Search,
    Filter, Calendar, Award, TrendingUp, Activity, Eye, EyeOff, ChevronDown, ChevronUp, History
} from 'lucide-react';

/**
 * Composant HistoryView pour afficher l'historique des entraînements.
 */
const HistoryView = ({
    historicalData = [],
    personalBests = {},
    handleReactivateExercise,
    analyzeProgressionWithAI,
    showProgressionGraphForExercise,
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

    // Assurer que historicalData est toujours un tableau
    const safeHistoricalData = Array.isArray(historicalData) ? historicalData : [];

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

    // Calcul des exercices uniques et leurs catégories pour le filtre - CORRECTION DES VARIABLES
    const allExercises = useMemo(() => {
        const exerciseMap = new Map();
        safeHistoricalData.forEach(sessionData => {
            if (sessionData?.exercises && Array.isArray(sessionData.exercises)) {
                sessionData.exercises.forEach(exerciseItem => {
                    if (exerciseItem?.name && (!exerciseItem.isDeleted || showDeletedExercises)) {
                        exerciseMap.set(exerciseItem.name, { 
                            name: exerciseItem.name, 
                            category: exerciseItem.category || 'Non catégorisé' 
                        });
                    }
                });
            }
        });
        return Array.from(exerciseMap.values()).sort((exerciseA, exerciseB) => exerciseA.name.localeCompare(exerciseB.name));
    }, [safeHistoricalData, showDeletedExercises]);

    // Filtrage et tri de l'historique - CORRECTION DES VARIABLES
    const filteredAndSortedSessions = useMemo(() => {
        let sessionsList = [...safeHistoricalData];

        // 1. Filtrer par état de suppression
        sessionsList = sessionsList.map(sessionRecord => ({
            ...sessionRecord,
            exercises: (sessionRecord?.exercises || []).filter(exerciseRecord => 
                showDeletedExercises ? exerciseRecord?.isDeleted : !exerciseRecord?.isDeleted
            )
        })).filter(sessionRecord => sessionRecord.exercises.length > 0);

        // 2. Filtrer par plage temporelle
        const now = new Date();
        sessionsList = sessionsList.filter(sessionRecord => {
            if (!sessionRecord?.timestamp) return false;
            
            const sessionDate = sessionRecord.timestamp?.toDate ? sessionRecord.timestamp.toDate() : new Date(sessionRecord.timestamp);
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
        sessionsList = sessionsList.map(sessionRecord => ({
            ...sessionRecord,
            exercises: (sessionRecord?.exercises || []).filter(exerciseRecord => {
                if (!exerciseRecord?.name) return false;
                const matchesSearch = searchTerm ? exerciseRecord.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
                const matchesFilter = selectedExerciseFilter === 'all' ? true : exerciseRecord.name === selectedExerciseFilter;
                return matchesSearch && matchesFilter;
            })
        })).filter(sessionRecord => sessionRecord.exercises.length > 0);

        // 4. Tri
        sessionsList.sort((sessionA, sessionB) => {
            const dateA = sessionA.timestamp?.toDate ? sessionA.timestamp.toDate().getTime() : (new Date(sessionA.timestamp || 0)).getTime();
            const dateB = sessionB.timestamp?.toDate ? sessionB.timestamp.toDate().getTime() : (new Date(sessionB.timestamp || 0)).getTime();

            switch (sortBy) {
                case 'date-desc':
                    return dateB - dateA;
                case 'date-asc':
                    return dateA - dateB;
                case 'exercise-name':
                    const nameA = sessionA.exercises?.[0]?.name || '';
                    const nameB = sessionB.exercises?.[0]?.name || '';
                    return nameA.localeCompare(nameB);
                case 'volume':
                    const volumeA = (sessionA.exercises || []).reduce((sessionSum, exerciseRecord) => 
                        sessionSum + (exerciseRecord?.series || []).reduce((exerciseSum, seriesRecord) => exerciseSum + ((seriesRecord?.reps || 0) * (seriesRecord?.weight || 0)), 0), 0
                    );
                    const volumeB = (sessionB.exercises || []).reduce((sessionSum, exerciseRecord) => 
                        sessionSum + (exerciseRecord?.series || []).reduce((exerciseSum, seriesRecord) => exerciseSum + ((seriesRecord?.reps || 0) * (seriesRecord?.weight || 0)), 0), 0
                    );
                    return volumeB - volumeA;
                default:
                    return 0;
            }
        });

        return sessionsList;
    }, [safeHistoricalData, showDeletedExercises, selectedTimeRange, searchTerm, selectedExerciseFilter, sortBy]);

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
        const exerciseHistory = safeHistoricalData.flatMap(sessionRecord =>
            (sessionRecord?.exercises || [])
                .filter(exerciseRecord => exerciseRecord?.name === exerciseName && !exerciseRecord?.isDeleted)
                .map(exerciseRecord => ({
                    timestamp: sessionRecord.timestamp,
                    series: exerciseRecord.series || []
                }))
        );

        if (exerciseHistory.length > 0 && analyzeProgressionWithAI) {
            analyzeProgressionWithAI(exerciseName, exerciseHistory);
        }
    };

    const getProgressionGraphData = (exerciseName) => {
        const progressionData = [];
        safeHistoricalData.forEach(sessionRecord => {
            if (sessionRecord?.exercises && Array.isArray(sessionRecord.exercises)) {
                const exerciseRecord = sessionRecord.exercises.find(exerciseItem => exerciseItem?.name === exerciseName && !exerciseItem?.isDeleted);
                if (exerciseRecord?.series && Array.isArray(exerciseRecord.series) && exerciseRecord.series.length > 0) {
                    let maxWeight = 0;
                    let maxReps = 0;
                    let maxVolume = 0;

                    exerciseRecord.series.forEach(seriesRecord => {
                        if (seriesRecord && typeof seriesRecord === 'object') {
                            const currentWeight = seriesRecord.weight || 0;
                            const currentReps = seriesRecord.reps || 0;
                            const currentVolume = currentWeight * currentReps;

                            if (currentWeight > maxWeight) maxWeight = currentWeight;
                            if (currentReps > maxReps) maxReps = currentReps;
                            if (currentVolume > maxVolume) maxVolume = currentVolume;
                        }
                    });
                    
                    progressionData.push({
                        date: sessionRecord.timestamp?.toDate ? sessionRecord.timestamp.toDate() : new Date(sessionRecord.timestamp || 0),
                        maxWeight,
                        maxReps,
                        maxVolume
                    });
                }
            }
        });
        return progressionData.sort((dataA, dataB) => dataA.date.getTime() - dataB.date.getTime());
    };

    const renderSessionCard = (sessionData) => (
        <div key={sessionData?.id || Math.random()} className="bg-gray-800 rounded-lg shadow-md border border-gray-700">
            <button
                onClick={() => toggleSessionExpansion(sessionData?.id)}
                className="w-full flex justify-between items-center p-4 text-left focus:outline-none"
            >
                <div>
                    <h4 className="text-lg font-semibold text-white">
                        Séance du {formatDate(sessionData?.timestamp)}
                    </h4>
                    <p className="text-sm text-gray-400">
                        {(sessionData?.exercises || []).length} {(sessionData?.exercises || []).length > 1 ? 'exercices' : 'exercice'}
                    </p>
                </div>
                {expandedSessions.has(sessionData?.id) ? (
                    <ChevronUp className="h-6 w-6 text-gray-400" />
                ) : (
                    <ChevronDown className="h-6 w-6 text-gray-400" />
                )}
            </button>

            {expandedSessions.has(sessionData?.id) && (
                <div className="border-t border-gray-700 p-4">
                    {!sessionData?.exercises || sessionData.exercises.length === 0 ? (
                        <p className="text-gray-400 text-center">Aucun exercice enregistré pour cette séance.</p>
                    ) : (
                        <ul className="space-y-4">
                            {sessionData.exercises.map((exerciseData, exerciseIndex) => {
                                if (!exerciseData) return null;
                                
                                const personalBest = personalBests[exerciseData.name?.toLowerCase()];
                                const hasPb = personalBest && (personalBest.maxWeight > 0 || personalBest.maxReps > 0 || personalBest.maxVolume > 0);
                                const isDeletedIndicator = exerciseData.isDeleted ? 
                                    <span className="text-red-500 text-xs font-semibold ml-2">(Supprimé)</span> : null;

                                return (
                                    <li key={`${exerciseData.id || exerciseIndex}-${exerciseIndex}`} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-md font-medium text-white flex-grow">
                                                {exerciseData.name || 'Exercice sans nom'} {isDeletedIndicator}
                                            </h5>
                                            <div className="flex space-x-2">
                                                {isAdvancedMode && !exerciseData.isDeleted && (
                                                    <button
                                                        onClick={() => handleAnalyzeProgression(exerciseData.name)}
                                                        className="p-1 bg-purple-600 rounded-full text-white hover:bg-purple-700 transition-colors"
                                                        title="Analyser avec l'IA"
                                                    >
                                                        <Sparkles className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {!exerciseData.isDeleted && (
                                                    <button
                                                        onClick={() => showProgressionGraphForExercise && showProgressionGraphForExercise(exerciseData.name, exerciseData.id)}
                                                        className="p-1 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors"
                                                        title="Voir le graphique de progression"
                                                    >
                                                        <LineChartIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {exerciseData.isDeleted && handleReactivateExercise && (
                                                    <button
                                                        onClick={() => handleReactivateExercise(exerciseData.id)}
                                                        className="p-1 bg-green-600 rounded-full text-white hover:bg-green-700 transition-colors"
                                                        title="Réactiver l'exercice"
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-gray-300 text-sm mb-2">{getSeriesDisplay(exerciseData.series)}</p>
                                        {exerciseData.notes && (
                                            <p className="text-gray-400 text-xs mt-1 flex items-start">
                                                <NotebookText className="h-4 w-4 mr-1 flex-shrink-0" />
                                                <span className="italic">{exerciseData.notes}</span>
                                            </p>
                                        )}
                                        {hasPb && (
                                            <div className="mt-2 text-xs text-gray-400 border-t border-gray-600 pt-2">
                                                <p className="font-semibold text-yellow-400 flex items-center gap-1">
                                                    <Award className="h-3 w-3" />Records Personnels :
                                                </p>
                                                {personalBest.bestWeightSeries && <p>Max Poids: {personalBest.bestWeightSeries.weight}kg x {personalBest.bestWeightSeries.reps} reps</p>}
                                                {personalBest.bestRepsSeries && <p>Max Reps: {personalBest.bestRepsSeries.reps} reps @ {personalBest.bestRepsSeries.weight}kg</p>}
                                                {personalBest.maxVolume > 0 && <p>Max Volume: {personalBest.maxVolume} kg</p>}
                                                {personalBest.lastAchieved && <p>Dernier record: {formatDate(personalBest.lastAchieved)}</p>}
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
                            onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
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
                            onChange={(e) => setSortBy && setSortBy(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            {sortOptions.map(sortOption => (
                                <option key={sortOption.value} value={sortOption.value}>{sortOption.label}</option>
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
                            {timeRangeOptions.map(timeOption => (
                                <option key={timeOption.value} value={timeOption.value}>{timeOption.label}</option>
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
                        {allExercises.map(exerciseOption => (
                            <option key={exerciseOption.name} value={exerciseOption.name}>
                                {exerciseOption.name} {exerciseOption.category ? `(${exerciseOption.category})` : ''}
                            </option>
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
                        {Object.entries(personalBests).map(([exerciseName, personalBest]) => {
                            if (!personalBest || (personalBest.maxWeight === 0 && personalBest.maxReps === 0 && personalBest.maxVolume === 0)) {
                                return null;
                            }

                            const exerciseDataForGraph = getProgressionGraphData(exerciseName);

                            return (
                                <div key={exerciseName} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-medium text-white mb-1 flex items-center justify-between">
                                            {exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1)}
                                            <div className="flex space-x-2">
                                                {isAdvancedMode && analyzeProgressionWithAI && (
                                                    <button
                                                        onClick={() => handleAnalyzeProgression(exerciseName)}
                                                        className="p-1 bg-purple-600 rounded-full text-white hover:bg-purple-700 transition-colors"
                                                        title="Analyser avec l'IA"
                                                    >
                                                        <Sparkles className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {exerciseDataForGraph.length > 0 && showProgressionGraphForExercise && (
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
                                            {personalBest.maxWeight > 0 && <li>Poids Max: {personalBest.bestWeightSeries?.weight || personalBest.maxWeight}kg x {personalBest.bestWeightSeries?.reps || '?'} reps</li>}
                                            {personalBest.maxReps > 0 && <li>Reps Max: {personalBest.bestRepsSeries?.reps || personalBest.maxReps} reps @ {personalBest.bestRepsSeries?.weight || '?'}kg</li>}
                                            {personalBest.maxVolume > 0 && <li>Volume Max: {personalBest.maxVolume} kg</li>}
                                        </ul>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Dernier record: {personalBest.lastAchieved ? formatDate(personalBest.lastAchieved.toDate ? personalBest.lastAchieved.toDate() : personalBest.lastAchieved) : 'N/A'}.
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
                    Historique des séances ({filteredAndSortedSessions.length})
                </h3>

                {filteredAndSortedSessions.length === 0 ? (
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
                        {filteredAndSortedSessions.map(sessionItem => renderSessionCard(sessionItem))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryView;