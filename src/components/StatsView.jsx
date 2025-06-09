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
    formatDate, // Ensure formatDate is destructured from props
    globalNotes = '',
    setGlobalNotes,
    analyzeGlobalStatsWithAI,
    aiAnalysisLoading = false,
    onGenerateAISuggestions,
    aiSuggestions = [],
    isLoadingAI = false,
    progressionAnalysisContent = '', // Renamed from showProgressionGraphForExercise to hold the analysis text
    getWorkoutStats, // Now receives the function from App.jsx
    getExerciseVolumeData, // Data prepared in App.jsx
    getDailyVolumeData,     // Data prepared in App.jsx
    getExerciseFrequencyData, // Data prepared in App.jsx
    showToast // Pass showToast for local messages if needed
}) => {
    // Assurer que les données sont sûres
    const safeHistoricalData = Array.isArray(historicalData) ? historicalData : [];
    const safeWorkouts = workouts || { days: {}, dayOrder: [] };
    const safePersonalBests = personalBests || {};

    // Couleurs pour les graphiques
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#A855F7', '#D946EF', '#6EE7B7'];

    // Calcul des statistiques clés (utilisez la fonction passée par App.jsx)
    const stats = useMemo(() => {
        return getWorkoutStats(safeHistoricalData, safeWorkouts);
    }, [safeHistoricalData, safeWorkouts, getWorkoutStats]);

    // Validation des données pour les graphiques
    const hasExerciseVolumeData = getExerciseVolumeData && getExerciseVolumeData.length > 0;
    const hasDailyVolumeData = getDailyVolumeData && getDailyVolumeData.length > 0;
    const hasExerciseFrequencyData = getExerciseFrequencyData && getExerciseFrequencyData.length > 0;

    // Effect pour vérifier si des données existent pour les stats
    useEffect(() => {
        if (safeHistoricalData.length === 0) {
            console.log("Pas de données historiques pour les statistiques.");
            // showToast("Aucune donnée historique trouvée pour les statistiques. Entraînez-vous d'abord !", "info");
        }
    }, [safeHistoricalData, showToast]);

    const renderNoDataMessage = (title) => (
        <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700 mt-4">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">
                Aucune donnée disponible pour "{title}"
            </h3>
            <p className="text-gray-400 text-sm">
                Enregistrez des entraînements pour voir vos statistiques ici.
            </p>
        </div>
    );

    return (
        <div className="p-4 bg-gray-900 min-h-screen text-gray-100 font-sans">
            <h1 className="text-3xl font-extrabold text-white mb-6 text-center">Vos Statistiques</h1>

            {/* Statistiques clés */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-md border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-blue-400" />
                    Aperçu Général
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-gray-400">Total Séances</p>
                        <p className="text-white font-bold text-lg">{stats.totalWorkouts}</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-gray-400">Volume Total (kg)</p>
                        <p className="text-white font-bold text-lg">{stats.totalVolume}</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-gray-400">Ex. le plus Fréquent</p>
                        <p className="text-white font-bold text-lg">{stats.mostFrequentExercise}</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-gray-400">Volume/Séance (kg)</p>
                        <p className="text-white font-bold text-lg">{stats.avgVolumePerWorkout}</p>
                    </div>
                </div>
            </div>

            {/* Records Personnels */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-md border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Award className="h-6 w-6 text-yellow-400" />
                    Meilleurs Records Personnels
                </h2>
                {Object.keys(safePersonalBests).length > 0 ? (
                    <ul className="space-y-3">
                        {Object.entries(safePersonalBests)
                            .sort(([, a], [, b]) => b.weight * b.reps - a.weight * a.reps) // Sort by estimated one-rep max or total volume
                            .map(([exerciseName, pb]) => (
                                <li key={exerciseName} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600 flex justify-between items-center text-sm">
                                    <span className="text-white font-medium">{exerciseName}:</span>
                                    <span className="text-green-400 font-bold">
                                        {pb.weight} kg pour {pb.reps} reps
                                    </span>
                                    <span className="text-gray-400 text-xs">
                                        le {formatDate(pb.date)}
                                    </span>
                                </li>
                            ))}
                    </ul>
                ) : (
                    <div className="text-center py-4">
                        <Target className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-400">Pas encore de records personnels enregistrés.</p>
                        <p className="text-sm text-gray-500 mt-1">Faites de nouvelles performances !</p>
                    </div>
                )}
            </div>

            {/* Graphique Volume par Exercice */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-md border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-purple-400" />
                    Volume total par Exercice
                </h2>
                {hasExerciseVolumeData ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={getExerciseVolumeData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                            <XAxis
                                dataKey="name"
                                stroke="#9CA3AF"
                                tickFormatter={(value) => value.length > 10 ? value.substring(0, 10) + '...' : value}
                                style={{ fontSize: '0.75rem' }}
                            />
                            <YAxis stroke="#9CA3AF" label={{ value: 'Volume (kg)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px', color: '#E5E7EB' }}
                                itemStyle={{ color: '#E5E7EB' }}
                                formatter={(value) => [`${value} kg`, 'Volume']}
                                labelFormatter={(label) => `Exercice: ${label}`}
                            />
                            <Legend />
                            <Bar dataKey="volume" fill="#8B5CF6" name="Volume Total" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : renderNoDataMessage("Volume par Exercice")}
            </div>

            {/* Graphique Volume Quotidien */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-md border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <LineChartIcon className="h-6 w-6 text-green-400" />
                    Volume Quotidien
                </h2>
                {hasDailyVolumeData ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                            data={getDailyVolumeData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                            <XAxis
                                dataKey="date"
                                stroke="#9CA3AF"
                                tickFormatter={(dateStr) => {
                                    const d = new Date(dateStr);
                                    return `${d.getDate()}/${d.getMonth() + 1}`;
                                }}
                                interval="preserveStartEnd"
                                angle={-30}
                                textAnchor="end"
                                height={60}
                                style={{ fontSize: '0.75rem' }}
                            />
                            <YAxis stroke="#9CA3AF" label={{ value: 'Volume (kg)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px', color: '#E5E7EB' }}
                                itemStyle={{ color: '#E5E7EB' }}
                                formatter={(value) => [`${value} kg`, 'Volume']}
                                labelFormatter={(label) => `Date: ${formatDate(label)}`}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="volume" stroke="#10B981" activeDot={{ r: 8 }} name="Volume Total" />
                        </LineChart>
                    </ResponsiveContainer>
                ) : renderNoDataMessage("Volume Quotidien")}
            </div>

            {/* Graphique Fréquence d'Exercices */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-md border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <PieChartIcon className="h-6 w-6 text-red-400" />
                    Fréquence des Exercices
                </h2>
                {hasExerciseFrequencyData ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={getExerciseFrequencyData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                                {getExerciseFrequencyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '8px', color: '#E5E7EB' }}
                                itemStyle={{ color: '#E5E7EB' }}
                                formatter={(value, name) => [`${value} séances`, name]}
                            />
                            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: '20px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : renderNoDataMessage("Fréquence des Exercices")}
            </div>

            {/* Notes globales de l'utilisateur */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-md border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <NotebookText className="h-6 w-6 text-orange-400" />
                    Notes Globales
                </h2>
                <textarea
                    className="w-full h-32 bg-gray-700 text-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all resize-y"
                    placeholder="Écrivez vos notes générales d'entraînement ici..."
                    value={globalNotes}
                    onChange={(e) => setGlobalNotes(e.target.value)}
                />
            </div>

            {/* Section Analyse IA */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-yellow-400" />
                    Analyse IA et Suggestions
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                    Obtenez une analyse de vos statistiques ou des suggestions pour votre programme d'entraînement.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <button
                        onClick={analyzeGlobalStatsWithAI}
                        className={`flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2
                            ${aiAnalysisLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white font-medium`}
                        disabled={aiAnalysisLoading || safeHistoricalData.length === 0}
                    >
                        {aiAnalysisLoading ? (
                            <>
                                <Dumbbell className="h-5 w-5 animate-bounce" />
                                Analyse en cours...
                            </>
                        ) : (
                            <>
                                <BarChart3 className="h-5 w-5" />
                                Analyser mes statistiques
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => onGenerateAISuggestions(safeWorkouts)}
                        className={`flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2
                            ${isLoadingAI ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white font-medium`}
                        disabled={isLoadingAI || safeWorkouts.dayOrder.length === 0}
                    >
                        {isLoadingAI ? (
                            <>
                                <Zap className="h-5 w-5 animate-pulse" />
                                Génération...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5" />
                                Générer des suggestions IA
                            </>
                        )}
                    </button>
                </div>
                {progressionAnalysisContent && ( // Afficher l'analyse globale si elle existe
                    <div className="mt-4 bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <h4 className="font-semibold text-white mb-2 flex items-center gap-1">
                            <Sparkles className="h-4 w-4 text-yellow-400" />
                            Résultat de l'analyse IA :
                        </h4>
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
            {/* Si aucune donnée historique n'est présente du tout */}
            {safeHistoricalData.length === 0 && (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700 mt-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Pas encore de données d'entraînement !</p>
                    <p className="text-sm text-gray-500">
                        Enregistrez des séances dans l'onglet "Entraînement" pour voir vos statistiques et analyses.
                    </p>
                </div>
            )}
        </div>
    );
};

export default StatsView;