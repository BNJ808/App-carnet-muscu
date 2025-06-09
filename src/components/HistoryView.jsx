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
    deleteHistoricalSession, // Nouvelle prop pour la suppression
    isLoadingAI = false
}) => {
    const [showDeletedExercises, setShowDeletedExercises] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [selectedExerciseFilter, setSelectedExerciseFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState(''); // État local pour le terme de recherche
    const [sortBy, setSortBy] = useState('date-desc'); // État local pour le tri

    // Assurer que historicalData est toujours un tableau
    const safeHistoricalData = Array.isArray(historicalData) ? historicalData : [];

    // Options de tri
    const sortOptions = [
        { value: 'date-desc', label: 'Plus récent' },
        { value: 'date-asc', label: 'Plus ancien' },
        { value: 'name-asc', label: 'Nom exercice (A-Z)' },
        { value: 'name-desc', label: 'Nom exercice (Z-A)' },
    ];

    // Calculer les exercices uniques pour le filtre
    const uniqueExercises = useMemo(() => {
        const exercises = new Set();
        safeHistoricalData.forEach(session => {
            session.exercises.forEach(ex => {
                exercises.add(ex.name);
            });
        });
        return ['all', ...Array.from(exercises).sort()];
    }, [safeHistoricalData]);

    const filteredAndSortedSessions = useMemo(() => {
        let filtered = safeHistoricalData;

        // Filtrer par exercices supprimés (uniquement en mode avancé)
        if (!showDeletedExercises && isAdvancedMode) {
            filtered = filtered.filter(session => !session.isDeleted);
        } else if (!isAdvancedMode) {
            // Toujours masquer les supprimés si pas en mode avancé
            filtered = filtered.filter(session => !session.isDeleted);
        }

        // Filtrer par terme de recherche
        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(session =>
                session.dayName.toLowerCase().includes(lowerCaseSearchTerm) ||
                session.exercises.some(ex => ex.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                    ex.notes?.toLowerCase().includes(lowerCaseSearchTerm)
                )
            );
        }

        // Filtrer par exercice sélectionné
        if (selectedExerciseFilter !== 'all') {
            filtered = filtered.filter(session =>
                session.exercises.some(ex => ex.name === selectedExerciseFilter)
            );
        }

        // Filtrer par plage de temps
        const now = new Date();
        filtered = filtered.filter(session => {
            const sessionDate = session.date instanceof Date ? session.date : new Date(session.date);
            switch (selectedTimeRange) {
                case 'last7days':
                    return (now.getTime() - sessionDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
                case 'last30days':
                    return (now.getTime() - sessionDate.getTime()) < 30 * 24 * 60 * 60 * 1000;
                case 'last90days':
                    return (now.getTime() - sessionDate.getTime()) < 90 * 24 * 60 * 60 * 1000;
                case 'thisYear':
                    return sessionDate.getFullYear() === now.getFullYear();
                default:
                    return true;
            }
        });

        // Trier les sessions
        return [...filtered].sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
            const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();

            switch (sortBy) {
                case 'date-asc':
                    return dateA - dateB;
                case 'date-desc':
                    return dateB - dateA;
                case 'name-asc':
                    // Pour le tri par nom, il faut considérer le nom du premier exercice ou du jour
                    const nameA = a.dayName || (a.exercises[0] ? a.exercises[0].name : '');
                    const nameB = b.dayName || (b.exercises[0] ? b.exercises[0].name : '');
                    return nameA.localeCompare(nameB);
                case 'name-desc':
                    const nameA_desc = a.dayName || (a.exercises[0] ? a.exercises[0].name : '');
                    const nameB_desc = b.dayName || (b.exercises[0] ? b.exercises[0].name : '');
                    return nameB_desc.localeCompare(nameA_desc);
                default:
                    return dateB - dateA; // Par défaut, tri par date décroissante
            }
        });
    }, [safeHistoricalData, showDeletedExercises, searchTerm, selectedExerciseFilter, selectedTimeRange, sortBy, isAdvancedMode]);

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

    const renderSessionCard = (sessionItem) => (
        <div key={sessionItem.id} className={`bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 ease-in-out ${sessionItem.isDeleted ? 'opacity-50 border-red-700 border-2' : 'border border-gray-700 hover:border-blue-500'}`}>
            <div
                className="flex items-center justify-between p-4 cursor-pointer bg-gray-700/50 hover:bg-gray-700 transition-colors"
                onClick={() => toggleSessionExpansion(sessionItem.id)}
            >
                <div className="flex flex-col">
                    <span className="text-sm text-gray-400 flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-500" /> {formatDate(sessionItem.date)}
                    </span>
                    <h4 className="text-lg font-semibold text-white mt-1 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-400" />
                        {sessionItem.dayName || 'Séance sans nom'}
                        {sessionItem.isDeleted && <span className="text-red-400 text-xs font-normal ml-2">(Supprimé)</span>}
                    </h4>
                </div>
                {sessionItem.isDeleted && isAdvancedMode ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleReactivateExercise(sessionItem.id, sessionItem.exercises[0]?.name); }}
                        className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                        aria-label="Réactiver l'exercice"
                    >
                        <RotateCcw className="h-4 w-4" /> Réactiver
                    </button>
                ) : (
                    <>
                        {expandedSessions.has(sessionItem.id) ? (
                            <ChevronUp className="h-6 w-6 text-gray-400" />
                        ) : (
                            <ChevronDown className="h-6 w-6 text-gray-400" />
                        )}
                    </>
                )}
            </div>

            {expandedSessions.has(sessionItem.id) && (
                <div className="p-4 border-t border-gray-700 bg-gray-800">
                    {sessionItem.exercises.map((exercise, exIndex) => (
                        <div key={`${sessionItem.id}-${exIndex}`} className="mb-4 last:mb-0 bg-gray-700/40 rounded-lg p-3 border border-gray-600">
                            <h5 className="font-medium text-white text-md mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Dumbbell className="h-4 w-4 text-purple-400" /> {exercise.name}
                                    <span className="text-sm text-gray-400">({exercise.category})</span>
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => analyzeProgressionWithAI(exercise.name, safeHistoricalData)}
                                        className="p-1 rounded-full text-yellow-400 hover:bg-gray-600 transition-colors"
                                        title="Analyser la progression avec l'IA"
                                        disabled={isLoadingAI}
                                    >
                                        <Sparkles className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => showProgressionGraphForExercise(exercise)}
                                        className="p-1 rounded-full text-green-400 hover:bg-gray-600 transition-colors"
                                        title="Voir le graphique de progression"
                                    >
                                        <LineChartIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </h5>
                            {exercise.notes && (
                                <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                                    <NotebookText className="h-3 w-3" /> {exercise.notes}
                                </p>
                            )}
                            <ul className="space-y-1 text-gray-300 text-sm">
                                {exercise.series.map((serie, sIndex) => (
                                    <li key={serie.id || sIndex} className={`flex items-center gap-2 ${serie.completed ? 'text-green-300' : 'text-gray-400'}`}>
                                        {serie.completed ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                        Série {sIndex + 1}: {getSeriesDisplay(serie)}
                                    </li>
                                ))}
                            </ul>

                            {personalBests[exercise.name] && (
                                <div className="mt-3 p-2 bg-gray-600/30 rounded-md text-xs text-gray-300 border border-gray-600">
                                    <h6 className="font-semibold text-white mb-1 flex items-center gap-1">
                                        <Award className="h-4 w-4 text-yellow-300" /> Records personnels:
                                    </h6>
                                    {personalBests[exercise.name].maxWeight > 0 && (
                                        <p>Max Poids: <span className="text-blue-300 font-bold">{personalBests[exercise.name].maxWeight} kg</span></p>
                                    )}
                                    {personalBests[exercise.name].oneRepMax > 0 && (
                                        <p>Max 1 Rép (estimé): <span className="text-purple-300 font-bold">{personalBests[exercise.name].oneRepMax.toFixed(1)} kg</span></p>
                                    )}
                                    {personalBests[exercise.name].volume > 0 && (
                                        <p>Meilleur Volume: <span className="text-green-300 font-bold">{personalBests[exercise.name].volume} kg</span></p>
                                    )}
                                    {Object.keys(personalBests[exercise.name].maxRepsAtWeight).length > 0 && (
                                        <p>Meilleures Rép. par Poids:
                                            {Object.entries(personalBests[exercise.name].maxRepsAtWeight)
                                                .map(([weight, reps]) => ` ${reps} reps @ ${weight}kg`)
                                                .join(', ')
                                            }
                                        </p>
                                    )}
                                </div>
                            )}
                            {isAdvancedMode && !sessionItem.isDeleted && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteHistoricalSession(sessionItem.id); }}
                                    className="mt-3 px-3 py-1 bg-red-600 text-white rounded-md text-xs hover:bg-red-700 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 className="h-3 w-3" /> Supprimer la séance
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="container mx-auto p-4 animate-fade-in-up">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <History className="h-8 w-8 text-yellow-400" />
                Historique des entraînements
            </h2>

            {/* Filtres et recherche */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Recherche par nom */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Rechercher exercice ou jour..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                    </div>

                    {/* Filtre par exercice */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <select
                            value={selectedExerciseFilter}
                            onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                            <option value="all">Tous les exercices</option>
                            {uniqueExercises.map(ex => (
                                <option key={ex} value={ex}>{ex}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Filtre par plage de temps */}
                    <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <select
                            value={selectedTimeRange}
                            onChange={(e) => setSelectedTimeRange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                            <option value="all">Toutes les dates</option>
                            <option value="last7days">7 derniers jours</option>
                            <option value="last30days">30 derniers jours</option>
                            <option value="last90days">90 derniers jours</option>
                            <option value="thisYear">Cette année</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Tri */}
                    <div className="relative md:col-span-2 lg:col-span-1">
                        <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                            {sortOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {isAdvancedMode && (
                    <div className="mt-4 flex items-center justify-end">
                        <label htmlFor="show-deleted" className="flex items-center text-gray-400 cursor-pointer">
                            <input
                                type="checkbox"
                                id="show-deleted"
                                checked={showDeletedExercises}
                                onChange={() => setShowDeletedExercises(!showDeletedExercises)}
                                className="mr-2 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <EyeOff className="h-4 w-4 mr-1" /> Afficher les séances supprimées
                        </label>
                        {/* Potentiel emplacement pour d'autres fonctionnalités avancées si pertinent et si ça rentre bien */}
                    </div>
                )}


            </div>


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