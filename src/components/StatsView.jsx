import React, { useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Activity, Calendar, Target, TrendingUp, Award, Zap,
    BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, NotebookText, Sparkles, Dumbbell
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
    getWorkoutStats,
    getExerciseVolumeData,
    getDailyVolumeData,
    getExerciseFrequencyData,
    showToast
}) => {
    // Assurer que les données sont sûres
    const safeHistoricalData = Array.isArray(historicalData) ? historicalData : [];
    const safeWorkouts = workouts || { days: {}, dayOrder: [] };
    // Assurer explicitement que dayOrder est un tableau même si workouts est malformé
    safeWorkouts.dayOrder = Array.isArray(safeWorkouts.dayOrder) ? safeWorkouts.dayOrder : [];
    const safePersonalBests = personalBests || {};

    // Couleurs pour les graphiques
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']; // Ajout de plus de couleurs

    // Données des entraînements pour les statistiques globales
    const globalStats = useMemo(() => {
        // Assurez-vous que safeWorkouts.dayOrder est un tableau avant de l'utiliser
        if (!Array.isArray(safeWorkouts.dayOrder) || !getWorkoutStats) {
            return { totalWorkouts: 0, totalExercises: 0, averageVolume: 0, favoriteExercise: 'N/A' };
        }
        return getWorkoutStats(safeWorkouts.dayOrder, safeWorkouts.days);
    }, [safeWorkouts.dayOrder, safeWorkouts.days, getWorkoutStats]);


    // Calculs memoized pour les données de graphique
    const exerciseVolumeData = useMemo(() => {
        if (!Array.isArray(safeWorkouts.dayOrder) || !safeWorkouts.days || !getExerciseVolumeData) {
            return [];
        }
        return getExerciseVolumeData(safeWorkouts.dayOrder, safeWorkouts.days);
    }, [safeWorkouts.dayOrder, safeWorkouts.days, getExerciseVolumeData]);

    const dailyVolumeData = useMemo(() => {
        if (!Array.isArray(safeHistoricalData) || !getDailyVolumeData) {
            return [];
        }
        return getDailyVolumeData(safeHistoricalData);
    }, [safeHistoricalData, getDailyVolumeData]);

    const exerciseFrequencyData = useMemo(() => {
        if (!Array.isArray(safeHistoricalData) || !getExerciseFrequencyData) {
            return [];
        }
        return getExerciseFrequencyData(safeHistoricalData);
    }, [safeHistoricalData, getExerciseFrequencyData]);

    // Top 5 des exercices par volume
    const top5ExercisesByVolume = useMemo(() => {
        if (!Array.isArray(exerciseVolumeData)) {
            return [];
        }
        return [...exerciseVolumeData]
            .sort((a, b) => b.totalVolume - a.totalVolume)
            .slice(0, 5);
    }, [exerciseVolumeData]);

    // Données pour le PieChart de fréquence des exercices (Top 5)
    const pieChartFrequencyData = useMemo(() => {
        if (!Array.isArray(exerciseFrequencyData)) {
            return [];
        }
        // Trier par fréquence décroissante et prendre les 5 premiers
        const sortedData = [...exerciseFrequencyData].sort((a, b) => b.count - a.count);
        const top5 = sortedData.slice(0, 5);
        const remaining = sortedData.slice(5).reduce((sum, item) => sum + item.count, 0);

        if (remaining > 0) {
            top5.push({ name: 'Autres', count: remaining });
        }
        return top5.filter(item => item.count > 0); // Filtrer les éléments avec une fréquence de 0
    }, [exerciseFrequencyData]);


    const handleAnalyzeGlobalStats = useCallback(() => {
        analyzeGlobalStatsWithAI(globalStats, safeHistoricalData, safePersonalBests, safeWorkouts.days);
    }, [analyzeGlobalStatsWithAI, globalStats, safeHistoricalData, safePersonalBests, safeWorkouts.days]);


    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-gray-900 min-h-screen text-gray-100">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white text-center mb-6">
                <BarChart3 className="inline-block h-8 w-8 sm:h-10 sm:w-10 mr-3 text-purple-400" />
                Vos Statistiques
            </h2>

            {safeHistoricalData.length === 0 && safeWorkouts.dayOrder.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700 mt-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Pas encore de données d'entraînement !</p>
                    <p className="text-sm text-gray-500">
                        Enregistrez des séances dans l'onglet "Entraînement" pour voir vos statistiques et analyses.
                    </p>
                </div>
            ) : (
                <>
                    {/* Section des statistiques globales */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Activity className="h-6 w-6 text-blue-400" />
                            Aperçu Global
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                <p className="text-blue-300 font-semibold text-lg">{globalStats.totalWorkouts}</p>
                                <p className="text-gray-400 text-sm">Séances terminées</p>
                            </div>
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                <p className="text-green-300 font-semibold text-lg">{globalStats.totalExercises}</p>
                                <p className="text-gray-400 text-sm">Exercices uniques</p>
                            </div>
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                <p className="text-purple-300 font-semibold text-lg">{globalStats.averageVolume.toFixed(2)} kg</p>
                                <p className="text-gray-400 text-sm">Volume moyen par séance</p>
                            </div>
                            <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                <p className="text-yellow-300 font-semibold text-lg">{globalStats.favoriteExercise}</p>
                                <p className="text-gray-400 text-sm">Exercice Favori</p>
                            </div>
                        </div>

                        {/* Bouton d'analyse IA globale */}
                        <div className="mt-6 text-center">
                            <button
                                onClick={handleAnalyzeGlobalStats}
                                className={`w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold transition-all duration-300 ease-in-out flex items-center justify-center gap-2
                                    ${aiAnalysisLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg'}`}
                                disabled={aiAnalysisLoading}
                            >
                                {aiAnalysisLoading ? (
                                    <>
                                        <Zap className="h-5 w-5 animate-pulse" /> Analyse en cours...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5" /> Analyser les statistiques globales (IA)
                                    </>
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

                    {/* Graphique du volume quotidien */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <LineChartIcon className="h-6 w-6 text-green-400" />
                            Volume Quotidien (kg)
                        </h3>
                        {dailyVolumeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={dailyVolumeData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        angle={-30}
                                        textAnchor="end"
                                        height={60}
                                        stroke="#9CA3AF"
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                        labelStyle={{ color: '#E5E7EB' }}
                                        itemStyle={{ color: '#D1D5DB' }}
                                        formatter={(value) => [`${value.toFixed(2)} kg`, 'Volume']}
                                        labelFormatter={(label) => `Date: ${formatDate(label)}`}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Line type="monotone" dataKey="totalVolume" stroke="#10B981" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                <p>Pas de données de volume quotidien disponibles.</p>
                            </div>
                        )}
                    </div>

                    {/* Graphique du volume par exercice */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="h-6 w-6 text-yellow-400" />
                            Volume par Exercice (Top 5)
                        </h3>
                        {top5ExercisesByVolume.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={top5ExercisesByVolume}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                                    <XAxis
                                        dataKey="exerciseName"
                                        angle={-30}
                                        textAnchor="end"
                                        height={70}
                                        interval={0}
                                        stroke="#9CA3AF"
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                        labelStyle={{ color: '#E5E7EB' }}
                                        itemStyle={{ color: '#D1D5DB' }}
                                        formatter={(value) => [`${value.toFixed(2)} kg`, 'Volume Total']}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="totalVolume" fill="#F59E0B" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                <p>Pas de données de volume par exercice disponibles.</p>
                            </div>
                        )}
                    </div>

                    {/* Graphique de fréquence des exercices */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <PieChartIcon className="h-6 w-6 text-pink-400" />
                            Fréquence des Exercices (Top 5)
                        </h3>
                        {pieChartFrequencyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={pieChartFrequencyData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="count"
                                        nameKey="name"
                                    >
                                        {pieChartFrequencyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                        labelStyle={{ color: '#E5E7EB' }}
                                        itemStyle={{ color: '#D1D5DB' }}
                                        formatter={(value, name, props) => [`${value} fois`, props.payload.name]}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                <p>Pas de données de fréquence d'exercice disponibles.</p>
                            </div>
                        )}
                    </div>

                    {/* Meilleurs records personnels */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Award className="h-6 w-6 text-orange-400" />
                            Vos Records Personnels
                        </h3>
                        {Object.keys(safePersonalBests).length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(safePersonalBests)
                                    .sort(([nameA, pbA], [nameB, pbB]) => nameA.localeCompare(nameB))
                                    .map(([exerciseName, pb]) => (
                                        <div key={exerciseName} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                            <p className="font-semibold text-lg text-white truncate">{exerciseName}</p>
                                            <p className="text-gray-300 text-sm">
                                                Meilleur: {pb.weight} kg x {pb.reps} reps
                                            </p>
                                            <p className="text-gray-400 text-xs">
                                                Date: {formatDate(pb.date)}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 py-8">
                                <p>Pas de records personnels enregistrés pour le moment.</p>
                                <p className="text-sm">Effectuez des entraînements pour en créer !</p>
                            </div>
                        )}
                    </div>

                    {/* Suggestions IA (si disponibles) */}
                    {aiSuggestions && aiSuggestions.length > 0 && (
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl">
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                <Sparkles className="h-6 w-6 text-yellow-400" />
                                Suggestions IA
                            </h3>
                            <div className="space-y-3">
                                {aiSuggestions.map((suggestion, index) => (
                                    <div key={index} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{suggestion}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StatsView;