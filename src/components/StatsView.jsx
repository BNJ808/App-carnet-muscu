// StatsView.jsx
import React, { useMemo, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Activity, Calendar, Target, TrendingUp, Award, Zap,
    BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, NotebookText, Sparkles, Dumbbell, RotateCcw
} from 'lucide-react';

/**
 * Composant StatsView pour afficher les statistiques détaillées.
 * @param {object} props - Les props du composant.
 * @param {object} props.workouts - L'objet des entraînements (pour les notes globales).
 * @param {Array<object>} props.historicalData - Les données historiques des séances.
 * @param {object} props.personalBests - Les records personnels.
 * @param {function} props.formatDate - Fonction pour formater une date.
 * @param {string} props.globalNotes - Les notes globales de l'utilisateur.
 * @param {function} props.setGlobalNotes - Fonction pour mettre à jour les notes globales.
 * @param {function} props.analyzeGlobalStatsWithAI - Fonction pour analyser les stats globales avec l'IA.
 * @param {boolean} props.aiAnalysisLoading - État de chargement de l'analyse AI.
 * @param {function} props.onGenerateAISuggestions - Fonction pour générer des suggestions AI.
 * @param {Array<string>} props.aiSuggestions - Les suggestions générées par l'IA.
 * @param {boolean} props.isLoadingAI - État de chargement de l'IA (global).
 * @param {string} props.progressionAnalysisContent - Contenu de l'analyse de progression (peut être utilisé si la vue Stats l'inclut).
 * @param {function} props.getWorkoutStats - Fonction pour obtenir les statistiques globales d'entraînement.
 * @param {function} props.getExerciseVolumeData - Fonction pour obtenir les données de volume par exercice.
 * @param {function} props.getDailyVolumeData - Fonction pour obtenir les données de volume quotidien.
 * @param {function} props.getExerciseFrequencyData - Fonction pour obtenir les données de fréquence par exercice.
 * @param {function} props.showToast - Fonction pour afficher des toasts.
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

    // Utilisation de useMemo pour les calculs coûteux
    const workoutStats = useMemo(() => getWorkoutStats(), [getWorkoutStats]);
    const exerciseVolumeData = useMemo(() => getExerciseVolumeData(), [getExerciseVolumeData]);
    const dailyVolumeData = useMemo(() => getDailyVolumeData(), [getDailyVolumeData]);
    const exerciseFrequencyData = useMemo(() => getExerciseFrequencyData(), [getExerciseFrequencyData]);

    const hasData = safeHistoricalData.length > 0;

    // Couleurs pour les graphiques (exemple)
    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FF8042', '#AF19FF'];

    // Fonction pour obtenir le 1RM estimé (simplifié pour les stats)
    const getEstimated1RM = useCallback((reps, weight) => {
        if (reps === 0 || weight === 0) return 0;
        // Brzycki formula
        return Math.round(weight * (36 / (37 - reps)));
    }, []);

    // Préparer les données pour les records personnels pour un affichage plus structuré
    const formattedPersonalBests = useMemo(() => {
        return Object.entries(personalBests).map(([exerciseName, pb]) => {
            let pbType = '';
            let pbValue = '';
            if (pb.maxWeight > 0 && pb.maxReps > 0) {
                pbType = 'Poids Max';
                pbValue = `${pb.maxWeight} kg x ${pb.maxReps} reps`;
            } else if (pb.maxRepsForWeight > 0 && pb.weightForMaxReps > 0) {
                pbType = 'Reps Max';
                pbValue = `${pb.maxRepsForWeight} reps à ${pb.weightForMaxReps} kg`;
            } else {
                return null; // Skip if no meaningful PB
            }

            const estimated1RM = getEstimated1RM(pb.maxReps, pb.maxWeight);

            return {
                exerciseName,
                pbType,
                pbValue,
                estimated1RM: estimated1RM > 0 ? `${estimated1RM} kg` : 'N/A',
                date: formatDate(pb.date)
            };
        }).filter(Boolean); // Filter out nulls
    }, [personalBests, formatDate, getEstimated1RM]);


    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-400" /> Vos Statistiques
            </h2>

            {!hasData ? (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700 shadow-xl">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Aucune donnée d'entraînement disponible.</p>
                    <p className="text-sm text-gray-500">Commencez à enregistrer vos séances pour voir vos statistiques ici !</p>
                </div>
            ) : (
                <>
                    {/* Statistiques générales */}
                    <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Activity className="h-6 w-6 text-green-400" /> Aperçu Général
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
                            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                <p className="text-sm text-gray-400">Séances Terminées</p>
                                <p className="text-2xl font-semibold text-white">{workoutStats.totalWorkouts}</p>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                <p className="text-sm text-gray-400">Exercices Uniques</p>
                                <p className="text-2xl font-semibold text-white">{workoutStats.totalExercises}</p>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                <p className="text-sm text-gray-400">Volume Total (kg)</p>
                                <p className="text-2xl font-semibold text-white">{workoutStats.totalVolume.toFixed(0)}</p>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                <p className="text-sm text-gray-400">Volume Moyen / Séance (kg)</p>
                                <p className="text-2xl font-semibold text-white">{workoutStats.averageVolumePerWorkout.toFixed(0)}</p>
                            </div>
                            <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                <p className="text-sm text-gray-400">Durée Moyenne / Séance</p>
                                <p className="text-2xl font-semibold text-white">
                                    {workoutStats.averageDuration > 0 ? `${workoutStats.averageDuration.toFixed(0)} min` : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Notes Globales */}
                    <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <NotebookText className="h-6 w-6 text-blue-400" /> Mes Notes Globales
                        </h3>
                        <textarea
                            className="w-full bg-gray-700 text-white rounded-lg p-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                            placeholder="Écrivez ici vos objectifs à long terme, réflexions générales sur l'entraînement, etc."
                            value={globalNotes}
                            onChange={(e) => setGlobalNotes(e.target.value)}
                        />
                    </div>

                    {/* Analyse AI des statistiques globales */}
                    <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-yellow-400" /> Analyse AI & Suggestions
                        </h3>
                        <button
                            onClick={onGenerateAISuggestions}
                            disabled={isLoadingAI}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoadingAI ? (
                                <>
                                    <RotateCcw className="h-5 w-5 animate-spin" />
                                    Génération en cours...
                                </>
                            ) : (
                                <>
                                    <Zap className="h-5 w-5" />
                                    Obtenir des suggestions AI
                                </>
                            )}
                        </button>
                    </div>

                    {/* Suggestions IA (si disponibles) */}
                    {aiSuggestions && aiSuggestions.length > 0 && (
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl mb-6">
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

                    {/* Graphique de Volume Quotidien */}
                    {dailyVolumeData.length > 0 && (
                        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700 shadow-xl">
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                <LineChartIcon className="h-6 w-6 text-cyan-400" /> Volume Quotidien
                            </h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={dailyVolumeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        stroke="#999"
                                        tick={{ fontSize: 12 }}
                                        minTickGap={30}
                                    />
                                    <YAxis stroke="#999" tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        labelFormatter={formatDate}
                                        formatter={(value) => [`${value.toFixed(0)} kg`, 'Volume']}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="volume" stroke="#00C49F" strokeWidth={2} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-gray-400 mt-2 text-center">Volume total d'entraînement par jour.</p>
                        </div>
                    )}

                    {/* Graphique de Volume par Exercice (Barres) */}
                    {exerciseVolumeData.length > 0 && (
                        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700 shadow-xl">
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                <BarChart3 className="h-6 w-6 text-orange-400" /> Volume par Exercice
                            </h3>
                            <ResponsiveContainer width="100%" height={Math.max(300, exerciseVolumeData.length * 50)}>
                                <BarChart
                                    data={exerciseVolumeData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                    <XAxis type="number" stroke="#999" tick={{ fontSize: 12 }} />
                                    <YAxis type="category" dataKey="name" stroke="#999" tick={{ fontSize: 12 }} width={100} />
                                    <Tooltip formatter={(value) => [`${value.toFixed(0)} kg`, 'Volume']} />
                                    <Legend />
                                    <Bar dataKey="volume" fill="#ff7300" />
                                </BarChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-gray-400 mt-2 text-center">Volume total accumulé par exercice.</p>
                        </div>
                    )}

                    {/* Graphique de Fréquence par Exercice (Pie Chart si pertinent, sinon Barres) */}
                    {exerciseFrequencyData.length > 0 && (
                        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700 shadow-xl">
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                                <PieChartIcon className="h-6 w-6 text-pink-400" /> Fréquence des Exercices
                            </h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={exerciseFrequencyData}
                                        dataKey="count"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        fill="#8884d8"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    >
                                        {exerciseFrequencyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => [`${value} séances`, 'Fréquence']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-gray-400 mt-2 text-center">Répartition de la fréquence de vos exercices.</p>
                        </div>
                    )}

                    {/* Records Personnels */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-xl">
                        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Award className="h-6 w-6 text-yellow-400" /> Vos Records Personnels
                        </h3>
                        {formattedPersonalBests.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {formattedPersonalBests.map((pb, index) => (
                                    <div key={index} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                        <p className="text-lg font-semibold text-blue-300 mb-1">{pb.exerciseName}</p>
                                        <p className="text-white">
                                            <span className="font-medium">{pb.pbType}:</span> {pb.pbValue}
                                        </p>
                                        <p className="text-gray-300 text-sm">~1RM estimé: {pb.estimated1RM}</p>
                                        <p className="text-gray-400 text-xs mt-1">Date: {pb.date}</p>
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
                </>
            )}
        </div>
    );
};

export default StatsView;