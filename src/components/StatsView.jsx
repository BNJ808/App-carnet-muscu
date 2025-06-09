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
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];

    // Calcul des statistiques principales
    const mainStats = useMemo(() => {
        if (getWorkoutStats) {
            return getWorkoutStats();
        }

        let totalExercises = 0;
        let totalSeries = 0;
        let totalVolume = 0;
        const totalSessions = safeHistoricalData.length;
        let thisWeekSessions = 0;

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Compter les exercices actifs et les séries complétées
        Object.values(safeWorkouts.days || {}).forEach(workoutDay => {
            if (workoutDay?.categories) {
                Object.values(workoutDay.categories).forEach(exercisesList => {
                    if (Array.isArray(exercisesList)) {
                        const activeExercises = exercisesList.filter(ex => ex && !ex.isDeleted);
                        totalExercises += activeExercises.length;
                        activeExercises.forEach(exercise => {
                            if (exercise?.series && Array.isArray(exercise.series)) {
                                totalSeries += exercise.series.length;
                                exercise.series.forEach(seriesItem => {
                                    if (seriesItem && typeof seriesItem === 'object') {
                                        totalVolume += (parseFloat(seriesItem.weight) || 0) * (parseInt(seriesItem.reps) || 0);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        // Calculer les sessions de la semaine en cours
        safeHistoricalData.forEach(sessionItem => {
            if (sessionItem?.timestamp) {
                const sessionDate = sessionItem.timestamp?.toDate ? 
                    sessionItem.timestamp.toDate() : 
                    new Date(sessionItem.timestamp);
                if (sessionDate >= oneWeekAgo) {
                    thisWeekSessions++;
                }
            }
        });

        const averageSessionsPerWeek = totalSessions > 0 ? 
            Math.round((totalSessions / Math.max(1, Math.ceil(totalSessions / 4))) * 10) / 10 : 0;

        return {
            totalExercises,
            totalSeries,
            totalSessions,
            thisWeekSessions,
            totalVolume: Math.round(totalVolume),
            averageSessionsPerWeek
        };
    }, [safeWorkouts, safeHistoricalData, getWorkoutStats]);

    // Données pour le graphique de progression des sessions (30 derniers jours)
    const sessionProgressData = useMemo(() => {
        const last30Days = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const sessionsCount = safeHistoricalData.filter(session => {
                if (!session.timestamp) return false;
                const sessionDate = session.timestamp?.toDate ? 
                    session.timestamp.toDate().toISOString().split('T')[0] :
                    new Date(session.timestamp).toISOString().split('T')[0];
                return sessionDate === dateStr;
            }).length;
            
            last30Days.push({
                date: dateStr,
                displayDate: date.getDate().toString(),
                sessions: sessionsCount
            });
        }
        
        return last30Days;
    }, [safeHistoricalData]);

    // Données pour le graphique de répartition par catégorie
    const categoryData = useMemo(() => {
        const categoryStats = {};
        
        Object.values(safeWorkouts.days || {}).forEach(day => {
            if (day?.categories) {
                Object.entries(day.categories).forEach(([categoryName, exercises]) => {
                    if (Array.isArray(exercises)) {
                        const activeExercises = exercises.filter(ex => ex && !ex.isDeleted);
                        if (activeExercises.length > 0) {
                            categoryStats[categoryName] = (categoryStats[categoryName] || 0) + activeExercises.length;
                        }
                    }
                });
            }
        });
        
        return Object.entries(categoryStats)
            .map(([name, value], index) => ({
                name,
                value,
                fill: COLORS[index % COLORS.length]
            }))
            .filter(item => item.value > 0);
    }, [safeWorkouts]);

    // Données pour le graphique des top exercices par volume
    const topExercisesByVolume = useMemo(() => {
        const exerciseVolumes = {};
        
        safeHistoricalData.forEach(session => {
            if (session?.days) {
                Object.values(session.days).forEach(day => {
                    if (day?.categories) {
                        Object.values(day.categories).forEach(exercises => {
                            if (Array.isArray(exercises)) {
                                exercises.forEach(exercise => {
                                    if (exercise?.name && exercise?.series) {
                                        const volume = exercise.series.reduce((sum, serie) => {
                                            if (serie?.completed) {
                                                return sum + (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
                                            }
                                            return sum;
                                        }, 0);
                                        
                                        exerciseVolumes[exercise.name] = (exerciseVolumes[exercise.name] || 0) + volume;
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        
        return Object.entries(exerciseVolumes)
            .map(([name, volume]) => ({ name, volume: Math.round(volume) }))
            .filter(item => item.volume > 0)
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [safeHistoricalData]);

    // Données pour le graphique du volume hebdomadaire
    const weeklyVolumeData = useMemo(() => {
        const weeklyVolumes = {};
        
        safeHistoricalData.forEach(session => {
            if (session?.timestamp && session?.days) {
                const date = session.timestamp?.toDate ? session.timestamp.toDate() : new Date(session.timestamp);
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                const weekKey = weekStart.toISOString().split('T')[0];
                
                let sessionVolume = 0;
                Object.values(session.days).forEach(day => {
                    if (day?.categories) {
                        Object.values(day.categories).forEach(exercises => {
                            if (Array.isArray(exercises)) {
                                exercises.forEach(exercise => {
                                    if (exercise?.series) {
                                        sessionVolume += exercise.series.reduce((sum, serie) => {
                                            if (serie?.completed) {
                                                return sum + (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
                                            }
                                            return sum;
                                        }, 0);
                                    }
                                });
                            }
                        });
                    }
                });
                
                weeklyVolumes[weekKey] = (weeklyVolumes[weekKey] || 0) + sessionVolume;
            }
        });
        
        return Object.entries(weeklyVolumes)
            .map(([week, volume]) => ({
                week,
                displayWeek: new Date(week).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
                volume: Math.round(volume)
            }))
            .sort((a, b) => new Date(a.week) - new Date(b.week))
            .slice(-8); // 8 dernières semaines
    }, [safeHistoricalData]);

    // Fonction de debug
    const debugGraphData = () => {
        console.log('🔍 Debug GraphData:', {
            sessionProgressData,
            categoryData,
            topExercisesByVolume,
            weeklyVolumeData,
            historicalData: safeHistoricalData,
            workouts: safeWorkouts,
            mainStats
        });
    };

    // Debug au chargement
    useEffect(() => {
        debugGraphData();
    }, [safeHistoricalData, safeWorkouts]);

    // Gestionnaire pour l'analyse IA
    const handleAnalyzeStats = () => {
        if (analyzeGlobalStatsWithAI) {
            analyzeGlobalStatsWithAI(mainStats, safePersonalBests, globalNotes);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                <BarChart3 className="h-7 w-7" />
                Statistiques détaillées
            </h2>

            {/* Cartes de statistiques principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: "Exercices totaux", value: mainStats.totalExercises, icon: Target, color: "text-blue-400", bg: "bg-blue-500/20" },
                    { title: "Sessions totales", value: mainStats.totalSessions, icon: Calendar, color: "text-green-400", bg: "bg-green-500/20" },
                    { title: "Cette semaine", value: mainStats.thisWeekSessions, icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/20" },
                    { title: "Volume total", value: `${mainStats.totalVolume} kg`, icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/20" }
                ].map((stat, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">{stat.title}</p>
                                <p className="text-2xl font-bold text-white">{stat.value}</p>
                            </div>
                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Analyse IA */}
            {analyzeGlobalStatsWithAI && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-yellow-400" />
                            Analyse IA
                        </h3>
                        <button
                            onClick={handleAnalyzeStats}
                            disabled={aiAnalysisLoading}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg border border-gray-600 min-h-[100px]">
                        <h4 className="text-md font-medium text-white mb-2">Notes & Insights IA :</h4>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                            {globalNotes || "Cliquez sur 'Analyser mes stats avec l'IA' pour obtenir un aperçu de votre progression et des conseils."}
                        </p>
                    </div>
                </div>
            )}

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Graphique de progression des sessions */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <LineChartIcon className="h-5 w-5 text-blue-400" />
                        Sessions des 30 derniers jours
                    </h3>
                    {sessionProgressData && sessionProgressData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={sessionProgressData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis 
                                    dataKey="displayDate" 
                                    stroke="#9CA3AF" 
                                    fontSize={12}
                                    interval="preserveStartEnd"
                                />
                                <YAxis stroke="#9CA3AF" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#1F2937', 
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F3F4F6'
                                    }}
                                    labelStyle={{ color: '#F3F4F6' }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="sessions" 
                                    stroke="#3B82F6" 
                                    strokeWidth={2}
                                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, fill: '#60A5FA' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-gray-400">
                            Aucune donnée de session disponible
                        </div>
                    )}
                </div>

                {/* Répartition par catégorie */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-purple-400" />
                        Répartition par catégorie
                    </h3>
                    {categoryData && categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${value}`}
                                    labelLine={false}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#1F2937', 
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F3F4F6'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-gray-400">
                            Aucune donnée de catégorie disponible
                        </div>
                    )}
                </div>

                {/* Top exercices par volume */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-green-400" />
                        Top 5 - Volume d'entraînement
                    </h3>
                    {topExercisesByVolume && topExercisesByVolume.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={topExercisesByVolume} layout="horizontal">
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                                <YAxis 
                                    type="category" 
                                    dataKey="name" 
                                    stroke="#9CA3AF" 
                                    fontSize={12}
                                    width={100}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#1F2937', 
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F3F4F6'
                                    }}
                                    formatter={(value, name) => [
                                        `${value}kg`,
                                        'Volume total'
                                    ]}
                                />
                                <Bar dataKey="volume" fill="#10B981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-gray-400">
                            Aucun exercice enregistré
                        </div>
                    )}
                </div>

                {/* Évolution hebdomadaire du volume */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-yellow-400" />
                        Volume par semaine (8 dernières)
                    </h3>
                    {weeklyVolumeData && weeklyVolumeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={weeklyVolumeData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis 
                                    dataKey="displayWeek" 
                                    stroke="#9CA3AF" 
                                    fontSize={12}
                                />
                                <YAxis stroke="#9CA3AF" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#1F2937', 
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        color: '#F3F4F6'
                                    }}
                                    formatter={(value, name) => [
                                        `${Math.round(value)}kg`,
                                        'Volume total'
                                    ]}
                                />
                                <Bar 
                                    dataKey="volume" 
                                    fill="#F59E0B" 
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-gray-400">
                            Données insuffisantes pour afficher l'évolution
                        </div>
                    )}
                </div>
            </div>

            {/* Conseils et insights */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">💡 Insights et recommandations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-4">
                        <h4 className="font-medium text-blue-400 mb-2">Fréquence d'entraînement</h4>
                        <p className="text-gray-300 text-sm">
                            {mainStats.thisWeekSessions === 0 ? 
                                "🚨 Aucune session cette semaine. Il est temps de reprendre !" :
                                mainStats.thisWeekSessions < 3 ?
                                "⚠️ Fréquence faible cette semaine. Essayez d'augmenter à 3-4 sessions." :
                                "✅ Excellente fréquence ! Maintenez ce rythme."
                            }
                        </p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-4">
                        <h4 className="font-medium text-green-400 mb-2">Volume d'entraînement</h4>
                        <p className="text-gray-300 text-sm">
                            {mainStats.totalVolume === 0 ?
                                "📊 Commencez à enregistrer vos séries pour voir votre volume." :
                                mainStats.totalVolume < 1000 ?
                                "📈 Volume en développement. Continuez à progresser !" :
                                "💪 Excellent volume d'entraînement ! Vous êtes sur la bonne voie."
                            }
                        </p>
                    </div>
                </div>
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