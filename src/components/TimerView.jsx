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
    setTimerSeconds, // Cette prop est maintenant utilisée pour définir le temps
    restTimeInput = '90', // Assume this is a string
    setRestTimeInput, // Pour mettre à jour l'input textuel dans App.jsx
    formatTime, // Ensure formatTime is destructured from props
}) => {
    // Les états locaux pour les minutes et secondes personnalisées sont maintenant indépendants
    // de timerSeconds et sont utilisés pour l'input et le calcul du total AVANT de le passer à setTimerSeconds
    const [customMinutes, setCustomMinutes] = useState(1);
    const [customSeconds, setCustomSeconds] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(90); // Default to 90s, matches restTimeInput initially

    // Synchronise les états locaux customMinutes/customSeconds avec timerSeconds si timerSeconds est modifié de l'extérieur
    // et que le minuteur n'est pas en cours d'exécution.
    useEffect(() => {
        if (!timerIsRunning && timerSeconds === 0 && !timerIsFinished) {
            // Only update custom inputs if timer is reset or not active
            const totalSecondsFromInput = parseInt(restTimeInput, 10) || 0;
            setCustomMinutes(Math.floor(totalSecondsFromInput / 60));
            setCustomSeconds(totalSecondsFromInput % 60);
        } else if (!timerIsRunning && timerSeconds > 0 && !timerIsFinished) {
            // If timer was paused, update inputs to reflect current timerSeconds
            setCustomMinutes(Math.floor(timerSeconds / 60));
            setCustomSeconds(timerSeconds % 60);
        }
    }, [timerSeconds, timerIsRunning, timerIsFinished, restTimeInput]);

    // Presets de temps populaires
    const timePresets = [
        { label: '30s', value: 30 },
        { label: '45s', value: 45 },
        { label: '1min', value: 60 },
        { label: '1m30', value: 90 },
        { label: '2min', value: 120 },
        { label: '3min', value: 180 },
    ];

    const handlePresetClick = (value) => {
        setSelectedPreset(value);
        setTimerSeconds(value); // Définit le temps dans l'état global App.jsx
        setRestTimeInput(String(value)); // Met à jour l'input affiché si nécessaire
        // Pas besoin de startTimer ici, l'utilisateur doit cliquer sur "Play"
    };

    const handleCustomTimerStart = () => {
        const totalSeconds = (customMinutes * 60) + customSeconds;
        if (totalSeconds > 0) {
            setTimerSeconds(totalSeconds); // Définit le temps dans l'état global App.jsx
            setRestTimeInput(String(totalSeconds)); // Met à jour l'input affiché
            startTimer(); // Démarre le minuteur
        }
    };

    // Fonctions pour ajuster les minutes/secondes personnalisées
    const increaseMinute = () => setCustomMinutes(prev => Math.min(prev + 1, 59)); // Max 59 minutes
    const decreaseMinute = () => setCustomMinutes(prev => Math.max(prev - 1, 0));
    const increaseSecond = () => setCustomSeconds(prev => Math.min(prev + 1, 59)); // Max 59 seconds
    const decreaseSecond = () => setCustomSeconds(prev => Math.max(prev - 1, 0));

    // Définir la valeur de l'input des minutes
    const handleMinuteInputChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setCustomMinutes(isNaN(value) ? 0 : Math.min(Math.max(value, 0), 59));
    };

    // Définir la valeur de l'input des secondes
    const handleSecondInputChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setCustomSeconds(isNaN(value) ? 0 : Math.min(Math.max(value, 0), 59));
    };


    return (
        <div className="p-4 bg-gray-900 min-h-screen text-gray-100 font-sans">
            <h1 className="text-3xl font-extrabold text-white mb-6 text-center">Minuteur de repos</h1>

            {/* Affichage du minuteur principal */}
            <div className="bg-gray-800 rounded-3xl p-8 mb-8 text-center shadow-lg border border-gray-700 relative">
                <Clock className="h-16 w-16 text-green-400 mx-auto mb-4 animate-pulse-slow" />
                <div className="text-6xl sm:text-7xl font-bold text-white mb-6 tracking-wide">
                    {formatTime(timerSeconds)}
                </div>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={timerIsRunning ? pauseTimer : startTimer}
                        className={`p-4 rounded-full shadow-lg transition-all duration-200 ${timerIsRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}
                        disabled={timerSeconds === 0 && !timerIsRunning}
                        aria-label={timerIsRunning ? 'Pause' : 'Démarrer'}
                    >
                        {timerIsRunning ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white" />}
                    </button>
                    <button
                        onClick={resetTimer}
                        className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors shadow-lg"
                        aria-label="Réinitialiser"
                    >
                        <RotateCcw className="h-8 w-8 text-white" />
                    </button>
                </div>
                {timerIsFinished && timerSeconds === 0 && (
                    <p className="text-green-400 mt-4 text-sm font-semibold animate-bounce">
                        Temps de repos terminé !
                    </p>
                )}
            </div>

            {/* Presets de temps */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-8 shadow-md border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Presets Rapides
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {timePresets.map((preset) => (
                        <button
                            key={preset.value}
                            onClick={() => handlePresetClick(preset.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                                ${selectedPreset === preset.value && !timerIsRunning
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-gray-700 text-gray-300 hover:bg-blue-500/30 hover:text-white'
                                }
                                ${timerIsRunning ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                            disabled={timerIsRunning}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Personnaliser le temps */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-8 shadow-md border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-400" />
                    Personnaliser
                </h3>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                    {/* Minutes */}
                    <div className="flex items-center gap-2">
                        <button onClick={decreaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><Minus className="h-5 w-5" /></button>
                        <input
                            type="number"
                            value={String(customMinutes).padStart(2, '0')}
                            onChange={handleMinuteInputChange}
                            className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-16 text-xl font-mono appearance-none"
                            disabled={timerIsRunning}
                            min="0"
                            max="59"
                            inputMode="numeric"
                        />
                        <button onClick={increaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><Plus className="h-5 w-5" /></button>
                        <span className="text-gray-400 text-base">min</span>
                    </div>

                    {/* Secondes */}
                    <div className="flex items-center gap-2">
                        <button onClick={decreaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><Minus className="h-5 w-5" /></button>
                        <input
                            type="number"
                            value={String(customSeconds).padStart(2, '0')}
                            onChange={handleSecondInputChange}
                            className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-16 text-xl font-mono appearance-none"
                            disabled={timerIsRunning}
                            min="0"
                            max="59"
                            inputMode="numeric"
                        />
                        <button onClick={increaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><Plus className="h-5 w-5" /></button>
                        <span className="text-gray-400 text-base">s</span>
                    </div>
                </div>

                <div className="text-center mb-4">
                    <button
                        onClick={handleCustomTimerStart}
                        disabled={timerIsRunning || ((customMinutes === 0 && customSeconds === 0))}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all flex items-center gap-2 text-lg mx-auto"
                    >
                        <Play className="h-5 w-5" />
                        Démarrer le minuteur personnalisé
                    </button>
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
                        <p className="text-gray-300">30-90 secondes pour une récupération rapide</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerView;