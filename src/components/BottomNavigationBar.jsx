import React from 'react';
import { Dumbbell, Clock, History, BarChart3 } from 'lucide-react';

/**
 * Composant de barre de navigation inférieure pour l'application mobile.
 */
const BottomNavigationBar = ({ currentView, setCurrentView }) => {
    const navItems = [
        { 
            name: 'Entraînement', 
            icon: Dumbbell, 
            view: 'workout',
            color: 'text-blue-400'
        },
        { 
            name: 'Minuteur', 
            icon: Clock, 
            view: 'timer',
            color: 'text-green-400'
        },
        { 
            name: 'Statistiques', 
            icon: BarChart3, 
            view: 'stats',
            color: 'text-purple-400'
        },
        { 
            name: 'Historique', 
            icon: History, 
            view: 'history',
            color: 'text-yellow-400'
        }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 shadow-lg z-50">
            <div className="flex justify-around items-center h-16 sm:h-20 max-w-lg mx-auto px-2">
                {navItems.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => setCurrentView(item.view)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ease-in-out min-w-0 flex-1 mx-1 ${
                            currentView === item.view 
                                ? `${item.color} bg-gray-800/50 scale-105` 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                        }`}
                    >
                        <item.icon className={`h-6 w-6 sm:h-7 sm:w-7 mb-1 ${
                            currentView === item.view ? 'scale-110' : ''
                        } transition-transform duration-200`} />
                        <span className={`text-xs sm:text-sm font-medium leading-tight text-center ${
                            currentView === item.view ? 'font-semibold' : ''
                        }`}>
                            {item.name}
                        </span>
                        {currentView === item.view && (
                            <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 ${item.color.replace('text-', 'bg-')} rounded-full`}></div>
                        )}
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default BottomNavigationBar;