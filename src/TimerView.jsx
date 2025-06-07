import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, Target, Zap, Settings } from 'lucide-react';

/**
 * Composant TimerView amélioré pour le minuteur de repos avec presets et fonctionnalités avancées.
 */
const TimerView = ({
    timerSeconds,
    timerIsRunning,
    timerIsFinished,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerSeconds,
    restTimeInput,
    setRestTimeInput,
    formatTime,
    setTimerPreset,
    isAdvancedMode
}) => {
    const [customTime, setCustomTime] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [timerHistory, setTimerHistory] = useState([]);
    const [selectedPreset, setSelectedPreset] = useState(90);

    // Presets de temps prédéfinis
    const timePresets = [
        { label: '30s', value: 30, icon: '⚡', color: 'bg-yellow-500' },
        { label: '1min', value: 60, icon: '🏃', color: 'bg-blue-500' },
        { label: '1m30', value: 90, icon: '💪', color: 'bg-green-500' },
        { label: '2min', value: 120, icon: '🔥', color: 'bg-orange-500' },
        { label: '3min', value: 180, icon: '🎯', color: 'bg-purple-500' },
        { label: '5min', value: 300, icon: '🧘', color: 'bg-indigo-500' }
    ];

    // Enregistrer l'historique des minuteurs
    useEffect(() => {
        if (timerIsFinished) {
            const completedTimer = {
                duration: parseInt(restTimeInput) || 90,
                completedAt: new Date().toISOString(),
                id: Date.now()
            };
            setTimerHistory(prev => [completedTimer, ...prev.slice(0, 9)]); // Garder les 10 derniers
        }
    }, [timerIsFinished, restTimeInput]);

    const handlePresetClick = (preset) => {
        setSelectedPreset(preset.value);
        setTimerPreset(preset.value);
        setRestTimeInput(preset.value.toString());
    };

    const handleCustomTimeSubmit = () => {
        const seconds = parseInt(customTime);
        if (seconds && seconds > 0 && seconds <= 3600) { // Max 1 heure
            setTimerPreset(seconds);
            setRestTimeInput(seconds.toString());
            setSelectedPreset(seconds);
            setCustomTime('');
            setShowCustomInput(false);
        }
    };

    const getTimerColor = () => {
        const percentage = (timerSeconds / (parseInt(restTimeInput) || 90)) * 100;
        if (percentage > 50) return 'text-green-400';
        if (percentage > 25) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getCircularProgress = () => {
        const total = parseInt(restTimeInput) || 90;
        const progress = ((total - timerSeconds) / total) * 100;
        return Math.min(progress, 100);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                    <Clock className="h-8 w-8 text-blue-400" />
                    Minuteur de Repos
                </h2>
                <p className="text-gray-400">Optimisez vos temps de récupération</p>
            </div>

            {/* Minuteur principal avec design circulaire */}
            <div className="relative">
                <div className="w-80 h-80 mx-auto relative">
                    {/* Cercle de progression */}
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Cercle de fond */}
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            className="text-gray-700"
                        />
                        {/* Cercle de progression */}
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 45}`}
                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - getCircularProgress() / 100)}`}
                            className={`transition-all duration-1000 ${getTimerColor()}`}
                            strokeLinecap="round"
                        />
                    </svg>

                    {/* Contenu central */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className={`text-6xl font-bold mb-2 transition-colors duration-300 ${getTimerColor()}`}>
                            {formatTime(timerSeconds)}
                        </div>
                        
                        {timerIsFinished && (
                            <div className="text-red-400 text-xl font-bold animate-pulse flex items-center gap-2">
                                <Zap className="h-6 w-6" />
                                Temps écoulé !
                            </div>
                        )}
                        
                        {!timerIsFinished && (
                            <div className="text-gray-400 text-sm">
                                {timerIsRunning ? 'En cours...' : 'En pause'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Contrôles principaux */}
            <div className="flex justify-center items-center gap-4">
                <button
                    onClick={resetTimer}
                    className="p-4 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all hover:scale-105"
                    title="Réinitialiser"
                >
                    <RotateCcw className="h-6 w-6" />
                </button>

                <button
                    onClick={timerIsRunning ? pauseTimer : startTimer}
                    className={`p-6 rounded-xl font-bold text-white transition-all transform hover:scale-105 shadow-lg ${
                        timerIsRunning 
                            ? 'bg-red-500 hover:bg-red-600' 
                            : 'bg-green-500 hover:bg-green-600'
                    }`}
                >
                    {timerIsRunning ? (
                        <Pause className="h-8 w-8" />
                    ) : (
                        <Play className="h-8 w-8" />
                    )}
                </button>

                <button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className="p-4 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-all hover:scale-105"
                    title="Temps personnalisé"
                >
                    <Settings className="h-6 w-6" />
                </button>
            </div>

            {/* Presets de temps */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white text-center">Temps prédéfinis</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {timePresets.map((preset) => (
                        <button
                            key={preset.value}
                            onClick={() => handlePresetClick(preset)}
                            className={`p-4 rounded-xl transition-all hover:scale-105 ${
                                selectedPreset === preset.value
                                    ? `${preset.color} text-white shadow-lg`
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            <div className="text-2xl mb-1">{preset.icon}</div>
                            <div className="text-sm font-medium">{preset.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Input temps personnalisé */}
            {showCustomInput && (
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 space-y-4">
                    <h4 className="text-lg font-semibold text-white">Temps personnalisé</h4>
                    <div className="flex gap-3">
                        <input
                            type="number"
                            value={customTime}
                            onChange={(e) => setCustomTime(e.target.value)}
                            placeholder="Secondes (1-3600)"
                            min="1"
                            max="3600"
                            className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={handleCustomTimeSubmit}
                            disabled={!customTime || parseInt(customTime) <= 0}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Définir
                        </button>
                    </div>
                    <p className="text-xs text-gray-400">
                        Entrez une durée entre 1 seconde et 1 heure (3600 secondes)
                    </p>
                </div>
            )}

            {/* Historique des minuteurs (mode avancé) */}
            {isAdvancedMode && timerHistory.length > 0 && (
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 space-y-4">
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Historique des repos
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {timerHistory.slice(0, 5).map((timer) => (
                            <div
                                key={timer.id}
                                className="bg-gray-700/50 rounded-lg p-3 text-center"
                            >
                                <div className="text-sm font-medium text-white">
                                    {formatTime(timer.duration)}
                                </div>
                                <div className="text-xs text-gray-400">
                                    {new Date(timer.completedAt).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conseils et informations */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 space-y-3">
                <h4 className="text-lg font-semibold text-blue-400">💡 Conseils pour les temps de repos</h4>
                <div className="text-sm text-gray-300 space-y-2">
                    <p><strong>Force/Puissance:</strong> 3-5 minutes entre les séries</p>
                    <p><strong>Hypertrophie:</strong> 1-3 minutes entre les séries</p>
                    <p><strong>Endurance:</strong> 30 secondes à 1 minute entre les séries</p>
                    <p><strong>Exercices isolés:</strong> 1-2 minutes suffisent généralement</p>
                </div>
            </div>
        </div>
    );
};

export default TimerView;