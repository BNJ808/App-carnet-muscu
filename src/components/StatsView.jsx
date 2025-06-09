import React, { useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Activity, Calendar, Target, TrendingUp, Award, Zap,
    BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, NotebookText, Sparkles
} from 'lucide-react';

/**
 * Composant StatsView pour afficher les statistiques détaillées.
 */
const StatsView = ({
    workouts = { days: {}, dayOrder: [] },
    historicalData = [],
    personalBests = {},
    formatDate,
    globalNotes = '',
    setGlobalNotes,
    analyzeGlobalStatsWithAI,
    aiAnalysisLoading = false,
    onGenerateAISuggestions,
    aiSuggestions = [],
    isLoadingAI = false,
    progressionAnalysisContent = '',
    getWorkoutStats
}) => {
    // Assurer que les données sont sûres
    const safeHistoricalData = Array.isArray(historicalData) ? historicalData : [];
    const safeWorkouts = workouts || { days: {}, dayOrder: [] };
    const safePersonalBests = personalBests || {};

    // Couleurs pour les graphiques
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#A855F7'];

    // Calcul des statistiques principales (utiliser useMemo pour optimiser)
    const mainStats = useMemo(() => {
        // Use the passed getWorkoutStats function
        return getWorkoutStats(safeHistoricalData);
    }, [safeHistoricalData, getWorkoutStats]);


    // Données pour le graphique de volume par jour (exemple)
    const volumePerDayData = useMemo(() => {
        const dataMap = new Map();
        safeHistoricalData.forEach(session => {
            const date = formatDate(session.date); // Assurez-vous que formatDate renvoie un format de date comparable (ex: YYYY-MM-DD)
            const sessionVolume = session.exercises.reduce((sum, exercise) =>
                sum + exercise.series.reduce((exSum, serie) => exSum + (serie.weight * serie.reps || 0), 0)
                , 0);
            dataMap.set(date, (dataMap.get(date) || 0) + sessionVolume);
        });

        // Convertir la map en tableau et trier par date
        return Array.from(dataMap.entries())
            .map(([date, volume]) => ({ date, volume }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [safeHistoricalData, formatDate]);


    // Effet pour déclencher l'analyse IA si nécessaire
    useEffect(() => {
        // Logique pour déclencher analyzeGlobalStatsWithAI
        // ...
    }, []);


    return (
        <div className="p-4 sm:p-6 pb-20 max-w-2xl mx-auto"> {/* MODIFIED: Added pb-20 for mobile padding */}
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <BarChart3 className="h-7 w-7 text-purple-400" />
                Vos Statistiques
            </h2>

            {/* Statistiques principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                    <BarChart3 className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-white">{mainStats.totalSessions}</p>
                    <p className="text-gray-400">Séances complétées</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                    <Activity className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-white">{mainStats.totalExercises}</p>
                    <p className="text-gray-400">Exercices réalisés</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                    <Target className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-white">{mainStats.totalSeries}</p>
                    <p className="text-gray-400">Séries effectuées</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                    <TrendingUp className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-white">
                        {mainStats.totalVolume.toLocaleString()}
                        <span className="text-xl">kg</span>
                    </p>
                    <p className="text-gray-400">Volume Total</p>
                </div>
            </div>

            {/* Records personnels (déjà bien stylisé) */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-400" />
                    Vos Records Personnels
                </h3>
                {Object.keys(safePersonalBests).length === 0 ? (
                    <p className="text-gray-400 text-sm">
                        Aucun record personnel enregistré. Commencez à enregistrer vos séries pour les voir ici !
                    </p>
                ) : (
                    <div className="space-y-3">
                        {Object.entries(safePersonalBests).map(([exerciseName, pb]) => (
                            <div key={exerciseName} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600 flex justify-between items-center">
                                <div>
                                    <p className="text-white font-medium">{exerciseName}</p>
                                    <p className="text-gray-300 text-sm">{pb.weight} kg x {pb.reps} reps</p>
                                </div>
                                <p className="text-gray-400 text-xs">
                                    {formatDate(pb.date)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Graphique de Volume par Jour */}
            {volumePerDayData.length > 1 && ( // Afficher seulement s'il y a plus d'un point
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <LineChartIcon className="h-5 w-5 text-blue-400" />
                        Volume par Jour
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={volumePerDayData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                            <XAxis
                                dataKey="date"
                                stroke="#9CA3AF"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                                angle={-30}
                                textAnchor="end"
                                height={60} // Augmente la hauteur pour éviter le chevauchement
                            />
                            <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px' }}
                                itemStyle={{ color: '#E5E7EB' }}
                                labelStyle={{ color: '#D1D5DB' }}
                                formatter={(value) => `${value.toLocaleString()} kg`}
                            />
                            <Line type="monotone" dataKey="volume" stroke="#3B82F6" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                    <p className="text-gray-500 text-center mt-2 text-sm">Volume total en kilogrammes par jour.</p>
                </div>
            )}

            {/* Graphique des exercices les plus fréquents */}
            {mainStats.topExercises.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-green-400" />
                        Exercices les plus Fréquents
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={mainStats.topExercises} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                            <XAxis
                                dataKey="name"
                                stroke="#9CA3AF"
                                tick={{ fontSize: 10 }}
                                interval={0} // Important pour afficher toutes les barres sur mobile
                                angle={-30}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px' }}
                                itemStyle={{ color: '#E5E7EB' }}
                                labelStyle={{ color: '#D1D5DB' }}
                                formatter={(value) => `${value} sessions`}
                            />
                            <Bar dataKey="count" fill="#10B981" />
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="text-gray-500 text-center mt-2 text-sm">Fréquence de réalisation des exercices.</p>
                </div>
            )}

            {/* Graphique de répartition des groupes musculaires (si données disponibles) */}
            {mainStats.topMuscleGroups.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-purple-400" />
                        Volume par Groupe Musculaire
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={mainStats.topMuscleGroups}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {mainStats.topMuscleGroups.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '8px' }}
                                itemStyle={{ color: '#E5E7EB' }}
                                labelStyle={{ color: '#D1D5DB' }}
                                formatter={(value) => `${value.toLocaleString()} kg`}
                            />
                            <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <p className="text-gray-500 text-center mt-2 text-sm">Répartition du volume d'entraînement par groupe musculaire.</p>
                </div>
            )}


            {/* Notes globales (si vous en avez) */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <NotebookText className="h-5 w-5 text-indigo-400" />
                    Notes Générales sur la Progression
                </h3>
                <textarea
                    value={globalNotes}
                    onChange={(e) => setGlobalNotes(e.target.value)}
                    placeholder="Ajoutez ici vos observations générales sur votre progression, vos objectifs futurs, etc."
                    className="w-full h-32 bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
                ></textarea>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={analyzeGlobalStatsWithAI}
                        disabled={aiAnalysisLoading}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {aiAnalysisLoading ? (
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 animate-pulse" /> Analyse en cours...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4" /> Analyser avec IA
                            </span>
                        )}
                    </button>
                    {/* Bouton pour générer des suggestions IA */}
                    <button
                        onClick={onGenerateAISuggestions}
                        disabled={isLoadingAI}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isLoadingAI ? (
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 animate-pulse" /> Génération...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4" /> Suggestions IA
                            </span>
                        )}
                    </button>
                </div>
                {progressionAnalysisContent && (
                    <div className="mt-4 bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <h4 className="font-semibold text-white mb-2 flex items-center gap-1"><Sparkles className="h-4 w-4 text-yellow-400" /> Résultat de l'analyse IA :</h4>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{progressionAnalysisContent}</p>
                    </div>
                )}
            </div>

            {/* Suggestions IA (si disponibles) */}
            {aiSuggestions && aiSuggestions.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-400" />
                        Suggestions IA
                    </h3>
                    <div className="space-y-2">
                        {aiSuggestions.map((suggestion, index) => (
                            <div key={index} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                <p className="text-gray-300 text-sm">{suggestion}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsView;
