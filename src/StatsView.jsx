import React, { useMemo } from 'react';
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
    aiAnalysisLoading = false
}) => {
    // Assurer que les données sont sûres
    const safeHistoricalData = Array.isArray(historicalData) ? historicalData : [];
    const safeWorkouts = workouts || { days: {}, dayOrder: [] };
    const safePersonalBests = personalBests || {};

    // Couleurs pour les graphiques
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];

    // Calcul des statistiques principales
    const mainStats = useMemo(() => {
        let totalExercises = 0;
        let totalSeries = 0;
        let totalVolume = 0;
        let totalSessions = safeHistoricalData.length;
        let thisWeekSessions = 0;

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Compter les exercices actifs et les séries complétées
        Object.values(safeWorkouts.days || {}).forEach(day => {
            if (day?.categories) {
                Object.values(day.categories).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        const activeExercises = exercises.filter(ex => ex && !ex.isDeleted);
                        totalExercises += activeExercises.length;
                        activeExercises.forEach(ex => {
                            if (ex?.series && Array.isArray(ex.series)) {
                                totalSeries += ex.series.length;
                                ex.series.forEach(s => {
                                    if (s && typeof s === 'object') {
                                        totalVolume += (s.weight || 0) * (s.reps || 0);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        // Calculer les sessions de la semaine en cours
        safeHistoricalData.forEach(session => {
            if (session?.timestamp) {
                const sessionDate = session.timestamp?.toDate ? session.timestamp.toDate() : new Date(session.timestamp);
                if (sessionDate >= oneWeekAgo && sessionDate <= now) {
                    thisWeekSessions++;
                }
            }
        });

        return {
            totalExercises,
            totalSeries,
            totalVolume: parseFloat(totalVolume.toFixed(2)),
            totalSessions,
            thisWeekSessions
        };
    }, [safeWorkouts, safeHistoricalData]);

    // Données pour le graphique des catégories musculaires (Pie Chart)
    const categoryData = useMemo(() => {
        const categoryVolumes = {};
        safeHistoricalData.forEach(session => {
            if (session?.exercises && Array.isArray(session.exercises)) {
                session.exercises.forEach(exercise => {
                    if (exercise && exercise.name) {
                        const category = exercise.category || 'Non catégorisé';
                        const exerciseVolume = (exercise?.series || []).reduce((sum, s) => {
                            if (s && typeof s === 'object') {
                                return sum + (s.weight || 0) * (s.reps || 0);
                            }
                            return sum;
                        }, 0);
                        categoryVolumes[category] = (categoryVolumes[category] || 0) + exerciseVolume;
                    }
                });
            }
        });
        return Object.entries(categoryVolumes)
            .map(([name, volume]) => ({ name, value: parseFloat(volume.toFixed(2)) }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [safeHistoricalData]);

    // Données pour le graphique de progression du volume hebdomadaire
    const weeklyVolumeData = useMemo(() => {
        const volumesByWeek = {};

        safeHistoricalData.forEach(session => {
            if (session?.timestamp && session?.exercises) {
                const sessionDate = session.timestamp?.toDate ? session.timestamp.toDate() : new Date(session.timestamp);
                const year = sessionDate.getFullYear();
                const weekNumber = getWeekNumber(sessionDate);

                const weekKey = `${year}-${String(weekNumber).padStart(2, '0')}`;
                const sessionVolume = (session.exercises || []).reduce((sum, ex) => {
                    if (ex && ex.series && Array.isArray(ex.series)) {
                        return sum + ex.series.reduce((sSum, s) => {
                            if (s && typeof s === 'object') {
                                return sSum + (s.reps || 0) * (s.weight || 0);
                            }
                            return sSum;
                        }, 0);
                    }
                    return sum;
                }, 0);

                volumesByWeek[weekKey] = (volumesByWeek[weekKey] || 0) + sessionVolume;
            }
        });

        const sortedWeeks = Object.keys(volumesByWeek).sort();
        return sortedWeeks.map(weekKey => ({
            week: weekKey,
            volume: parseFloat(volumesByWeek[weekKey].toFixed(2))
        }));
    }, [safeHistoricalData]);

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
        safeHistoricalData.forEach(session => {
            if (session?.exercises && Array.isArray(session.exercises)) {
                session.exercises.forEach(exercise => {
                    if (exercise && exercise.name) {
                        const exerciseName = exercise.name;
                        const exerciseVolume = (exercise?.series || []).reduce((sum, s) => {
                            if (s && typeof s === 'object') {
                                return sum + (s.weight || 0) * (s.reps || 0);
                            }
                            return sum;
                        }, 0);
                        exerciseVolumes[exerciseName] = (exerciseVolumes[exerciseName] || 0) + exerciseVolume;
                    }
                });
            }
        });
        return Object.entries(exerciseVolumes)
            .map(([name, volume]) => ({ name, volume: parseFloat(volume.toFixed(2)) }))
            .filter(item => item.volume > 0)
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [safeHistoricalData]);

    const handleAnalyzeStats = () => {
        if (analyzeGlobalStatsWithAI) {
            analyzeGlobalStatsWithAI(mainStats, safePersonalBests, globalNotes);
        }
    };

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
                    onClick={handleAnalyzeStats}
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
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">
                        {globalNotes || "Cliquez sur 'Analyser mes stats avec l'IA' pour obtenir un aperçu de votre progression et des conseils."}
                    </p>
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
                        <div className="text-center text-gray-400 p-8">
                            <PieChartIcon className="h-10 w-10 mx-auto mb-3" />
                            <p className="mb-4">Graphique circulaire des catégories disponible avec les bibliothèques de charts</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {categoryData.map((category, index) => (
                                    <div key={category.name} className="flex items-center gap-2">
                                        <div 
                                            className="w-4 h-4 rounded-full" 
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        ></div>
                                        <span>{category.name}: {category.value} kg</span>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                        <div className="text-center text-gray-400 p-8">
                            <LineChartIcon className="h-10 w-10 mx-auto mb-3" />
                            <p className="mb-4">Graphique linéaire du volume hebdomadaire disponible avec les bibliothèques de charts</p>
                            <div className="text-sm">
                                <p>Données de volume par semaine :</p>
                                <div className="grid grid-cols-1 gap-1 mt-2 max-h-32 overflow-y-auto">
                                    {weeklyVolumeData.map(data => (
                                        <div key={data.week} className="flex justify-between">
                                            <span>Semaine {data.week}:</span>
                                            <span>{data.volume} kg</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
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
                            <div className="text-center text-gray-400 p-8">
                                <Award className="h-10 w-10 mx-auto mb-3" />
                                <p className="mb-4">Graphique en barres des top exercices disponible avec les bibliothèques de charts</p>
                                <div className="text-sm">
                                    <p>Top exercices par volume :</p>
                                    <div className="space-y-2 mt-2">
                                        {topExercisesData.map((exercise, index) => (
                                            <div key={exercise.name} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                                <span className="flex items-center gap-2">
                                                    <span className="text-yellow-400 font-bold">#{index + 1}</span>
                                                    {exercise.name}
                                                </span>
                                                <span className="font-semibold">{exercise.volume} kg</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
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

            {/* Statistiques avancées */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-green-400" />
                    Statistiques Avancées
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                        <h4 className="font-semibold text-blue-400 mb-2">Moyennes par séance</h4>
                        <ul className="text-sm text-gray-300 space-y-1">
                            <li>Exercices: {mainStats.totalSessions > 0 ? (mainStats.totalExercises / mainStats.totalSessions).toFixed(1) : 0}</li>
                            <li>Volume: {mainStats.totalSessions > 0 ? (mainStats.totalVolume / mainStats.totalSessions).toFixed(1) : 0} kg</li>
                            <li>Séries: {mainStats.totalSessions > 0 ? (mainStats.totalSeries / mainStats.totalSessions).toFixed(1) : 0}</li>
                        </ul>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                        <h4 className="font-semibold text-purple-400 mb-2">Records personnels</h4>
                        <ul className="text-sm text-gray-300 space-y-1">
                            <li>Exercices avec records: {Object.keys(safePersonalBests).length}</li>
                            <li>Volume max total: {Object.values(safePersonalBests).reduce((sum, pb) => sum + (pb?.maxVolume || 0), 0).toFixed(1)} kg</li>
                            <li>Poids max global: {Math.max(...Object.values(safePersonalBests).map(pb => pb?.maxWeight || 0), 0)} kg</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Progression récente */}
            {safeHistoricalData.length > 0 && (
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 shadow-lg">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity className="h-6 w-6 text-teal-400" />
                        Progression Récente
                    </h3>
                    <div className="space-y-2">
                        {safeHistoricalData.slice(-5).reverse().map((session, index) => (
                            <div key={session?.id || index} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                <div className="flex justify-between items-center">
                                    <span className="text-white font-medium">
                                        {formatDate && formatDate(session?.timestamp)}
                                    </span>
                                    <div className="text-sm text-gray-400">
                                        {(session?.exercises || []).length} exercices - 
                                        {(session?.exercises || []).reduce((sum, ex) => 
                                            sum + (ex?.series || []).reduce((sSum, s) => 
                                                sSum + ((s?.weight || 0) * (s?.reps || 0)), 0
                                            ), 0
                                        ).toFixed(1)} kg
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsView;