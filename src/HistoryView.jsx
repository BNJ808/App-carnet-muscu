import React, { useState, useMemo } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText, RotateCcw, Search,
    Filter, Calendar, Award, TrendingUp, Activity, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react';

/**
 * Composant HistoryView pour afficher l'historique des entraînements.
 */
const HistoryView = ({
    historicalData,
    personalBests,
    handleReactivateExercise,
    analyzeProgressionWithAI,
    formatDate,
    getSeriesDisplay,
    isAdvancedMode,
    searchTerm,
    setSearchTerm,
    sortBy,
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
        { value: 'week', label: '7 derniers jours' },
        { value: 'month', label: '30 derniers jours' },
        { value: 'quarter', label: '3 derniers mois' }
    ];

    // Filtrage des données par plage temporelle
    const getFilteredDataByTime = useMemo(() => {
        if (selectedTimeRange === 'all') return historicalData;
        
        const now = new Date();
        const cutoffDate = new Date();
        
        switch (selectedTimeRange) {
            case 'week':
                cutoffDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                cutoffDate.setDate(now.getDate() - 30);
                break;
            case 'quarter':
                cutoffDate.setMonth(now.getMonth() - 3);
                break;
            default:
                return historicalData;
        }
        
        return historicalData.filter(session => 
            session.timestamp && session.timestamp >= cutoffDate
        );
    }, [historicalData, selectedTimeRange]);

    // Extraction de tous les exercices uniques
    const getAllUniqueExercises = useMemo(() => {
        const exercises = new Set();
        
        getFilteredDataByTime.forEach(session => {
            const workoutData = session.workoutData;
            if (!workoutData?.days) return;
            
            Object.values(workoutData.days).forEach(day => {
                if (!day.categories) return;
                
                Object.values(day.categories).forEach(categoryExercises => {
                    if (!Array.isArray(categoryExercises)) return;
                    
                    categoryExercises.forEach(exercise => {
                        if (!exercise.isDeleted || showDeletedExercises) {
                            exercises.add(exercise.name);
                        }
                    });
                });
            });
        });
        
        return Array.from(exercises).sort();
    }, [getFilteredDataByTime, showDeletedExercises]);

    // Données traitées et filtrées
    const processedData = useMemo(() => {
        let data = [];
        
        getFilteredDataByTime.forEach(session => {
            const workoutData = session.workoutData;
            if (!workoutData?.days) return;
            
            Object.values(workoutData.days).forEach(day => {
                if (!day.categories) return;
                
                Object.values(day.categories).forEach(exercises => {
                    if (!Array.isArray(exercises)) return;
                    
                    exercises.forEach(exercise => {
                        if (exercise.isDeleted && !showDeletedExercises) return;
                        
                        // Filtrage par terme de recherche
                        if (searchTerm && !exercise.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                            return;
                        }
                        
                        // Filtrage par exercice sélectionné
                        if (selectedExerciseFilter !== 'all' && exercise.name !== selectedExerciseFilter) {
                            return;
                        }
                        
                        data.push({
                            ...exercise,
                            sessionId: session.id,
                            timestamp: session.timestamp,
                            isDeleted: exercise.isDeleted || false
                        });
                    });
                });
            });
        });
        
        // Tri des données
        switch (sortBy) {
            case 'date-desc':
                data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                break;
            case 'date-asc':
                data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                break;
            case 'exercise-name':
                data.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'volume':
                data.sort((a, b) => {
                    const volumeA = calculateExerciseVolume(a);
                    const volumeB = calculateExerciseVolume(b);
                    return volumeB - volumeA;
                });
                break;
            default:
                break;
        }
        
        return data;
    }, [getFilteredDataByTime, searchTerm, sortBy, showDeletedExercises, selectedExerciseFilter]);

    // Calcul du volume total d'un exercice
    const calculateExerciseVolume = (exercise) => {
        if (!exercise.series || !Array.isArray(exercise.series)) return 0;
        
        return exercise.series.reduce((total, serie) => {
            const weight = parseFloat(serie.weight) || 0;
            const reps = parseInt(serie.reps) || 0;
            return total + (weight * reps);
        }, 0);
    };

    // Groupement des données par session
    const groupedBySessions = useMemo(() => {
        const sessions = new Map();
        
        processedData.forEach(exercise => {
            if (!sessions.has(exercise.sessionId)) {
                sessions.set(exercise.sessionId, {
                    id: exercise.sessionId,
                    timestamp: exercise.timestamp,
                    exercises: []
                });
            }
            sessions.get(exercise.sessionId).exercises.push(exercise);
        });
        
        return Array.from(sessions.values()).sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }, [processedData]);

    // Statistiques de l'historique
    const historyStats = useMemo(() => {
        const totalSessions = getFilteredDataByTime.length;
        const totalExercises = processedData.length;
        const totalVolume = processedData.reduce((sum, ex) => sum + calculateExerciseVolume(ex), 0);
        const uniqueExercises = new Set(processedData.map(ex => ex.name)).size;
        
        return {
            totalSessions,
            totalExercises,
            totalVolume: Math.round(totalVolume),
            uniqueExercises
        };
    }, [getFilteredDataByTime, processedData]);

    const toggleSessionExpanded = (sessionId) => {
        const newExpanded = new Set(expandedSessions);
        if (newExpanded.has(sessionId)) {
            newExpanded.delete(sessionId);
        } else {
            newExpanded.add(sessionId);
        }
        setExpandedSessions(newExpanded);
    };

    const renderExerciseCard = (exercise) => {
        const personalBest = personalBests[exercise.name];
        const volume = calculateExerciseVolume(exercise);
        
        return (
            <div key={`${exercise.sessionId}-${exercise.id}`} className={`bg-gray-700/50 rounded-lg p-4 border border-gray-600/50 ${exercise.isDeleted ? 'opacity-60 border-red-500/30' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <h4 className={`font-medium mb-1 ${exercise.isDeleted ? 'text-red-400 line-through' : 'text-white'}`}>
                            {exercise.name}
                            {exercise.isDeleted && <span className="ml-2 text-xs">(Supprimé)</span>}
                        </h4>
                        
                        {personalBest && (
                            <div className="text-xs text-yellow-400 mb-1">
                                🏆 Record: {personalBest.maxWeight}kg × {personalBest.maxWeightReps} reps
                            </div>
                        )}
                        
                        <div className="text-sm text-gray-300 mb-2">
                            {getSeriesDisplay(exercise.series)}
                        </div>
                        
                        {volume > 0 && (
                            <div className="text-xs text-blue-400">
                                Volume: {volume}kg
                            </div>
                        )}
                        
                        {exercise.notes && (
                            <div className="text-xs text-gray-400 mt-1">
                                📝 {exercise.notes}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-3">
                        {isAdvancedMode && (
                            <>
                                <button
                                    onClick={() => analyzeProgressionWithAI && analyzeProgressionWithAI(exercise.name)}
                                    className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded transition-colors"
                                    title="Analyser avec IA"
                                >
                                    <Sparkles className="h-4 w-4" />
                                </button>
                                
                                {exercise.isDeleted && (
                                    <button
                                        onClick={() => handleReactivateExercise && handleReactivateExercise(exercise)}
                                        className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors"
                                        title="Réactiver l'exercice"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
                
                <div className="text-xs text-gray-400">
                    📅 {formatDate(exercise.timestamp)}
                </div>
            </div>
        );
    };

    const renderSessionCard = (session) => {
        const isExpanded = expandedSessions.has(session.id);
        const totalVolume = session.exercises.reduce((sum, ex) => sum + calculateExerciseVolume(ex), 0);
        
        return (
            <div key={session.id} className="bg-gray-800 rounded-lg border border-gray-700">
                <button
                    onClick={() => toggleSessionExpanded(session.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-400" />
                        <div className="text-left">
                            <h3 className="font-medium text-white">{formatDate(session.timestamp)}</h3>
                            <p className="text-sm text-gray-400">
                                {session.exercises.length} exercice{session.exercises.length !== 1 ? 's' : ''} • 
                                {Math.round(totalVolume)}kg de volume
                            </p>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </button>
                
                {isExpanded && (
                    <div className="p-4 pt-0 space-y-3">
                        {session.exercises.map(exercise => renderExerciseCard(exercise))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Statistiques de l'historique */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-blue-400" />
                    Statistiques de l'historique
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{historyStats.totalSessions}</div>
                        <div className="text-sm text-gray-400">Sessions</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{historyStats.totalExercises}</div>
                        <div className="text-sm text-gray-400">Exercices</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">{historyStats.uniqueExercises}</div>
                        <div className="text-sm text-gray-400">Exercices uniques</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{historyStats.totalVolume}</div>
                        <div className="text-sm text-gray-400">Volume total (kg)</div>
                    </div>
                </div>
            </div>

            {/* Filtres et recherche */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Filter className="h-5 w-5 text-purple-400" />
                    Filtres et recherche
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Recherche */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher un exercice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-3 py-2 text-sm placeholder-gray-400"
                        />
                    </div>
                    
                    {/* Plage temporelle */}
                    <select
                        value={selectedTimeRange}
                        onChange={(e) => setSelectedTimeRange(e.target.value)}
                        className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                    >
                        {timeRangeOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    
                    {/* Exercice spécifique */}
                    <select
                        value={selectedExerciseFilter}
                        onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                        className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="all">Tous les exercices</option>
                        {getAllUniqueExercises.map(exercise => (
                            <option key={exercise} value={exercise}>{exercise}</option>
                        ))}
                    </select>
                    
                    {/* Tri */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm"
                    >
                        {sortOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
                
                {/* Options d'affichage */}
                {isAdvancedMode && (
                    <div className="mt-4 flex items-center gap-4">
                        <button
                            onClick={() => setShowDeletedExercises(!showDeletedExercises)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                showDeletedExercises 
                                    ? 'bg-red-600/20 text-red-400' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {showDeletedExercises ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            {showDeletedExercises ? 'Masquer' : 'Afficher'} les exercices supprimés
                        </button>
                    </div>
                )}
            </div>

            {/* Records personnels */}
            {Object.keys(personalBests).length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Award className="h-5 w-5 text-yellow-400" />
                        Records personnels
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(personalBests).slice(0, 6).map(([exerciseName, best]) => (
                            <div key={exerciseName} className="bg-gray-700/50 rounded-lg p-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-white text-sm">{exerciseName}</span>
                                    <div className="text-right">
                                        <div className="text-yellow-400 font-bold text-sm">
                                            {best.maxWeight}kg × {best.maxWeightReps}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {formatDate(best.lastUpdate)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
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