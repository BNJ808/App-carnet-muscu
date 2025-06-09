import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Clock, Zap, X, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Composant TimerModal pour la gestion du minuteur de repos en modal.
 */
const TimerModal = ({
    isOpen,
    onClose,
    timerSeconds = 0,
    timerIsRunning = false,
    timerIsFinished = false,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerSeconds,
    formatTime
}) => {
    const [customMinutes, setCustomMinutes] = useState(1);
    const [customSeconds, setCustomSeconds] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(90); // Default to 90s

    if (!isOpen) return null;

    // Presets de temps populaires
    const timePresets = [
        { label: '30s', value: 30 },
        { label: '45s', value: 45 },
        { label: '1min', value: 60 },
        { label: '1m30', value: 90 },
        { label: '2min', value: 120 },
        { label: '3min', value: 180 },
    ];

    const handleCustomTimerStart = () => {
        const totalSeconds = (customMinutes * 60) + customSeconds;
        if (totalSeconds > 0) {
            setTimerSeconds(totalSeconds);
            startTimer();
        }
    };

    const handlePresetClick = (value) => {
        setSelectedPreset(value);
        setTimerSeconds(value);
        if (!timerIsRunning) { // Démarrer seulement si pas déjà en cours
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
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-lg z-[100] flex items-center justify-center p-4 sm:p-6"> {/* MODIFIED: Added p-4 sm:p-6 for mobile padding */}
            <div className="relative bg-gray-800 rounded-2xl shadow-xl border border-gray-700 w-full max-w-sm mx-auto overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Clock className="h-6 w-6 text-green-400" />
                            Minuteur de repos
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                            aria-label="Fermer le minuteur"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Affichage du temps restant */}
                    <div className="text-center mb-6">
                        <p className={`font-mono text-7xl sm:text-8xl font-extrabold transition-colors duration-300 ${timerIsFinished ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                            {formatTime(timerSeconds)}
                        </p>
                        {timerIsFinished && (
                            <p className="text-red-400 text-sm mt-2 animate-bounce">Temps écoulé !</p>
                        )}
                    </div>

                    {/* Contrôles du minuteur */}
                    <div className="flex justify-center gap-4 mb-6">
                        <button
                            onClick={timerIsRunning ? pauseTimer : startTimer}
                            className={`p-4 rounded-full ${timerIsRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white transition-all shadow-lg flex items-center justify-center`}
                            aria-label={timerIsRunning ? "Pause" : "Démarrer"}
                        >
                            {timerIsRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                        </button>
                        <button
                            onClick={resetTimer}
                            className="p-4 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-all shadow-lg flex items-center justify-center"
                            aria-label="Réinitialiser"
                        >
                            <RotateCcw className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Presets */}
                    <div className="mb-6">
                        <h3 className="text-md font-semibold text-gray-300 mb-3">Presets rapides :</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {timePresets.map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() => handlePresetClick(preset.value)}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                        selectedPreset === preset.value && timerSeconds === preset.value && timerIsRunning
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Minuteur personnalisé */}
                    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                        <h3 className="text-md font-semibold text-gray-300 mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-purple-400" /> Personnalisé</h3>
                        <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-col items-center">
                                <button onClick={increaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-5 w-5" /></button>
                                {/* MODIFIED: Moved comment to a new line */}
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={customMinutes}
                                    onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 0)}
                                    className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-12 text-sm"
                                    disabled={timerIsRunning}
                                    inputMode="numeric"
                                />
                                <button onClick={decreaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronDown className="h-5 w-5" /></button>
                                <span className="text-gray-400 text-xs mt-1">min</span>
                            </div>
                            <span className="text-gray-400 text-lg">:</span>
                            <div className="flex flex-col items-center">
                                <button onClick={increaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-5 w-5" /></button>
                                {/* MODIFIED: Moved comment to a new line */}
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={customSeconds}
                                    onChange={(e) => setCustomSeconds(parseInt(e.target.value) || 0)}
                                    className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-12 text-sm"
                                    disabled={timerIsRunning}
                                    inputMode="numeric"
                                />
                                <button onClick={decreaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronDown className="h-5 w-5" /></button>
                                <span className="text-gray-400 text-xs mt-1">s</span>
                            </div>

                            <button
                                onClick={handleCustomTimerStart}
                                disabled={timerIsRunning || (customMinutes === 0 && customSeconds === 0)}
                                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg transition-all flex items-center gap-1 text-sm"
                            >
                                <Play className="h-3 w-3" />
                                Go
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerModal;