// StatsView.jsx
import React, { useMemo, useEffect } from 'react';
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
                            onChange={(e) => setGlobalNotes