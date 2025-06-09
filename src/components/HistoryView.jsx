import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText, RotateCcw, Search,
    Filter, Calendar, Award, TrendingUp, Activity, Eye, EyeOff, ChevronDown, ChevronUp, History, Clock, Trash2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Composant HistoryView pour afficher l'historique des entraînements.
 */
const HistoryView = ({
    historicalData = [],
    personalBests = {},
    handleReactivateExercise,
    analyzeProgressionWithAI, // Function to call AI analysis
    progressionAnalysisContent = '', // Renamed from showProgressionGraphForExercise to hold the analysis text
    formatDate,
    getSeriesDisplay,
    isAdvancedMode,
    deleteHistoricalSession, // Nouvelle prop pour la suppression
    isLoadingAI = false, // Loading state for AI analysis
    showToast // Prop pour afficher des toasts
}) => {
    const [showDeletedExercises, setShowDeletedExercises] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [selectedExerciseFilter, setSelectedExerciseFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState(''); // État local pour le terme de recherche
    const [sortBy, setSortBy] = useState('date-desc'); // État local pour le tri
    const [showFilters, setShowFilters] = useState(false); // État pour afficher/masquer les filtres
    const [selectedExerciseForProgression, setSelectedExerciseForProgression] = useState(null); // Pour l'exercice sélectionné pour le graphique

    // Assurer que historicalData est toujours un tableau
    const safeHistoricalData = useMemo(() => Array.isArray(historicalData) ? historicalData : [], [historicalData]);

    // Options de tri
    const sortOptions = [
        { label: 'Date (récent)', value: 'date-desc' },
        { label: 'Date (ancien)', value: 'date-asc' },
        { label: 'Volume (décroissant)', value: 'volume-desc' },
        { label: 'Volume (croissant)', value: 'volume-asc' },
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

    // Fonction pour calculer le volume d'une session
    const calculateSessionVolume = useCallback((session) => {
        return session.exercises.reduce((totalVolume, exercise) => {
            return totalVolume + exercise.series.reduce((exerciseVolume, serie) => {
                return exerciseVolume + (serie.weight || 0) * (serie.reps || 0);
            }, 0);
        }, 0);
    }, []);

    // Filtrage et tri des sessions
    const filteredAndSortedSessions = useMemo(() => {
        let sessions = [...safeHistoricalData];

        // 1. Filtrer les exercices supprimés
        if (!showDeletedExercises) {
            sessions = sessions.map(session => ({
                ...session,
                exercises: session.exercises.filter(ex => !ex.deleted)
            })).filter(session => session.exercises.length > 0); // Supprimer les sessions vides après filtrage
        }

        // 2. Filtrer par plage de temps
        const now = new Date();
        sessions = sessions.filter(session => {
            const sessionDate = new Date(session.date);
            switch (selectedTimeRange) {
                case 'week':
                    const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                    return sessionDate >= lastWeek;
                case 'month':
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                    return sessionDate >= lastMonth;
                case 'year':
                    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                    return sessionDate >= lastYear;
                case 'all':
                default:
                    return true;
            }
        });

        // 3. Filtrer par exercice sélectionné
        if (selectedExerciseFilter !== 'all') {
            sessions = sessions.filter(session =>
                session.exercises.some(exercise => exercise.name === selectedExerciseFilter)
            );
        }

        // 4. Filtrer par terme de recherche (dans le nom de la session ou des exercices)
        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            sessions = sessions.filter(session =>
                session.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                session.exercises.some(exercise => exercise.name.toLowerCase().includes(lowerCaseSearchTerm))
            );
        }

        // 5. Trier
        sessions.sort((a, b) => {
            switch (sortBy) {
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'date-desc':
                    return new Date(b.date) - new Date(a.date);
                case 'volume-asc':
                    return calculateSessionVolume(a) - calculateSessionVolume(b);
                case 'volume-desc':
                    return calculateSessionVolume(b) - calculateSessionVolume(a);
                default:
                    return 0;
            }
        });

        return sessions;
    }, [safeHistoricalData, showDeletedExercises, selectedTimeRange, selectedExerciseFilter, searchTerm, sortBy, calculateSessionVolume]);

    // Préparation des données pour le graphique de progression d'un exercice spécifique
    const getProgressionDataForExercise = useCallback((exerciseName) => {
        const data = [];
        safeHistoricalData.forEach(session => {
            const sessionDate = session.date;
            session.exercises.forEach(exercise => {
                if (exercise.name === exerciseName) {
                    // Calculer le 1RM estimé pour cet exercice dans cette session
                    // Formule Epley: Poids * (1 + (Reps / 30))
                    let max1RM = 0;
                    exercise.series.forEach(serie => {
                        if (serie.weight && serie.reps) {
                            max1RM = Math.max(max1RM, serie.weight * (1 + (serie.reps / 30)));
                        }
                    });
                    if (max1RM > 0) {
                        data.push({ date: sessionDate, '1RM Estimé (kg)': parseFloat(max1RM.toFixed(2)) });
                    }
                }
            });
        });

        // Trier par date pour le graphique
        return data.sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [safeHistoricalData]);

    const renderProgressionGraph = (exerciseName) => {
        const data = getProgressionDataForExercise(exerciseName);

        if (data.length === 0) {
            return (
                <div className="bg-gray-700/50 rounded-lg p-4 text-center border border-gray-600">
                    <LineChartIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-400">Pas assez de données pour le graphique de progression de cet exercice.</p>
                </div>
            );
        }

        return (
            <div className="mt-4 bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h4 className="font-semibold text-white mb-3 text-center flex items-center justify-center gap-2">
                    <LineChartIcon className="h-5 w-5 text-blue-400" /> Progression pour {exerciseName} (1RM Estimé)
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                        <XAxis
                            dataKey="date"
                            stroke="#9CA3AF"
                            tickFormatter={(dateStr) => {
                                const d = new Date(dateStr);
                                return `${d.getDate()}/${d.getMonth() + 1}`;
                            }}
                            interval="preserveStartEnd"
                            angle={-20}
                            textAnchor="end"
                            height={40}
                            style={{ fontSize: '0.7rem' }}
                        />
                        <YAxis stroke="#9CA3AF" label={{ value: '1RM (kg)', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: '0.8rem' }} />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px', color: '#E5E7EB', fontSize: '0.8rem' }}
                            itemStyle={{ color: '#E5E7EB' }}
                            formatter={(value) => [`${value} kg`, '1RM Estimé']}
                            labelFormatter={(label) => `Date: ${formatDate(label)}`}
                        />
                        <Line type="monotone" dataKey="1RM Estimé (kg)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
                <div className="text-center mt-3 text-gray-400 text-xs">
                    *1RM Estimé = Poids x (1 + (Reps / 30))
                </div>
            </div>
        );
    };

    const renderSessionCard = useCallback((sessionItem) => {
        const isExpanded = expandedSessions.has(sessionItem.id);
        const sessionVolume = calculateSessionVolume(sessionItem);

        return (
            <div key={sessionItem.id} className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
                <div
                    className="flex justify-between items-center p-4 cursor-pointer bg-gray-700 hover:bg-gray-600 transition-colors"
                    onClick={() => setExpandedSessions(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(sessionItem.id)) {
                            newSet.delete(sessionItem.id);
                        } else {
                            newSet.add(sessionItem.id);
                        }
                        return newSet;
                    })}
                >
                    <div className="flex-1">
                        <h4 className="font-semibold text-white text-lg flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-yellow-400" />
                            {formatDate(sessionItem.date)} - {sessionItem.name || 'Séance'}
                        </h4>
                        <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                            <Activity className="h-4 w-4 text-gray-400" /> Volume: {sessionVolume} kg
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Empêche l'expansion/rétraction de la carte
                                if (window.confirm("Êtes-vous sûr de vouloir supprimer cette séance ? Cette action est irréversible.")) {
                                    deleteHistoricalSession(sessionItem.id);
                                    showToast("Séance supprimée !", "success");
                                }
                            }}
                            className="p-2 rounded-full text-red-400 hover:bg-red-900/50 transition-colors"
                            aria-label="Supprimer la séance"
                        >
                            <Trash2 className="h-5 w-5" />
                        </button>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="p-4 bg-gray-800 border-t border-gray-700">
                        {sessionItem.exercises.map((exercise, exIndex) => (
                            <div key={exIndex} className="mb-4 last:mb-0 bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                <div className="flex justify-between items-center mb-2">
                                    <h5 className="font-medium text-white flex items-center gap-2">
                                        <Dumbbell className="h-4 w-4 text-blue-400" /> {exercise.name}
                                        {exercise.deleted && <span className="text-red-400 text-xs ml-2">(Supprimé)</span>}
                                    </h5>
                                    <div className="flex gap-2">
                                        {exercise.deleted && (
                                            <button
                                                onClick={() => { handleReactivateExercise(exercise.name); showToast(`${exercise.name} réactivé !`, "info"); }}
                                                className="text-green-400 hover:text-green-300 text-xs px-2 py-1 rounded-md bg-green-900/50 transition-colors"
                                            >
                                                Réactiver
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setSelectedExerciseForProgression(exercise.name);
                                                analyzeProgressionWithAI(exercise.name, safeHistoricalData); // Trigger AI analysis
                                            }}
                                            disabled={isLoadingAI}
                                            className="text-yellow-400 hover:text-yellow-300 text-xs px-2 py-1 rounded-md bg-yellow-900/50 transition-colors flex items-center gap-1"
                                        >
                                            {isLoadingAI && selectedExerciseForProgression === exercise.name ? (
                                                <RotateCcw className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Sparkles className="h-3 w-3" />
                                            )}
                                            Analyse IA
                                        </button>
                                    </div>
                                </div>
                                <ul className="space-y-1 text-sm text-gray-300">
                                    {exercise.series.map((serie, serieIndex) => (
                                        <li key={serieIndex}>
                                            <span className="text-gray-400">Série {serie.set}:</span> {getSeriesDisplay(serie)}
                                        </li>
                                    ))}
                                </ul>
                                {personalBests[exercise.name] && (
                                    <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                                        <Award className="h-3 w-3" /> Record personnel: {personalBests[exercise.name].weight} kg pour {personalBests[exercise.name].reps} reps
                                    </p>
                                )}
                                {exercise.notes && (
                                    <div className="mt-2 bg-gray-600/50 rounded-md p-2 text-xs text-gray-300 flex items-start gap-1">
                                        <NotebookText className="h-3 w-3 flex-shrink-0 text-orange-300" />
                                        <span className="flex-grow">{exercise.notes}</span>
                                    </div>
                                )}
                                {/* Afficher le graphique de progression et l'analyse IA si sélectionné pour cet exercice */}
                                {selectedExerciseForProgression === exercise.name && renderProgressionGraph(exercise.name)}
                                {selectedExerciseForProgression === exercise.name && progressionAnalysisContent && (
                                    <div className="mt-3 bg-gray-600/50 rounded-lg p-3 text-sm border border-gray-500">
                                        <h6 className="font-medium text-white mb-2 flex items-center gap-1">
                                            <Sparkles className="h-4 w-4 text-yellow-400" /> Analyse IA pour {exercise.name}:
                                        </h6>
                                        <p className="text-gray-300 whitespace-pre-wrap">{progressionAnalysisContent}</p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            💡 Cette analyse est générée par IA et doit être considérée comme un conseil général.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }, [expandedSessions, calculateSessionVolume, formatDate, getSeriesDisplay, personalBests, handleReactivateExercise, deleteHistoricalSession, showToast, analyzeProgressionWithAI, isLoadingAI, selectedExerciseForProgression, progressionAnalysisContent, safeHistoricalData]);

    return (
        <div className="p-4 bg-gray-900 min-h-screen text-gray-100 font-sans">
            <h1 className="text-3xl font-extrabold text-white mb-6 text-center">Historique des Entraînements</h1>

            {/* Barre de recherche et filtres */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                    <Search className="h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une séance ou un exercice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-gray-700 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300"
                        aria-label="Afficher/Masquer les filtres"
                    >
                        <Filter className="h-5 w-5" />
                    </button>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 animate-fade-in-down">
                        {/* Filtre par Exercice */}
                        <div>
                            <label htmlFor="exercise-filter" className="block text-sm font-medium text-gray-400 mb-1">Exercice :</label>
                            <select
                                id="exercise-filter"
                                value={selectedExerciseFilter}
                                onChange={(e) => setSelectedExerciseFilter(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            >
                                <option value="all">Tous les exercices</option>
                                {allExerciseNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtre par Plage de Temps */}
                        <div>
                            <label htmlFor="time-range-filter" className="block text-sm font-medium text-gray-400 mb-1">Période :</label>
                            <select
                                id="time-range-filter"
                                value={selectedTimeRange}
                                onChange={(e) => setSelectedTimeRange(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            >
                                <option value="all">Toutes les dates</option>
                                <option value="week">Dernière semaine</option>
                                <option value="month">Dernier mois</option>
                                <option value="year">Dernière année</option>
                            </select>
                        </div>

                        {/* Options supplémentaires (exercices supprimés, tri) */}
                        <div className="col-span-full flex items-center justify-between mt-2">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-4 w-4 text-blue-600 rounded"
                                    checked={showDeletedExercises}
                                    onChange={(e) => setShowDeletedExercises(e.target.checked)}
                                />
                                <span className="ml-2 text-sm text-gray-300">Afficher exercices supprimés</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <label htmlFor="sort-by" className="block text-sm font-medium text-gray-400">Trier par :</label>
                                <select
                                    id="sort-by"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-gray-700 text-white rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                >
                                    {sortOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
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