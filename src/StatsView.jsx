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
        let totalTimeInGym = 0; // en minutes
        let exercisesPerSession = 0; // moyenne

        const now = new Date();
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7); // Lundi de cette semaine

        // Compter les exercices actifs et les séries
        Object.values(workouts.days || {}).forEach(day => {
            Object.values(day.categories || {}).forEach(exercises => {
                if (Array.isArray(exercises)) {
                    const activeExercises = exercises.filter(ex => !ex.isDeleted);
                    totalExercises += activeExercises.length;
                    activeExercises.forEach(ex => {
                        if (Array.isArray(ex.series)) {
                            totalSeries += ex.series.length;
                        }
                    });
                }
            });
        });

        // Calculer le volume total et les sessions de cette semaine
        historicalData.forEach(session => {
            let sessionVolume = 0;
            Object.values(session.workoutData?.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(ex => {
                            if (Array.isArray(ex.series)) {
                                ex.series.forEach(serie => {
                                    sessionVolume += (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
                                });
                            }
                        });
                    }
                });
            });
            totalVolume += sessionVolume;

            const sessionDate = session.timestamp instanceof Date ? session.timestamp : new Date(session.timestamp.seconds * 1000);
            if (sessionDate >= startOfWeek) {
                thisWeekSessions++;
            }
        });

        // Calcul du temps total en salle (estimation simple: 60min par session)
        totalTimeInGym = totalSessions * 60;
        exercisesPerSession = totalSessions > 0 ? (totalExercises / totalSessions).toFixed(1) : 0;

        return {
            totalExercises,
            totalSeries,
            totalSessions,
            thisWeekSessions,
            totalVolume: Math.round(totalVolume),
            averageSessionsPerWeek: totalSessions > 0 ? (totalSessions / (historicalData.length > 0 ? ((now.getTime() - historicalData[historicalData.length - 1].timestamp.getTime()) / (1000 * 60 * 60 * 24 * 7)) : 1)).toFixed(1) : 0,
            totalTimeInGym,
            exercisesPerSession
        };
    }, [workouts, historicalData]);

    // Données pour le graphique de volume par semaine
    const weeklyVolumeData = useMemo(() => {
        const weeks = {};
        historicalData.forEach(session => {
            const date = session.timestamp instanceof Date ? session.timestamp : new Date(session.timestamp.seconds * 1000);
            const startOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7); // Lundi de la semaine
            const weekKey = startOfWeek.toISOString().split('T')[0];

            let sessionVolume = 0;
            Object.values(session.workoutData?.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(ex => {
                            if (Array.isArray(ex.series)) {
                                ex.series.forEach(serie => {
                                    sessionVolume += (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
                                });
                            }
                        });
                    }
                });
            });

            if (!weeks[weekKey]) {
                weeks[weekKey] = { date: startOfWeek, volume: 0 };
            }
            weeks[weekKey].volume += sessionVolume;
        });

        const sortedWeeks = Object.values(weeks).sort((a, b) => a.date.getTime() - b.date.getTime());

        // Garder les 8 dernières semaines pour le graphique
        return sortedWeeks.slice(-8).map(week => ({
            name: formatDate(week.date).substring(0, formatDate(week.date).indexOf(',')), // Ex: "15 janv."
            volume: Math.round(week.volume)
        }));
    }, [historicalData, formatDate]);

    // Données pour le graphique de répartition par catégorie musculaire
    const categoryData = useMemo(() => {
        const categoryVolumes = {};
        historicalData.forEach(session => {
            Object.values(session.workoutData?.days || {}).forEach(day => {
                Object.entries(day.categories || {}).forEach(([categoryName, exercises]) => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(ex => {
                            if (Array.isArray(ex.series) && !ex.isDeleted) {
                                ex.series.forEach(serie => {
                                    const volume = (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
                                    categoryVolumes[categoryName] = (categoryVolumes[categoryName] || 0) + volume;
                                });
                            }
                        });
                    }
                });
            });
        });
        return Object.entries(categoryVolumes)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value);
    }, [historicalData]);

    // Données pour le graphique des top 5 exercices par volume
    const topExercisesData = useMemo(() => {
        const exerciseVolumes = {};
        historicalData.forEach(session => {
            Object.values(session.workoutData?.days || {}).forEach(day => {
                Object.values(day.categories || {}).forEach(exercises => {
                    if (Array.isArray(exercises)) {
                        exercises.forEach(ex => {
                            if (Array.isArray(ex.series) && !ex.isDeleted) {
                                ex.series.forEach(serie => {
                                    const volume = (parseFloat(serie.weight) || 0) * (parseInt(serie.reps) || 0);
                                    exerciseVolumes[ex.name] = (exerciseVolumes[ex.name] || 0) + volume;
                                });
                            }
                        });
                    }
                });
            });
        });

        return Object.entries(exerciseVolumes)
            .map(([name, value]) => ({ name, volume: Math.round(value) }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5); // Top 5
    }, [historicalData]);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <BarChart3 className="h-7 w-7 text-purple-400" />
                Statistiques générales
            </h2>

            {/* Statistiques principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Total Exercices</p>
                    <p className="text-2xl font-bold text-blue-400">{mainStats.totalExercises}</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Total Séries</p>
                    <p className="text-2xl font-bold text-green-400">{mainStats.totalSeries}</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Total Sessions</p>
                    <p className="text-2xl font-bold text-yellow-400">{mainStats.totalSessions}</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Volume Total</p>
                    <p className="text-2xl font-bold text-purple-400">{mainStats.totalVolume} kg</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Sessions cette semaine</p>
                    <p className="text-2xl font-bold text-red-400">{mainStats.thisWeekSessions}</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Temps total en salle (est.)</p>
                    <p className="text-2xl font-bold text-teal-400">{mainStats.totalTimeInGym} min</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Moy. Ex. par séance</p>
                    <p className="text-2xl font-bold text-orange-400">{mainStats.exercisesPerSession}</p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Records pers. suivis</p>
                    <p className="text-2xl font-bold text-lime-400">{Object.keys(personalBests).length}</p>
                </div>
            </div>

            {/* Section notes globales */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <NotebookText className="h-6 w-6 text-yellow-400" /> Notes Globales
                </h3>
                <textarea
                    value={globalNotes}
                    onChange={(e) => setGlobalNotes(e.target.value)}
                    placeholder="Ajoutez des notes générales sur votre entraînement, vos objectifs à long terme, votre état de forme général, etc."
                    rows="5"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm whitespace-pre-wrap"
                ></textarea>
                <p className="text-xs text-gray-500 mt-2">
                    Ces notes sont sauvegardées automatiquement.
                </p>
            </div>

            {/* Analyse IA globale */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg text-center">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
                    <Sparkles className="h-6 w-6 text-purple-400" /> Analyse IA Générale
                </h3>
                <p className="text-gray-400 mb-4">
                    Obtenez une analyse personnalisée de vos statistiques globales et des conseils pour votre progression.
                </p>
                <button
                    onClick={analyzeGlobalStatsWithAI}
                    className={`w-full px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                        aiAnalysisLoading
                            ? 'bg-purple-500/50 text-white cursor-wait'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                    disabled={aiAnalysisLoading}
                >
                    {aiAnalysisLoading ? (
                        <>
                            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                            Analyse en cours...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-5 w-5" /> Obtenir l'analyse IA
                        </>
                    )}
                </button>
            </div>

            {/* Graphiques */}
            <div className="space-y-6">
                {/* Volume total par semaine */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <LineChartIcon className="h-6 w-6 text-blue-400" /> Volume total par semaine (8 dernières semaines)
                    </h3>
                    {weeklyVolumeData.length > 0 ? (
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyVolumeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="name" stroke="#cbd5e0" />
                                    <YAxis stroke="#cbd5e0" label={{ value: 'Volume (kg)', angle: -90, position: 'insideLeft', fill: '#cbd5e0' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4a5568', borderRadius: '8px' }}
                                        labelStyle={{ color: '#cbd5e0' }}
                                        formatter={(value, name, props) => [`${value} kg`, 'Volume']}
                                    />
                                    <Legend wrapperStyle={{ color: '#cbd5e0', paddingTop: '10px' }} />
                                    <Bar dataKey="volume" fill="#8884d8" name="Volume (kg)" radius={[10, 10, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 p-8">
                            <Calendar className="h-10 w-10 mx-auto mb-3" />
                            <p>Aucune donnée de volume hebdomadaire disponible.</p>
                            <p className="text-sm text-gray-500">Enregistrez vos séances pour voir votre progression ici !</p>
                        </div>
                    )}
                </div>

                {/* Répartition par catégorie musculaire */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <PieChartIcon className="h-6 w-6 text-green-400" /> Répartition par catégorie musculaire
                    </h3>
                    {categoryData.length > 0 ? (
                        <div className="h-80 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4a5568', borderRadius: '8px' }}
                                        labelStyle={{ color: '#cbd5e0' }}
                                        formatter={(value, name, props) => [`${value} kg`, name]}
                                    />
                                    <Legend wrapperStyle={{ color: '#cbd5e0', paddingTop: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 p-8">
                            <Dumbbell className="h-10 w-10 mx-auto mb-3" />
                            <p>Aucune donnée de catégorie musculaire disponible.</p>
                            <p className="text-sm text-gray-500">Ajoutez des exercices et des catégories pour voir la répartition.</p>
                        </div>
                    )}
                </div>

                {/* Top 5 exercices par volume */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Target className="h-6 w-6 text-red-400" /> Top 5 exercices par volume
                    </h3>
                    {topExercisesData.length > 0 ? (
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={topExercisesData}
                                    layout="vertical"
                                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
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
