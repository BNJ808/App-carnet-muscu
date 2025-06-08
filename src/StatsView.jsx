import React, { useMemo } from 'react';
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
    globalNotes, // Nouvelle prop pour les notes globales
    setGlobalNotes, // Nouvelle prop pour mettre à jour les notes globales
    analyzeGlobalStatsWithAI, // Nouvelle prop pour l'analyse IA globale
    aiAnalysisLoading // État de chargement de l'IA
}) => {
    // Couleurs pour les graphiques
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];

    // Calcul des statistiques principales
    const mainStats = useMemo(() => {
        let totalExercises = 0;
        let totalSeries = 0;
        let totalVolume = 0;
        let totalSessions = historicalData.length;
        let thisWeekSessions = 0;

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Compter les exercices actifs et les séries complétées
        Object.values(workouts.days || {}).forEach(day => {
            Object.values(day.categories || {}).forEach(exercises => {
                if (Array.isArray(exercises)) {
                    const activeExercises = exercises.filter(ex => !ex.isDeleted);
                    totalExercises += activeExercises.length;
                    activeExercises.forEach(ex => {
                        totalSeries += ex.series.length;
                        ex.series.forEach(s => {
                            totalVolume += (s.weight || 0) * (s.reps || 0);
                        });
                    });
                }
            });
        });

        // Calculer les sessions de la semaine en cours
        historicalData.forEach(session => {
            const sessionDate = session.timestamp?.toDate ? session.timestamp.toDate() : new Date(session.timestamp);
            if (sessionDate >= oneWeekAgo && sessionDate <= now) {
                thisWeekSessions++;
            }
        });


        return {
            totalExercises,
            totalSeries,
            totalVolume: parseFloat(totalVolume.toFixed(2)),
            totalSessions,
            thisWeekSessions
        };
    }, [workouts, historicalData]);

    // Données pour le graphique des catégories musculaires (Pie Chart)
    const categoryData = useMemo(() => {
        const categoryVolumes = {};
        historicalData.forEach(session => {
            session.exercises.forEach(exercise => {
                const category = exercise.category || 'Non catégorisé';
                const exerciseVolume = exercise.series.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
                categoryVolumes[category] = (categoryVolumes[category] || 0) + exerciseVolume;
            });
        });
        return Object.entries(categoryVolumes)
            .map(([name, volume]) => ({ name, value: parseFloat(volume.toFixed(2)) }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value); // Trie par volume décroissant
    }, [historicalData]);

    // Données pour le graphique de progression du volume hebdomadaire
    const weeklyVolumeData = useMemo(() => {
        const volumesByWeek = {}; // Key: YYYY-WW (Year-Week number)

        historicalData.forEach(session => {
            const sessionDate = session.timestamp?.toDate ? session.timestamp.toDate() : new Date(session.timestamp);
            const year = sessionDate.getFullYear();
            const weekNumber = getWeekNumber(sessionDate); // Custom function needed to get week number

            const weekKey = `${year}-${String(weekNumber).padStart(2, '0')}`;
            const sessionVolume = session.exercises.reduce((sum, ex) => sum + ex.series.reduce((sSum, s) => sSum + (s.reps || 0) * (s.weight || 0), 0), 0);

            volumesByWeek[weekKey] = (volumesByWeek[weekKey] || 0) + sessionVolume;
        });

        const sortedWeeks = Object.keys(volumesByWeek).sort();
        return sortedWeeks.map(weekKey => ({
            week: weekKey,
            volume: parseFloat(volumesByWeek[weekKey].toFixed(2))
        }));
    }, [historicalData]);

    // Helper function to get week number (ISO week date system)
    const getWeekNumber = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    // Données pour le graphique des top exercices (Bar Chart)
    const topExercisesData = useMemo(() => {
        const exerciseVolumes = {};
        historicalData.forEach(session => {
            session.exercises.forEach(exercise => {
                const exerciseName = exercise.name;
                const exerciseVolume = exercise.series.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
                exerciseVolumes[exerciseName] = (exerciseVolumes[exerciseName] || 0) + exerciseVolume;
            });
        });
        return Object.entries(exerciseVolumes)
            .map(([name, volume]) => ({ name, volume: parseFloat(volume.toFixed(2)) }))
            .filter(item => item.volume > 0)
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5); // Top 5 exercices
    }, [historicalData]);


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                <BarChart3 className="h-7 w-7" />
                Statistiques Détaillées
            </h2>

            {/* Statistiques principales */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4">Aperçu Général</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-2xl font-bold text-blue-400">{mainStats.totalSessions}</p>
                        <p className="text-sm text-gray-300">Séances enregistrées</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-2xl font-bold text-green-400">{mainStats.totalExercises}</p>
                        <p className="text-sm text-gray-300">Exercices actifs</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-2xl font-bold text-purple-400">{mainStats.totalSeries}</p>
                        <p className="text-sm text-gray-300">Séries réalisées</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                        <p className="text-2xl font-bold text-yellow-400">{mainStats.totalVolume} kg</p>
                        <p className="text-sm text-gray-300">Volume total</p>
                    </div>
                </div>
                {mainStats.thisWeekSessions > 0 && (
                    <p className="text-sm text-gray-400 text-center mt-4">
                        Vous avez réalisé {mainStats.thisWeekSessions} séances cette semaine !
                    </p>
                )}
            </div>

            {/* Analyse IA et Notes globales */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <h3 className="text-xl font-semibold text-purple-400 mb-4 flex items-center gap-2">
                    <Sparkles className="h-6 w-6" />
                    Analyse IA & Notes Générales
                </h3>
                <button
                    onClick={analyzeGlobalStatsWithAI}
                    disabled={aiAnalysisLoading}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                >
                    {aiAnalysisLoading ? (
                        <>
                            <Activity className="h-5 w-5 animate-spin" />
                            Analyse en cours...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-5 w-5" />
                            Analyser mes stats avec l'IA
                        </>
                    )}
                </button>
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600 min-h-[100px]">
                    <h4 className="text-md font-medium text-white mb-2">Notes & Insights IA :</h4>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{globalNotes || "Cliquez sur 'Analyser mes stats avec l'IA' pour obtenir un aperçu de votre progression et des conseils."}</p>
                </div>
            </div>

            {/* Graphique de la répartition par groupe musculaire */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <PieChartIcon className="h-6 w-6 text-orange-400" />
                    Répartition par Groupe Musculaire
                </h3>
                {categoryData.length > 0 ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4a5568', borderRadius: '8px' }}
                                    itemStyle={{ color: '#cbd5e0' }}
                                    formatter={(value, name) => [`${value} kg`, name]}
                                />
                                <Legend wrapperStyle={{ color: '#cbd5e0', paddingTop: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center text-gray-400 p-8">
                        <PieChartIcon className="h-10 w-10 mx-auto mb-3" />
                        <p>Pas de données pour la répartition musculaire.</p>
                        <p className="text-sm text-gray-500">Enregistrez des exercices avec leurs catégories pour voir ce graphique.</p>
                    </div>
                )}
            </div>

            {/* Graphique de progression du volume hebdomadaire */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <LineChartIcon className="h-6 w-6 text-teal-400" />
                    Volume Hebdomadaire
                </h3>
                {weeklyVolumeData.length > 0 ? (
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={weeklyVolumeData}
                                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                <XAxis dataKey="week" stroke="#cbd5e0" />
                                <YAxis stroke="#cbd5e0" label={{ value: 'Volume (kg)', angle: -90, position: 'insideLeft', fill: '#cbd5e0' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4a5568', borderRadius: '8px' }}
                                    labelStyle={{ color: '#cbd5e0' }}
                                    formatter={(value, name) => [`${value} kg`, 'Volume']}
                                />
                                <Legend wrapperStyle={{ color: '#cbd5e0', paddingTop: '10px' }} />
                                <Line type="monotone" dataKey="volume" stroke="#06b6d4" activeDot={{ r: 8 }} name="Volume (kg)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center text-gray-400 p-8">
                        <Calendar className="h-10 w-10 mx-auto mb-3" />
                        <p>Pas de données de volume hebdomadaire.</p>
                        <p className="text-sm text-gray-500">Enregistrez des séances pour voir votre progression de volume ici.</p>
                    </div>
                )}
            </div>

            {/* Graphique des top exercices par volume */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Award className="h-6 w-6 text-orange-400" />
                    Top 5 Exercices (Volume)
                </h3>
                <div className="h-72">
                    {topExercisesData.length > 0 ? (
                        <div className="h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={topExercisesData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis type="number" stroke="#cbd5e0" label={{ value: 'Volume (kg)', position: 'insideBottom', offset: -5, fill: '#cbd5e0' }} />
                                    <YAxis type="category" dataKey="name" stroke="#cbd5e0" width={100} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4a5568', borderRadius: '8px' }}
                                        labelStyle={{ color: '#cbd5e0' }}
                                        formatter={(value, name, props) => [`${value} kg`, 'Volume']}
                                    />
                                    <Legend wrapperStyle={{ color: '#cbd5e0', paddingTop: '10px' }} />
                                    <Bar dataKey="volume" fill="#f59e0b" name="Volume (kg)" radius={[0, 10, 10, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 p-8">
                            <Award className="h-10 w-10 mx-auto mb-3" />
                            <p>Aucune donnée pour les top exercices disponible.</p>
                            <p className="text-sm text-gray-500">Enregistrez plus d'exercices pour voir vos meilleurs performers !</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatsView;