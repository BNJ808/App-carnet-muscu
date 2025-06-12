// TimerView.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
    formatTime,
    showToast,
    currentTheme = 'dark'
}) => {
    const [customMinutes, setCustomMinutes] = useState(1);
    const [customSeconds, setCustomSeconds] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(90);

    useEffect(() => {
        if (!timerIsRunning && timerSeconds === 0 && !timerIsFinished) {
            setCustomMinutes(Math.floor(selectedPreset / 60));
            setCustomSeconds(selectedPreset % 60);
        } else if (!timerIsRunning) {
            setCustomMinutes(Math.floor(timerSeconds / 60));
            setCustomSeconds(timerSeconds % 60);
        }
    }, [timerSeconds, timerIsRunning, timerIsFinished, selectedPreset]);

    const handlePresetClick = useCallback((seconds) => {
        setTimerSeconds(seconds);
        setSelectedPreset(seconds);
        setCustomMinutes(Math.floor(seconds / 60));
        setCustomSeconds(seconds % 60);
        if (!timerIsRunning) {
            startTimer();
        }
    }, [setTimerSeconds, startTimer, timerIsRunning]);

    const handleCustomTimerStart = useCallback(() => {
        const totalSeconds = customMinutes * 60 + customSeconds;
        if (totalSeconds > 0) {
            setTimerSeconds(totalSeconds);
            startTimer();
        }
    }, [customMinutes, customSeconds, setTimerSeconds, startTimer]);

    const increaseMinute = useCallback(() => {
        setCustomMinutes(prev => Math.min(prev + 1, 59));
    }, []);

    const decreaseMinute = useCallback(() => {
        setCustomMinutes(prev => Math.max(prev - 1, 0));
    }, []);

    const increaseSecond = useCallback(() => {
        setCustomSeconds(prev => (prev === 59 ? 0 : prev + 1));
    }, []);

    const decreaseSecond = useCallback(() => {
        setCustomSeconds(prev => (prev === 0 ? 59 : prev - 1));
    }, []);

    const handleMinuteInputChange = useCallback((e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setCustomMinutes(Math.max(0, Math.min(59, value)));
        }
    }, []);

    const handleSecondInputChange = useCallback((e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setCustomSeconds(Math.max(0, Math.min(59, value)));
        }
    }, []);

    return (
        <div className="container mx-auto p-4">
            <h2 className={`text-3xl font-bold mb-6 flex items-center gap-3 ${
                currentTheme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
                <Clock className={`h-8 w-8 ${
                    currentTheme === 'light' ? 'text-green-600' : 'text-green-400'
                }`} /> 
                Minuteur
            </h2>

            {/* Affichage principal du minuteur */}
            <div className={`rounded-2xl p-6 mb-6 border shadow-xl text-center ${
                currentTheme === 'light' 
                    ? 'bg-white border-gray-300' 
                    : 'bg-gray-800 border-gray-700'
            }`}>
                <p className={`text-7xl font-mono font-extrabold ${
                    currentTheme === 'light' ? 'text-green-600' : 'text-green-400'
                }`}>
                    {formatTime(timerSeconds)}
                </p>
                <div className="mt-6 flex justify-center gap-4">
                    <button
                        onClick={timerIsRunning ? pauseTimer : startTimer}
                        className={`p-4 rounded-full ${timerIsRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors shadow-lg`}
                        aria-label={timerIsRunning ? "Pause" : "Démarrer"}
                    >
                        {timerIsRunning ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                    </button>
                    <button
                        onClick={resetTimer}
                        className={`p-4 rounded-full text-white transition-colors shadow-lg ${
                            currentTheme === 'light' 
                                ? 'bg-gray-500 hover:bg-gray-600' 
                                : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                        aria-label="Réinitialiser"
                    >
                        <RotateCcw className="h-8 w-8" />
                    </button>
                </div>
                {timerIsFinished && timerSeconds === 0 && (
                    <p className={`text-sm mt-3 animate-pulse ${
                        currentTheme === 'light' ? 'text-yellow-600' : 'text-yellow-400'
                    }`}>Temps écoulé !</p>
                )}
            </div>

            {/* Préréglages du minuteur */}
            <div className={`rounded-2xl p-6 mb-6 border shadow-xl ${
                currentTheme === 'light' 
                    ? 'bg-white border-gray-300' 
                    : 'bg-gray-800 border-gray-700'
            }`}>
                <h3 className={`text-lg font-semibold mb-4 ${
                    currentTheme === 'light' ? 'text-gray-900' : 'text-white'
                }`}>Préréglages rapides :</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => handlePresetClick(60)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${
                            selectedPreset === 60 
                                ? 'bg-blue-600 text-white' 
                                : (currentTheme === 'light' 
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                        }`}
                    >
                        60s
                    </button>
                    <button
                        onClick={() => handlePresetClick(90)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${
                            selectedPreset === 90 
                                ? 'bg-blue-600 text-white' 
                                : (currentTheme === 'light' 
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                        }`}
                    >
                        90s
                    </button>
                    <button
                        onClick={() => handlePresetClick(120)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${
                            selectedPreset === 120 
                                ? 'bg-blue-600 text-white' 
                                : (currentTheme === 'light' 
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                        }`}
                    >
                        120s
                    </button>
                    <button
                        onClick={() => handlePresetClick(180)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${
                            selectedPreset === 180 
                                ? 'bg-blue-600 text-white' 
                                : (currentTheme === 'light' 
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                        }`}
                    >
                        180s
                    </button>
                    <button
                        onClick={() => handlePresetClick(240)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${
                            selectedPreset === 240 
                                ? 'bg-blue-600 text-white' 
                                : (currentTheme === 'light' 
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                        }`}
                    >
                        240s
                    </button>
                    <button
                        onClick={() => handlePresetClick(300)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${
                            selectedPreset === 300 
                                ? 'bg-blue-600 text-white' 
                                : (currentTheme === 'light' 
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600')
                        }`}
                    >
                        300s
                    </button>
                </div>
            </div>

            {/* Minuteur personnalisé */}
            <div className={`rounded-2xl p-6 mb-6 border shadow-xl ${
                currentTheme === 'light' 
                    ? 'bg-white border-gray-300' 
                    : 'bg-gray-800 border-gray-700'
            }`}>
                <h3 className={`text-lg font-semibold mb-4 ${
                    currentTheme === 'light' ? 'text-gray-900' : 'text-white'
                }`}>Définir un minuteur personnalisé :</h3>
                <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex flex-col items-center">
                        <button 
                            onClick={increaseMinute} 
                            className={`p-1 transition-colors disabled:opacity-50 ${
                                currentTheme === 'light' 
                                    ? 'text-gray-700 hover:text-gray-900' 
                                    : 'text-gray-300 hover:text-white'
                            }`} 
                            disabled={timerIsRunning}
                        >
                            <ChevronUp className="h-6 w-6" />
                        </button>
                        <input
                            type="number"
                            value={String(customMinutes).padStart(2, '0')}
                            onChange={handleMinuteInputChange}
                            className={`text-center rounded-lg px-3 py-2 w-20 text-xl appearance-none [moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0 ${
                                currentTheme === 'light' 
                                    ? 'bg-gray-100 text-gray-900 border border-gray-300' 
                                    : 'bg-gray-700 text-white border-gray-600'
                            }`}
                            disabled={timerIsRunning}
                            min="0"
                            max="59"
                            inputMode="numeric"
                            aria-label="Minutes pour le minuteur personnalisé"
                        />
                        <button 
                            onClick={decreaseMinute} 
                            className={`p-1 transition-colors disabled:opacity-50 ${
                                currentTheme === 'light' 
                                    ? 'text-gray-700 hover:text-gray-900' 
                                    : 'text-gray-300 hover:text-white'
                            }`} 
                            disabled={timerIsRunning}
                        >