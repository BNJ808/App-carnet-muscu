import React, { useEffect } from 'react';

/**
 * Composant Toast pour afficher des notifications temporaires.
 * @param {object} props - Les props du composant.
 * @param {string} props.message - Le message à afficher dans le toast.
 * @param {'success' | 'error' | 'warning' | 'info'} props.type - Le type de toast.
 * @param {function} props.onClose - Fonction de rappel à appeler lorsque le toast doit être fermé.
 * @param {object} props.action - Action optionnelle avec label et onClick.
 * @param {number} props.duration - Durée d'affichage en ms (défaut: 3000).
 */
const Toast = ({ message, type = 'info', onClose, action, duration = 3000 }) => {
    // Détermine les couleurs en fonction du type de toast
    const getToastColors = () => {
        switch (type) {
            case 'success':
                return 'bg-green-500 border-green-400';
            case 'error':
                return 'bg-red-500 border-red-400';
            case 'warning':
                return 'bg-yellow-500 border-yellow-400';
            case 'info':
            default:
                return 'bg-blue-500 border-blue-400';
        }
    };

    // Effet pour masquer le toast automatiquement
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [onClose, duration]);

    return (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-6 py-4 rounded-lg shadow-2xl ${getToastColors()} text-white font-medium z-50 animate-fade-in-up transition-all duration-300 ease-out max-w-sm w-full mx-4 border-l-4`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm leading-relaxed">{message}</p>
                    {action && (
                        <button
                            onClick={() => {
                                action.onClick();
                                onClose();
                            }}
                            className="mt-2 text-white underline text-xs hover:no-underline transition-all"
                        >
                            {action.label}
                        </button>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="ml-3 text-white/80 hover:text-white transition-colors text-lg leading-none"
                    aria-label="Fermer"
                >
                    ×
                </button>
            </div>
        </div>
    );
};

export default Toast;
