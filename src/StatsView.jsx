import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import {
    Activity, Calendar, Target, TrendingUp, Award, Zap,
    BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon
} from 'lucide-react';

/**
 * Composant StatsView pour afficher les statistiques détaillées.
 */
const StatsView = ({
    workouts = { days: {}, dayOrder: [] },
    historicalData = [],
    personalBests = {},
    formatDate
}) => {
    // Couleurs pour les graphiques
    const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];

    // Calcul des statistiques principales
    const mainStats = useMemo(() => {
        let totalExercises = 0;
        let totalSeries = 0;
        let totalVolume = 0;

        // Compter les exercices actifs
        Object.values(workouts.days || {}).forEach(day => {
            Object.values(day.categories || {}).forEach(exercises => {
                if (Array.isArray(exercises)) {
                    const activeExercises = exercises.filter(ex => !ex.isDeleted);
                    totalExercises += activeExercises.length;
                    
                    activeExercises.forEach(exercise => {
                        if (Array.isArray(exercise.series)) {
                            totalSeries += exercise.series.length;
                        }
                    });
                }
            });
        });

        // Calculer le volume total
        Object.values(personalBests).forEach(best => {
            totalVolume += (best.totalVolume || 0);
        });

        const totalSessions = historicalData.length;
        const thisWeekSessions = historicalData.filter(session => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return session.timestamp && session.timestamp > weekAgo;
        }).length;

        return {
            totalExercises,
            totalSeries,
            totalSessions,
            thisWeekSessions,
            totalVolume: Math.round(totalVolume),
            averageSessionsPerWeek: totalSessions > 0 ? Math.round((totalSessions / 12) * 10) / 10 : 0
        };
    }, [workouts, historicalData, personalBests]);

    // Données pour le graphique de progression des sessions
    const sessionProgressData = useMemo(() => {
        const last30Days = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const sessionsCount = historicalData.filter(session => {
                if (!session.timestamp) return false;
                const sessionDate = session.timestamp.toISOString ? 
                    session.timestamp.toISOString().split('T')[0] : 
                    new Date(session.timestamp).toISOString().split('T')[0];
                return sessionDate === dateStr;
            }).length;

            last30Days.push({
                date: dateStr,
                sessions: sessionsCount,
                displayDate: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            });
        }
        
        return last30Days;
    }, [historicalData]);

    // Données pour le graphique de répartition par catégorie
    const categoryData = useMemo(() => {
        const categories = {};
        
        Object.values(workouts.days || {}).forEach(day => {
            Object.entries(day.categories || {}).forEach(([categoryName, exercises]) => {
                if (Array.isArray(exercises)) {
                    const activeExercises = exercises.filter(ex => !ex.isDeleted);
                    categories[categoryName] = (categories[categoryName] || 0) + activeExercises.length;
                }
            });
        });

        return Object.entries(categories).map(([name, value], index) => ({
            name,
            value,
            fill: COLORS[index % COLORS.length]
        }));
    }, [workouts]);

    // Top 5 des exercices par volume
    const topExercisesByVolume = useMemo(() => {
        return Object.entries(personalBests)
            .map(([exerciseId, best]) => ({
                name: best.name || 'Exercice sans nom',
                volume: Math.round(best.totalVolume || 0),
                sessions: best.sessions || 0,
                maxWeight: best.maxWeight || 0
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [personalBests]);

    // Données d'évolution du volume par semaine
    const weeklyVolumeData = useMemo(() => {
        const weeks = {};
        
        historicalData.forEach(session => {
            if (!session.timestamp || !session.workoutData?.days) return;
            
            const weekStart = new Date(session.timestamp);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeks[weekKey]) {
                weeks[weekKey] = {
                    week: weekKey,
                    volume: 0,
                    sessions: 0,
                    displayWeek: weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                };
            }
            
            weeks[weekKey].sessions++;
            
            // Calculer le volume de cette session
            Object.values(session.workoutData.days).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(exercise => {
                            if (Array.isArray(exercise.series)) {
                                exercise.series.forEach(serie => {
                                    const weight = parseFloat(serie.weight) || 0;
                                    const reps = parseInt(serie.reps) || 0;
                                    weeks[weekKey].volume += weight * reps;
                                });
                            }
                        });
                    }
                });
            });
        });

        return Object.values(weeks)
            .sort((a, b) => new Date(a.week) - new Date(b.week))
            .slice(-8); // 8 dernières semaines
    }, [historicalData]);

    const renderStatCard = (title, value, subtitle, icon, color) => (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:bg-gray-700/50 transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${color}`}>
                    {icon}
                </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{value}</div>
            <div className="text-sm font-medium text-gray-300 mb-1">{title}</div>
            {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Titre */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">Statistiques d'entraînement</h1>
                <p className="text-gray-400">Analysez vos performances et votre progression</p>
            </div>

            {/* Statistiques principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {renderStatCard(
                    "Exercices actifs",
                    mainStats.totalExercises,
                    `${mainStats.totalSeries} séries au total`,
                    <Activity className="h-6 w-6 text-blue-400" />,
                    "bg-blue-500/20"
                )}
                
                {renderStatCard(
                    "Sessions totales",
                    mainStats.totalSessions,
                    `${mainStats.thisWeekSessions} cette semaine`,
                    <Calendar className="h-6 w-6 text-green-400" />,
                    "bg-green-500/20"
                )}
                
                {renderStatCard(
                    "Volume total",
                    `${mainStats.totalVolume}kg`,
                    "Charge × Répétitions",
                    <Target className="h-6 w-6 text-purple-400" />,
                    "bg-purple-500/20"
                )}
                
                {renderStatCard(
                    "Moyenne/semaine",
                    `${mainStats.averageSessionsPerWeek}`,
                    "Sessions par semaine",
                    <TrendingUp className="h-6 w-6 text-yellow-400" />,
                    "bg-yellow-500/20"
                )}
                
                {renderStatCard(
                    "Records personnels",
                    Object.keys(personalBests).length,
                    "Exercices suivis",
                    <Award className="h-6 w-6 text-red-400" />,
                    "bg-red-500/20"
                )}
                
                {renderStatCard(
                    "Régularité",
                    mainStats.thisWeekSessions > 0 ? "✅ Actif" : "⏸️ Pause",
                    "Cette semaine",
                    <Zap className="h-6 w-6 text-cyan-400" />,
                    "bg-cyan-500/20"
                )}
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Graphique de progression des sessions */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <LineChartIcon className="h-5 w-5 text-blue-400" />
                        Sessions des 30 derniers jours
                    </h3>
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
                </div>

                {/* Répartition par catégorie */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-purple-400" />
                        Répartition par catégorie
                    </h3>
                    {categoryData.length > 0 ? (
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
                        <div className="flex items-center justify-center h-250 text-gray-400">
                            Aucune donnée disponible
                        </div>
                    )}
                </div>
            </div>

            {/* Top exercices et évolution hebdomadaire */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top exercices par volume */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-green-400" />
                        Top 5 - Volume d'entraînement
                    </h3>
                    {topExercisesByVolume.length > 0 ? (
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
                        <div className="flex items-center justify-center h-250 text-gray-400">
                            Commencez à vous entraîner pour voir vos statistiques
                        </div>
                    )}
                </div>

                {/* Évolution hebdomadaire du volume */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-yellow-400" />
                        Volume par semaine (8 dernières)
                    </h3>
                    {weeklyVolumeData.length > 0 ? (
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
                        <div className="flex items-center justify-center h-250 text-gray-400">
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
                        <h4 className="font-medium text-green-400 mb-2">Progression</h4>
                        <p className="text-gray-300 text-sm">
                            {Object.keys(personalBests).length === 0 ?
                                "Commencez à vous entraîner pour établir vos premiers records !" :
                                Object.keys(personalBests).length < 5 ?
                                "🎯 Diversifiez vos exercices pour un développement équilibré." :
                                "🏆 Excellent suivi ! Vous progressez sur plusieurs exercices."
                            }
                        </p>
                    </div>
                    
                    <div className="bg-gray-700/50 rounded-lg p-4">
                        <h4 className="font-medium text-purple-400 mb-2">Volume d'entraînement</h4>
                        <p className="text-gray-300 text-sm">
                            {mainStats.totalVolume === 0 ?
                                "Commencez à enregistrer vos poids et répétitions !" :
                                mainStats.totalVolume < 1000 ?
                                "💪 Bon début ! Augmentez progressivement votre volume." :
                                "🔥 Volume impressionnant ! Veillez à bien récupérer."
                            }
                        </p>
                    </div>
                    
                    <div className="bg-gray-700/50 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-400 mb-2">Équilibre musculaire</h4>
                        <p className="text-gray-300 text-sm">
                            {categoryData.length < 3 ?
                                "⚖️ Ajoutez plus de groupes musculaires pour un entraînement équilibré." :
                                "✅ Bonne répartition des groupes musculaires !"
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsView;