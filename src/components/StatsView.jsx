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
    formatDate, // Ensure formatDate is destructured from props
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
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EAB308', '#6D28D9'];

    // Calcul des statistiques globales
    const { totalWorkouts, totalExercises, totalSeries, mostFrequentExercise, mostWeightLiftedExercise, totalWorkoutDuration } = useMemo(() => {
        let totalWorkouts = Object.keys(safeWorkouts.days).length;
        let totalExercises = 0;
        let totalSeries = 0;
        const exerciseCounts = {}; // { exerciseName: count }
        const exerciseTotalWeight = {}; // { exerciseName: totalWeight }
        let totalDuration = 0;

        safeHistoricalData.forEach(session => {
            if (session.duration) {
                totalDuration += session.duration; // Supposons que la durée est en secondes
            }
            session.exercises.forEach(exercise => {
                if (!exercise.isDeleted) {
                    totalExercises++;
                    exerciseCounts[exercise.name] = (exerciseCounts[exercise.name] || 0) + 1;
                    exercise.series.forEach(serie => {
                        totalSeries++;
                        const weight = parseFloat(serie.weight) || 0;
                        const reps = parseInt(serie.reps) || 0;
                        exerciseTotalWeight[exercise.name] = (exerciseTotalWeight[exercise.name] || 0) + (weight * reps);
                    });
                }
            });
        });

        const mostFrequentExercise = Object.keys(exerciseCounts).reduce((a, b) => exerciseCounts[a] > exerciseCounts[b] ? a : b, '');
        const mostWeightLiftedExercise = Object.keys(exerciseTotalWeight).reduce((a, b) => exerciseTotalWeight[a] > exerciseTotalWeight[b] ? a : b, '');

        return {
            totalWorkouts,
            totalExercises,
            totalSeries,
            mostFrequentExercise,
            mostWeightLiftedExercise,
            totalWorkoutDuration: totalDuration
        };
    }, [safeWorkouts, safeHistoricalData]);

    const formatDuration = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return "N/A";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        let result = '';
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0 || hours > 0) result += `${minutes}min `;
        result += `${remainingSeconds}s`;
        return result.trim();
    };

    // Préparation des données pour les graphiques (si nécessaire, réutiliser le formatage de date)
    const chartData = useMemo(() => {
        // Exemple de données pour un graphique de progression de poids (vous devrez l'adapter à vos données réelles)
        // Ici, nous allons simplement simuler ou utiliser des données simplifiées si non fournies
        const exerciseProgressionData = {}; // { exerciseName: [{ date: '...', weight: ..., reps: ... }] }

        safeHistoricalData.forEach(session => {
            session.exercises.forEach(exercise => {
                if (!exercise.isDeleted) {
                    if (!exerciseProgressionData[exercise.name]) {
                        exerciseProgressionData[exercise.name] = [];
                    }
                    exercise.series.forEach(serie => {
                        if (serie.weight > 0) {
                            exerciseProgressionData[exercise.name].push({
                                date: session.date ? formatDate(session.date) : 'N/A', // Use formatDate here
                                weight: serie.weight,
                                reps: serie.reps
                            });
                        }
                    });
                }
            });
        });

        // Pour chaque exercice, trier par date et prendre le max de poids/reps pour chaque date
        const processedChartData = Object.entries(exerciseProgressionData).map(([exerciseName, data]) => {
            const aggregatedData = {};
            data.forEach(item => {
                if (!aggregatedData[item.date] || aggregatedData[item.date].weight < item.weight) {
                    aggregatedData[item.date] = item;
                }
            });
            return {
                name: exerciseName,
                data: Object.values(aggregatedData).sort((a, b) => new Date(a.date) - new Date(b.date))
            };
        });

        return processedChartData;
    }, [safeHistoricalData, formatDate]); // Added formatDate to dependencies


    // Fonction pour générer le contenu du tooltip pour les graphiques
    const customTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-700 text-gray-100 text-sm">
                    <p className="font-semibold mb-1">{`Date: ${label}`}</p>
                    <p className="text-blue-300">{`Poids: ${data.weight} kg`}</p>
                    <p className="text-green-300">{`Reps: ${data.reps}`}</p>
                </div>
            );
        }
        return null;
    };


    useEffect(() => {
        // Placeholder for any effects needed on mount or data change
        // For example, if you need to fetch more detailed stats based on initial data
    }, [workouts, historicalData, personalBests]);

    return (
        <div className="flex-1 overflow-y-auto p-4 pb-20 custom-scrollbar space-y-6">
            {/* Carte de résumé des statistiques */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-5 flex items-center gap-3">
                    <BarChart3 className="h-7 w-7 text-blue-400" />
                    Vue d'ensemble des statistiques
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex flex-col items-center justify-center">
                        <Calendar className="h-8 w-8 text-orange-400 mb-2" />
                        <p className="text-gray-300 text-sm">Séances terminées</p>
                        <p className="text-white text-3xl font-bold">{totalWorkouts}</p>
                    </div>
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex flex-col items-center justify-center">
                        <Activity className="h-8 w-8 text-pink-400 mb-2" />
                        <p className="text-gray-300 text-sm">Exercices réalisés</p>
                        <p className="text-white text-3xl font-bold">{totalExercises}</p>
                    </div>
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex flex-col items-center justify-center">
                        <Target className="h-8 w-8 text-green-400 mb-2" />
                        <p className="text-gray-300 text-sm">Séries complétées</p>
                        <p className="text-white text-3xl font-bold">{totalSeries}</p>
                    </div>
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 flex flex-col items-center justify-center">
                        <Clock className="h-8 w-8 text-indigo-400 mb-2" />
                        <p className="text-gray-300 text-sm">Temps total entraînement</p>
                        <p className="text-white text-3xl font-bold">{formatDuration(totalWorkoutDuration)}</p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 flex items-center">
                        <TrendingUp className="h-5 w-5 text-purple-400 mr-2" />
                        <p className="text-gray-300 text-sm">Exercice le plus fréquent:</p>
                        <p className="text-white ml-2 font-medium">{mostFrequentExercise || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 flex items-center">
                        <Award className="h-5 w-5 text-yellow-400 mr-2" />
                        <p className="text-gray-300 text-sm">Exercice avec le plus de poids soulevé:</p>
                        <p className="text-white ml-2 font-medium">{mostWeightLiftedExercise || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Section des meilleurs personnels */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                    <Award className="h-6 w-6 text-yellow-400" /> Meilleurs Personnels
                </h3>
                {Object.keys(safePersonalBests).length === 0 ? (
                    <p className="text-gray-400 text-center py-4">
                        Aucun record personnel enregistré. Continuez à vous entraîner !
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(safePersonalBests).map(([exerciseName, pb]) => (
                            <div key={exerciseName} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                <h4 className="font-semibold text-blue-300 mb-2">{exerciseName}</h4>
                                <p className="text-white text-lg font-bold">
                                    {pb.weight} kg x {pb.reps} reps
                                </p>
                                <p className="text-gray-400 text-sm mt-1">
                                    Date: {formatDate(pb.date)} {/* Use formatDate here */}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Graphiques de progression (simplifié pour l'exemple) */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                    <LineChartIcon className="h-6 w-6 text-green-400" /> Progression par exercice
                </h3>
                {chartData.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">
                        Pas assez de données pour afficher les graphiques de progression.
                    </p>
                ) : (
                    <div className="space-y-6">
                        {chartData.map((exerciseData, index) => (
                            <div key={exerciseData.name} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                <h4 className="font-semibold text-blue-300 mb-3">{exerciseData.name}</h4>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={exerciseData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                                        <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                        <Tooltip content={customTooltip} />
                                        <Line type="monotone" dataKey="weight" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} name="Poids (kg)" />
                                        <Line type="monotone" dataKey="reps" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} name="Reps" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notes globales et Analyse IA */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                    <NotebookText className="h-6 w-6 text-indigo-400" /> Notes et Analyse
                </h3>
                <div className="mb-4">
                    <label htmlFor="globalNotes" className="block text-gray-300 text-sm font-medium mb-2">Notes globales :</label>
                    <textarea
                        id="globalNotes"
                        className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all custom-scrollbar-light"
                        rows="5"
                        placeholder="Écrivez vos pensées générales sur votre entraînement, vos objectifs, etc."
                        value={globalNotes}
                        onChange={(e) => setGlobalNotes(e.target.value)}
                    ></textarea>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={onGenerateAISuggestions}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoadingAI}
                    >
                        {isLoadingAI ? (
                            <>
                                <Activity className="h-5 w-5 animate-spin" />
                                Analyse en cours...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5" />
                                Générer des suggestions IA
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