import React, { useState, useEffect } from 'react';
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
    setTimerSeconds, // Cette prop est maintenant utilisée pour définir le temps
    formatTime // Ensure formatTime is destructured from props
}) => {
    // Les états locaux pour les minutes et secondes personnalisées sont maintenant indépendants
    // de timerSeconds et sont utilisés pour l'input et le calcul du total AVANT de le passer à setTimerSeconds
    const [customMinutes, setCustomMinutes] = useState(1);
    const [customSeconds, setCustomSeconds] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(90); // Default to 90s for internal state

    // Synchronise les états locaux customMinutes/customSeconds avec timerSeconds
    // S'assure que si le minuteur est réinitialisé ou arrêté, les inputs reflètent timerSeconds
    useEffect(() => {
        if (!timerIsRunning && timerSeconds === 0 && !timerIsFinished) {
            // Si le minuteur est à 0 et non démarré/fini, réinitialiser les inputs au preset par défaut ou 90s
            setCustomMinutes(1);
            setCustomSeconds(30);
            setSelectedPreset(90);
        } else if (!timerIsRunning && timerSeconds > 0) {
            // Si le minuteur est en pause, mettez à jour les inputs pour refléter le temps actuel
            setCustomMinutes(Math.floor(timerSeconds / 60));
            setCustomSeconds(timerSeconds % 60);
        }
        // else if (timerIsRunning) { // If running, don't update custom inputs, they are locked
        //     // Optionally, you might want to disable the inputs while running.
        //     // This is handled by `disabled={timerIsRunning}` in JSX.
        // }
    }, [timerSeconds, timerIsRunning, timerIsFinished]);


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

    const handlePresetClick = (value) => {
        setSelectedPreset(value);
        setTimerSeconds(value); // Définit le temps dans l'état global App.jsx
        // Pas besoin de startTimer ici, l'utilisateur doit cliquer sur "Play"
    };

    const handleCustomTimerStart = () => {
        const totalSeconds = (customMinutes * 60) + customSeconds;
        if (totalSeconds > 0) {
            setTimerSeconds(totalSeconds); // Définit le temps dans l'état global App.jsx
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 border border-gray-700 relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
                    aria-label="Fermer le minuteur"
                >
                    <X className="h-6 w-6" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6 text-center flex items-center justify-center gap-2">
                    <Clock className="h-7 w-7 text-green-400" />
                    Minuteur de repos
                </h2>

                {/* Affichage du minuteur principal */}
                <div className="text-center mb-6">
                    <div className="text-5xl font-bold text-white mb-4">
                        {formatTime(timerSeconds)}
                    </div>
                    <div className="flex justify-center space-x-4">
                        <button
                            onClick={timerIsRunning ? pauseTimer : startTimer}
                            className={`p-3 rounded-full shadow-lg transition-all duration-200 ${timerIsRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}
                            disabled={timerSeconds === 0 && !timerIsRunning}
                            aria-label={timerIsRunning ? 'Pause' : 'Démarrer'}
                        >
                            {timerIsRunning ? <Pause className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 text-white" />}
                        </button>
                        <button
                            onClick={resetTimer}
                            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors shadow-lg"
                            aria-label="Réinitialiser"
                        >
                            <RotateCcw className="h-6 w-6 text-white" />
                        </button>
                    </div>
                    {timerIsFinished && timerSeconds === 0 && (
                        <p className="text-green-400 mt-3 text-xs font-semibold animate-bounce">
                            Temps de repos terminé !
                        </p>
                    )}
                </div>

                {/* Presets de temps */}
                <div className="bg-gray-700/50 rounded-lg p-4 mb-5 border border-gray-600">
                    <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        Presets Rapides
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        {timePresets.map((preset) => (
                            <button
                                key={preset.value}
                                onClick={() => handlePresetClick(preset.value)}
                                className={`px-3 py-2 rounded-md text-xs font-medium transition-all duration-200
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
                <div className="bg-gray-700/50 rounded-lg p-4 mb-5 border border-gray-600">
                    <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        Personnaliser
                    </h3>
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2">
                            {/* Minutes */}
                            <button onClick={increaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-5 w-5" /></button>
                            <input
                                type="number"
                                value={String(customMinutes).padStart(2, '0')}
                                onChange={handleMinuteInputChange}
                                className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-12 text-sm appearance-none"
                                disabled={timerIsRunning}
                                min="0"
                                max="59"
                                inputMode="numeric"
                            />
                            <button onClick={decreaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronDown className="h-5 w-5" /></button>
                            <span className="text-gray-400 text-xs mt-1">min</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Secondes */}
                            <button onClick={increaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-5 w-5" /></button>
                            <input
                                type="number"
                                value={String(customSeconds).padStart(2, '0')}
                                onChange={handleSecondInputChange}
                                className="bg-gray-700 text-white text-center rounded-lg px-2 py-1 w-12 text-sm appearance-none"
                                disabled={timerIsRunning}
                                min="0"
                                max="59"
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
    );
};

export default TimerModal;