// TimerModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Clock, Zap, X, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Composant TimerModal pour la gestion du minuteur de repos en modal.
 * @param {object} props - Les props du composant.
 * @param {boolean} props.isOpen - Indique si la modale est ouverte.
 * @param {function} props.onClose - Fonction à appeler pour fermer la modale.
 * @param {number} props.timerSeconds - Le nombre de secondes restantes du minuteur.
 * @param {boolean} props.timerIsRunning - Indique si le minuteur est en cours.
 * @param {boolean} props.timerIsFinished - Indique si le minuteur est terminé.
 * @param {function} props.startTimer - Fonction pour démarrer le minuteur.
 * @param {function} props.pauseTimer - Fonction pour mettre en pause le minuteur.
 * @param {function} props.resetTimer - Fonction pour réinitialiser le minuteur.
 * @param {function} props.setTimerSeconds - Fonction pour définir le temps du minuteur.
 * @param {function} props.formatTime - Fonction pour formater le temps en MM:SS.
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
    // Les états locaux pour les minutes et secondes personnalisées sont maintenant indépendants
    // de timerSeconds et sont utilisés pour l'input et le calcul du total AVANT de le passer à setTimerSeconds
    const [customMinutes, setCustomMinutes] = useState(1);
    const [customSeconds, setCustomSeconds] = useState(30);
    const [selectedPreset, setSelectedPreset] = useState(90); // Default to 90s for internal state

    // Synchronise les états locaux customMinutes/customSeconds avec timerSeconds
    // S'assure que si le minuteur est réinitialisé ou arrêté, les inputs reflètent timerSeconds
    useEffect(() => {
        if (!timerIsRunning && timerSeconds === 0 && !timerIsFinished) {
            // Si le minuteur est à 0 et non démarré/fini, réinitialiser les inputs au preset par défaut
            setCustomMinutes(Math.floor(selectedPreset / 60));
            setCustomSeconds(selectedPreset % 60);
        } else if (!timerIsRunning) {
            // Si le minuteur est arrêté mais a une valeur, mettez à jour les inputs pour refléter cette valeur.
            setCustomMinutes(Math.floor(timerSeconds / 60));
            setCustomSeconds(timerSeconds % 60);
        }
    }, [timerSeconds, timerIsRunning, timerIsFinished, selectedPreset]);


    const handlePresetClick = useCallback((seconds) => {
        setTimerSeconds(seconds);
        setSelectedPreset(seconds);
        // Mettre à jour les champs personnalisés pour refléter le préréglage
        setCustomMinutes(Math.floor(seconds / 60));
        setCustomSeconds(seconds % 60);
        if (!timerIsRunning) { // Démarrer seulement si pas déjà en cours
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
        setCustomMinutes(prev => Math.min(prev + 1, 59)); // Limite à 59 minutes
    }, []);

    const decreaseMinute = useCallback(() => {
        setCustomMinutes(prev => Math.max(prev - 1, 0)); // Minimum 0 minute
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


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    aria-label="Fermer le minuteur"
                >
                    <X className="h-6 w-6" />
                </button>

                <h2 className="text-3xl font-bold text-white text-center mb-6 flex items-center justify-center gap-3">
                    <Clock className="h-8 w-8 text-green-400" /> Minuteur de repos
                </h2>

                {/* Affichage principal du minuteur */}
                <div className="text-center mb-8">
                    <p className="text-6xl sm:text-7xl font-mono font-extrabold text-green-400">
                        {formatTime(timerSeconds)}
                    </p>
                    <div className="mt-4 flex justify-center gap-4">
                        <button
                            onClick={timerIsRunning ? pauseTimer : startTimer}
                            className={`p-3 rounded-full ${timerIsRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors shadow-lg`}
                            aria-label={timerIsRunning ? "Pause" : "Démarrer"}
                        >
                            {timerIsRunning ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
                        </button>
                        <button
                            onClick={resetTimer}
                            className="p-3 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-colors shadow-lg"
                            aria-label="Réinitialiser"
                        >
                            <RotateCcw className="h-7 w-7" />
                        </button>
                    </div>
                    {timerIsFinished && timerSeconds === 0 && (
                        <p className="text-sm text-yellow-400 mt-2 animate-pulse">Temps écoulé !</p>
                    )}
                </div>

                {/* Préréglages du minuteur */}
                <div className="mb-8 border-t border-b border-gray-700 py-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Préréglages rapides :</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => handlePresetClick(60)}
                            className={`py-2 px-4 rounded-lg font-medium transition-all ${selectedPreset === 60 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            60s
                        </button>
                        <button
                            onClick={() => handlePresetClick(90)}
                            className={`py-2 px-4 rounded-lg font-medium transition-all ${selectedPreset === 90 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            90s
                        </button>
                        <button
                            onClick={() => handlePresetClick(120)}
                            className={`py-2 px-4 rounded-lg font-medium transition-all ${selectedPreset === 120 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            120s
                        </button>
                        <button
                            onClick={() => handlePresetClick(180)}
                            className={`py-2 px-4 rounded-lg font-medium transition-all ${selectedPreset === 180 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            180s
                        </button>
                        <button
                            onClick={() => handlePresetClick(240)}
                            className={`py-2 px-4 rounded-lg font-medium transition-all ${selectedPreset === 240 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            240s
                        </button>
                        <button
                            onClick={() => handlePresetClick(300)}
                            className={`py-2 px-4 rounded-lg font-medium transition-all ${selectedPreset === 300 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                            300s
                        </button>
                    </div>
                </div>

                {/* Minuteur personnalisé */}
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-3">Minuteur personnalisé :</h3>
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="flex flex-col items-center">
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
                        <span className="text-3xl font-bold text-gray-400">:</span>
                        <div className="flex flex-col items-center">
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
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg transition-all flex items-center gap-1 text-sm ml-4"
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