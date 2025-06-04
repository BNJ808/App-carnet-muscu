import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

/**
 * Composant TimerView pour afficher le minuteur de repos.
 * @param {object} props - Les props du composant.
 * @param {number} props.timerSeconds - Secondes restantes du minuteur.
 * @param {boolean} props.timerIsRunning - Indique si le minuteur est en cours.
 * @param {boolean} props.timerIsFinished - Indique si le minuteur est terminé.
 * @param {function} props.startTimer - Fonction pour démarrer le minuteur.
 * @param {function} props.pauseTimer - Fonction pour mettre en pause le minuteur.
 * @param {function} props.resetTimer - Fonction pour réinitialiser le minuteur.
 * @param {function} props.setTimerSeconds - Fonction pour définir les secondes du minuteur.
 * @param {string} props.restTimeInput - Valeur du champ de saisie du temps de repos.
 * @param {function} props.setRestTimeInput - Fonction pour définir le temps de repos.
 * @param {function} props.formatTime - Fonction pour formater le temps du minuteur.
 */
const TimerView = ({
    timerSeconds, timerIsRunning, timerIsFinished,
    startTimer, pauseTimer, resetTimer,
    setTimerSeconds, restTimeInput, setRestTimeInput, formatTime
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-8 px-4"> {/* Removed min-h-[calc(...)] to fix mobile scroll issue */}
            <div className="w-full max-w-md bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-700 text-center">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-400 mb-6">Minuteur de Repos</h2>

                <div className="mb-8">
                    <p className="text-6xl sm:text-7xl font-bold text-white mb-4 transition-colors duration-300">
                        {formatTime(timerSeconds)}
                    </p>
                    {timerIsFinished && (
                        <p className="text-red-400 text-xl sm:text-2xl font-bold mt-4 animate-pulse">Temps écoulé !</p>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
                    {!timerIsRunning ? (
                        <button
                            onClick={() => startTimer(parseInt(restTimeInput, 10) || 0)} // Start with input value
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full transition transform hover:scale-105 shadow-lg text-lg sm:text-xl flex items-center justify-center w-full sm:w-auto"
                        >
                            <Play className="h-6 w-6 mr-2" /> Démarrer
                        </button>
                    ) : (
                        <button
                            onClick={pauseTimer}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full transition transform hover:scale-105 shadow-lg text-lg sm:text-xl flex items-center justify-center w-full sm:w-auto"
                        >
                            <Pause className="h-6 w-6 mr-2" /> Pause
                        </button>
                    )}
                    <button
                        onClick={() => resetTimer(parseInt(restTimeInput, 10) || 0)} // Reset to input value
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full transition transform hover:scale-105 shadow-lg text-lg sm:text-xl flex items-center justify-center w-full sm:w-auto"
                    >
                        <RotateCcw className="h-6 w-6 mr-2" /> Réinitialiser
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                    <label htmlFor="restTimeInput" className="text-gray-300 text-base sm:text-lg">Temps de repos (secondes):</label>
                    <input
                        type="number"
                        id="restTimeInput"
                        className="shadow appearance-none border border-gray-600 rounded w-full sm:w-28 py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-lg text-center"
                        value={restTimeInput}
                        onChange={(e) => {
                            const value = e.target.value;
                            setRestTimeInput(value === '' ? '' : (parseInt(value, 10) || 0));
                        }}
                        min="0"
                    />
                </div>
            </div>
        </div>
    );
};

export default TimerView;
