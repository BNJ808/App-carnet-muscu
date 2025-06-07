import React from 'react';
import { Dumbbell, Clock, History, Activity, BarChart3 } from 'lucide-react';

/**
 * Composant de barre de navigation inférieure amélioré pour l'application mobile.
 * Inclut des indicateurs visuels et des animations fluides.
 */
const BottomNavigationBar = ({ currentView, setCurrentView }) => {
    const navItems = [
        { 
            name: 'Entraînement', 
            icon: Dumbbell, 
            view: 'workout',
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
        },
        { 
            name: 'Minuteur', 
            icon: Clock, 
            view: 'timer',
            color: 'text-green-400',
            bgColor: 'bg-green-500/20'
        },
        { 
            name: 'Historique', 
            icon: History, 
            view: 'history',
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/20'
        }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50">
            {/* Effet de flou en arrière-plan */}
            <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-lg border-t border-gray-700/50"></div>
            
            {/* Contenu de la navigation */}
            <div className="relative flex justify-around items-center h-20 max-w-lg mx-auto px-4">
                {navItems.map((item, index) => {
                    const isActive = currentView === item.view;
                    const Icon = item.icon;
                    
                    return (
                        <button
                            key={item.view}
                            onClick={() => setCurrentView(item.view)}
                            className={`relative flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 ease-in-out transform ${
                                isActive 
                                    ? `${item.bgColor} scale-110 shadow-lg` 
                                    : 'hover:bg-gray-800/50 hover:scale-105'
                            }`}
                            style={{
                                minWidth: '64px',
                                minHeight: '64px'
                            }}
                        >
                            {/* Indicateur actif */}
                            {isActive && (
                                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
                            )}
                            
                            {/* Icône avec animation */}
                            <div className={`relative ${isActive ? 'animate-pulse' : ''}`}>
                                <Icon className={`h-6 w-6 transition-colors duration-200 ${
                                    isActive ? item.color : 'text-gray-400'
                                }`} />
                                
                                {/* Point d'activité */}
                                {isActive && (
                                    <div className={`absolute -top-1 -right-1 w-2 h-2 ${item.color.replace('text-', 'bg-')} rounded-full animate-ping`}></div>
                                )}
                            </div>
                            
                            {/* Label */}
                           <span className={`text-xs font-medium mt-1 transition-colors duration-200 ${
                               isActive ? item.color : 'text-gray-400'
                           }`}>
                               {item.name}
                           </span>
                           
                           {/* Badge de notification (exemple pour futures fonctionnalités) */}
                           {item.view === 'history' && (
                               <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                                   <span className="text-xs text-white font-bold">!</span>
                               </div>
                           )}
                       </button>
                   );
               })}
           </div>
           
           {/* Indicateur de swipe (optionnel) */}
           <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-600 rounded-full opacity-50"></div>
       </nav>
   );
};

export default BottomNavigationBar;