import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Clock, Zap, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Composant TimerView pour la gestion du minuteur de repos.
 */
const TimerView = ({
    timerSeconds = 0,
    timerIsRunning = false,
    timerIsFinished = false,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerSeconds,
    restTimeInput = '90', // Assume this is a string
    setRestTimeInput,
    formatTime, // Ensure formatTime is destructured from props
    setTimerPreset // New prop to set a preset
}) => {
    const [customMinutes, setCustomMinutes] = useState(1);
    const [customSeconds, setCustomSeconds] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(90); // Default to 90s

    // Update custom minutes/seconds when restTimeInput changes from outside
    useEffect(() => {
        const totalSeconds = parseInt(restTimeInput, 10) || 0;
        setCustomMinutes(Math.floor(totalSeconds / 60));
        setCustomSeconds(totalSeconds % 60);
        setSelectedPreset(totalSeconds); // Set selected preset when external restTimeInput changes
    }, [restTimeInput]);

    // Presets de temps populaires
    const timePresets = [
        { label: '30s', value: 30, category: 'Court' },
        { label: '45s', value: 45, category: 'Court' },
        { label: '1min', value: 60, category: 'Moyen' },
        { label: '1m30', value: 90, category: 'Moyen' },
        { label: '2min', value: 120, category: 'Long' },
        { label: '3min', value: 180, category: 'Long' },
    ];

    const handleCustomTimerStart = () => {
        const totalSeconds = (customMinutes * 60) + customSeconds;
        if (totalSeconds > 0) {
            setTimerSeconds(totalSeconds);
            startTimer();
        }
    };

    const handlePresetClick = (value) => {
        setTimerPreset(value); // Utilise la nouvelle prop
        setSelectedPreset(value);
        if (!timerIsRunning) {
            startTimer();
        }
    };

    const increaseMinute = () => {
        setCustomMinutes(prev => Math.min(prev + 1, 59));
    };

    const decreaseMinute = () => {
        setCustomMinutes(prev => Math.max(prev - 1, 0));
    };

    const increaseSecond = () => {
        setCustomSeconds(prev => (prev === 59 ? 0 : prev + 1));
    };

    const decreaseSecond = () => {
        setCustomSeconds(prev => (prev === 0 ? 59 : prev - 1));
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 pb-20 custom-scrollbar space-y-6">
            {/* Affichage principal du minuteur */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 text-center">
                <div className="flex items-center justify-center mb-4 text-gray-400">
                    <Clock className="h-8 w-8 mr-2" />
                    <h2 className="text-2xl font-bold text-white">Minuteur de repos</h2>
                </div>

                <p className={`font-mono text-8xl sm:text-9xl font-extrabold transition-colors duration-300 ${timerIsFinished ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                    {formatTime ? formatTime(timerSeconds) : '00:00'}
                </p>

                {timerIsFinished && (
                    <p className="text-red-400 text-sm mt-2 animate-bounce">Temps écoulé !</p>
                )}

                <div className="flex justify-center gap-4 mt-6">
                    <button
                        onClick={timerIsRunning ? pauseTimer : startTimer}
                        className={`p-4 rounded-full ${timerIsRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white transition-all shadow-lg flex items-center justify-center`}
                        aria-label={timerIsRunning ? "Pause" : "Démarrer"}
                    >
                        {timerIsRunning ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
                    </button>
                    <button
                        onClick={resetTimer}
                        className="p-4 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-all shadow-lg flex items-center justify-center"
                        aria-label="Réinitialiser"
                    >
                        <RotateCcw className="h-7 w-7" />
                    </button>
                </div>
            </div>

            {/* Presets de temps */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">⏱️ Presets rapides</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {timePresets.map((preset) => (
                        <button
                            key={preset.value}
                            onClick={() => handlePresetClick(preset.value)}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                selectedPreset === preset.value && timerSeconds === preset.value && timerIsRunning
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Minuteur personnalisé */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-purple-400" /> Minuteur personnalisé</h3>
                <div className="flex items-center justify-center gap-6 mb-4">
                    <div className="flex flex-col items-center">
                        <button onClick={increaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-6 w-6" /></button>
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={String(customMinutes).padStart(2, '0')}
                            onChange={(e) => setCustomMinutes(Math.min(parseInt(e.target.value) || 0, 59))}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-20 text-4xl font-mono"
                            disabled={timerIsRunning}
                            inputMode="numeric"
                        />
                        <button onClick={decreaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronDown className="h-6 w-6" /></button>
                        <span className="text-gray-400 text-xs mt-1">minutes</span>
                    </div>
                    <span className="text-gray-400 text-5xl font-extrabold">:</span>
                    <div className="flex flex-col items-center">
                        <button onClick={increaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-6 w-6" /></button>
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={String(customSeconds).padStart(2, '0')}
                            onChange={(e) => setCustomSeconds(Math.min(parseInt(e.target.value) || 0, 59))}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-20 text-4xl font-mono"
                            disabled={timerIsRunning}
                            inputMode="numeric"
                        />
                        <button onClick={decreaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronDown className="h-6 w-6" /></button>
                        <span className="text-gray-400 text-xs mt-1">secondes</span>
                    </div>
                </div>
                <div className="flex justify-center mt-4">
                    <button
                        onClick={handleCustomTimerStart}
                        disabled={timerIsRunning || (customMinutes === 0 && customSeconds === 0)}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-full shadow-lg transition-all flex items-center gap-2 text-lg"
                    >
                        <Play className="h-5 w-5" />
                        Démarrer personnalisé
                    </button>
                </div>
                <div className="text-center text-gray-400 text-sm mt-4">
                    Temps total: {formatTime ? formatTime((customMinutes * 60) + customSeconds) : '00:00'}
                </div>
            </div>

            {/* Conseils de repos (déjà bien stylisé) */}
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
                        <p className="text-gray-300">30-90 secondes pour l'endurance musculaire</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerView;