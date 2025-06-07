import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

/**
 * Composant Toast amélioré pour afficher des notifications temporaires.
 * @param {object} props - Les props du composant.
 * @param {string} props.message - Le message à afficher dans le toast.
 * @param {'success' | 'error' | 'warning' | 'info'} props.type - Le type de toast.
 * @param {function} props.onClose - Fonction de rappel à appeler lorsque le toast doit être fermé.
 * @param {object} props.action - Action optionnelle avec label et onClick.
 * @param {number} props.duration - Durée d'affichage en ms (défaut: 3000).
 * @param {string} props.position - Position du toast ('bottom-center', 'top-right', etc.).
 */
const Toast = ({ 
    message, 
    type = 'info', 
    onClose, 
    action = null, 
    duration = 3000,
    position = 'bottom-center'
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(100);

    // Configuration des styles par type
    const typeConfig = {
        success: {
            bg: 'bg-emerald-500',
            icon: CheckCircle,
            iconColor: 'text-white'
        },
        error: {
            bg: 'bg-red-500',
            icon: XCircle,
            iconColor: 'text-white'
        },
        warning: {
            bg: 'bg-amber-500',
            icon: AlertTriangle,
            iconColor: 'text-white'
        },
        info: {
            bg: 'bg-blue-500',
            icon: Info,
            iconColor: 'text-white'
        }
    };

    const config = typeConfig[type] || typeConfig.info;
    const Icon = config.icon;

    // Configuration des positions
    const positionClasses = {
        'bottom-center': 'bottom-5 left-1/2 -translate-x-1/2',
        'top-right': 'top-5 right-5',
        'top-left': 'top-5 left-5',
        'bottom-right': 'bottom-5 right-5',
        'bottom-left': 'bottom-5 left-5',
        'top-center': 'top-5 left-1/2 -translate-x-1/2'
    };

    // Animation d'entrée
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Gestion de la durée et de la barre de progression
    useEffect(() => {
        if (!duration) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev - (100 / (duration / 50));
                return newProgress <= 0 ? 0 : newProgress;
            });
        }, 50);

        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Délai pour l'animation de sortie
        }, duration);

        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [duration, onClose]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    const handleActionClick = () => {
        if (action?.onClick) {
            action.onClick();
        }
        handleClose();
    };

    return (
        <div 
            className={`fixed ${positionClasses[position]} z-50 transform transition-all duration-300 ease-out ${
                isVisible 
                    ? 'translate-y-0 opacity-100 scale-100' 
                    : 'translate-y-2 opacity-0 scale-95'
            }`}
        >
            <div className={`${config.bg} text-white rounded-xl shadow-2xl border border-white/20 backdrop-blur-sm max-w-sm min-w-[300px] overflow-hidden`}>
                {/* Barre de progression */}
                {duration && (
                    <div className="h-1 bg-white/20">
                        <div 
                            className="h-full bg-white/40 transition-all duration-75 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <Icon className={`h-5 w-5 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-relaxed">
                                {message}
                            </p>
                        </div>
                        {!action && (
                            <button
                                onClick={handleClose}
                                className="flex-shrink-0 ml-2 p-1 rounded-md hover:bg-white/20 transition-colors"
                                aria-label="Fermer"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {action && (
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                onClick={handleActionClick}
                                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                            >
                                {action.label}
                            </button>
                            <button
                                onClick={handleClose}
                                className="p-1 rounded-md hover:bg-white/20 transition-colors"
                                aria-label="Fermer"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Toast;