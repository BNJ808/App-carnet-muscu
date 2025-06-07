import React, { useState, useEffect, useMemo } from 'react';
import {
    Sparkles, LineChart as LineChartIcon, NotebookText, RotateCcw, Search,
    Calendar, TrendingUp, Award, Activity, Filter, Download, BarChart3,
    Target, Zap, Eye, EyeOff
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

/**
 * Composant HistoryView amélioré pour l'affichage de l'historique avec analyses et graphiques.
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
    const [selectedTimeRange, setSelectedTimeRange] = useState('30days');
    const [selectedExerciseForGraph, setSelectedExerciseForGraph] = useState(null);
    const [showDeletedOnly, setShowDeletedOnly] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [viewMode, setViewMode] = useState('exercises'); // 'exercises', 'sessions', 'analytics'

    // Plages de temps disponibles
    const timeRanges = [
        { label: '7 jours', value: '7days' },
        { label: '30 jours', value: '30days' },
        { label: '3 mois', value: '90days' },
        { label: '6 mois', value: '180days' },
        { label: 'Tout', value: 'all' }
    ];

    // Traitement des données historiques pour extraire les exercices uniques
    const processedExercises = useMemo(() => {
        const exerciseMap = {};
        const now = new Date();
        const cutoffDate = selectedTimeRange === 'all' ? new Date(0) : new Date(now - parseInt(selectedTimeRange) * 24 * 60 * 60 * 1000);

        historicalData.forEach(session => {
            const sessionDate = session.timestamp;
            if (sessionDate < cutoffDate) return;

            const workoutData = session.workoutData;
            if (!workoutData?.days) return;

            Object.entries(workoutData.days).forEach(([dayName, dayData]) => {
                Object.entries(dayData.categories || {}).forEach(([categoryName, exercises]) => {
                    if (!Array.isArray(exercises)) return;

                    exercises.forEach(exercise => {
                        if (!exercise.id) return;

                        if (!exerciseMap[exercise.id]) {
                            exerciseMap[exercise.id] = {
                                id: exercise.id,
                                name: exercise.name,
                                category: categoryName,
                                dayName: dayName,
                                allSeries: [],
                                sessions: [],
                                isDeleted: exercise.isDeleted,
                                firstSeen: sessionDate,
                                lastSeen: sessionDate,
                                totalVolume: 0,
                                maxWeight: 0,
                                maxReps: 0
                            };
                        }

                        const exerciseData = exerciseMap[exercise.id];
                        exerciseData.isDeleted = exercise.isDeleted; // Dernière valeur connue
                        exerciseData.lastSeen = sessionDate > exerciseData.lastSeen ? sessionDate : exerciseData.lastSeen;

                        // Ajouter la session
                        exerciseData.sessions.push({
                            date: sessionDate,
                            series: exercise.series || [],
                            notes: exercise.notes || ''
                        });

                        // Traiter les séries
                        if (Array.isArray(exercise.series)) {
                            exercise.series.forEach(serie => {
                                const weight = parseFloat(serie.weight) || 0;
                                const reps = parseInt(serie.reps) || 0;
                                const volume = weight * reps;

                                if (weight > 0 && reps > 0) {
                                    exerciseData.allSeries.push({
                                        date: sessionDate,
                                        weight: weight,
                                        reps: reps,
                                        volume: volume
                                    });

                                    exerciseData.totalVolume += volume;
                                    exerciseData.maxWeight = Math.max(exerciseData.maxWeight, weight);
                                    exerciseData.maxReps = Math.max(exerciseData.maxReps, reps);
                                }
                            });
                        }
                    });
                });
            });
        });

        return Object.values(exerciseMap);
    }, [historicalData, selectedTimeRange]);

    // Filtrage des exercices
    const filteredExercises = useMemo(() => {
        return processedExercises.filter(exercise => {
            // Filtre par statut supprimé
            if (showDeletedOnly && !exercise.isDeleted) return false;
            if (!showDeletedOnly && exercise.isDeleted) return false;

            // Filtre par catégorie
            if (selectedCategory !== 'all' && exercise.category !== selectedCategory) return false;

            // Filtre par recherche
            if (searchTerm && !exercise.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            return true;
        }).sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'recent':
                    return new Date(b.lastSeen) - new Date(a.lastSeen);
                case 'volume':
                    return b.totalVolume - a.totalVolume;
                case 'sessions':
                    return b.sessions.length - a.sessions.length;
                default:
                    return 0;
            }
        });
    }, [processedExercises, showDeletedOnly, selectedCategory, searchTerm, sortBy]);

    // Extraction des catégories uniques
    const availableCategories = useMemo(() => {
        const categories = new Set();
        processedExercises.forEach(exercise => categories.add(exercise.category));
        return ['all', ...Array.from(categories)].filter(Boolean);
    }, [processedExercises]);

    // Données pour les graphiques
    const chartData = useMemo(() => {
        if (!selectedExerciseForGraph) return [];

        const exercise = processedExercises.find(ex => ex.id === selectedExerciseForGraph);
        if (!exercise) return [];

        return exercise.allSeries.map((serie, index) => ({
            session: index + 1,
            date: serie.date.toLocaleDateString('fr-FR'),
            weight: serie.weight,
            reps: serie.reps,
            volume: serie.volume
        }));
    }, [selectedExerciseForGraph, processedExercises]);

    // Statistiques globales
    const globalStats = useMemo(() => {
        const activeExercises = processedExercises.filter(ex => !ex.isDeleted);
        const totalSessions = historicalData.filter(session => {
            const now = new Date();
            const cutoffDate = selectedTimeRange === 'all' ? new Date(0) : new Date(now - parseInt(selectedTimeRange) * 24 * 60 * 60 * 1000);
            return session.timestamp >= cutoffDate;
        }).length;

        return {
            totalExercises: activeExercises.length,
            deletedExercises: processedExercises.filter(ex => ex.isDeleted).length,
            totalSessions: totalSessions,
            totalVolume: Math.round(activeExercises.reduce((sum, ex) => sum + ex.totalVolume, 0)),
            avgSessionsPerExercise: activeExercises.length > 0 ? Math.round((activeExercises.reduce((sum, ex) => sum + ex.sessions.length, 0) / activeExercises.length) * 10) / 10 : 0
        };
    }, [processedExercises, historicalData, selectedTimeRange]);

    // Composant pour une carte d'exercice
    const ExerciseCard = ({ exercise }) => {
        const trend = calculateTrend(exercise);
        const daysSinceLastWorkout = Math.floor((new Date() - exercise.lastSeen) / (1000 * 60 * 60 * 24));

        return (
            <div className={`bg-gray-800/50 backdrop-blur-sm border rounded-xl p-6 transition-all duration-300 hover:bg-gray-800/70 hover:scale-[1.02] group ${
                exercise.isDeleted ? 'border-red-500/30 bg-red-900/20' : 'border-gray-700 hover:border-gray-600'
            }`}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-lg font-semibold text-white truncate ${exercise.isDeleted ? 'line-through opacity-60' : ''}`}>
                            {exercise.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full">
                                {exercise.category}
                            </span>
                            <span className="text-sm text-gray-400">
                                {exercise.dayName}
                            </span>
                        </div>
                    </div>

                    {exercise.isDeleted && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            Supprimé
                        </span>
                    )}
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-sm text-gray-400">Sessions</div>
                        <div className="text-xl font-bold text-white">{exercise.sessions.length}</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-sm text-gray-400">Volume total</div>
                        <div className="text-xl font-bold text-white">{Math.round(exercise.totalVolume)}kg</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-sm text-gray-400">Poids max</div>
                        <div className="text-xl font-bold text-white">{exercise.maxWeight}kg</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <div className="text-sm text-gray-400">Reps max</div>
                        <div className="text-xl font-bold text-white">{exercise.maxReps}</div>
                    </div>
                </div>

                {/* Progression */}
                {trend !== 0 && (
                    <div className={`flex items-center gap-2 mb-4 p-2 rounded-lg ${
                        trend > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                        <TrendingUp className={`h-4 w-4 ${trend < 0 ? 'rotate-180' : ''}`} />
                        <span className="text-sm font-medium">
                            {trend > 0 ? 'Progression' : 'Régression'} : {Math.abs(trend)}%
                        </span>
                    </div>
                )}

                {/* Dernière activité */}
               <div className="text-sm text-gray-400 mb-4">
                   Dernière fois: {daysSinceLastWorkout === 0 ? "Aujourd'hui" : `il y a ${daysSinceLastWorkout} jour(s)`}
               </div>

               {/* Actions */}
               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   {exercise.isDeleted ? (
                       <button
                           onClick={() => handleReactivateExercise(exercise.id)}
                           className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                       >
                           <RotateCcw className="h-4 w-4" />
                           Réactiver
                       </button>
                   ) : (
                       <>
                           <button
                               onClick={() => setSelectedExerciseForGraph(exercise.id)}
                               className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                           >
                               <LineChartIcon className="h-4 w-4" />
                               Graphique
                           </button>
                           {isAdvancedMode && (
                               <button
                                   onClick={() => analyzeProgressionWithAI(exercise)}
                                   className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all"
                               >
                                   <Sparkles className="h-4 w-4" />
                                   Analyser
                               </button>
                           )}
                       </>
                   )}
               </div>
           </div>
       );
   };

   const calculateTrend = (exercise) => {
       if (exercise.sessions.length < 3) return 0;
       
       const recentSessions = exercise.sessions.slice(-3);
       const oldSessions = exercise.sessions.slice(-6, -3);
       
       if (oldSessions.length === 0) return 0;

       const recentAvg = recentSessions.reduce((sum, session) => {
           const sessionVolume = session.series.reduce((vol, serie) => {
               return vol + ((parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0));
           }, 0);
           return sum + sessionVolume;
       }, 0) / recentSessions.length;

       const oldAvg = oldSessions.reduce((sum, session) => {
           const sessionVolume = session.series.reduce((vol, serie) => {
               return vol + ((parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0));
           }, 0);
           return sum + sessionVolume;
       }, 0) / oldSessions.length;

       if (oldAvg === 0) return 0;
       return Math.round(((recentAvg - oldAvg) / oldAvg) * 100);
   };

   return (
       <div className="space-y-8">
           {/* Header avec statistiques */}
           <div className="space-y-6">
               <div className="flex items-center justify-between">
                   <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                       <Activity className="h-7 w-7 text-blue-400" />
                       Historique & Analyses
                   </h2>
                   
                   <div className="flex items-center gap-2">
                       {['exercises', 'sessions', 'analytics'].map((mode) => (
                           <button
                               key={mode}
                               onClick={() => setViewMode(mode)}
                               className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                   viewMode === mode
                                       ? 'bg-blue-500 text-white'
                                       : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                               }`}
                           >
                               {mode === 'exercises' && 'Exercices'}
                               {mode === 'sessions' && 'Sessions'}
                               {mode === 'analytics' && 'Analytics'}
                           </button>
                       ))}
                   </div>
               </div>

               {/* Statistiques globales */}
               <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                   <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
                       <div className="flex items-center gap-2 mb-2">
                           <Target className="h-5 w-5 text-blue-400" />
                           <span className="text-sm text-gray-400">Exercices actifs</span>
                       </div>
                       <div className="text-2xl font-bold text-white">{globalStats.totalExercises}</div>
                   </div>

                   <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
                       <div className="flex items-center gap-2 mb-2">
                           <Calendar className="h-5 w-5 text-green-400" />
                           <span className="text-sm text-gray-400">Sessions</span>
                       </div>
                       <div className="text-2xl font-bold text-white">{globalStats.totalSessions}</div>
                   </div>

                   <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
                       <div className="flex items-center gap-2 mb-2">
                           <Zap className="h-5 w-5 text-yellow-400" />
                           <span className="text-sm text-gray-400">Volume total</span>
                       </div>
                       <div className="text-2xl font-bold text-white">{globalStats.totalVolume}kg</div>
                   </div>

                   <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
                       <div className="flex items-center gap-2 mb-2">
                           <Award className="h-5 w-5 text-purple-400" />
                           <span className="text-sm text-gray-400">Moy/exercice</span>
                       </div>
                       <div className="text-2xl font-bold text-white">{globalStats.avgSessionsPerExercise}</div>
                   </div>

                   <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
                       <div className="flex items-center gap-2 mb-2">
                           <Eye className="h-5 w-5 text-red-400" />
                           <span className="text-sm text-gray-400">Supprimés</span>
                       </div>
                       <div className="text-2xl font-bold text-white">{globalStats.deletedExercises}</div>
                   </div>
               </div>
           </div>

           {/* Filtres et recherche */}
           <div className="space-y-4">
               <div className="flex flex-wrap gap-3">
                   {timeRanges.map((range) => (
                       <button
                           key={range.value}
                           onClick={() => setSelectedTimeRange(range.value)}
                           className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                               selectedTimeRange === range.value
                                   ? 'bg-blue-500 text-white'
                                   : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                           }`}
                       >
                           {range.label}
                       </button>
                   ))}
               </div>

               <div className="flex flex-wrap gap-3">
                   <div className="relative flex-1 min-w-[200px]">
                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                       <input
                           type="text"
                           placeholder="Rechercher un exercice..."
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                       />
                   </div>

                   <select
                       value={selectedCategory}
                       onChange={(e) => setSelectedCategory(e.target.value)}
                       className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                       {availableCategories.map((category) => (
                           <option key={category} value={category}>
                               {category === 'all' ? 'Toutes catégories' : category}
                           </option>
                       ))}
                   </select>

                   <select
                       value={sortBy}
                       onChange={(e) => setSortBy(e.target.value)}
                       className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                   >
                       <option value="name">Nom</option>
                       <option value="recent">Plus récent</option>
                       <option value="volume">Volume</option>
                       <option value="sessions">Sessions</option>
                   </select>

                   <button
                       onClick={() => setShowDeletedOnly(!showDeletedOnly)}
                       className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                           showDeletedOnly
                               ? 'bg-red-500 text-white'
                               : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                       }`}
                   >
                       {showDeletedOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                       {showDeletedOnly ? 'Masquer supprimés' : 'Voir supprimés'}
                   </button>
               </div>
           </div>

           {/* Contenu principal selon le mode */}
           {viewMode === 'exercises' && (
               <div className="space-y-6">
                   {filteredExercises.length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {filteredExercises.map((exercise) => (
                               <ExerciseCard key={exercise.id} exercise={exercise} />
                           ))}
                       </div>
                   ) : (
                       <div className="text-center py-12">
                           <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4 opacity-50" />
                           <p className="text-gray-400 text-lg">Aucun exercice trouvé</p>
                           <p className="text-gray-500 text-sm mt-2">Modifiez vos filtres ou ajoutez des exercices</p>
                       </div>
                   )}
               </div>
           )}

           {/* Modale graphique d'exercice */}
           {selectedExerciseForGraph && (
               <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                   <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-700 max-h-[90vh] overflow-y-auto">
                       <div className="p-6">
                           <div className="flex items-center justify-between mb-6">
                               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                   <LineChartIcon className="h-5 w-5 text-blue-400" />
                                   Progression - {processedExercises.find(ex => ex.id === selectedExerciseForGraph)?.name}
                               </h3>
                               <button
                                   onClick={() => setSelectedExerciseForGraph(null)}
                                   className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                               >
                                   ✕
                               </button>
                           </div>

                           {chartData.length > 0 ? (
                               <div className="space-y-6">
                                   <div className="h-80">
                                       <ResponsiveContainer width="100%" height="100%">
                                           <LineChart data={chartData}>
                                               <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                               <XAxis 
                                                   dataKey="session" 
                                                   stroke="#9CA3AF"
                                                   label={{ value: 'Session', position: 'insideBottom', offset: -5 }}
                                               />
                                               <YAxis stroke="#9CA3AF" />
                                               <Tooltip 
                                                   contentStyle={{ 
                                                       backgroundColor: '#1F2937', 
                                                       border: '1px solid #374151',
                                                       borderRadius: '8px',
                                                       color: '#F3F4F6'
                                                   }}
                                               />
                                               <Legend />
                                               <Line 
                                                   type="monotone" 
                                                   dataKey="weight" 
                                                   stroke="#3B82F6" 
                                                   strokeWidth={2}
                                                   name="Poids (kg)"
                                                   dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                                               />
                                               <Line 
                                                   type="monotone" 
                                                   dataKey="reps" 
                                                   stroke="#10B981" 
                                                   strokeWidth={2}
                                                   name="Répétitions"
                                                   dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                                               />
                                               <Line 
                                                   type="monotone" 
                                                   dataKey="volume" 
                                                   stroke="#F59E0B" 
                                                   strokeWidth={2}
                                                   name="Volume (kg)"
                                                   dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                                               />
                                           </LineChart>
                                       </ResponsiveContainer>
                                   </div>

                                   <div className="grid grid-cols-3 gap-4">
                                       <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 text-center">
                                           <div className="text-blue-400 text-sm mb-1">Poids moyen</div>
                                           <div className="text-white text-xl font-bold">
                                               {Math.round(chartData.reduce((sum, d) => sum + d.weight, 0) / chartData.length * 10) / 10}kg
                                           </div>
                                       </div>
                                       <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 text-center">
                                           <div className="text-green-400 text-sm mb-1">Reps moyennes</div>
                                           <div className="text-white text-xl font-bold">
                                               {Math.round(chartData.reduce((sum, d) => sum + d.reps, 0) / chartData.length * 10) / 10}
                                           </div>
                                       </div>
                                       <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 text-center">
                                           <div className="text-yellow-400 text-sm mb-1">Volume moyen</div>
                                           <div className="text-white text-xl font-bold">
                                               {Math.round(chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length)}kg
                                           </div>
                                       </div>
                                   </div>
                               </div>
                           ) : (
                               <div className="text-center py-8">
                                   <p className="text-gray-400">Pas assez de données pour générer un graphique</p>
                               </div>
                           )}

                           <div className="mt-6">
                               <button
                                   onClick={() => setSelectedExerciseForGraph(null)}
                                   className="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all"
                               >
                                   Fermer
                               </button>
                           </div>
                       </div>
                   </div>
               </div>
           )}
       </div>
   );
};

export default HistoryView;