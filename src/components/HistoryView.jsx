import React, { useState, useMemo, useCallback } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText, RotateCcw, Search,
    Filter, Calendar, Award, TrendingUp, Activity, Eye, EyeOff, ChevronDown, ChevronUp, History, Clock
} from 'lucide-react';

/**
 * Composant HistoryView pour afficher l'historique des entraînements.
 */
const HistoryView = ({
    historicalData = [],
    personalBests = {},
    handleReactivateExercise,
    analyzeProgressionWithAI,
    showProgressionGraphForExercise, // This prop is now expected to be a function that takes exerciseData
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
        { value: 'volume-desc', label: 'Volume (Décroissant)' },
        { value: 'volume-asc', label: 'Volume (Croissant)' },
        { value: 'duration-desc', label: 'Durée (Décroissant)' },
        { value: 'duration-asc', label: 'Durée (Croissant)' },
    ];

    // Extraction de tous les noms d'exercices uniques pour le filtre
    const allExerciseNames = useMemo(() => {
        const names = new Set();
        safeHistoricalData.forEach(session => {
            session.exercises.forEach(exercise => {
                names.add(exercise.name);
            });
        });
        return Array.from(names).sort();
    }, [safeHistoricalData]);

    // Filtrage et tri (Assurez-vous que cette logique est robuste et mémorisée)
    const filteredAndSortedSessions = useMemo(() => {
        let sessions = safeHistoricalData.filter(session => showDeletedExercises || !session.isDeleted);

        // Filtrage par terme de recherche
        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            sessions = sessions.filter(session =>
                session.exercises.some(exercise =>
                    exercise.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                    (exercise.notes && exercise.notes.toLowerCase().includes(lowerCaseSearchTerm))
                ) ||
                (session.notes && session.notes.toLowerCase().includes(lowerCaseSearchTerm))
            );
        }

        // Filtrage par exercice sélectionné
        if (selectedExerciseFilter !== 'all') {
            sessions = sessions.filter(session =>
                session.exercises.some(exercise => exercise.name === selectedExerciseFilter)
            );
        }

        // Filtrage par période (à implémenter si ce n'est pas déjà fait)
        // ex: filter by date range

        // Tri
        return sessions.sort((a, b) => {
            switch (sortBy) {
                case 'date-asc':
                    // Convert Firestore Timestamps to Date objects for comparison
                    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                    return dateA - dateB;
                case 'date-desc':
                    const dateA_desc = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                    const dateB_desc = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                    return dateB_desc - dateA_desc;
                case 'volume-desc':
                    // Calculate total volume for session if not already present
                    const volumeA_desc = a.exercises.reduce((sum, exercise) => sum + exercise.series.reduce((exSum, serie) => exSum + (serie.weight * serie.reps || 0), 0), 0);
                    const volumeB_desc = b.exercises.reduce((sum, exercise) => sum + exercise.series.reduce((exSum, serie) => exSum + (serie.weight * serie.reps || 0), 0), 0);
                    return volumeB_desc - volumeA_desc;
                case 'volume-asc':
                    const volumeA_asc = a.exercises.reduce((sum, exercise) => sum + exercise.series.reduce((exSum, serie) => exSum + (serie.weight * serie.reps || 0), 0), 0);
                    const volumeB_asc = b.exercises.reduce((sum, exercise) => sum + exercise.series.reduce((exSum, serie) => exSum + (serie.weight * serie.reps || 0), 0), 0);
                    return volumeA_asc - volumeB_asc;
                case 'duration-desc':
                    return (b.durationInSeconds || 0) - (a.durationInSeconds || 0);
                case 'duration-asc':
                    return (a.durationInSeconds || 0) - (b.durationInSeconds || 0);
                default:
                    return 0;
            }
        });
    }, [safeHistoricalData, showDeletedExercises, searchTerm, selectedExerciseFilter, sortBy, selectedTimeRange]);


    const toggleSessionExpansion = useCallback((sessionId) => {
        setExpandedSessions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sessionId)) {
                newSet.delete(sessionId);
            } else {
                newSet.add(sessionId);
            }
            return newSet;
        });
    }, []);

    const formatTime = useCallback((totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, []);


    const renderSessionCard = useCallback((sessionItem) => {
        const isExpanded = expandedSessions.has(sessionItem.id);
        // Calculez le volume total pour la session
        const totalSessionVolume = sessionItem.exercises.reduce((sum, exercise) =>
            sum + exercise.series.reduce((exSum, serie) => exSum + (serie.weight * serie.reps || 0), 0)
        , 0);

        return (
            <div key={sessionItem.id} className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
                <div
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer transition-all duration-200 hover:bg-gray-700/50"
                    onClick={() => toggleSessionExpansion(sessionItem.id)}
                >
                    <div className="flex-1 mb-2 sm:mb-0">
                        <h4 className="text-white font-semibold text-base mb-1">{sessionItem.name || `Séance du ${formatDate(sessionItem.date)}`}</h4>
                        <p className="text-gray-400 text-sm flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(sessionItem.date)}
                            {sessionItem.durationInSeconds > 0 && (
                                <span className="ml-2 flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {formatTime(sessionItem.durationInSeconds)}
                                </span>
                            )}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                            Volume Total: {totalSessionVolume.toLocaleString()} kg
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-4 border-t border-gray-700 bg-gray-850">
                        {sessionItem.notes && (
                            <div className="mb-4 bg-gray-700/50 p-3 rounded-md border border-gray-600">
                                <h5 className="font-medium text-gray-300 mb-1 flex items-center gap-1"><NotebookText className="h-4 w-4" /> Notes de séance:</h5>
                                <p className="text-gray-400 text-sm whitespace-pre-wrap">{sessionItem.notes}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {sessionItem.exercises.map((exercise, exIndex) => (
                                <div key={exIndex} className="bg-gray-700 rounded-lg p-3 border border-gray-600">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="font-semibold text-white text-base flex items-center gap-1">
                                            <Dumbbell className="h-4 w-4 text-blue-400" /> {exercise.name}
                                            {exercise.isDeleted && <span className="text-red-400 text-xs ml-2">(Supprimé)</span>}
                                        </h5>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); analyzeProgressionWithAI(exercise.id); }}
                                                className="p-1 rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors flex items-center gap-1 text-xs"
                                                title="Analyser la progression IA"
                                            >
                                                <Sparkles className="h-4 w-4" />
                                                <span className="hidden sm:inline">IA Analyse</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); showProgressionGraphForExercise(exercise); }}
                                                className="p-1 rounded-md bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors flex items-center gap-1 text-xs"
                                                title="Voir progression"
                                            >
                                                <LineChartIcon className="h-4 w-4" />
                                                <span className="hidden sm:inline">Progression</span>
                                            </button>
                                            {exercise.isDeleted && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleReactivateExercise(exercise.id); }}
                                                    className="p-1 rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors flex items-center gap-1 text-xs"
                                                    title="Réactiver"
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                    <span className="hidden sm:inline">Réactiver</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {exercise.notes && (
                                        <p className="text-gray-400 text-sm mb-2 whitespace-pre-wrap flex items-start gap-1">
                                            <NotebookText className="h-4 w-4 flex-shrink-0" /> {exercise.notes}
                                        </p>
                                    )}

                                    <ul className="space-y-1">
                                        {exercise.series.map((serie, serieIndex) => (
                                            <li key={serieIndex} className="text-gray-300 text-sm flex items-center gap-2">
                                                <span className="bg-gray-600 px-2 py-0.5 rounded-full text-xs font-mono">{serieIndex + 1}</span>
                                                {getSeriesDisplay(serie)}
                                                {serie.isPersonalBest && (
                                                    <Award className="h-4 w-4 text-yellow-400" title="Record Personnel" />
                                                )}
                                                {serie.isWarmUp && (
                                                    <Zap className="h-4 w-4 text-purple-400" title="Échauffement" />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }, [expandedSessions, toggleSessionExpansion, formatDate, formatTime, getSeriesDisplay, handleReactivateExercise, showProgressionGraphForExercise, analyzeProgressionWithAI]);


    // Styles pour les filtres et la recherche
    const filterInputClasses = "w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 p-2 text-sm";
    const selectClasses = "w-full bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 p-2 text-sm appearance-none pr-8";


    return (
        <div className="p-4 sm:p-6 pb-20 max-w-2xl mx-auto"> {/* MODIFIED: Added pb-20 for mobile padding */}
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <History className="h-7 w-7 text-yellow-400" />
                Historique des entraînements
            </h2>

            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                    <Search className="h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une séance ou un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={filterInputClasses}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="sort-by" className="block text-gray-300 text-sm font-medium mb-1">Trier par :</label>
                        <div className="relative">
                            <select
                                id="sort-by"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className={selectClasses}
                            >
                                {sortOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="exercise-filter" className="block text-gray-300 text-sm font-medium mb-1">Filtrer par exercice :</label>
                        <div className="relative">
                            <select
                                id="exercise-filter"
                                value={selectedExerciseFilter}
                                onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                                className={selectClasses}
                            >
                                <option value="all">Tous les exercices</option>
                                {allExerciseNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Option d'affichage des exercices supprimés */}
                <div className="flex items-center mt-4">
                    <input
                        type="checkbox"
                        id="show-deleted"
                        checked={showDeletedExercises}
                        onChange={(e) => setShowDeletedExercises(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-600 bg-gray-700"
                    />
                    <label htmlFor="show-deleted" className="ml-2 text-gray-300 text-sm flex items-center gap-1">
                        <Eye className="h-4 w-4" /> Afficher les exercices supprimés
                    </label>
                </div>
            </div>

            {/* Statistiques rapides (déjà existantes, bien pour mobile) */}
            {filteredAndSortedSessions.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <BarChart3 className="h-5 w-5 text-blue-400" />
                        Aperçu Rapide
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Adapté pour mobile, utilisez des classes comme col-span-1 */}
                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                            <p className="text-xl font-bold text-blue-400">{filteredAndSortedSessions.length}</p>
                            <p className="text-gray-400 text-sm">Séances</p>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                            <p className="text-xl font-bold text-green-400">
                                {/* Calculer le total des records personnels */}
                                {safeHistoricalData.reduce((count, session) =>
                                    count + session.exercises.reduce((exCount, ex) =>
                                        exCount + ex.series.filter(s => s.isPersonalBest).length, 0
                                    ), 0
                                )}
                            </p>
                            <p className="text-gray-400 text-sm">Records Personnels</p>
                        </div>
                        {/* Ajoutez d'autres stats rapides si pertinent et si ça rentre bien */}
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
