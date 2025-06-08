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
        { value: '30-days', label: '30 derniers jours' },
        { value: '90-days', label: '90 derniers jours' },
        { value: 'this-year', label: 'Cette année' }
    ];

    // Calculer les exercices uniques pour le filtre
    const uniqueExercises = useMemo(() => {
        const exerciseNames = new Set();
        historicalData.forEach(session => {
            Object.values(session.workoutData?.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    exercises.forEach(ex => exerciseNames.add(ex.name));
                });
            });
        });
        return Array.from(exerciseNames).sort();
    }, [historicalData]);

    const filteredAndSortedSessions = useMemo(() => {
        let sessions = [...historicalData];

        // Filtrer par plage temporelle
        if (selectedTimeRange !== 'all') {
            const now = new Date();
            sessions = sessions.filter(session => {
                const sessionDate = session.timestamp;
                if (selectedTimeRange === '30-days') {
                    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
                    return sessionDate >= thirtyDaysAgo;
                } else if (selectedTimeRange === '90-days') {
                    const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90));
                    return sessionDate >= ninetyDaysAgo;
                } else if (selectedTimeRange === 'this-year') {
                    return sessionDate.getFullYear() === now.getFullYear();
                }
                return true;
            });
        }

        // Filtrer par terme de recherche et exercice spécifique
        sessions = sessions.filter(session => {
            const sessionMatchesSearch = session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                Object.values(session.workoutData?.days || {}).some(day =>
                    Object.values(day.categories || {}).some(exercises =>
                        exercises.some(ex =>
                            ex.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                            (selectedExerciseFilter === 'all' || ex.name === selectedExerciseFilter)
                        )
                    )
                );
            return sessionMatchesSearch;
        });

        // Tri
        sessions.sort((a, b) => {
            if (sortBy === 'date-desc') {
                return b.timestamp.getTime() - a.timestamp.getTime();
            } else if (sortBy === 'date-asc') {
                return a.timestamp.getTime() - b.timestamp.getTime();
            } else if (sortBy === 'exercise-name') {
                // Pour le tri par nom d'exercice, il faudrait une logique plus complexe
                // ou trier les exercices à l'intérieur de chaque session
                return 0; // Pas de tri significatif pour l'instant
            } else if (sortBy === 'volume') {
                const volA = Object.values(a.workoutData?.days || {}).flatMap(day => Object.values(day.categories || {}).flatMap(ex => ex)).reduce((sum, ex) => sum + (personalBests[ex.id]?.totalVolume || 0), 0);
                const volB = Object.values(b.workoutData?.days || {}).flatMap(day => Object.values(day.categories || {}).flatMap(ex => ex)).reduce((sum, ex) => sum + (personalBests[ex.id]?.totalVolume || 0), 0);
                return volB - volA;
            }
            return 0;
        });

        return sessions;
    }, [historicalData, searchTerm, sortBy, selectedTimeRange, selectedExerciseFilter, personalBests]);

    // Regrouper les exercices par session
    const groupedBySessions = useMemo(() => {
        return filteredAndSortedSessions.map(session => {
            const sessionExercises = [];
            let sessionTotalVolume = 0;

            Object.values(session.workoutData?.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    exercises.forEach(ex => {
                        if (showDeletedExercises || !ex.isDeleted) {
                            let exerciseVolume = 0;
                            ex.series.forEach(serie => {
                                exerciseVolume += (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
                            });
                            sessionTotalVolume += exerciseVolume;
                            sessionExercises.push({ ...ex, calculatedVolume: exerciseVolume });
                        }
                    });
                });
            });

            // Tri des exercices à l'intérieur de la session
            sessionExercises.sort((a, b) => a.name.localeCompare(b.name));

            return {
                ...session,
                exercises: sessionExercises,
                totalVolume: sessionTotalVolume
            };
        });
    }, [filteredAndSortedSessions, showDeletedExercises]);

    const renderSessionCard = (session) => (
        <div key={session.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-lg">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-yellow-400" />
                    Séance du {formatDate(session.timestamp)}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300 bg-gray-700 px-3 py-1 rounded-full">
                        Volume: {Math.round(session.totalVolume)} kg
                    </span>
                    <button
                        onClick={() => setExpandedSessions(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(session.id)) {
                                newSet.delete(session.id);
                            } else {
                                newSet.add(session.id);
                            }
                            return newSet;
                        })}
                        className="p-1 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                        {expandedSessions.has(session.id) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {expandedSessions.has(session.id) && (
                <div className="space-y-3 mt-4">
                    {session.exercises.length === 0 ? (
                        <p className="text-gray-400 text-sm italic">Aucun exercice enregistré pour cette séance.</p>
                    ) : (
                        session.exercises.map(exercise => (
                            <div key={exercise.id} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className={`font-semibold ${exercise.isDeleted ? 'text-red-400 line-through' : 'text-blue-400'}`}>
                                        {exercise.name}
                                        {exercise.isDeleted && <span className="ml-2 text-xs text-red-500">(Supprimé)</span>}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        {personalBests[exercise.id] && (
                                            <span className="text-yellow-400 text-sm font-medium flex items-center gap-1">
                                                <Award className="h-4 w-4" /> PB: {personalBests[exercise.id].maxWeight}kg
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-gray-300 text-sm mb-2">
                                    {getSeriesDisplay(exercise.series)}
                                </p>
                                <p className="text-gray-400 text-xs">
                                    Volume exercice: {Math.round(exercise.calculatedVolume)} kg
                                </p>
                                {exercise.notes && (
                                    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs p-2 rounded-md mt-2 whitespace-pre-wrap">
                                        <NotebookText className="inline-block h-3 w-3 mr-1" /> {exercise.notes}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {exercise.isDeleted && (
                                        <button
                                            onClick={() => handleReactivateExercise(exercise.id)}
                                            className="flex-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all text-xs flex items-center justify-center gap-1 min-w-[100px]"
                                        >
                                            <RotateCcw className="h-3 w-3" /> Réactiver
                                        </button>
                                    )}
                                    <button
                                        onClick={() => showProgressionGraphForExercise(exercise)}
                                        className="flex-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all text-xs flex items-center justify-center gap-1 min-w-[100px]"
                                    >
                                        <LineChartIcon className="h-3 w-3" /> Graphique
                                    </button>
                                    <button
                                        onClick={() => analyzeProgressionWithAI(exercise)}
                                        className="flex-1 px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all text-xs flex items-center justify-center gap-1 min-w-[100px]"
                                    >
                                        <Sparkles className="h-3 w-3" /> IA
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <Search className="h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une séance ou un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-base"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {/* Filtre par exercice */}
                    <div>
                        <label htmlFor="exercise-filter" className="sr-only">Filtrer par exercice</label>
                        <select
                            id="exercise-filter"
                            value={selectedExerciseFilter}
                            onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="all">Tous les exercices</option>
                            {uniqueExercises.map(exName => (
                                <option key={exName} value={exName}>{exName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtre par plage temporelle */}
                    <div>
                        <label htmlFor="time-range-filter" className="sr-only">Filtrer par période</label>
                        <select
                            id="time-range-filter"
                            value={selectedTimeRange}
                            onChange={(e) => setSelectedTimeRange(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            {timeRangeOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Options de tri */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-gray-400 text-sm flex items-center gap-1">
                        <Filter className="h-4 w-4" /> Trier par:
                    </span>
                    {sortOptions.map(option => (
                        <button
                            key={option.value}
                            onClick={() => setSortBy(option.value)}
                            className={`px-3 py-1 rounded-full font-medium text-xs transition-all ${sortBy === option.value
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {/* Afficher/Masquer les exercices supprimés */}
                <div className="flex items-center justify-between mt-4">
                    <label htmlFor="show-deleted" className="flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            id="show-deleted"
                            checked={showDeletedExercises}
                            onChange={(e) => setShowDeletedExercises(e.target.checked)}
                            className="form-checkbox h-4 w-4 text-red-500 rounded border-gray-600 bg-gray-700"
                        />
                        <span className="ml-2 text-sm text-gray-300">Afficher les exercices supprimés</span>
                    </label>
                    <span className="text-xs text-gray-500">{filteredAndSortedSessions.length} séances</span>
                </div>
            </div>

            {/* Statistiques rapides (en mode avancé) */}
            {isAdvancedMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                        <h4 className="font-medium text-green-400 mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Records personnels
                        </h4>
                        <p className="text-gray-300 text-sm">
                            Vous avez enregistré {Object.keys(personalBests).length} records personnels. Continuez comme ça !
                        </p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                        <h4 className="font-medium text-blue-400 mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4" /> Activité
                        </h4>
                        <p className="text-gray-300 text-sm">
                            Votre entraînement le plus récent était le{' '}
                            {historicalData.length > 0 ? formatDate(historicalData[0].timestamp) : 'N/A'}.
                        </p>
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
