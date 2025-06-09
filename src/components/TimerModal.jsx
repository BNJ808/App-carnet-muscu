import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Clock, Zap, X } from 'lucide-react';

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
    const [selectedPreset, setSelectedPreset] = useState(90);
    
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
            if (setTimerSeconds) setTimerSeconds(totalSeconds);
            setSelectedPreset(totalSeconds);
            if (startTimer) startTimer();
        }
    };

    const handlePresetStart = (seconds) => {
        setSelectedPreset(seconds);
        if (setTimerSeconds) setTimerSeconds(seconds);
        if (startTimer) startTimer();
    };

    const getTimerDisplay = () => {
        if (timerSeconds === 0 && !timerIsRunning) {
            return '00:00';
        }
        return formatTime ? formatTime(timerSeconds) : '00:00';
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            <Clock className="h-6 w-6 text-blue-400" />
                            Minuteur de repos
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Affichage du temps */}
                    <div className="text-center mb-6">
                        <div className={`text-5xl font-mono font-bold ${getTimerStatusColor()} mb-4`}>
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
                            <div className="text-green-400 font-semibold text-lg animate-pulse">
                                ⏰ Temps terminé !
                            </div>
                        )}
                    </div>

                    {/* Contrôles */}
                    <div className="flex justify-center gap-3 mb-6">
                        {timerSeconds > 0 && (
                            <>
                                <button
                                    onClick={timerIsRunning ? pauseTimer : startTimer}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                                        timerIsRunning 
                                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                                >
                                    {timerIsRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    {timerIsRunning ? 'Pause' : 'Start'}
                                </button>
                                <button
                                    onClick={resetTimer}
                                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-2"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Reset
                                </button>
                            </>
                        )}
                    </div>

                    {/* Presets rapides */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-300 mb-3">Temps prédéfinis</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {timePresets.map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() => handlePresetStart(preset.value)}
                                    disabled={timerIsRunning}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                        selectedPreset === preset.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Minuteur personnalisé */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-300 mb-3">Temps personnalisé</h3>
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={customMinutes}
                                    onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 0)}
                                    className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-12 text-sm"
                                    disabled={timerIsRunning}
                                />
                                <span className="text-gray-400 text-sm">m</span>
                            </div>
                            
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={customSeconds}
                                    onChange={(e) => setCustomSeconds(parseInt(e.target.value) || 0)}
                                    className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-12 text-sm"
                                    disabled={timerIsRunning}
                                />
                                <span className="text-gray-400 text-sm">s</span>
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