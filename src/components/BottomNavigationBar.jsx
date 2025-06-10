// BottomNavigationBar.jsx
import React from 'react';
import { Dumbbell, Clock, History, BarChart3 } from 'lucide-react';

/**
 * Composant de barre de navigation inférieure pour l'application mobile.
 * @param {object} props - Les props du composant.
 * @param {string} props.currentView - La vue actuellement sélectionnée.
 * @param {function} props.setCurrentView - Fonction pour changer la vue.
 */
const BottomNavigationBar = ({ currentView, setCurrentView }) => {
    // Définition des éléments de navigation
    const navItems = [
        {
            name: 'Entraînement',
            icon: Dumbbell, // Icône pour la vue d'entraînement
            view: 'workout', // Nom de la vue correspondante
            color: 'text-blue-400' // Couleur associée à la vue
        },
        {
            name: 'Minuteur',
            icon: Clock, // Icône pour la vue du minuteur
            view: 'timer', // Nom de la vue correspondante
            color: 'text-green-400' // Couleur associée à la vue
        },
        {
            name: 'Statistiques',
            icon: BarChart3, // Icône pour la vue des statistiques
            view: 'stats', // Nom de la vue correspondante
            color: 'text-purple-400' // Couleur associée à la vue
        },
        {
            name: 'Historique',
            icon: History, // Icône pour la vue historique
            view: 'history', // Nom de la vue correspondante
            color: 'text-yellow-400' // Couleur associée à la vue
        }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 shadow-lg z-40">
            <div className="flex justify-around h-16">
                {navItems.map((item) => (
                    <button
                        key={item.view}
                        onClick={() => setCurrentView(item.view)}
                        className={`flex flex-col items-center justify-center text-sm p-2 rounded-lg transition-all duration-200 ease-in-out min-w-0 flex-1 mx-1 ${
                            currentView === item.view
                                ? `${item.color} bg-gray-800/50 scale-105` // Styles pour l'élément sélectionné
                                : 'text-gray-400 hover:text-white hover:bg-gray-800/30' // Styles pour les éléments non sélectionnés
                        }`}
                    >
                        <item.icon className={`h-6 w-6 sm:h-7 sm:w-7 mb-1 ${
                            currentView === item.view ? 'scale-110' : '' // Animation d'échelle pour l'icône sélectionnée
                        } transition-transform duration-200`} />
                        <span className={`text-xs sm:text-sm font-medium leading-tight text-center ${
                            currentView === item.view ? 'font-semibold' : '' // Texte en gras pour l'élément sélectionné
                        }`}>
                            {item.name}
                        </span>
                        {/* Indicateur visuel sous l'élément sélectionné */}
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