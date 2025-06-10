// TimerView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Clock, Zap, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Composant TimerView pour la gestion du minuteur de repos.
 * @param {object} props - Les props du composant.
 * @param {number} props.timerSeconds - Le nombre de secondes restantes du minuteur.
 * @param {boolean} props.timerIsRunning - Indique si le minuteur est en cours.
 * @param {boolean} props.timerIsFinished - Indique si le minuteur est terminé.
 * @param {function} props.startTimer - Fonction pour démarrer le minuteur.
 * @param {function} props.pauseTimer - Fonction pour mettre en pause le minuteur.
 * @param {function} props.resetTimer - Fonction pour réinitialiser le minuteur.
 * @param {function} props.setTimerSeconds - Fonction pour définir le temps du minuteur.
 * @param {string} props.restTimeInput - L'entrée textuelle du temps de repos (non utilisé directement ici, mais peut l'être).
 * @param {function} props.setRestTimeInput - Fonction pour mettre à jour l'entrée textuelle du temps de repos (non utilisé directement ici).
 * @param {function} props.formatTime - Fonction pour formater le temps en MM:SS.
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

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Clock className="h-8 w-8 text-green-400" /> Minuteur
            </h2>

            {/* Affichage principal du minuteur */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700 shadow-xl text-center">
                <p className="text-7xl font-mono font-extrabold text-green-400">
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
                        className="p-4 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-colors shadow-lg"
                        aria-label="Réinitialiser"
                    >
                        <RotateCcw className="h-8 w-8" />
                    </button>
                </div>
                {timerIsFinished && timerSeconds === 0 && (
                    <p className="text-sm text-yellow-400 mt-3 animate-pulse">Temps écoulé !</p>
                )}
            </div>

            {/* Préréglages du minuteur */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700 shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Préréglages rapides :</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => handlePresetClick(60)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${selectedPreset === 60 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        60s
                    </button>
                    <button
                        onClick={() => handlePresetClick(90)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${selectedPreset === 90 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        90s
                    </button>
                    <button
                        onClick={() => handlePresetClick(120)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${selectedPreset === 120 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        120s
                    </button>
                    <button
                        onClick={() => handlePresetClick(180)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${selectedPreset === 180 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        180s
                    </button>
                    <button
                        onClick={() => handlePresetClick(240)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${selectedPreset === 240 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        240s
                    </button>
                    <button
                        onClick={() => handlePresetClick(300)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all text-lg ${selectedPreset === 300 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        300s
                    </button>
                </div>
            </div>

            {/* Minuteur personnalisé */}
            <div className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700 shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4">Définir un minuteur personnalisé :</h3>
                <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex flex-col items-center">
                        <button onClick={increaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-6 w-6" /></button>
                        <input
                            type="number"
                            value={String(customMinutes).padStart(2, '0')}
                            onChange={handleMinuteInputChange}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-20 text-xl appearance-none [moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0"
                            disabled={timerIsRunning}
                            min="0"
                            max="59"
                            inputMode="numeric"
                            aria-label="Minutes pour le minuteur personnalisé"
                        />
                        <button onClick={decreaseMinute} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronDown className="h-6 w-6" /></button>
                        <span className="text-gray-400 text-sm mt-1">minutes</span>
                    </div>
                    <span className="text-4xl font-bold text-gray-400">:</span>
                    <div className="flex flex-col items-center">
                        <button onClick={increaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronUp className="h-6 w-6" /></button>
                        <input
                            type="number"
                            value={String(customSeconds).padStart(2, '0')}
                            onChange={handleSecondInputChange}
                            className="bg-gray-700 text-white text-center rounded-lg px-3 py-2 w-20 text-xl appearance-none [moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0"
                            disabled={timerIsRunning}
                            min="0"
                            max="59"
                            inputMode="numeric"
                            aria-label="Secondes pour le minuteur personnalisé"
                        />
                        <button onClick={decreaseSecond} className="p-1 text-gray-300 hover:text-white transition-colors disabled:opacity-50" disabled={timerIsRunning}><ChevronDown className="h-6 w-6" /></button>
                        <span className="text-gray-400 text-sm mt-1">secondes</span>
                    </div>
                </div>
                <button
                    onClick={handleCustomTimerStart}
                    disabled={timerIsRunning || (customMinutes === 0 && customSeconds === 0)}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-lg"
                >
                    <Play className="h-5 w-5" />
                    Démarrer le minuteur personnalisé
                </button>
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
                        <p className="text-gray-300">30-90 secondes pour une endurance musculaire accrue</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimerView;