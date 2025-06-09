import React from 'react';
import { Dumbbell, Clock, History } from 'lucide-react';

/**
 * Composant de barre de navigation inférieure pour l'application mobile.
 * @param {object} props - Les props du composant.
 * @param {string} props.currentView - La vue actuellement sélectionnée ('workout', 'timer', 'history').
 * @param {function} props.setCurrentView - Fonction pour changer la vue.
 */
const BottomNavigationBar = ({ currentView, setCurrentView }) => {
    const navItems = [
        { name: 'Entraînement', icon: Dumbbell, view: 'workout' },
        { name: 'Minuteur', icon: Clock, view: 'timer' },
        { name: 'Historique', icon: History, view: 'history' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 shadow-lg z-50">
            <div className="flex justify-around items-center h-16 sm:h-20 max-w-lg mx-auto">
                {navItems.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => setCurrentView(item.view)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200 ease-in-out
                            ${currentView === item.view ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        <item.icon className="h-6 w-6 sm:h-7 sm:w-7 mb-1" />
                        <span className="text-xs sm:text-sm font-medium">{item.name}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default BottomNavigationBar;
