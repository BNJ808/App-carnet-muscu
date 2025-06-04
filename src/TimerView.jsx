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
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] p-4 sm:p-6 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
            <div className="mb-8 p-4 bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl sm:text-3xl font-bold text-center text-blue-400 mb-6">Minuteur de repos</h2>
                <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="text-6xl sm:text-7xl font-extrabold text-white">
                        {formatTime(timerSeconds)}
                    </div>
                    <div className="flex space-x-4 sm:space-x-6">
                        <button
                            onClick={() => startTimer(restTimeInput === '' ? 90 : parseInt(restTimeInput, 10))}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full transition transform hover:scale-105 shadow-lg text-lg sm:text-xl flex items-center justify-center"
                            disabled={timerIsRunning && timerSeconds > 0}
                        >
                            <Play className="h-6 w-6 mr-2" /> {timerIsRunning ? 'Reprendre' : 'Démarrer'}
                        </button>
                        <button
                            onClick={pauseTimer}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full transition transform hover:scale-105 shadow-lg text-lg sm:text-xl flex items-center justify-center"
                            disabled={!timerIsRunning}
                        >
                            <Pause className="h-6 w-6 mr-2" /> Pause
                        </button>
                        <button
                            onClick={() => resetTimer(restTimeInput === '' ? 90 : parseInt(restTimeInput, 10))}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full transition transform hover:scale-105 shadow-lg text-lg sm:text-xl flex items-center justify-center"
                        >
                            <RotateCcw className="h-6 w-6 mr-2" /> Réinitialiser
                        </button>
                    </div>
                    <div className="flex items-center space-x-3 mt-4">
                        <label htmlFor="restTimeInput" className="text-gray-300 text-base sm:text-lg">Temps de repos (secondes):</label>
                        <input
                            type="number"
                            id="restTimeInput"
                            className="shadow appearance-none border border-gray-600 rounded w-28 py-2 px-3 sm:py-3 sm:px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-lg"
                            value={restTimeInput}
                            onChange={(e) => {
                                const value = e.target.value;
                                setRestTimeInput(value === '' ? '' : (parseInt(value, 10) || 0));
                            }}
                            min="0"
                        />
                    </div>
                    {timerIsFinished && (
                        <p className="text-red-400 text-xl sm:text-2xl font-bold mt-4 animate-pulse">Temps écoulé !</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimerView;
