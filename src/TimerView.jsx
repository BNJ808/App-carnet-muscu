import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Clock, Zap } from 'lucide-react';

/**
 * Composant TimerView pour la gestion du minuteur de repos.
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
    setTimerPreset
}) => {
    const [customMinutes, setCustomMinutes] = useState(1);
    const [customSeconds, setCustomSeconds] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(90);
    
    // Presets de temps populaires
    const timePresets = [
        { label: '30s', value: 30, category: 'Court' },
        { label: '45s', value: 45, category: 'Court' },
        { label: '1min', value: 60, category: 'Court' },
        { label: '1min30', value: 90, category: 'Moyen' },
        { label: '2min', value: 120, category: 'Moyen' },
        { label: '3min', value: 180, category: 'Moyen' },
        { label: '4min', value: 240, category: 'Long' },
        { label: '5min', value: 300, category: 'Long' }
    ];

    const groupedPresets = timePresets.reduce((acc, preset) => {
        if (!acc[preset.category]) {
            acc[preset.category] = [];
        }
        acc[preset.category].push(preset);
        return acc;
    }, {});

    const handleCustomTimerStart = () => {
        const totalSeconds = (customMinutes * 60) + customSeconds;
        if (totalSeconds > 0) {
            setTimerSeconds(totalSeconds);
            setSelectedPreset(totalSeconds);
            startTimer();
        }
    };

    const handlePresetStart = (seconds) => {
        setSelectedPreset(seconds);
        setTimerSeconds(seconds);
        startTimer();
    };

    const getTimerDisplay = () => {
        if (timerSeconds === 0 && !timerIsRunning) {
            return '00:00';
        }
        return formatTime(timerSeconds);
    };

    const getTimerStatusColor = () => {
        if (timerIsFinished) return 'text-red-400';
        if (timerIsRunning) return 'text-blue-400';
        if (timerSeconds > 0) return 'text-yellow-400';
        return 'text-gray-400';
    };

    const getProgressPercentage = () => {
        if (selectedPreset === 0) return 0;
        return ((selectedPreset - timerSeconds) / selectedPreset) * 100;
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Affichage principal du minuteur */}
            <div className="bg-gray-800 rounded-2xl p-8 text-center border border-gray-700">
                <div className="mb-6">
                    <Clock className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Minuteur de repos</h2>
                    <p className="text-gray-400">Gérez vos temps de repos entre les séries</p>
                </div>

                {/* Affichage du temps */}
                <div className="relative mb-8">
                    <div className={`text-7xl font-mono font-bold ${getTimerStatusColor()} mb-4`}>
                        {getTimerDisplay()}
                    </div>
                    
                    {/* Barre de progression */}
                    {selectedPreset > 0 && timerSeconds > 0 && (
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                            <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${getProgressPercentage()}%` }}
                            ></div>
                        </div>
                    )}
                    
                    {timerIsFinished && (
                        <div className="text-green-400 font-semibold text-xl animate-pulse">
                            ⏰ Temps de repos terminé !
                        </div>
                    )}
                </div>

                {/* Contrôles du minuteur */}
                <div className="flex justify-center gap-4 mb-6">
                    {timerSeconds === 0 && !timerIsFinished && (
                        <div className="text-gray-400 text-lg">
                            Choisissez un temps de repos ci-dessous
                        </div>
                    )}
                    
                    {timerSeconds > 0 && !timerIsFinished && (
                        <>
                            <button
                                onClick={timerIsRunning ? pauseTimer : startTimer}
                                className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                                    timerIsRunning 
                                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                            >
                                {timerIsRunning ? (
                                    <>
                                        <Pause className="h-5 w-5" />
                                        Pause
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-5 w-5" />
                                        Démarrer
                                    </>
                                )}
                            </button>
                        </>
                    )}
                    
                    {(timerSeconds > 0 || timerIsFinished) && (
                        <button
                            onClick={resetTimer}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2"
                        >
                            <RotateCcw className="h-5 w-5" />
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Presets de temps */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Temps prédéfinis
                </h3>
                
                {Object.entries(groupedPresets).map(([category, presets]) => (
                    <div key={category} className="mb-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">{category}</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {presets.map(preset => (
                                <button
                                    key={preset.value}
                                    onClick={() => handlePresetStart(preset.value)}
                                    disabled={timerIsRunning}
                                    className={`p-3 rounded-lg font-medium transition-all ${
                                        selectedPreset === preset.value && timerSeconds > 0
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Minuteur personnalisé */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Temps personnalisé</h3>
                
                <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 0)}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-16"
                            disabled={timerIsRunning}
                        />
                        <span className="text-gray-400">min</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={customSeconds}
                            onChange={(e) => setCustomSeconds(parseInt(e.target.value) || 0)}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-16"
                            disabled={timerIsRunning}
                        />
                        <span className="text-gray-400">sec</span>
                    </div>
                    
                    <button
                        onClick={handleCustomTimerStart}
                        disabled={timerIsRunning || (customMinutes === 0 && customSeconds === 0)}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                    >
                        <Play className="h-4 w-4" />
                        Démarrer
                    </button>
                </div>
                
                <div className="text-center text-gray-400 text-sm">
                    Temps total: {formatTime((customMinutes * 60) + customSeconds)}
                </div>
            </div>

            {/* Conseils de repos */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">💡 Conseils de temps de repos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <h4 className="font-medium text-green-400 mb-2">Force (1-5 reps)</h4>
                        <p className="text-gray-300">3-5 minutes entre les séries pour une récupération complète</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <h4 className="font-medium text-blue-400 mb-2">Hypertrophie (6-12 reps)</h4>
                        <p className="text-gray-300">1-3 minutes pour maintenir l'intensité musculaire</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                        <h4 className="font-medium text-yellow-400 mb-2">Endurance (12+ reps)</h4>
                        <p className="text-gray-300">30s-1min pour maintenir le rythme cardiaque</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerView;