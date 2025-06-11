// HistoryView.jsx
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText, RotateCcw, Search,
    Filter, Calendar, Award, TrendingUp, Activity, Eye, EyeOff, ChevronDown, ChevronUp, History, Clock, Trash2, XCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Composant HistoryView pour afficher l'historique des entraînements.
 * @param {object} props - Les props du composant.
 * @param {Array<object>} props.historicalData - Les données historiques des séances.
 * @param {object} props.personalBests - Les records personnels.
 * @param {function} props.handleReactivateExercise - Fonction pour réactiver un exercice supprimé.
 * @param {function} props.analyzeProgressionWithAI - Fonction pour appeler l'analyse AI.
 * @param {string} props.progressionAnalysisContent - Le texte de l'analyse AI de progression.
 * @param {function} props.formatDate - Fonction pour formater une date.
 * @param {function} props.getSeriesDisplay - Fonction pour afficher les séries.
 * @param {function} props.deleteHistoricalSession - Fonction pour supprimer une session historique.
 * @param {boolean} props.isLoadingAI - État de chargement de l'analyse AI.
 * @param {function} props.showToast - Fonction pour afficher des toasts.
 */
const HistoryView = ({
    historicalData = [],
    personalBests = {},
    handleReactivateExercise,
    analyzeProgressionWithAI,
    progressionAnalysisContent = '',
    formatDate,
    getSeriesDisplay,
    deleteHistoricalSession,
    isLoadingAI = false,
    showToast
}) => {
    const [showDeletedExercises, setShowDeletedExercises] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [selectedExerciseFilter, setSelectedExerciseFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'volume-desc', 'volume-asc'
    const [selectedExerciseForProgression, setSelectedExerciseForProgression] = useState(null);

    // Effet pour effacer l'analyse IA si l'exercice sélectionné change
    useEffect(() => {
        if (!selectedExerciseForProgression) {
            // Assuming progressionAnalysisContent is managed by a parent component
            // If it's specific to this view and tied to selectedExerciseForProgression,
            // you might want to reset it here if it's not already handled by a clear function.
        }
    }, [selectedExerciseForProgression]);

    // Calculer la liste unique de tous les exercices pour le filtre
    const allExercises = useMemo(() => {
        const exercises = new Set();
        historicalData.forEach(session => {
            session.exercises.forEach(ex => {
                exercises.add(ex.name);
            });
        });
        return ['all', ...Array.from(exercises).sort()];
    }, [historicalData]);

    // Filtrage et tri des sessions
    const filteredAndSortedSessions = useMemo(() => {
        let filtered = historicalData;

        // Filtrer par exercices supprimés
        if (!showDeletedExercises) {
            filtered = filtered.map(session => ({
                ...session,
                exercises: session.exercises.filter(ex => !ex.deleted)
            })).filter(session => session.exercises.length > 0); // Remove sessions with no active exercises
        }

        // Filtrer par terme de recherche (nom d'exercice ou notes de session)
        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(session =>
                session.exercises.some(ex => ex.name.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (session.notes && session.notes.toLowerCase().includes(lowerCaseSearchTerm))
            );
        }

        // Filtrer par exercice spécifique
        if (selectedExerciseFilter !== 'all') {
            filtered = filtered.filter(session =>
                session.exercises.some(ex => ex.name === selectedExerciseFilter && !ex.deleted)
            );
        }

        // Filtrer par plage de temps
        const now = new Date();
        filtered = filtered.filter(session => {
            const sessionDate = typeof session.date.toDate === 'function' ? session.date.toDate() : new Date(session.date);
            switch (selectedTimeRange) {
                case 'last7days':
                    return (now - sessionDate) / (1000 * 60 * 60 * 24) <= 7;
                case 'last30days':
                    return (now - sessionDate) / (1000 * 60 * 60 * 24) <= 30;
                case 'last90days':
                    return (now - sessionDate) / (1000 * 60 * 60 * 24) <= 90;
                case 'thisYear':
                    return sessionDate.getFullYear() === now.getFullYear();
                case 'lastYear':
                    return sessionDate.getFullYear() === now.getFullYear() - 1;
                default:
                    return true;
            }
        });

        // Tri
        const sorted = [...filtered].sort((a, b) => {
            const dateA = typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date);
            const dateB = typeof b.date.toDate === 'function' ? b.date.toDate() : new Date(b.date);

            if (sortBy === 'date-desc') {
                return dateB - dateA;
            } else if (sortBy === 'date-asc') {
                return dateA - dateB;
            } else if (sortBy === 'volume-desc') {
                const volumeA = a.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps * set.weight), 0), 0);
                const volumeB = b.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps * set.weight), 0), 0);
                return volumeB - volumeA;
            } else if (sortBy === 'volume-asc') {
                const volumeA = a.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps * set.weight), 0), 0);
                const volumeB = b.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps * set.weight), 0), 0);
                return volumeA - volumeB;
            }
            return 0;
        });

        return sorted;
    }, [historicalData, showDeletedExercises, searchTerm, selectedExerciseFilter, selectedTimeRange, sortBy, formatDate]);


    const toggleSessionExpand = useCallback((sessionId) => {
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

    const getExerciseHistoryForGraph = useCallback((exerciseName) => {
        const history = [];
        historicalData.forEach(session => {
            const exerciseEntry = session.exercises.find(ex => ex.name === exerciseName && !ex.deleted);
            if (exerciseEntry) {
                // Pour le graphique de progression, nous voulons une métrique simple par séance, par exemple le 1RM estimé ou le volume.
                // Ici, nous allons utiliser le volume total pour l'exercice dans cette session.
                const volume = exerciseEntry.sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
                history.push({
                    date: typeof session.date.toDate === 'function' ? session.date.toDate().getTime() : new Date(session.date).getTime(), // Timestamp for Recharts
                    volume: volume,
                    sets: exerciseEntry.sets // Keep sets to pass to AI
                });
            }
        });
        // Sort by date ascending for the graph
        return history.sort((a, b) => a.date - b.date);
    }, [historicalData]);


    const renderSessionCard = useCallback((sessionItem) => {
        const isExpanded = expandedSessions.has(sessionItem.id);
        const sessionDate = typeof sessionItem.date.toDate === 'function' ? sessionItem.date.toDate() : new Date(sessionItem.date);
        const formattedSessionDate = formatDate(sessionItem.date);

        const sessionVolume = sessionItem.exercises.reduce((seshVol, exercise) => {
            const exerciseVolume = exercise.sets.reduce((exVol, set) => exVol + (set.reps * set.weight), 0);
            return seshVol + exerciseVolume;
        }, 0);

        return (
            <div key={sessionItem.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-md">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleSessionExpand(sessionItem.id)}>
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        Séance du {formattedSessionDate}
                        {sessionItem.duration && (
                            <span className="text-sm text-gray-400 ml-2 flex items-center gap-1">
                                <Clock className="h-4 w-4" /> {sessionItem.duration} min
                            </span>
                        )}
                    </h4>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-300 hidden sm:block">{sessionVolume.toFixed(0)} kg de volume</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent toggling expand
                                deleteHistoricalSession(sessionItem.id);
                            }}
                            className="text-red-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-700 transition-colors"
                            title="Supprimer la séance"
                            aria-label="Supprimer la séance"
                        >
                            <Trash2 className="h-5 w-5" />
                        </button>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-4 border-t border-gray-700 pt-4 space-y-4">
                        {sessionItem.notes && (
                            <p className="text-gray-300 text-sm mb-4 bg-gray-700/30 p-3 rounded-md italic">
                                <NotebookText className="h-4 w-4 inline-block mr-2 text-blue-300" />
                                {sessionItem.notes}
                            </p>
                        )}
                        {sessionItem.exercises.length > 0 ? (
                            sessionItem.exercises.map((exercise, exIndex) => {
                                const exerciseHistory = getExerciseHistoryForGraph(exercise.name);
                                const currentExercisePB = personalBests[exercise.name] || null;
                                const isDeleted = exercise.deleted;

                                return (
                                    <div key={exIndex} className={`bg-gray-700 rounded-lg p-3 border ${isDeleted ? 'border-red-600/50 opacity-60' : 'border-gray-600'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className={`font-semibold ${isDeleted ? 'text-red-300 line-through' : 'text-blue-300'} flex items-center gap-2`}>
                                                {exercise.name}
                                                {isDeleted && <span className="text-xs text-red-300">(Supprimé)</span>}
                                            </h5>
                                            {isDeleted && (
                                                <button
                                                    onClick={() => handleReactivateExercise(exercise.name)}
                                                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                                >
                                                    <RotateCcw className="h-3 w-3" /> Réactiver
                                                </button>
                                            )}
                                        </div>
                                        <ul className="text-gray-300 text-sm space-y-1">
                                            {exercise.sets.map((set, setIndex) => (
                                                <li key={setIndex} className="flex justify-between">
                                                    <span>Série {setIndex + 1}:</span>
                                                    <span>{getSeriesDisplay([set])}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {currentExercisePB && (
                                            <div className="mt-2 text-xs text-yellow-300 flex items-center gap-1">
                                                <Award className="h-4 w-4" />
                                                PB: {currentExercisePB.maxWeight}kg x {currentExercisePB.maxReps} reps
                                                {currentExercisePB.weightForMaxReps && currentExercisePB.maxRepsForWeight && currentExercisePB.weightForMaxReps !== currentExercisePB.maxWeight && (
                                                    ` | ${currentExercisePB.maxRepsForWeight} reps à ${currentExercisePB.weightForMaxReps}kg`
                                                )}
                                            </div>
                                        )}
                                        {/* Graphiques et analyses IA toujours visibles maintenant */}
                                        {exerciseHistory.length > 1 && (
                                            <div className="mt-4">
                                                <h6 className="text-md font-semibold text-white mb-2 flex items-center gap-2">
                                                    <LineChartIcon className="h-5 w-5 text-purple-400" /> Progression du volume
                                                </h6>
                                                <ResponsiveContainer width="100%" height={200}>
                                                    <LineChart data={exerciseHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                                        <XAxis
                                                            dataKey="date"
                                                            type="number"
                                                            domain={['dataMin', 'dataMax']}
                                                            tickFormatter={(unixTime) => formatDate(new Date(unixTime))}
                                                            stroke="#999"
                                                            tick={{ fontSize: 10 }}
                                                            minTickGap={30}
                                                        />
                                                        <YAxis stroke="#999" tick={{ fontSize: 10 }} />
                                                        <Tooltip labelFormatter={(label) => formatDate(new Date(label))} formatter={(value) => [`${value.toFixed(0)} kg`, 'Volume']} />
                                                        <Line type="monotone" dataKey="volume" stroke="#8884d8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                                <button
                                                    onClick={() => analyzeProgressionWithAI(exercise.name, exerciseHistory)}
                                                    disabled={isLoadingAI}
                                                    className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isLoadingAI ? (
                                                        <RotateCcw className="h-4 w-4 animate-spin mr-2" />
                                                    ) : (
                                                        <Sparkles className="h-4 w-4 mr-2" />
                                                    )}
                                                    Analyser la progression avec l'IA
                                                </button>
                                            </div>
                                        )}
                                        {progressionAnalysisContent && selectedExerciseForProgression === exercise.name && (
                                            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4 relative mt-4">
                                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                                    <Sparkles className="h-6 w-6 text-yellow-400" /> Analyse IA pour {exercise.name}
                                                    <button
                                                        onClick={() => {
                                                            // Assumons que cette fonction est gérée par le parent ou que progressionAnalysisContent
                                                            // est lié à selectedExerciseForProgression et se réinitialise quand selectedExerciseForProgression est null.
                                                            // Pour l'instant, on n'a pas de prop setProgressionAnalysisContent ici.
                                                            // Si progressionAnalysisContent est global, il faut une prop pour le vider.
                                                            // Pour cette démo, on le laisse tel quel.
                                                            setSelectedExerciseForProgression(null); // Cela masquera le contenu
                                                        }}
                                                        className="ml-auto text-gray-400 hover:text-white transition-colors"
                                                        aria-label="Effacer l'analyse IA"
                                                    >
                                                        <XCircle className="h-5 w-5" />
                                                    </button>
                                                </h3>
                                                <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                                                    {progressionAnalysisContent}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-4">
                                                    💡 Cette analyse est générée par IA et doit être considérée comme un conseil général.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-gray-400 italic">Aucun exercice non supprimé dans cette séance.</p>
                        )}
                    </div>
                )}
            </div>
        );
    }, [expandedSessions, personalBests, isLoadingAI, progressionAnalysisContent, selectedExerciseForProgression, analyzeProgressionWithAI, deleteHistoricalSession, handleReactivateExercise, formatDate, getSeriesDisplay, getExerciseHistoryForGraph, toggleSessionExpand]);


    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <History className="h-8 w-8 text-yellow-400" /> Historique d'entraînement
            </h2>

            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {/* Recherche par nom */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher exercice ou note..."
                            className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Filtre par exercice */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                            value={selectedExerciseFilter}
                            onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-colors"
                        >
                            {allExercises.map(ex => (
                                <option key={ex} value={ex}>{ex === 'all' ? 'Tous les exercices' : ex}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Filtre par période */}
                    <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                            value={selectedTimeRange}
                            onChange={(e) => setSelectedTimeRange(e.target.value)}
                            className="w-full bg-gray-700 text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-colors"
                        >
                            <option value="all">Toutes les périodes</option>
                            <option value="last7days">7 derniers jours</option>
                            <option value="last30days">30 derniers jours</option>
                            <option value="last90days">90 derniers jours</option>
                            <option value="thisYear">Cette année</option>
                            <option value="lastYear">L'année dernière</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Options d'affichage */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="showDeleted"
                            checked={showDeletedExercises}
                            onChange={() => setShowDeletedExercises(prev => !prev)}
                            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700 focus:ring-blue-500"
                        />
                        <label htmlFor="showDeleted" className="text-gray-300 select-none flex items-center gap-1">
                            {showDeletedExercises ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                            Afficher exercices supprimés
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-gray-300">Trier par:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-gray-700 text-white rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-colors"
                        >
                            <option value="date-desc">Date (récent au plus ancien)</option>
                            <option value="date-asc">Date (ancien au plus récent)</option>
                            <option value="volume-desc">Volume (décroissant)</option>
                            <option value="volume-asc">Volume (croissant)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Liste des sessions */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-yellow-400" />
                    Historique des séances ({filteredAndSortedSessions.length})
                </h3>

                {filteredAndSortedSessions.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400 mb-2">Aucune séance trouvée</p>
                        <p className="text-sm text-gray-500">
                            {searchTerm || selectedExerciseFilter !== 'all' || selectedTimeRange !== 'all' || showDeletedExercises
                                ? 'Essayez de modifier vos filtres de recherche ou d\'afficher les exercices supprimés.'
                                : 'Commencez à vous entraîner pour voir votre historique ici.'
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